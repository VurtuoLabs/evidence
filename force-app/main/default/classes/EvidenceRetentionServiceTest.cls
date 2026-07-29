/**
 * EvidenceRetentionServiceTest
 * Hold-aware purge honoring Evidence_Retention_Policy__mdt (CONTRACT.md 5.3, 9.2, 13).
 *
 * Mandatory cases:
 *   - purge honors the retention policy (Redact_Body_Keep_Hash vs Delete)
 *   - it skips rows under an active legal hold
 *   - Redact_Body_Keep_Hash clears Canonical_Body__c but preserves the hashes so
 *     the chain still verifies; the index flips to Redaction_State__c 'Body_Redacted'
 *
 * Runs as an Evidence_Custodian (holds Evidence_Manage_Retention). Retention
 * policies are injected into the configuration cache so the test does not depend on
 * seeded org metadata.
 */
@IsTest
private class EvidenceRetentionServiceTest {
    private static final String REDACT_AGENT = 'Claims_Triage';
    private static final String HELD_AGENT = 'Billing';
    private static final Integer REDACT_LINKS = 3;

    private static String chainKey(String agent) {
        return UserInfo.getOrganizationId() + ':' + agent;
    }

    private static void seedPolicies() {
        EvidenceConfigurationService.retentionPolicyCache = new List<Evidence_Retention_Policy__mdt>{
            new Evidence_Retention_Policy__mdt(
                Policy_Key__c = 'low_redact',
                Consequence_Level__c = 'Low',
                Retention_Days__c = 30,
                Purge_Strategy__c = 'Redact_Body_Keep_Hash',
                Active__c = true
            )
        };
    }

    /** A correctly-chained ledger + index for an agent, all expired. */
    private static void seedExpiredChain(String agent, Integer links) {
        List<Decision_Ledger__b> ledger = new List<Decision_Ledger__b>();
        List<Decision_Record__c> index = new List<Decision_Record__c>();
        Datetime base = Datetime.newInstanceGmt(2020, 1, 1, 0, 0, 0);
        String priorHash = '';
        for (Integer i = 0; i < links; i++) {
            Datetime occ = base.addSeconds(i);
            String ledgerKey = 'LK-' + agent + '-' + i;
            Map<String, Object> body = new Map<String, Object>{ 'agentApiName' => agent, 'occurredAt' => occ };
            String canon = EvidenceCanonicalizer.canonicalize(body, 1);

            EvidenceChainService.ChainInput ci = new EvidenceChainService.ChainInput();
            ci.priorHash = priorHash;
            ci.ledgerKey = ledgerKey;
            ci.agentApiName = agent;
            ci.occurredAt = occ;
            ci.canonicalBody = canon;
            String thisHash = EvidenceChainService.computeHash(ci);

            Decision_Ledger__b row = new Decision_Ledger__b();
            row.Chain_Key__c = chainKey(agent);
            row.Chain_Position__c = i;
            row.Ledger_Key__c = ledgerKey;
            row.Occurred_At__c = occ;
            row.Canonical_Body__c = canon;
            row.Canonical_Version__c = 1;
            row.This_Hash__c = thisHash;
            row.Prior_Hash__c = priorHash;
            ledger.add(row);

            Decision_Record__c rec = EvidenceTestFactory.decisionRecord(agent, ledgerKey);
            rec.Occurred_At__c = occ;
            rec.Chain_Position__c = i;
            rec.This_Hash__c = thisHash;
            rec.Prior_Hash__c = priorHash;
            rec.Consequence_Level__c = 'Low';
            rec.Redaction_State__c = 'None';
            rec.Retention_Expires_At__c = System.today().addDays(-1); // expired
            index.add(rec);

            priorHash = thisHash;
        }
        EvidenceLedgerStore.insertLedger(ledger);
        insert index;
    }

    @IsTest
    static void purgeRedactsExpiredSkipsHeldAndKeepsChainVerifiable() {
        seedPolicies();
        User custodian = EvidenceTestSetup.userWith('Evidence_Custodian');
        seedExpiredChain(REDACT_AGENT, REDACT_LINKS);
        seedExpiredChain(HELD_AGENT, 1);

        // A scoped, active hold covers only HELD_AGENT.
        Legal_Hold__c hold = EvidenceTestFactory.legalHoldForAgent('Matter-Held', HELD_AGENT);
        insert hold;

        Test.startTest();
        EvidenceRetentionService.PurgeResult result;
        System.runAs(custodian) {
            result = EvidenceRetentionService.purge(100);
        }
        Test.stopTest();

        Assert.areEqual(REDACT_LINKS, result.redacted, 'Every expired REDACT_AGENT row must be redacted.');
        Assert.areEqual(1, result.skippedHeld, 'The held row must be skipped.');

        // The redacted index rows carry Body_Redacted and have their subject cleared.
        List<Decision_Record__c> redacted = [
            SELECT Redaction_State__c, Subject_Reference__c
            FROM Decision_Record__c
            WHERE Agent_API_Name__c = :REDACT_AGENT
        ];
        Assert.areEqual(REDACT_LINKS, redacted.size());
        for (Decision_Record__c rec : redacted) {
            Assert.areEqual(
                'Body_Redacted',
                rec.Redaction_State__c,
                'Strategy Redact_Body_Keep_Hash sets Body_Redacted.'
            );
            Assert.isNull(rec.Subject_Reference__c, 'Subject reference must be cleared on redaction.');
        }

        // The held row is untouched.
        Decision_Record__c heldRow = [
            SELECT Redaction_State__c, Under_Legal_Hold__c
            FROM Decision_Record__c
            WHERE Agent_API_Name__c = :HELD_AGENT
            LIMIT 1
        ];
        Assert.areNotEqual('Body_Redacted', heldRow.Redaction_State__c, 'A held row is not redacted.');
        Assert.isTrue(heldRow.Under_Legal_Hold__c, 'A skipped-held row is flagged under legal hold.');

        // Body is gone but the hash chain still verifies (continuity intact).
        List<Decision_Ledger__b> ledger = EvidenceLedgerStore.chain(chainKey(REDACT_AGENT));
        for (Decision_Ledger__b row : ledger) {
            Assert.isTrue(String.isBlank(row.Canonical_Body__c), 'Canonical body must be cleared.');
            Assert.isNotNull(row.This_Hash__c, 'The hash must be preserved.');
        }
        Chain_Verification__c v = EvidenceChainService.verify(chainKey(REDACT_AGENT), 0, REDACT_LINKS - 1);
        Assert.areEqual('Intact', v.Result__c, 'A redacted-body chain still verifies as intact.');
    }

    @IsTest
    static void purgeWithoutPermissionIsRefused() {
        seedPolicies();
        User analyst = EvidenceTestSetup.userWith('Evidence_Analyst'); // lacks Manage Retention
        Test.startTest();
        System.runAs(analyst) {
            try {
                EvidenceRetentionService.purge(10);
                Assert.fail('An Analyst cannot run retention.');
            } catch (EvidenceException e) {
                Assert.isTrue(e.getMessage().contains('permission'), e.getMessage());
            }
        }
        Test.stopTest();
    }
}
