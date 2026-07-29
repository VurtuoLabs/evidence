/**
 * EvidenceTestFactory
 * @IsTest-only builders for every Evidence object (CONTRACT.md 9.1, 13).
 *
 * Tests must not assume org data, so this factory produces fully-populated,
 * internally-consistent records with valid picklist values. Builders return
 * unsaved SObjects with sensible defaults; the caller inserts (so a test can
 * override any field first). Master-detail children take their parent Id.
 *
 * Big Objects (Decision_Ledger__b, Chain_Anchor__b) and the platform event
 * (Evidence_Turn__e) are BUILT here; persistence for those goes through
 * Database.insertImmediate / EventBus.publish, exposed as helpers.
 */
@IsTest
public class EvidenceTestFactory {
    // Monotonic counter so every generated key/position is unique within a test.
    private static Integer seq = 0;

    private static Integer nextSeq() {
        seq++;
        return seq;
    }

    /** A unique ledger key of the form LK-<n>. */
    public static String ledgerKey() {
        return 'LK-' + String.valueOf(nextSeq()).leftPad(8, '0');
    }

    /** The per-agent chain key, matching EvidenceCaptureService.chainKeyFor. */
    public static String chainKey(String agentApiName) {
        return UserInfo.getOrganizationId() + ':' + agentApiName;
    }

    // ---- Decision_Record__c ------------------------------------------------

    /** A Decision_Record__c index row with defaults; caller sets Ledger_Key__c. */
    public static Decision_Record__c decisionRecord(String agentApiName, String ledgerKeyValue) {
        return new Decision_Record__c(
            Ledger_Key__c = String.isBlank(ledgerKeyValue) ? ledgerKey() : ledgerKeyValue,
            Agent_API_Name__c = String.isBlank(agentApiName) ? 'Claims_Triage' : agentApiName,
            Agent_Version__c = '1',
            Occurred_At__c = System.now(),
            Headline__c = 'Agent turn recorded',
            Outcome__c = null,
            Autonomy_Level__c = 'Autonomous',
            Consequence_Level__c = 'Low',
            Subject_Reference__c = 'Claim/0018000000abcde',
            Subject_Object__c = 'Claim',
            Actions_Taken__c = 'Recalculate_Reserve',
            Sources_Read__c = 'Claim; Policy',
            This_Hash__c = 'hash-' + String.valueOf(nextSeq()),
            Prior_Hash__c = '',
            Chain_Position__c = 0,
            Under_Legal_Hold__c = false,
            Redaction_State__c = 'None',
            Retention_Expires_At__c = System.today().addDays(2555)
        );
    }

    /** Convenience overload with a generated ledger key. */
    public static Decision_Record__c decisionRecord(String agentApiName) {
        return decisionRecord(agentApiName, null);
    }

    // ---- Rationale__c (master-detail on Decision_Record__c) ----------------

    public static Rationale__c rationale(Id decisionRecordId) {
        return new Rationale__c(
            Decision_Record__c = decisionRecordId,
            Statement__c = 'Reserve raised because the claimant reported new injuries.',
            Declared_At__c = System.now(),
            Declared_Before_Action__c = true,
            Model_Version__c = 'atlas-2026-05',
            Prompt_Template_Version__c = 'Evidence_Narrative_v1',
            Confidence__c = 0.82
        );
    }

    // ---- Consideration__c (master-detail on Decision_Record__c) ------------

    public static Consideration__c consideration(Id decisionRecordId) {
        return new Consideration__c(
            Decision_Record__c = decisionRecordId,
            Option_Label__c = 'Escalate to adjuster',
            Option_Type__c = 'Action',
            Confidence__c = 0.41,
            Taken__c = false,
            Rejection_Reason__c = 'Below escalation threshold'
        );
    }

    // ---- Policy_Check__c (master-detail on Decision_Record__c) -------------

    public static Policy_Check__c policyCheck(Id decisionRecordId) {
        return new Policy_Check__c(
            Decision_Record__c = decisionRecordId,
            Control_Key__c = 'AMOUNT_LIMIT',
            Control_Label__c = 'Reserve amount within authority',
            Evaluation__c = 'Passed',
            Detail__c = 'Reserve 4500 within 10000 authority',
            Threshold_Value__c = '10000',
            Actual_Value__c = '4500'
        );
    }

    // ---- Evidence_Bundle__c ------------------------------------------------

    public static Evidence_Bundle__c bundle(String matter) {
        return new Evidence_Bundle__c(
            Matter__c = String.isBlank(matter) ? 'Matter-2026-001' : matter,
            Purpose__c = 'Regulatory production',
            Range_Start__c = System.now().addDays(-30),
            Range_End__c = System.now(),
            Decision_Count__c = 0,
            State__c = 'Draft',
            Redaction_Profile__c = 'OutsideCounsel',
            Export_Format__c = 'JSON'
        );
    }

    // ---- Bundle_Item__c (master-detail on Evidence_Bundle__c) --------------

    public static Bundle_Item__c bundleItem(Id bundleId, Id decisionRecordId, String ledgerKeyValue) {
        return new Bundle_Item__c(
            Evidence_Bundle__c = bundleId,
            Decision_Record__c = decisionRecordId,
            Ledger_Key__c = ledgerKeyValue
        );
    }

    // ---- Legal_Hold__c -----------------------------------------------------

    public static Legal_Hold__c legalHold(String matter) {
        return new Legal_Hold__c(
            Matter__c = String.isBlank(matter) ? 'Matter-2026-001' : matter,
            Scope_Filter_JSON__c = null, // matter-wide by default
            Effective_From__c = System.today().addDays(-1),
            Issued_By__c = UserInfo.getUserId(),
            Active__c = true
        );
    }

    /** A hold scoped to a single agent chain. */
    public static Legal_Hold__c legalHoldForAgent(String matter, String agentApiName) {
        Legal_Hold__c hold = legalHold(matter);
        hold.Scope_Filter_JSON__c = JSON.serialize(new Map<String, Object>{ 'agentApiName' => agentApiName });
        return hold;
    }

    // ---- Chain_Verification__c ---------------------------------------------

    public static Chain_Verification__c chainVerification() {
        return new Chain_Verification__c(
            Verified_At__c = System.now(),
            Links_Checked__c = 0,
            First_Position__c = 0,
            Last_Position__c = 0,
            Result__c = 'Intact',
            Break_At_Position__c = null,
            Duration_Ms__c = 0
        );
    }

    // ---- Evidence_Turn__e (platform event) ---------------------------------

    /** Build a fully-populated turn for one agent chain. */
    public static Evidence_Turn__e turn(String agentApiName, String ledgerKeyValue) {
        return new Evidence_Turn__e(
            Agent_API_Name__c = String.isBlank(agentApiName) ? 'Claims_Triage' : agentApiName,
            Agent_Version__c = '1',
            Session_Key__c = 'SESSION-' + String.valueOf(nextSeq()),
            Ledger_Key__c = String.isBlank(ledgerKeyValue) ? ledgerKey() : ledgerKeyValue,
            Occurred_At__c = System.now(),
            Subject_Reference__c = 'Claim/0018000000abcde',
            Subject_Object__c = 'Claim',
            Declared_Rationale__c = 'Raised reserve after new medical evidence.',
            Policy_Evaluations__c = 'AMOUNT_LIMIT:Passed',
            Variables_Set__c = 'reserve=4500',
            Topics_Considered__c = 'triage:0.91;escalate:0.41',
            Actions_Invoked__c = 'Recalculate_Reserve',
            Sources_Read__c = 'Claim; Policy',
            Running_User_Id__c = UserInfo.getUserId(),
            Approver_Id__c = null,
            Escalated_To__c = null
        );
    }

    /** Convenience overload with a generated ledger key. */
    public static Evidence_Turn__e turn(String agentApiName) {
        return turn(agentApiName, null);
    }

    /** Build a list of sequential turns for a single agent chain. */
    public static List<Evidence_Turn__e> turns(String agentApiName, Integer count) {
        List<Evidence_Turn__e> out = new List<Evidence_Turn__e>();
        for (Integer i = 0; i < count; i++) {
            out.add(turn(agentApiName));
        }
        return out;
    }

    /** Publish one turn PublishAfterCommit and return the publish result. */
    public static Database.SaveResult publishTurn(Evidence_Turn__e turnEvent) {
        return EventBus.publish(turnEvent);
    }

    /** Publish a batch of turns and return the publish results. */
    public static List<Database.SaveResult> publishTurns(List<Evidence_Turn__e> turnEvents) {
        return EventBus.publish(turnEvents);
    }

    // ---- Decision_Ledger__b (Big Object) -----------------------------------

    /**
     * Build a ledger row consistent with the capture path's field mapping.
     * Not inserted; persist via Database.insertImmediate when the test needs it.
     */
    public static Decision_Ledger__b ledgerRow(String agentApiName, Long position, String ledgerKeyValue) {
        String ck = chainKey(agentApiName);
        String lk = String.isBlank(ledgerKeyValue) ? ledgerKey() : ledgerKeyValue;
        return new Decision_Ledger__b(
            Chain_Key__c = ck,
            Chain_Position__c = position,
            Ledger_Key__c = lk,
            Occurred_At__c = System.now(),
            Agent_Version__c = '1',
            Canonical_Body__c = '{"agentApiName":"' + agentApiName + '"}',
            Canonical_Version__c = 1,
            This_Hash__c = 'hash-' + String.valueOf(nextSeq()),
            Prior_Hash__c = '',
            Consequence_Level__c = 'Low',
            Autonomy_Level__c = 'Autonomous',
            Subject_Reference__c = 'Claim/0018000000abcde',
            Running_User_Id__c = UserInfo.getUserId(),
            Approver_Id__c = null
        );
    }

    // ---- Chain_Anchor__b (Big Object) --------------------------------------

    public static Chain_Anchor__b anchorRow(String agentApiName, Date anchorDate) {
        String ck = chainKey(agentApiName);
        Date d = anchorDate == null ? System.today() : anchorDate;
        return new Chain_Anchor__b(
            Chain_Key__c = ck,
            Anchor_Date__c = EvidenceChainService.anchorDayStart(d),
            // Mirrors EvidenceChainService.anchor: the tiebreak is the date alone,
            // not chainKey:date, so it fits the 35-character index column.
            Anchor_Key__c = String.valueOf(d),
            Terminal_Hash__c = 'hash-' + String.valueOf(nextSeq()),
            Terminal_Position__c = 0,
            Link_Count__c = 1,
            Computed_At__c = System.now(),
            Computed_By__c = UserInfo.getUserId(),
            Signature__c = null
        );
    }
}
