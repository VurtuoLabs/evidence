/**
 * EvidenceLedgerServiceTest
 * The read facade over the decision index (CONTRACT.md 8.5, 8.6, 9.2, 13).
 *
 * Mandatory cases covered:
 *   - an index-incompatible search (position filter without an agent) throws
 *     EvidenceException rather than returning an empty list
 *   - the permission/redaction layer nulls Subject_Reference__c and the rationale
 *     statement when the caller lacks the matching custom permission
 *   - getDecisions / getDecision / getByLedgerKey happy paths for a fully
 *     permissioned caller
 *   - a caller without Evidence_View_Ledger is refused
 *
 * Users carry the System Administrator profile (so CRUD/FLS/record visibility is a
 * non-issue) plus exactly the Evidence permission set under test, so each assertion
 * is about the custom-permission gate itself.
 */
@IsTest
private class EvidenceLedgerServiceTest {
    private static final String AGENT = 'Claims_Triage';

    private static Decision_Record__c insertDecision(String ledgerKey) {
        Decision_Record__c rec = EvidenceTestFactory.decisionRecord(AGENT, ledgerKey);
        rec.Consequence_Level__c = 'High';
        rec.Outcome__c = 'Approved';
        rec.Chain_Position__c = 0;
        insert rec;
        return rec;
    }

    @IsTest
    static void indexIncompatibleSearchThrows() {
        User auditor = EvidenceTestSetup.userWith('Evidence_Auditor');
        EvidenceLedgerService.LedgerSearch s = new EvidenceLedgerService.LedgerSearch();
        s.fromPosition = 0L; // a position filter with no agentApiName cannot be served by the index

        Test.startTest();
        System.runAs(auditor) {
            try {
                EvidenceLedgerService.search(s);
                Assert.fail('A position filter without an agent must be rejected.');
            } catch (EvidenceException e) {
                Assert.isTrue(e.getMessage().contains('Index-incompatible'), e.getMessage());
            }
        }
        Test.stopTest();
    }

    @IsTest
    static void searchByAgentIsServiceable() {
        User auditor = EvidenceTestSetup.userWith('Evidence_Auditor');
        insertDecision('LK-SEARCH-0');

        Test.startTest();
        System.runAs(auditor) {
            EvidenceLedgerService.LedgerSearch s = new EvidenceLedgerService.LedgerSearch();
            s.agentApiName = AGENT;
            s.fromPosition = 0L;
            s.toPosition = 10L;
            List<EvidenceLedgerService.DecisionView> views = EvidenceLedgerService.search(s);
            Assert.areEqual(1, views.size(), 'The single agent decision must be returned.');
        }
        Test.stopTest();
    }

    @IsTest
    static void getDecisionsHappyPathShowsSubjectForPermittedCaller() {
        User investigator = EvidenceTestSetup.userWith('Evidence_Investigator');
        insertDecision('LK-HP-0');

        Test.startTest();
        System.runAs(investigator) {
            EvidenceLedgerService.LedgerQuery q = new EvidenceLedgerService.LedgerQuery();
            q.agentApiName = AGENT;
            List<EvidenceLedgerService.DecisionView> views = EvidenceLedgerService.getDecisions(q);
            Assert.areEqual(1, views.size());
            EvidenceLedgerService.DecisionView v = views[0];
            Assert.isFalse(v.subjectRedacted, 'An Investigator holds Evidence_View_Subject_Data.');
            Assert.isNotNull(v.subjectReference, 'Subject reference must be visible.');
            Assert.areEqual('LK-HP-0', v.ledgerKey);
        }
        Test.stopTest();
    }

    @IsTest
    static void getDecisionReturnsRedactedSubjectAndRationaleWithoutPermission() {
        // Analyst holds Evidence_View_Ledger only: subject data and rationale
        // must be nulled by the DTO re-check even though the sysadmin profile has FLS.
        User analyst = EvidenceTestSetup.userWith('Evidence_Analyst');
        Decision_Record__c rec = insertDecision('LK-RED-0');
        insert EvidenceTestFactory.rationale(rec.Id);

        Test.startTest();
        System.runAs(analyst) {
            List<EvidenceLedgerService.DecisionView> views = EvidenceLedgerService.getDecisions(
                new EvidenceLedgerService.LedgerQuery()
            );
            Assert.areEqual(1, views.size());
            Assert.isTrue(views[0].subjectRedacted, 'Subject must be flagged redacted for an Analyst.');
            Assert.isNull(views[0].subjectReference, 'Subject reference must be nulled.');

            EvidenceLedgerService.DecisionDetailView detail = EvidenceLedgerService.getDecision(rec.Id);
            Assert.areEqual(1, detail.rationales.size());
            Assert.isTrue(detail.rationales[0].redacted, 'Rationale must be flagged redacted.');
            Assert.isNull(detail.rationales[0].statement, 'Rationale statement must be nulled.');
        }
        Test.stopTest();
    }

    @IsTest
    static void getDecisionReturnsSixPartsForPermittedCaller() {
        User investigator = EvidenceTestSetup.userWith('Evidence_Investigator');
        Decision_Record__c rec = insertDecision('LK-DET-0');
        insert EvidenceTestFactory.rationale(rec.Id);
        insert EvidenceTestFactory.consideration(rec.Id);
        insert EvidenceTestFactory.policyCheck(rec.Id);

        Test.startTest();
        System.runAs(investigator) {
            EvidenceLedgerService.DecisionDetailView detail = EvidenceLedgerService.getDecision(rec.Id);
            Assert.isNotNull(detail.summary, 'Summary must be present.');
            Assert.areEqual('LK-DET-0', detail.summary.ledgerKey);
            Assert.isNotNull(detail.actionsTaken, 'Actions taken (Observed) must be present.');
            Assert.areEqual(1, detail.rationales.size());
            Assert.isFalse(detail.rationales[0].redacted, 'Investigator sees the rationale.');
            Assert.isNotNull(detail.rationales[0].statement);
            Assert.areEqual(1, detail.considerations.size());
            Assert.areEqual(1, detail.policyChecks.size());
        }
        Test.stopTest();
    }

    @IsTest
    static void getByLedgerKeyHappyPath() {
        User investigator = EvidenceTestSetup.userWith('Evidence_Investigator');
        insertDecision('LK-BYKEY-0');

        Test.startTest();
        System.runAs(investigator) {
            EvidenceLedgerService.DecisionDetailView detail = EvidenceLedgerService.getByLedgerKey('LK-BYKEY-0');
            Assert.areEqual('LK-BYKEY-0', detail.summary.ledgerKey);
        }
        Test.stopTest();
    }

    @IsTest
    static void getByLedgerKeyUnknownThrows() {
        User investigator = EvidenceTestSetup.userWith('Evidence_Investigator');
        Test.startTest();
        System.runAs(investigator) {
            try {
                EvidenceLedgerService.getByLedgerKey('LK-DOES-NOT-EXIST');
                Assert.fail('An unknown ledger key must throw.');
            } catch (EvidenceException e) {
                Assert.isTrue(e.getMessage().contains('No decision found'), e.getMessage());
            }
        }
        Test.stopTest();
    }

    @IsTest
    static void withoutLedgerPermissionIsRefused() {
        User outsider = EvidenceTestSetup.userWithNoEvidenceAccess();
        Test.startTest();
        System.runAs(outsider) {
            try {
                EvidenceLedgerService.getDecisions(new EvidenceLedgerService.LedgerQuery());
                Assert.fail('A caller without Evidence_View_Ledger must be refused.');
            } catch (EvidenceException e) {
                Assert.isTrue(e.getMessage().contains('permission'), e.getMessage());
            }
        }
        Test.stopTest();
    }

    // ---------------------------------------------------------- Agent action
    // Evidence_Analyst reaches this class through an @InvocableMethod (CONTRACT §11.2).
    // The agent must never be able to answer beyond what the query returned, so the
    // count leads the payload and an empty result says so explicitly.

    @IsTest
    static void runLedgerQueryLeadsWithTheCountItIsAnsweringFrom() {
        User analyst = EvidenceTestSetup.userWith('Evidence_Analyst');

        EvidenceLedgerService.LedgerQueryRequest req = new EvidenceLedgerService.LedgerQueryRequest();
        req.query_json = '{"agentApiName":"Nothing_Matches_This"}';

        List<EvidenceLedgerService.LedgerQueryResponse> out;
        Test.startTest();
        System.runAs(analyst) {
            out = EvidenceLedgerService.runLedgerQuery(
                new List<EvidenceLedgerService.LedgerQueryRequest>{ req }
            );
        }
        Test.stopTest();

        Assert.areEqual(1, out.size(), 'One response per request.');
        Assert.isTrue(
            out[0].decisions.startsWith('MATCHING_DECISIONS: 0'),
            'An empty result set must say so rather than return nothing: ' + out[0].decisions
        );
        Assert.isTrue(
            out[0].decisions.contains('no decisions matching'),
            'The agent is handed language it can repeat verbatim: ' + out[0].decisions
        );
    }

    @IsTest
    static void runLedgerQueryReturnsMalformedJsonAsTextRatherThanFaulting() {
        User analyst = EvidenceTestSetup.userWith('Evidence_Analyst');

        EvidenceLedgerService.LedgerQueryRequest req = new EvidenceLedgerService.LedgerQueryRequest();
        req.query_json = 'not json at all';

        List<EvidenceLedgerService.LedgerQueryResponse> out;
        System.runAs(analyst) {
            out = EvidenceLedgerService.runLedgerQuery(
                new List<EvidenceLedgerService.LedgerQueryRequest>{ req }
            );
        }

        Assert.isTrue(
            out[0].decisions.startsWith('Query could not be run:'),
            'A bad query is reported to the agent, not thrown mid-conversation: ' + out[0].decisions
        );
    }
}
