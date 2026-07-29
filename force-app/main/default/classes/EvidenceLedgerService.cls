/**
 * EvidenceLedgerService
 * The read facade over the decision index. Every user-facing read of the ledger
 * goes through here (CONTRACT.md 5.3, 8.5): it enforces custom-permission checks,
 * applies redaction, and publishes an access event before anything leaves Apex.
 *
 * Reads run WITH USER_MODE. Because DTO fields are not FLS-protected, this class
 * re-checks with FeatureManagement.checkPermission and nulls restricted fields
 * before returning (8.5, "both layers, always"). Reads that return subject data
 * publish Evidence_Access__e (8.6, auditing the auditors).
 *
 * The Big Object ledger bodies are never read here; the queryable index
 * Decision_Record__c is (12.2). Anything touching Decision_Ledger__b goes through
 * EvidenceChainService, which has no record-level sharing to lean on.
 */
public with sharing class EvidenceLedgerService {
    // ---------------------------------------------------------------- Agent action
    //
    // Evidence_Analyst's Run_Ledger_Query action targets apex://EvidenceLedgerService
    // (CONTRACT §11.2). Agentforce resolves an Apex action to an @InvocableMethod, and
    // the @InvocableVariable names must match the .agent input/output names exactly:
    // query_json in, decisions out.
    //
    // This goes through getDecisions(), so the running user's permission checks and
    // redaction apply before anything reaches the model. The agent never sees more
    // than the person talking to it is entitled to see.

    public class LedgerQueryRequest {
        @InvocableVariable(label='query_json' description='Structured LedgerQuery JSON' required=true)
        public String query_json;
    }

    public class LedgerQueryResponse {
        @InvocableVariable(
            label='decisions'
            description='Matching decisions, already redacted for the running user'
        )
        public String decisions;
    }

    /** Cap on rows handed to the model in one turn. */
    private static final Integer AGENT_MAX_ROWS = 25;

    @InvocableMethod(
        label='Run Ledger Query'
        description='Execute a structured query against the decision ledger and return matching decisions.'
        category='Evidence'
    )
    public static List<LedgerQueryResponse> runLedgerQuery(List<LedgerQueryRequest> requests) {
        List<LedgerQueryResponse> out = new List<LedgerQueryResponse>();
        for (LedgerQueryRequest req : requests) {
            LedgerQueryResponse res = new LedgerQueryResponse();
            try {
                res.decisions = executeAgentQuery(req.query_json);
            } catch (Exception e) {
                // Surfaced to the model as text so it can say what went wrong rather
                // than fault mid-conversation. It must never invent a result set.
                res.decisions = 'Query could not be run: ' + e.getMessage();
            }
            out.add(res);
        }
        return out;
    }

    private static String executeAgentQuery(String queryJson) {
        LedgerQuery q = new LedgerQuery();
        if (String.isNotBlank(queryJson)) {
            Map<String, Object> parsed;
            try {
                parsed = (Map<String, Object>) JSON.deserializeUntyped(queryJson);
            } catch (Exception e) {
                throw new EvidenceException('query_json is not valid JSON.');
            }
            q.agentApiName = asString(parsed.get('agentApiName'));
            q.consequenceLevel = asString(parsed.get('consequenceLevel'));
            q.outcome = asString(parsed.get('outcome'));
            q.autonomyLevel = asString(parsed.get('autonomyLevel'));
            q.fromDate = asDatetime(parsed.get('fromDate'));
            q.toDate = asDatetime(parsed.get('toDate'));
            if (parsed.get('underLegalHold') instanceof Boolean) {
                q.underLegalHold = (Boolean) parsed.get('underLegalHold');
            }
        }
        q.maxRows = AGENT_MAX_ROWS;

        List<DecisionView> rows = getDecisions(q);
        if (rows.isEmpty()) {
            return 'MATCHING_DECISIONS: 0. The ledger holds no decisions matching that query.';
        }
        // The count leads, because the agent is instructed to always state the count
        // it is answering from (CONTRACT §11.1).
        return 'MATCHING_DECISIONS: ' + rows.size() + '\n' + JSON.serialize(rows);
    }

    private static String asString(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private static Datetime asDatetime(Object o) {
        if (o == null) {
            return null;
        }
        if (o instanceof Long) {
            return Datetime.newInstance((Long) o);
        }
        try {
            return (Datetime) JSON.deserialize('"' + String.valueOf(o) + '"', Datetime.class);
        } catch (Exception e) {
            throw new EvidenceException('Unparseable date in query_json: ' + o);
        }
    }

    private static final String PERM_VIEW_LEDGER = 'Evidence_View_Ledger';
    private static final String PERM_VIEW_SUBJECT = 'Evidence_View_Subject_Data';
    private static final String PERM_VIEW_RATIONALE = 'Evidence_View_Rationale';

    private static final List<String> DECISION_FIELDS = new List<String>{
        'Id',
        'Name',
        'Decision_Number__c',
        'Ledger_Key__c',
        'Agent_API_Name__c',
        'Agent_Version__c',
        'Occurred_At__c',
        'Headline__c',
        'Outcome__c',
        'Autonomy_Level__c',
        'Consequence_Level__c',
        'Subject_Reference__c',
        'Subject_Object__c',
        'Actions_Taken__c',
        'Sources_Read__c',
        'Running_User__c',
        'Approver__c',
        'Escalated_To__c',
        'This_Hash__c',
        'Prior_Hash__c',
        'Chain_Position__c',
        'Under_Legal_Hold__c',
        'Retention_Expires_At__c',
        'Redaction_State__c'
    };

    /** Filter shape for a list read. All fields optional; nulls are ignored. */
    public class LedgerQuery {
        @AuraEnabled
        public String agentApiName;
        @AuraEnabled
        public String consequenceLevel;
        @AuraEnabled
        public String outcome;
        @AuraEnabled
        public String autonomyLevel;
        @AuraEnabled
        public Datetime fromDate;
        @AuraEnabled
        public Datetime toDate;
        @AuraEnabled
        public Boolean underLegalHold;
        @AuraEnabled
        public Integer maxRows;
    }

    /** Index-order-aware search over the ledger (CONTRACT 9.2). */
    public class LedgerSearch {
        @AuraEnabled
        public String agentApiName; // required to filter by position
        @AuraEnabled
        public Long fromPosition;
        @AuraEnabled
        public Long toPosition;
        @AuraEnabled
        public Integer maxRows;
    }

    /** Row-level projection of a decision, already redacted for the caller. */
    public class DecisionView {
        @AuraEnabled
        public Id id;
        @AuraEnabled
        public String decisionNumber;
        @AuraEnabled
        public String ledgerKey;
        @AuraEnabled
        public String agentApiName;
        @AuraEnabled
        public String agentVersion;
        @AuraEnabled
        public Datetime occurredAt;
        @AuraEnabled
        public String headline;
        @AuraEnabled
        public String outcome;
        @AuraEnabled
        public String autonomyLevel;
        @AuraEnabled
        public String consequenceLevel;
        @AuraEnabled
        public String subjectReference;
        @AuraEnabled
        public String subjectObject;
        @AuraEnabled
        public String thisHash;
        @AuraEnabled
        public String priorHash;
        @AuraEnabled
        public Decimal chainPosition;
        @AuraEnabled
        public Boolean underLegalHold;
        @AuraEnabled
        public String redactionState;
        @AuraEnabled
        public String runningUser;
        @AuraEnabled
        public String approver;
        @AuraEnabled
        public String escalatedTo;
        @AuraEnabled
        public Boolean subjectRedacted;
    }

    /** The full six-part decision record (CONTRACT 12.4). */
    public class DecisionDetailView {
        @AuraEnabled
        public DecisionView summary;
        @AuraEnabled
        public String actionsTaken;
        @AuraEnabled
        public String sourcesRead;
        @AuraEnabled
        public List<RationaleView> rationales;
        @AuraEnabled
        public List<ConsiderationView> considerations;
        @AuraEnabled
        public List<PolicyCheckView> policyChecks;
    }

    public class RationaleView {
        @AuraEnabled
        public String statement;
        @AuraEnabled
        public Datetime declaredAt;
        @AuraEnabled
        public Boolean declaredBeforeAction;
        @AuraEnabled
        public String modelVersion;
        @AuraEnabled
        public String promptTemplateVersion;
        @AuraEnabled
        public Decimal confidence;
        @AuraEnabled
        public Boolean redacted;
    }

    public class ConsiderationView {
        @AuraEnabled
        public String optionLabel;
        @AuraEnabled
        public String optionType;
        @AuraEnabled
        public Decimal confidence;
        @AuraEnabled
        public Boolean taken;
        @AuraEnabled
        public String rejectionReason;
    }

    public class PolicyCheckView {
        @AuraEnabled
        public String controlKey;
        @AuraEnabled
        public String controlLabel;
        @AuraEnabled
        public String evaluation;
        @AuraEnabled
        public String detail;
        // Text, not Decimal: a control threshold may be a currency amount, a
        // percentage, or a count, and the field stores whichever the control used.
        @AuraEnabled
        public String thresholdValue;
        @AuraEnabled
        public String actualValue;
    }

    /**
     * List decisions matching a filter, redacted for the running user.
     * @param q the filter; null is treated as an empty filter
     * @return matching decision views
     */
    @AuraEnabled
    public static List<DecisionView> getDecisions(LedgerQuery q) {
        requireLedgerAccess();
        LedgerQuery query = q == null ? new LedgerQuery() : q;

        List<String> clauses = new List<String>();
        Map<String, Object> binds = new Map<String, Object>();
        if (String.isNotBlank(query.agentApiName)) {
            clauses.add('Agent_API_Name__c = :agentApiName');
            binds.put('agentApiName', query.agentApiName);
        }
        if (String.isNotBlank(query.consequenceLevel)) {
            clauses.add('Consequence_Level__c = :consequenceLevel');
            binds.put('consequenceLevel', query.consequenceLevel);
        }
        if (String.isNotBlank(query.outcome)) {
            clauses.add('Outcome__c = :outcome');
            binds.put('outcome', query.outcome);
        }
        if (String.isNotBlank(query.autonomyLevel)) {
            clauses.add('Autonomy_Level__c = :autonomyLevel');
            binds.put('autonomyLevel', query.autonomyLevel);
        }
        if (query.fromDate != null) {
            clauses.add('Occurred_At__c >= :fromDate');
            binds.put('fromDate', query.fromDate);
        }
        if (query.toDate != null) {
            clauses.add('Occurred_At__c <= :toDate');
            binds.put('toDate', query.toDate);
        }
        if (query.underLegalHold != null) {
            clauses.add('Under_Legal_Hold__c = :underLegalHold');
            binds.put('underLegalHold', query.underLegalHold);
        }

        Integer limitRows = query.maxRows == null ? 200 : Math.min(query.maxRows, 2000);
        binds.put('limitRows', limitRows);

        String soql = 'SELECT ' + String.join(DECISION_FIELDS, ', ') + ' FROM Decision_Record__c';
        if (!clauses.isEmpty()) {
            soql += ' WHERE ' + String.join(clauses, ' AND ');
        }
        soql += ' ORDER BY Occurred_At__c DESC LIMIT :limitRows';

        List<Decision_Record__c> records = Database.queryWithBinds(soql, binds, AccessLevel.USER_MODE);
        return toViews(records);
    }

    /**
     * The full six-part record for one decision, redacted for the caller.
     * @param decisionId the Decision_Record__c Id
     * @return the detail view
     */
    @AuraEnabled
    public static DecisionDetailView getDecision(Id decisionId) {
        requireLedgerAccess();
        List<Decision_Record__c> records = Database.queryWithBinds(
            'SELECT ' + String.join(DECISION_FIELDS, ', ') + ' FROM Decision_Record__c WHERE Id = :decisionId LIMIT 1',
            new Map<String, Object>{ 'decisionId' => decisionId },
            AccessLevel.USER_MODE
        );
        if (records.isEmpty()) {
            throw new EvidenceException('No decision found for Id ' + decisionId);
        }
        return buildDetail(records[0]);
    }

    /**
     * The full record for a ledger key.
     * @param ledgerKey the External Id pointer into the ledger
     * @return the detail view
     */
    @AuraEnabled
    public static DecisionDetailView getByLedgerKey(String ledgerKey) {
        requireLedgerAccess();
        List<Decision_Record__c> records = Database.queryWithBinds(
            'SELECT ' +
                String.join(DECISION_FIELDS, ', ') +
                ' FROM Decision_Record__c WHERE Ledger_Key__c = :ledgerKey LIMIT 1',
            new Map<String, Object>{ 'ledgerKey' => ledgerKey },
            AccessLevel.USER_MODE
        );
        if (records.isEmpty()) {
            throw new EvidenceException('No decision found for ledger key ' + ledgerKey);
        }
        return buildDetail(records[0]);
    }

    /**
     * Index-order-aware search. Rejects a query the Big Object index cannot serve
     * (a position filter without an agent) rather than silently returning nothing.
     * @param s the search
     * @return matching decision views, ordered by chain position
     */
    @AuraEnabled
    public static List<DecisionView> search(LedgerSearch s) {
        requireLedgerAccess();
        if (s == null) {
            throw new EvidenceException('A LedgerSearch is required.');
        }
        Boolean hasPositionFilter = s.fromPosition != null || s.toPosition != null;
        if (hasPositionFilter && String.isBlank(s.agentApiName)) {
            // Index is Chain_Key -> Chain_Position -> Ledger_Key: equality on all
            // filters but the last. A position range without an agent is not serviceable.
            throw new EvidenceException(
                'Index-incompatible query: filtering by chain position requires an agentApiName.'
            );
        }

        List<String> clauses = new List<String>();
        Map<String, Object> binds = new Map<String, Object>();
        if (String.isNotBlank(s.agentApiName)) {
            clauses.add('Agent_API_Name__c = :agentApiName');
            binds.put('agentApiName', s.agentApiName);
        }
        if (s.fromPosition != null) {
            clauses.add('Chain_Position__c >= :fromPosition');
            binds.put('fromPosition', s.fromPosition);
        }
        if (s.toPosition != null) {
            clauses.add('Chain_Position__c <= :toPosition');
            binds.put('toPosition', s.toPosition);
        }
        Integer limitRows = s.maxRows == null ? 200 : Math.min(s.maxRows, 2000);
        binds.put('limitRows', limitRows);

        String soql = 'SELECT ' + String.join(DECISION_FIELDS, ', ') + ' FROM Decision_Record__c';
        if (!clauses.isEmpty()) {
            soql += ' WHERE ' + String.join(clauses, ' AND ');
        }
        soql += ' ORDER BY Chain_Position__c ASC LIMIT :limitRows';

        List<Decision_Record__c> records = Database.queryWithBinds(soql, binds, AccessLevel.USER_MODE);
        return toViews(records);
    }

    // ---- internal ----------------------------------------------------------

    private static void requireLedgerAccess() {
        if (!FeatureManagement.checkPermission(PERM_VIEW_LEDGER)) {
            throw new EvidenceException('You do not have permission to view the decision ledger.');
        }
    }

    private static List<DecisionView> toViews(List<Decision_Record__c> records) {
        Boolean canSeeSubject = FeatureManagement.checkPermission(PERM_VIEW_SUBJECT);
        List<DecisionView> views = new List<DecisionView>();
        List<Decision_Record__c> subjectReturned = new List<Decision_Record__c>();
        for (Decision_Record__c rec : records) {
            views.add(toView(rec, canSeeSubject));
            if (canSeeSubject && String.isNotBlank(rec.Subject_Reference__c)) {
                subjectReturned.add(rec);
            }
        }
        auditSubjectAccess(subjectReturned, 'list');
        return views;
    }

    private static DecisionView toView(Decision_Record__c rec, Boolean canSeeSubject) {
        DecisionView v = new DecisionView();
        v.id = rec.Id;
        v.decisionNumber = rec.Decision_Number__c;
        v.ledgerKey = rec.Ledger_Key__c;
        v.agentApiName = rec.Agent_API_Name__c;
        v.agentVersion = rec.Agent_Version__c;
        v.occurredAt = rec.Occurred_At__c;
        v.headline = rec.Headline__c;
        v.outcome = rec.Outcome__c;
        v.autonomyLevel = rec.Autonomy_Level__c;
        v.consequenceLevel = rec.Consequence_Level__c;
        v.thisHash = rec.This_Hash__c;
        v.priorHash = rec.Prior_Hash__c;
        v.chainPosition = rec.Chain_Position__c;
        v.underLegalHold = rec.Under_Legal_Hold__c;
        v.redactionState = rec.Redaction_State__c;
        v.runningUser = rec.Running_User__c;
        v.approver = rec.Approver__c;
        v.escalatedTo = rec.Escalated_To__c;
        // Second FLS layer: null subject data unless the caller holds the permission.
        v.subjectRedacted = !canSeeSubject;
        v.subjectReference = canSeeSubject ? rec.Subject_Reference__c : null;
        v.subjectObject = canSeeSubject ? rec.Subject_Object__c : null;
        return v;
    }

    private static DecisionDetailView buildDetail(Decision_Record__c rec) {
        Boolean canSeeSubject = FeatureManagement.checkPermission(PERM_VIEW_SUBJECT);
        Boolean canSeeRationale = FeatureManagement.checkPermission(PERM_VIEW_RATIONALE);

        DecisionDetailView detail = new DecisionDetailView();
        detail.summary = toView(rec, canSeeSubject);
        detail.actionsTaken = rec.Actions_Taken__c;
        detail.sourcesRead = rec.Sources_Read__c;
        detail.rationales = queryRationales(rec.Id, canSeeRationale);
        detail.considerations = queryConsiderations(rec.Id);
        detail.policyChecks = queryPolicyChecks(rec.Id);

        if (canSeeSubject && String.isNotBlank(rec.Subject_Reference__c)) {
            auditSubjectAccess(new List<Decision_Record__c>{ rec }, 'detail');
        }
        return detail;
    }

    private static List<RationaleView> queryRationales(Id decisionId, Boolean canSeeRationale) {
        List<RationaleView> out = new List<RationaleView>();
        for (Rationale__c r : [
            SELECT
                Statement__c,
                Declared_At__c,
                Declared_Before_Action__c,
                Model_Version__c,
                Prompt_Template_Version__c,
                Confidence__c
            FROM Rationale__c
            WHERE Decision_Record__c = :decisionId
            WITH USER_MODE
            ORDER BY Declared_At__c ASC
        ]) {
            RationaleView rv = new RationaleView();
            rv.declaredAt = r.Declared_At__c;
            rv.declaredBeforeAction = r.Declared_Before_Action__c;
            rv.modelVersion = r.Model_Version__c;
            rv.promptTemplateVersion = r.Prompt_Template_Version__c;
            rv.confidence = r.Confidence__c;
            rv.redacted = !canSeeRationale;
            rv.statement = canSeeRationale ? r.Statement__c : null;
            out.add(rv);
        }
        return out;
    }

    private static List<ConsiderationView> queryConsiderations(Id decisionId) {
        List<ConsiderationView> out = new List<ConsiderationView>();
        for (Consideration__c c : [
            SELECT Option_Label__c, Option_Type__c, Confidence__c, Taken__c, Rejection_Reason__c
            FROM Consideration__c
            WHERE Decision_Record__c = :decisionId
            WITH USER_MODE
            ORDER BY Confidence__c DESC
        ]) {
            ConsiderationView cv = new ConsiderationView();
            cv.optionLabel = c.Option_Label__c;
            cv.optionType = c.Option_Type__c;
            cv.confidence = c.Confidence__c;
            cv.taken = c.Taken__c;
            cv.rejectionReason = c.Rejection_Reason__c;
            out.add(cv);
        }
        return out;
    }

    private static List<PolicyCheckView> queryPolicyChecks(Id decisionId) {
        List<PolicyCheckView> out = new List<PolicyCheckView>();
        for (Policy_Check__c p : [
            SELECT Control_Key__c, Control_Label__c, Evaluation__c, Detail__c, Threshold_Value__c, Actual_Value__c
            FROM Policy_Check__c
            WHERE Decision_Record__c = :decisionId
            WITH USER_MODE
        ]) {
            PolicyCheckView pv = new PolicyCheckView();
            pv.controlKey = p.Control_Key__c;
            pv.controlLabel = p.Control_Label__c;
            pv.evaluation = p.Evaluation__c;
            pv.detail = p.Detail__c;
            pv.thresholdValue = p.Threshold_Value__c;
            pv.actualValue = p.Actual_Value__c;
            out.add(pv);
        }
        return out;
    }

    /**
     * Publish one Evidence_Access__e per decision whose subject data was returned.
     * Reads of the evidence system are themselves evidence (CONTRACT 8.6).
     */
    private static void auditSubjectAccess(List<Decision_Record__c> records, String context) {
        if (records == null || records.isEmpty()) {
            return;
        }
        List<Evidence_Access__e> events = new List<Evidence_Access__e>();
        for (Decision_Record__c rec : records) {
            events.add(
                new Evidence_Access__e(
                    Accessed_At__c = System.now(),
                    Accessed_By_Id__c = UserInfo.getUserId(),
                    Context__c = context,
                    Decision_Number__c = rec.Decision_Number__c,
                    Ledger_Key__c = rec.Ledger_Key__c,
                    Subject_Returned__c = true
                )
            );
        }
        EventBus.publish(events);
    }
}
