/**
 * EvidenceRetentionService
 * Hold-aware purge honoring Evidence_Retention_Policy__mdt.
 *
 * Per CONTRACT.md 5.3 and 9.2:
 *   - Deletion of the Big Object ledger is Database.deleteImmediate, used only by
 *     this job, and blocked entirely while a matching Legal_Hold__c is active.
 *   - Where a policy specifies Redact_Body_Keep_Hash, the Canonical_Body__c is
 *     cleared but This_Hash__c/Prior_Hash__c stay in place, so the chain still
 *     verifies (EvidenceChainService.verify skips recomputation of redacted rows).
 *
 * Requires Evidence_Manage_Retention.
 */
public with sharing class EvidenceRetentionService {
    private static final String PERM_MANAGE = 'Evidence_Manage_Retention';
    private static final String STRATEGY_REDACT = 'Redact_Body_Keep_Hash';
    private static final String STRATEGY_DELETE = 'Delete';

    /** Outcome of a purge pass. */
    public class PurgeResult {
        @AuraEnabled
        public Integer examined = 0;
        @AuraEnabled
        public Integer deleted = 0;
        @AuraEnabled
        public Integer redacted = 0;
        @AuraEnabled
        public Integer skippedHeld = 0;
        @AuraEnabled
        public Integer skippedNoPolicy = 0;
    }

    /**
     * Purge up to batchSize expired decisions, skipping anything under legal hold.
     * @param batchSize the maximum number of expired index rows to examine
     * @return counts of what happened
     */
    public static PurgeResult purge(Integer batchSize) {
        requireManage();
        Integer limitRows = (batchSize == null || batchSize <= 0) ? 200 : Math.min(batchSize, 2000);
        PurgeResult result = new PurgeResult();

        Map<String, Evidence_Retention_Policy__mdt> policyByConsequence = policyByConsequence();

        List<Decision_Record__c> candidates = [
            SELECT
                Id,
                Ledger_Key__c,
                Agent_API_Name__c,
                Chain_Position__c,
                Consequence_Level__c,
                Redaction_State__c,
                Under_Legal_Hold__c
            FROM Decision_Record__c
            WHERE Retention_Expires_At__c <= :System.today() AND Redaction_State__c != 'Purged'
            WITH USER_MODE
            ORDER BY Retention_Expires_At__c ASC
            LIMIT :limitRows
        ];

        List<Decision_Ledger__b> toDelete = new List<Decision_Ledger__b>();
        List<Decision_Ledger__b> toRedact = new List<Decision_Ledger__b>();
        List<Decision_Record__c> indexUpdates = new List<Decision_Record__c>();
        List<Decision_Record__c> indexDeletes = new List<Decision_Record__c>();

        for (Decision_Record__c rec : candidates) {
            result.examined++;

            if (EvidenceLegalHoldService.isHeld(rec.Ledger_Key__c)) {
                result.skippedHeld++;
                if (rec.Under_Legal_Hold__c != true) {
                    rec.Under_Legal_Hold__c = true;
                    indexUpdates.add(rec);
                }
                continue;
            }

            Evidence_Retention_Policy__mdt policy = policyByConsequence.get(rec.Consequence_Level__c);
            if (policy == null) {
                result.skippedNoPolicy++;
                continue;
            }

            Decision_Ledger__b ledgerRow = loadLedgerRow(
                rec.Agent_API_Name__c,
                rec.Chain_Position__c,
                rec.Ledger_Key__c
            );
            if (ledgerRow == null) {
                continue;
            }

            if (STRATEGY_REDACT.equalsIgnoreCase(policy.Purge_Strategy__c)) {
                // Keep the hash; clear the body. The chain still verifies.
                ledgerRow.Canonical_Body__c = null;
                toRedact.add(ledgerRow);
                rec.Redaction_State__c = 'Body_Redacted';
                rec.Subject_Reference__c = null;
                indexUpdates.add(rec);
                result.redacted++;
            } else if (STRATEGY_DELETE.equalsIgnoreCase(policy.Purge_Strategy__c)) {
                toDelete.add(ledgerRow);
                indexDeletes.add(rec);
                result.deleted++;
            } else {
                result.skippedNoPolicy++;
            }
        }

        applyChanges(toDelete, toRedact, indexUpdates, indexDeletes);
        return result;
    }

    // ---- internal ----------------------------------------------------------

    private static void applyChanges(
        List<Decision_Ledger__b> toDelete,
        List<Decision_Ledger__b> toRedact,
        List<Decision_Record__c> indexUpdates,
        List<Decision_Record__c> indexDeletes
    ) {
        // Big Object mutation is immediate; redaction is an upsert of the same
        // index row (Chain_Key/Position/Ledger_Key), deletion is deleteImmediate.
        if (!toRedact.isEmpty()) {
            EvidenceLedgerStore.insertLedger(toRedact);
        }
        if (!toDelete.isEmpty()) {
            EvidenceLedgerStore.deleteLedger(toDelete);
        }
        if (!indexUpdates.isEmpty()) {
            update as user indexUpdates;
        }
        if (!indexDeletes.isEmpty()) {
            delete as user indexDeletes;
        }
    }

    private static Map<String, Evidence_Retention_Policy__mdt> policyByConsequence() {
        Map<String, Evidence_Retention_Policy__mdt> byLevel = new Map<String, Evidence_Retention_Policy__mdt>();
        for (Evidence_Retention_Policy__mdt policy : EvidenceConfigurationService.getRetentionPolicies()) {
            if (String.isNotBlank(policy.Consequence_Level__c)) {
                byLevel.put(policy.Consequence_Level__c, policy);
            }
        }
        return byLevel;
    }

    private static Decision_Ledger__b loadLedgerRow(String agentApiName, Decimal position, String ledgerKey) {
        String chainKey = UserInfo.getOrganizationId() + ':' + agentApiName;
        return EvidenceLedgerStore.atPosition(chainKey, position, ledgerKey);
    }

    private static void requireManage() {
        if (!FeatureManagement.checkPermission(PERM_MANAGE)) {
            throw new EvidenceException('You do not have permission to manage retention.');
        }
    }
}
