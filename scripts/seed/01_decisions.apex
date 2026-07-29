/**
 * Evidence demo seed, step 1 - append a batch of real, chained decisions.
 *
 * Goes through EvidenceCaptureService.write rather than inserting rows directly,
 * so the demo data is produced by the same canonicalize → hash → chain → index
 * path production uses. That means the chain actually verifies, which is the
 * whole point of the product.
 *
 * seed.sh calls this repeatedly. Each run appends BATCH decisions per agent and
 * continues each chain from its current terminal position, so positions stay
 * monotonic and gap-free across runs. One write() per execution is deliberate:
 * Decision_Ledger__b is a Big Object and its insertImmediate must be the first
 * DML in the transaction.
 *
 * The subject of every decision is Alex.
 */
final Integer BATCH = 17;
final Id RUNNING_USER = UserInfo.getUserId();
// Position 0 is the oldest link and time moves forward with the chain, which is
// how a real ledger grows. Deriving the timestamp from a fixed base rather than
// from "now minus position" keeps that true across repeated seed runs.
final Datetime CHAIN_START = System.now().addDays(-30);

List<String> agents = new List<String>{ 'Sentinel', 'Scribe_Agent', 'Codify_Agent' };

// What each agent decided, and the rationale it declared before acting.
Map<String, List<String>> playbook = new Map<String, List<String>>{
    'Sentinel' => new List<String>{
        'Snooze_Record|Case|Snoozed a case for Alex because the customer asked for a callback next week.',
        'Reassign_Records|Lead|Reassigned Alex\'s aging leads: they were past the 14-day band and unworked.',
        'Create_Follow_Up|Task|Created a follow-up for Alex on the opportunity that had no next step.'
    },
    'Scribe_Agent' => new List<String>{
        'Update_Opportunity|Opportunity|Moved the close date because Alex reported the CFO asked for pricing by Friday.',
        'Log_Call|Task|Logged Alex\'s call recap against the opportunity so the history is complete.',
        'Create_Contact|Contact|Created the stakeholder Alex mentioned who was not yet in Salesforce.'
    },
    'Codify_Agent' => new List<String>{
        'Update_Case_Resolution|Case|Recorded the fix Alex described so the root cause is captured on the case.',
        'Draft_Knowledge_Article|Knowledge__kav|Drafted an article from Alex\'s resolution; it stays draft until reviewed.'
    }
};

List<Evidence_Turn__e> turns = new List<Evidence_Turn__e>();

for (String agent : agents) {
    String chainKey = UserInfo.getOrganizationId() + ':' + agent;
    Long start = EvidenceChainService.nextPosition(chainKey);
    List<String> actions = playbook.get(agent);

    for (Integer i = 0; i < BATCH; i++) {
        Long pos = start + i;
        List<String> parts = actions[Math.mod(i, actions.size())].split('\\|');
        String actionName = parts[0];
        String subjectObject = parts[1];
        String rationale = parts[2];

        // Every fourth decision was approved by a human; every seventh escalated.
        Boolean approved = Math.mod((Integer) pos, 4) == 0;
        Boolean escalated = Math.mod((Integer) pos, 7) == 0 && !approved;

        Evidence_Turn__e t = new Evidence_Turn__e();
        t.Agent_API_Name__c = agent;
        t.Agent_Version__c = 'v1';
        t.Session_Key__c = 'SES-ALEX-' + agent + '-' + Math.mod((Integer) pos, 25);
        // Ledger_Key__c is Text(35); keep the composite short.
        t.Ledger_Key__c = 'LK-' + agent.left(8) + '-' + String.valueOf(pos).leftPad(5, '0');
        t.Occurred_At__c = CHAIN_START.addMinutes(((Integer) pos) * 7);
        t.Subject_Reference__c = 'Alex Imperiale';
        t.Subject_Object__c = subjectObject;
        t.Declared_Rationale__c = rationale;
        t.Topics_Considered__c = actionName + ':0.91;escalate:0.06;defer:0.03';
        t.Actions_Invoked__c =
            '[{"action":"' + actionName + '","input":{"subject":"Alex Imperiale"},"output":{"status":"Success"}}]';
        t.Sources_Read__c = 'KB:agent-ops-01;Record:' + subjectObject;
        t.Policy_Evaluations__c =
            '[{"controlKey":"AMOUNT_LIMIT","evaluation":"Passed"},' +
            '{"controlKey":"HUMAN_REVIEW","evaluation":"' + (approved ? 'Passed' : 'Not_Triggered') + '"}]';
        t.Variables_Set__c = '{"subject":"Alex Imperiale","autonomous":' + (!approved) + '}';
        t.Running_User_Id__c = RUNNING_USER;
        t.Approver_Id__c = approved ? RUNNING_USER : null;
        t.Escalated_To__c = escalated ? RUNNING_USER : null;
        turns.add(t);
    }
}

Integer written = EvidenceCaptureService.write(turns);
System.debug('Decisions written this batch: ' + written);
