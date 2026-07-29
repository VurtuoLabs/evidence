/**
 * EvidenceCaptureServiceTest
 * The write path: classify, canonicalize, chain, append (CONTRACT.md 9.3, 13).
 *
 * Mandatory cases covered:
 *   - classify honors Evidence_Consequence_Rule__mdt priority (first match wins
 *     on a priority-sorted rule set)
 *   - capture writes both the Decision_Ledger__b link and the Decision_Record__c
 *     index row
 *   - concurrent capture across two chains produces gap-free positions in both
 */
@IsTest
private class EvidenceCaptureServiceTest {
    private static final String AGENT_A = 'Claims_Triage';
    private static final String AGENT_B = 'Billing';

    private static void seedDefaultSetting() {
        Evidence_Setting__mdt s = new Evidence_Setting__mdt();
        s.Canonical_Version__c = 1;
        s.Default_Retention_Days__c = 30;
        EvidenceConfigurationService.settingCache = s;
    }

    private static Evidence_Turn__e turn(String agent, String ledgerKey, String actions) {
        return new Evidence_Turn__e(
            Agent_API_Name__c = agent,
            Agent_Version__c = 'v1',
            Ledger_Key__c = ledgerKey,
            Occurred_At__c = Datetime.newInstanceGmt(2026, 1, 1, 0, 0, 0),
            Actions_Invoked__c = actions,
            Subject_Reference__c = 'Claim#123',
            Subject_Object__c = 'Claim'
        );
    }

    @IsTest
    static void classifyHonorsPriority() {
        // Two rules both match 'Issue_Payment'. The list is priority-sorted
        // ascending (as EvidenceConfigurationService.getConsequenceRules returns
        // it), so the first match - the highest priority - must win.
        EvidenceConfigurationService.consequenceRuleCache = new List<Evidence_Consequence_Rule__mdt>{
            new Evidence_Consequence_Rule__mdt(
                Rule_Key__c = 'high_issue',
                Match_Strategy__c = 'Action_Name',
                Match_Value__c = 'Issue_',
                Consequence_Level__c = 'High',
                Priority__c = 1,
                Active__c = true
            ),
            new Evidence_Consequence_Rule__mdt(
                Rule_Key__c = 'medium_issue',
                Match_Strategy__c = 'Action_Name',
                Match_Value__c = 'Issue_',
                Consequence_Level__c = 'Medium',
                Priority__c = 5,
                Active__c = true
            )
        };

        EvidenceCaptureService.ConsequenceResult r = EvidenceCaptureService.classify(
            turn(AGENT_A, 'LK-1', 'Issue_Payment')
        );
        Assert.areEqual('High', r.consequenceLevel, 'Highest-priority matching rule must win.');
        Assert.areEqual('high_issue', r.matchedRuleKey);
    }

    @IsTest
    static void classifyStrategiesAndAutonomy() {
        EvidenceConfigurationService.consequenceRuleCache = new List<Evidence_Consequence_Rule__mdt>{
            new Evidence_Consequence_Rule__mdt(
                Rule_Key__c = 'amount',
                Match_Strategy__c = 'Amount_Threshold',
                Match_Value__c = '1000',
                Consequence_Level__c = 'High',
                Priority__c = 1,
                Active__c = true
            ),
            new Evidence_Consequence_Rule__mdt(
                Rule_Key__c = 'policy',
                Match_Strategy__c = 'Policy_Blocked',
                Consequence_Level__c = 'Medium',
                Priority__c = 2,
                Active__c = true
            )
        };

        // Amount over threshold classifies High.
        EvidenceCaptureService.ConsequenceResult big = EvidenceCaptureService.classify(
            turn(AGENT_A, 'LK-2', 'Issue_Payment amount 5000')
        );
        Assert.areEqual('High', big.consequenceLevel, 'An amount over threshold is High consequence.');

        // Autonomy is derived: approver present -> Human_Approved. These values are
        // written to Decision_Record__c.Autonomy_Level__c and must match its value
        // set exactly (Autonomous / Human_Approved / Escalated).
        Evidence_Turn__e approved = turn(AGENT_A, 'LK-3', 'Read_Only');
        approved.Approver_Id__c = UserInfo.getUserId();
        Assert.areEqual('Human_Approved', EvidenceCaptureService.classify(approved).autonomyLevel);

        // Nothing matches -> default Low, Autonomous.
        Evidence_Turn__e plain = turn(AGENT_A, 'LK-4', 'Read_Only');
        EvidenceCaptureService.ConsequenceResult low = EvidenceCaptureService.classify(plain);
        Assert.areEqual('Low', low.consequenceLevel);
        Assert.areEqual('Autonomous', low.autonomyLevel);
    }

    @IsTest
    static void writeAppendsLedgerAndIndex() {
        seedDefaultSetting();
        EvidenceConfigurationService.consequenceRuleCache = new List<Evidence_Consequence_Rule__mdt>();

        List<Evidence_Turn__e> turns = new List<Evidence_Turn__e>{
            turn(AGENT_A, 'LK-A-0', 'Read'),
            turn(AGENT_A, 'LK-A-1', 'Read')
        };

        Test.startTest();
        Integer written = EvidenceCaptureService.write(turns);
        Test.stopTest();

        Assert.areEqual(2, written, 'Both turns must produce ledger links.');

        List<Decision_Ledger__b> ledger = EvidenceLedgerStore.chain(chainKey(AGENT_A));
        Assert.areEqual(2, ledger.size(), 'Two ledger rows must be written.');
        Assert.areEqual(0, (Integer) ledger[0].Chain_Position__c);
        Assert.areEqual(1, (Integer) ledger[1].Chain_Position__c);
        // Position 1 must chain onto position 0's hash.
        Assert.areEqual(
            ledger[0].This_Hash__c,
            ledger[1].Prior_Hash__c,
            'Links must chain in memory across the batch.'
        );

        List<Decision_Record__c> index = [
            SELECT Ledger_Key__c, Chain_Position__c
            FROM Decision_Record__c
            WHERE Agent_API_Name__c = :AGENT_A
            WITH USER_MODE
        ];
        Assert.areEqual(2, index.size(), 'An index row must be written per ledger link.');

        // Empty/null input is a no-op.
        Assert.areEqual(0, EvidenceCaptureService.write(null));
        Assert.areEqual(0, EvidenceCaptureService.write(new List<Evidence_Turn__e>()));
    }

    @IsTest
    static void concurrentCaptureAcrossTwoChainsIsGapFree() {
        seedDefaultSetting();
        EvidenceConfigurationService.consequenceRuleCache = new List<Evidence_Consequence_Rule__mdt>();

        // Interleave two chains in a single write() call.
        List<Evidence_Turn__e> turns = new List<Evidence_Turn__e>{
            turn(AGENT_A, 'LK-A-0', 'Read'),
            turn(AGENT_B, 'LK-B-0', 'Read'),
            turn(AGENT_A, 'LK-A-1', 'Read'),
            turn(AGENT_B, 'LK-B-1', 'Read'),
            turn(AGENT_A, 'LK-A-2', 'Read')
        };

        Test.startTest();
        EvidenceCaptureService.write(turns);
        Test.stopTest();

        assertGapFree(AGENT_A, 3);
        assertGapFree(AGENT_B, 2);
    }

    private static void assertGapFree(String agent, Integer expectedCount) {
        List<Decision_Ledger__b> rows = EvidenceLedgerStore.chain(chainKey(agent));
        Assert.areEqual(expectedCount, rows.size(), 'Chain ' + agent + ' must have every link.');
        for (Integer i = 0; i < rows.size(); i++) {
            Assert.areEqual(
                i,
                (Integer) rows[i].Chain_Position__c,
                'Positions must be contiguous and gap-free for ' + agent
            );
        }
    }

    private static String chainKey(String agent) {
        return UserInfo.getOrganizationId() + ':' + agent;
    }
}
