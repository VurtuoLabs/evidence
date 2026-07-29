/**
 * EvidenceRetentionBatchTest
 * The nightly hold-aware purge driver (CONTRACT.md 5.3, 9.2, 10.2, 13).
 *
 * The batch delegates each chunk to EvidenceRetentionService.purge, so this test
 * confirms the driver applies the configured Redact_Body_Keep_Hash strategy to
 * expired rows. It runs as an Evidence_Custodian (purge enforces
 * Evidence_Manage_Retention inside the service).
 */
@IsTest
private class EvidenceRetentionBatchTest {
    private static final String AGENT = 'Claims_Triage';
    private static final Integer LINKS = 3;

    private static String chainKey() {
        return UserInfo.getOrganizationId() + ':' + AGENT;
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

    private static void seedExpiredChain() {
        List<Decision_Ledger__b> ledger = new List<Decision_Ledger__b>();
        List<Decision_Record__c> index = new List<Decision_Record__c>();
        Datetime base = Datetime.newInstanceGmt(2020, 1, 1, 0, 0, 0);
        String priorHash = '';
        for (Integer i = 0; i < LINKS; i++) {
            Datetime occ = base.addSeconds(i);
            String ledgerKey = 'LK-RB-' + i;
            Map<String, Object> body = new Map<String, Object>{ 'agentApiName' => AGENT, 'occurredAt' => occ };
            String canon = EvidenceCanonicalizer.canonicalize(body, 1);

            EvidenceChainService.ChainInput ci = new EvidenceChainService.ChainInput();
            ci.priorHash = priorHash;
            ci.ledgerKey = ledgerKey;
            ci.agentApiName = AGENT;
            ci.occurredAt = occ;
            ci.canonicalBody = canon;
            String thisHash = EvidenceChainService.computeHash(ci);

            Decision_Ledger__b row = new Decision_Ledger__b();
            row.Chain_Key__c = chainKey();
            row.Chain_Position__c = i;
            row.Ledger_Key__c = ledgerKey;
            row.Occurred_At__c = occ;
            row.Canonical_Body__c = canon;
            row.Canonical_Version__c = 1;
            row.This_Hash__c = thisHash;
            row.Prior_Hash__c = priorHash;
            ledger.add(row);

            Decision_Record__c rec = EvidenceTestFactory.decisionRecord(AGENT, ledgerKey);
            rec.Occurred_At__c = occ;
            rec.Chain_Position__c = i;
            rec.Consequence_Level__c = 'Low';
            rec.Redaction_State__c = 'None';
            rec.Retention_Expires_At__c = System.today().addDays(-1);
            index.add(rec);

            priorHash = thisHash;
        }
        EvidenceLedgerStore.insertLedger(ledger);
        insert index;
    }

    @IsTest
    static void batchRedactsExpiredRows() {
        seedPolicies();
        User custodian = EvidenceTestSetup.userWith('Evidence_Custodian');
        seedExpiredChain();

        Test.startTest();
        System.runAs(custodian) {
            Database.executeBatch(new EvidenceRetentionBatch(), 200);
        }
        Test.stopTest();

        List<Decision_Record__c> index = [
            SELECT Redaction_State__c, Subject_Reference__c
            FROM Decision_Record__c
            WHERE Agent_API_Name__c = :AGENT
        ];
        Assert.areEqual(LINKS, index.size());
        for (Decision_Record__c rec : index) {
            Assert.areEqual('Body_Redacted', rec.Redaction_State__c, 'The batch must apply the redact strategy.');
            Assert.isNull(rec.Subject_Reference__c, 'Subject reference must be cleared.');
        }

        // Bodies cleared, hashes preserved, chain still verifies.
        Chain_Verification__c v = EvidenceChainService.verify(chainKey(), 0, LINKS - 1);
        Assert.areEqual('Intact', v.Result__c, 'A redacted-body chain still verifies as intact.');
    }
}
