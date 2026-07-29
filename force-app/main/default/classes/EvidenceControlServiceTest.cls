/**
 * EvidenceControlServiceTest
 * The regulatory control mapping (CONTRACT.md 7, 9.2, 13).
 *
 * getMappings surfaces Evidence_Control_Mapping__mdt sorted by framework then
 * reference; evidenceFor resolves a control's stored query, overlays the caller's
 * window, and delegates to EvidenceLedgerService so redaction applies. Mappings are
 * injected into the configuration cache; evidenceFor runs as an Evidence_Auditor so
 * the delegated ledger read is permitted and sees the seeded record.
 */
@IsTest
private class EvidenceControlServiceTest {
    private static final String AGENT = 'Claims_Triage';

    private static void seedMappings() {
        EvidenceConfigurationService.controlMappingCache = new List<Evidence_Control_Mapping__mdt>{
            new Evidence_Control_Mapping__mdt(
                Control_Key__c = 'EU_AI_ACT_ART12',
                Framework__c = 'EU AI Act',
                Control_Reference__c = 'Art. 12',
                Control_Label__c = 'Record-keeping',
                Satisfied_By__c = 'Hash-chained ledger',
                Evidence_Query_JSON__c = '{"consequenceLevel":"High"}',
                Active__c = true
            ),
            new Evidence_Control_Mapping__mdt(
                Control_Key__c = 'SOC2_CC7',
                Framework__c = 'SOC 2',
                Control_Reference__c = 'CC7.2',
                Control_Label__c = 'System monitoring',
                Satisfied_By__c = 'Chain verification',
                Evidence_Query_JSON__c = null,
                Active__c = true
            )
        };
    }

    @IsTest
    static void getMappingsReturnsSortedViews() {
        seedMappings();
        Test.startTest();
        List<EvidenceControlService.ControlMappingView> views = EvidenceControlService.getMappings();
        Test.stopTest();

        Assert.areEqual(2, views.size(), 'Both active mappings must be returned.');
        // Sorted by framework: 'EU AI Act' precedes 'SOC 2'.
        Assert.areEqual('EU_AI_ACT_ART12', views[0].controlKey, 'Mappings sort by framework then reference.');
        Assert.areEqual('EU AI Act', views[0].framework);
        Assert.areEqual('Art. 12', views[0].controlReference);
        Assert.areEqual('SOC2_CC7', views[1].controlKey);
    }

    @IsTest
    static void evidenceForResolvesStoredQueryAndWindow() {
        seedMappings();
        User auditor = EvidenceTestSetup.userWith('Evidence_Auditor');

        Decision_Record__c high = EvidenceTestFactory.decisionRecord(AGENT, 'LK-CTRL-HIGH');
        high.Consequence_Level__c = 'High';
        high.Occurred_At__c = Datetime.newInstanceGmt(2026, 6, 1, 0, 0, 0);
        Decision_Record__c low = EvidenceTestFactory.decisionRecord(AGENT, 'LK-CTRL-LOW');
        low.Consequence_Level__c = 'Low';
        low.Occurred_At__c = Datetime.newInstanceGmt(2026, 6, 1, 0, 0, 0);
        insert new List<Decision_Record__c>{ high, low };

        Test.startTest();
        System.runAs(auditor) {
            List<EvidenceLedgerService.DecisionView> views = EvidenceControlService.evidenceFor(
                'EU_AI_ACT_ART12',
                Datetime.newInstanceGmt(2026, 1, 1, 0, 0, 0),
                Datetime.newInstanceGmt(2026, 12, 31, 0, 0, 0)
            );
            // The stored query narrows to High consequence, so only the High row matches.
            Assert.areEqual(1, views.size(), 'Only the High-consequence decision satisfies the control query.');
            Assert.areEqual('LK-CTRL-HIGH', views[0].ledgerKey);
        }
        Test.stopTest();
    }

    @IsTest
    static void evidenceForUnknownControlThrows() {
        seedMappings();
        User auditor = EvidenceTestSetup.userWith('Evidence_Auditor');
        Test.startTest();
        System.runAs(auditor) {
            try {
                EvidenceControlService.evidenceFor('NOT_A_CONTROL', null, null);
                Assert.fail('An unknown control key must throw.');
            } catch (EvidenceException e) {
                Assert.isTrue(e.getMessage().contains('No control mapping'), e.getMessage());
            }
        }
        Test.stopTest();
    }
}
