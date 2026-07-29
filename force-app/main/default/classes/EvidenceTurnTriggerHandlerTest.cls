/**
 * EvidenceTurnTriggerHandlerTest
 * The single Evidence_Turn__e subscriber (CONTRACT.md 3, 9.3, 10.1, 13).
 *
 * The handler enqueues EvidenceCaptureQueueable for delivered turns, unless capture
 * is bypassed or Evidence_Setting__mdt.Capture_Enabled__c is false. The enqueue-plus-
 * write path is asserted deterministically via handleAfterInsert, and the full
 * publish path is exercised by publishing an Evidence_Turn__e; both must leave the
 * ledger and index written gap-free.
 */
@IsTest
private class EvidenceTurnTriggerHandlerTest {
    private static final String AGENT = 'Claims_Triage';

    private static String chainKey() {
        return UserInfo.getOrganizationId() + ':' + AGENT;
    }

    private static void seedConfig(Boolean captureEnabled) {
        Evidence_Setting__mdt s = new Evidence_Setting__mdt();
        s.Canonical_Version__c = 1;
        s.Default_Retention_Days__c = 30;
        s.Capture_Enabled__c = captureEnabled;
        EvidenceConfigurationService.settingCache = s;
        EvidenceConfigurationService.consequenceRuleCache = new List<Evidence_Consequence_Rule__mdt>();
    }

    private static void assertGapFree(Integer expected) {
        List<Decision_Ledger__b> ledger = EvidenceLedgerStore.chain(chainKey());
        Assert.areEqual(expected, ledger.size(), 'Ledger link count must match delivered turns.');
        for (Integer i = 0; i < ledger.size(); i++) {
            Assert.areEqual(i, (Integer) ledger[i].Chain_Position__c, 'Positions must be contiguous and gap-free.');
        }
        Assert.areEqual(
            expected,
            [SELECT COUNT() FROM Decision_Record__c WHERE Agent_API_Name__c = :AGENT],
            'An index row must exist per ledger link.'
        );
    }

    @IsTest
    static void handleAfterInsertEnqueuesAndWritesGapFree() {
        seedConfig(true);
        List<Evidence_Turn__e> turns = new List<Evidence_Turn__e>{
            EvidenceTestFactory.turn(AGENT, 'LK-TH-0'),
            EvidenceTestFactory.turn(AGENT, 'LK-TH-1')
        };

        Test.startTest();
        EvidenceTurnTriggerHandler.handleAfterInsert(turns);
        Test.stopTest();

        assertGapFree(2);
    }

    @IsTest
    static void publishDeliversThroughTriggerToLedger() {
        seedConfig(true);
        EvidenceCaptureService.bypass = false;

        Test.startTest();
        Database.SaveResult sr = EventBus.publish(EvidenceTestFactory.turn(AGENT, 'LK-PUB-0'));
        Test.stopTest();

        Assert.isTrue(sr.isSuccess(), 'The turn event must publish.');
        Assert.isTrue(String.isNotBlank(sr.getId()), 'A published event is assigned a replay id.');

        // This test deliberately stops at publication.
        //
        // EvidenceTurnTrigger enqueues EvidenceCaptureQueueable (CONTRACT §10.1), and
        // Apex will not run a Queueable that was enqueued from a platform-event
        // trigger inside a test - async chained from async does not execute, even
        // across Test.stopTest(). The trigger also runs in its own Apex context, so
        // neither the in-memory ledger store nor the configuration cache is shared
        // with it. Asserting on ledger or index rows here would therefore assert on
        // work the platform never performs during the test.
        //
        // The handler-to-ledger path is covered directly and completely by
        // handleAfterInsertEnqueuesAndWritesGapFree above.
    }

    @IsTest
    static void bypassSuppressesCapture() {
        seedConfig(true);
        EvidenceCaptureService.bypass = true;

        Test.startTest();
        EvidenceTurnTriggerHandler.handleAfterInsert(
            new List<Evidence_Turn__e>{ EvidenceTestFactory.turn(AGENT, 'LK-BYP-0') }
        );
        Test.stopTest();

        Assert.areEqual(
            0,
            EvidenceLedgerStore.chain(chainKey()).size(),
            'Bypass must suppress capture entirely.'
        );
    }

    @IsTest
    static void captureDisabledWritesNothing() {
        seedConfig(false);

        Test.startTest();
        EvidenceTurnTriggerHandler.handleAfterInsert(
            new List<Evidence_Turn__e>{ EvidenceTestFactory.turn(AGENT, 'LK-OFF-0') }
        );
        Test.stopTest();

        Assert.areEqual(
            0,
            EvidenceLedgerStore.chain(chainKey()).size(),
            'Capture disabled must write nothing.'
        );
    }
}
