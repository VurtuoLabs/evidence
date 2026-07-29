/**
 * Evidence - tests for the capture tap (CONTRACT §3).
 *
 * The case that matters most here is the one about honesty: a decision recorded
 * without a declared rationale must still be recorded, and must report that no
 * rationale was declared. Silently dropping such a turn would hide exactly the
 * thing an auditor is looking for.
 */
@IsTest
private class EvidenceTapTest {
    private static EvidenceTap.DecisionRequest decisionFor(String agentApiName) {
        EvidenceTap.DecisionRequest req = new EvidenceTap.DecisionRequest();
        req.agent_api_name = agentApiName;
        req.agent_version = 'v1';
        req.session_key = 'SES-ALEX-1';
        req.subject_reference = 'Alex Imperiale';
        req.subject_object = 'Case';
        req.declared_rationale = 'The record passed the stale threshold and no policy blocked the action.';
        req.actions_invoked = '[{"action":"Snooze_Record","output":{"status":"Success"}}]';
        req.sources_read = 'KB:agent-ops-01';
        req.topics_considered = 'Snooze_Record:0.91;escalate:0.06';
        req.policy_evaluations = '[{"controlKey":"AMOUNT_LIMIT","evaluation":"Passed"}]';
        return req;
    }

    @IsTest
    static void recordPublishesADecisionAndReturnsItsLedgerKey() {
        Test.startTest();
        List<EvidenceTap.DecisionResponse> out = EvidenceTap.record(
            new List<EvidenceTap.DecisionRequest>{ decisionFor('Claims_Triage') }
        );
        Test.stopTest();

        Assert.areEqual(1, out.size(), 'One response per request.');
        Assert.isTrue(out[0].captured, 'A well-formed decision is captured.');
        Assert.isNotNull(out[0].ledger_key, 'The caller is told the key its decision was recorded under.');
        Assert.isTrue(out[0].rationale_declared, 'A supplied rationale is reported as declared.');
    }

    @IsTest
    static void aDecisionWithoutARationaleIsStillRecordedAndFlagged() {
        EvidenceTap.DecisionRequest req = decisionFor('Claims_Triage');
        req.declared_rationale = null;

        List<EvidenceTap.DecisionResponse> out = EvidenceTap.record(
            new List<EvidenceTap.DecisionRequest>{ req }
        );

        // Both halves matter: the decision is still on the record, AND the absence
        // of a rationale is reported rather than hidden.
        Assert.isTrue(out[0].captured, 'A decision without a rationale is still recorded.');
        Assert.isFalse(out[0].rationale_declared, 'The missing rationale is reported, not hidden.');
    }

    @IsTest
    static void generatedLedgerKeyFitsTheBigObjectIndexColumn() {
        List<EvidenceTap.DecisionResponse> out = EvidenceTap.record(
            new List<EvidenceTap.DecisionRequest>{ decisionFor('Claims_Triage') }
        );
        // Decision_Ledger__b.Ledger_Key__c is Text(35), and the index is immutable.
        Assert.isTrue(
            out[0].ledger_key.length() <= 35,
            'Generated ledger key must fit Text(35), was ' + out[0].ledger_key.length()
        );
    }

    @IsTest
    static void aSuppliedLedgerKeyIsHonoured() {
        EvidenceTap.DecisionRequest req = decisionFor('Claims_Triage');
        req.ledger_key = 'LK-CALLER-SUPPLIED-1';

        List<EvidenceTap.DecisionResponse> out = EvidenceTap.record(
            new List<EvidenceTap.DecisionRequest>{ req }
        );

        Assert.areEqual('LK-CALLER-SUPPLIED-1', out[0].ledger_key, 'A caller-supplied key is not replaced.');
    }

    @IsTest
    static void aDecisionWithoutAnAgentIsReportedNotThrown() {
        List<EvidenceTap.DecisionResponse> out = EvidenceTap.record(
            new List<EvidenceTap.DecisionRequest>{ decisionFor(null) }
        );

        Assert.isFalse(out[0].captured, 'A decision with no agent has no chain to append to.');
        Assert.isNull(out[0].ledger_key, 'No key is issued for an unrecordable decision.');
    }
}
