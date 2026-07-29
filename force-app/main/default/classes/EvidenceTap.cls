/**
 * Evidence - the capture tap (CONTRACT §3).
 *
 * The subscriber side (EvidenceTurnTrigger → EvidenceCaptureQueueable →
 * EvidenceCaptureService) was complete, but nothing published an Evidence_Turn__e,
 * so no live agent conversation ever reached the ledger. This is that publisher.
 *
 * A monitored agent invokes this once per consequential turn. It publishes
 * PublishAfterCommit: capture observes the agent's work and must never be able to
 * roll it back.
 *
 * The `declared_rationale` input carries the agent's own account of its reasoning
 * and is what the Declare_Rationale action supplies. It is stored and labelled as
 * **Declared**, never as observed fact - that distinction is the product
 * (CONTRACT §1). A turn submitted without one is still recorded; the record simply
 * shows that no rationale was declared, which is itself evidence.
 */
public with sharing class EvidenceTap {
    public class DecisionRequest {
        @InvocableVariable(label='agent_api_name' description='API name of the monitored agent' required=true)
        public String agent_api_name;

        @InvocableVariable(label='agent_version' description='Version of the agent that decided')
        public String agent_version;

        @InvocableVariable(label='session_key' description='Conversation/session identifier')
        public String session_key;

        @InvocableVariable(label='ledger_key' description='Unique key for this decision; generated when blank')
        public String ledger_key;

        @InvocableVariable(label='subject_reference' description='Who or what the decision was about')
        public String subject_reference;

        @InvocableVariable(label='subject_object' description='SObject type the decision concerned')
        public String subject_object;

        @InvocableVariable(
            label='declared_rationale'
            description='The agent\'s own account of why it chose this. Declared, not observed.'
        )
        public String declared_rationale;

        @InvocableVariable(label='actions_invoked' description='Actions taken, with inputs and outputs')
        public String actions_invoked;

        @InvocableVariable(label='sources_read' description='Records and knowledge the agent read')
        public String sources_read;

        @InvocableVariable(label='topics_considered' description='Options weighed, with confidence')
        public String topics_considered;

        @InvocableVariable(label='policy_evaluations' description='Controls evaluated and their outcome')
        public String policy_evaluations;

        @InvocableVariable(label='approver_id' description='User who approved, when a human did')
        public String approver_id;

        @InvocableVariable(label='escalated_to' description='User the decision was escalated to')
        public String escalated_to;
    }

    public class DecisionResponse {
        @InvocableVariable(label='ledger_key' description='The key this decision was recorded under')
        public String ledger_key;

        @InvocableVariable(label='captured' description='True when the decision was published for recording')
        public Boolean captured;

        @InvocableVariable(
            label='rationale_declared'
            description='False when the agent recorded no rationale for this decision'
        )
        public Boolean rationale_declared;
    }

    @InvocableMethod(
        label='Evidence Record Decision'
        description='Publish one agent decision to the Evidence ledger.'
        category='Evidence'
    )
    public static List<DecisionResponse> record(List<DecisionRequest> requests) {
        List<DecisionResponse> responses = new List<DecisionResponse>();
        List<Evidence_Turn__e> events = new List<Evidence_Turn__e>();

        for (DecisionRequest req : requests) {
            DecisionResponse res = new DecisionResponse();
            res.captured = false;
            res.rationale_declared = String.isNotBlank(req.declared_rationale);

            if (String.isBlank(req.agent_api_name)) {
                // Without an agent there is no chain to append to. Reported, not
                // thrown: capture must never break the conversation it observes.
                responses.add(res);
                continue;
            }

            String ledgerKey = String.isNotBlank(req.ledger_key) ? req.ledger_key : newLedgerKey();
            Evidence_Turn__e e = new Evidence_Turn__e();
            e.Agent_API_Name__c = req.agent_api_name;
            e.Agent_Version__c = req.agent_version;
            e.Session_Key__c = req.session_key;
            e.Ledger_Key__c = ledgerKey;
            e.Occurred_At__c = System.now();
            e.Subject_Reference__c = req.subject_reference;
            e.Subject_Object__c = req.subject_object;
            e.Declared_Rationale__c = req.declared_rationale;
            e.Actions_Invoked__c = req.actions_invoked;
            e.Sources_Read__c = req.sources_read;
            e.Topics_Considered__c = req.topics_considered;
            e.Policy_Evaluations__c = req.policy_evaluations;
            e.Running_User_Id__c = UserInfo.getUserId();
            e.Approver_Id__c = req.approver_id;
            e.Escalated_To__c = req.escalated_to;
            events.add(e);

            res.ledger_key = ledgerKey;
            res.captured = true;
            responses.add(res);
        }

        if (!events.isEmpty()) {
            EventBus.publish(events);
        }
        return responses;
    }

    /**
     * Ledger keys must fit Decision_Ledger__b.Ledger_Key__c, which is Text(35)
     * because the Big Object index has a 100-character text budget (CONTRACT §5.1).
     */
    private static String newLedgerKey() {
        return 'LK-' +
            String.valueOf(System.now().getTime()) +
            '-' +
            String.valueOf(Math.abs(Crypto.getRandomInteger())).left(6);
    }
}
