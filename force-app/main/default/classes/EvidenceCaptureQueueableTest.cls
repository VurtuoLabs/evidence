/**
 * EvidenceCaptureQueueableTest
 * The asynchronous write path (CONTRACT.md 9.3, 13).
 *
 * The Queueable processes exactly one chain per link and does not chain further in
 * a test. Enqueuing a single-agent batch and running Test.startTest/stopTest must
 * therefore write both the Decision_Ledger__b links and the Decision_Record__c
 * index rows, with contiguous, gap-free positions.
 */
@IsTest
private class EvidenceCaptureQueueableTest {
    private static final String AGENT = 'Claims_Triage';

    private static String chainKey() {
        return UserInfo.getOrganizationId() + ':' + AGENT;
    }

    private static void seedConfig() {
        Evidence_Setting__mdt s = new Evidence_Setting__mdt();
        s.Canonical_Version__c = 1;
        s.Default_Retention_Days__c = 30;
        s.Capture_Enabled__c = true;
        EvidenceConfigurationService.settingCache = s;
        EvidenceConfigurationService.consequenceRuleCache = new List<Evidence_Consequence_Rule__mdt>();
    }

    @IsTest
    static void queueableWritesLedgerAndIndexGapFree() {
        seedConfig();
        List<Evidence_Turn__e> turns = new List<Evidence_Turn__e>{
            EvidenceTestFactory.turn(AGENT, 'LK-Q-0'),
            EvidenceTestFactory.turn(AGENT, 'LK-Q-1'),
            EvidenceTestFactory.turn(AGENT, 'LK-Q-2')
        };

        Test.startTest();
        System.enqueueJob(new EvidenceCaptureQueueable(turns));
        Test.stopTest();

        List<Decision_Ledger__b> ledger = EvidenceLedgerStore.chain(chainKey());
        Assert.areEqual(3, ledger.size(), 'Every turn must produce a ledger link.');
        for (Integer i = 0; i < ledger.size(); i++) {
            Assert.areEqual(i, (Integer) ledger[i].Chain_Position__c, 'Positions must be gap-free.');
        }
        // Continuity: each link chains onto the previous one's hash.
        Assert.areEqual(ledger[0].This_Hash__c, ledger[1].Prior_Hash__c, 'Link 1 must chain onto link 0.');
        Assert.areEqual(ledger[1].This_Hash__c, ledger[2].Prior_Hash__c, 'Link 2 must chain onto link 1.');

        List<Decision_Record__c> index = [
            SELECT Chain_Position__c
            FROM Decision_Record__c
            WHERE Agent_API_Name__c = :AGENT
            ORDER BY Chain_Position__c ASC
        ];
        Assert.areEqual(3, index.size(), 'An index row must be written per ledger link.');
    }

    @IsTest
    static void emptyBatchIsANoOp() {
        seedConfig();
        Test.startTest();
        System.enqueueJob(new EvidenceCaptureQueueable(new List<Evidence_Turn__e>()));
        Test.stopTest();

        Assert.areEqual(
            0,
            EvidenceLedgerStore.chain(chainKey()).size(),
            'An empty batch writes nothing.'
        );
    }
}
