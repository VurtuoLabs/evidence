/**
 * EvidenceCompletenessServiceTest
 * The detective control (CONTRACT.md 6.4): reconcile index vs. ledger per agent.
 *
 * A matched day reconciles within tolerance; a day where index and ledger counts
 * diverge beyond tolerance raises a gap finding. No permission gate, so these run
 * as the (fully-privileged) test-running user.
 */
@IsTest
private class EvidenceCompletenessServiceTest {
    private static final String AGENT = 'Claims_Triage';
    private static final Date DAY = Date.newInstance(2026, 1, 1);
    private static final Datetime DAY_START = Datetime.newInstanceGmt(2026, 1, 1, 1, 0, 0);

    private static String chainKey() {
        return UserInfo.getOrganizationId() + ':' + AGENT;
    }

    private static void insertIndexRows(Integer n) {
        List<Decision_Record__c> rows = new List<Decision_Record__c>();
        for (Integer i = 0; i < n; i++) {
            rows.add(
                new Decision_Record__c(
                    Ledger_Key__c = 'LK-IDX-' + i,
                    Agent_API_Name__c = AGENT,
                    Occurred_At__c = DAY_START,
                    Chain_Position__c = i,
                    Consequence_Level__c = 'Low',
                    Redaction_State__c = 'None',
                    Under_Legal_Hold__c = false
                )
            );
        }
        insert rows;
    }

    private static void insertLedgerRows(Integer n) {
        List<Decision_Ledger__b> rows = new List<Decision_Ledger__b>();
        for (Integer i = 0; i < n; i++) {
            Decision_Ledger__b row = new Decision_Ledger__b();
            row.Chain_Key__c = chainKey();
            row.Chain_Position__c = i;
            row.Ledger_Key__c = 'LK-LDG-' + i;
            row.Occurred_At__c = DAY_START;
            row.This_Hash__c = 'h' + i;
            row.Prior_Hash__c = i == 0 ? '' : 'h' + (i - 1);
            row.Canonical_Version__c = 1;
            rows.add(row);
        }
        EvidenceLedgerStore.insertLedger(rows);
    }

    private static void zeroTolerance() {
        Evidence_Setting__mdt s = new Evidence_Setting__mdt();
        s.Completeness_Tolerance_Percent__c = 0;
        EvidenceConfigurationService.settingCache = s;
    }

    @IsTest
    static void reconcilesWithinToleranceWhenCountsMatch() {
        zeroTolerance();
        insertIndexRows(3);
        insertLedgerRows(3);

        Test.startTest();
        EvidenceCompletenessService.CompletenessResult result = EvidenceCompletenessService.reconcile(DAY);
        Test.stopTest();

        Assert.areEqual(DAY, result.checkedDate);
        Assert.areEqual(3, result.totalIndexCount);
        Assert.areEqual(3, result.totalLedgerCount);
        Assert.isFalse(result.gapDetected, 'Equal counts must reconcile within tolerance.');
        Assert.areEqual(1, result.agents.size(), 'One agent chain was reconciled.');
        Assert.isTrue(result.agents[0].withinTolerance);
    }

    @IsTest
    static void gapDetectedWhenCountsDiverge() {
        zeroTolerance();
        insertIndexRows(3);
        insertLedgerRows(2); // one ledger link short of the index

        Test.startTest();
        EvidenceCompletenessService.CompletenessResult result = EvidenceCompletenessService.reconcile(DAY);
        Test.stopTest();

        Assert.areEqual(3, result.totalIndexCount);
        Assert.areEqual(2, result.totalLedgerCount);
        Assert.isTrue(result.gapDetected, 'A count divergence beyond tolerance is a gap finding.');
        Assert.isTrue(result.message.contains('gap'), result.message);
    }

    @IsTest
    static void nullDateDefaultsToToday() {
        zeroTolerance();
        EvidenceCompletenessService.CompletenessResult result = EvidenceCompletenessService.reconcile(null);
        Assert.areEqual(System.today(), result.checkedDate, 'A null date reconciles today.');
    }
}
