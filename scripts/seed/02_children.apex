/**
 * Evidence demo seed, step 2 - the six-panel decision record.
 *
 * EvidenceCaptureService writes the ledger link and the Decision_Record__c index
 * row, but not the Rationale__c / Consideration__c / Policy_Check__c children the
 * decision record UI renders (CONTRACT §12.4). This seeds them for the most
 * recent decisions so the hero screen has something to show.
 *
 * Deliberately included: one decision whose rationale was captured AFTER the
 * action. Declared_Before_Action__c = false is what makes the UI show its warning
 * treatment, and a demo that never shows it hides the product's main honesty
 * feature.
 */
final Integer DEPTH = 40;

// Select by "has no rationale yet" rather than by recency. Taking the newest N
// and filtering afterwards does nothing on a re-run: the newest N are exactly the
// ones already seeded, so every candidate is skipped and nothing is added.
Set<Id> alreadySeeded = new Set<Id>();
for (Rationale__c r : [SELECT Decision_Record__c FROM Rationale__c]) {
    alreadySeeded.add(r.Decision_Record__c);
}

List<Decision_Record__c> recent = [
    SELECT Id, Ledger_Key__c, Agent_API_Name__c, Chain_Position__c, Autonomy_Level__c, Occurred_At__c
    FROM Decision_Record__c
    WHERE Id NOT IN :alreadySeeded
    ORDER BY Occurred_At__c DESC
    LIMIT :DEPTH
];

List<Rationale__c> rationales = new List<Rationale__c>();
List<Consideration__c> considerations = new List<Consideration__c>();
List<Policy_Check__c> checks = new List<Policy_Check__c>();

Integer n = 0;
for (Decision_Record__c d : recent) {
    // Every fifth decision declared its rationale only after acting.
    Boolean postHoc = Math.mod(n, 5) == 4;

    rationales.add(
        new Rationale__c(
            Decision_Record__c = d.Id,
            Statement__c = postHoc
                ? 'Recorded after the action completed. The agent reports it acted because the record ' +
                  'matched the stale threshold for Alex, but no rationale was declared beforehand.'
                : 'Alex\'s record met the configured threshold and no policy blocked the action, so the ' +
                  'agent proceeded with the standard remedy for this case type.',
            Declared_At__c = postHoc ? d.Occurred_At__c.addSeconds(45) : d.Occurred_At__c.addSeconds(-3),
            Declared_Before_Action__c = !postHoc,
            Model_Version__c = 'atlas-2026-06',
            Prompt_Template_Version__c = 'v4',
            Confidence__c = postHoc ? 0.58 : 0.91
        )
    );

    considerations.add(
        new Consideration__c(
            Decision_Record__c = d.Id,
            Option_Label__c = 'Act now on Alex\'s record',
            Option_Type__c = 'Action',
            Confidence__c = 0.91,
            Taken__c = true
        )
    );
    considerations.add(
        new Consideration__c(
            Decision_Record__c = d.Id,
            Option_Label__c = 'Escalate to a human reviewer',
            Option_Type__c = 'Route',
            Confidence__c = 0.06,
            Taken__c = false,
            Rejection_Reason__c = 'Below the escalation threshold and no policy required review.'
        )
    );
    considerations.add(
        new Consideration__c(
            Decision_Record__c = d.Id,
            Option_Label__c = 'Defer until the next sweep',
            Option_Type__c = 'Topic',
            Confidence__c = 0.03,
            Taken__c = false,
            Rejection_Reason__c = 'The record was already past its threshold; deferring would widen the breach.'
        )
    );

    checks.add(
        new Policy_Check__c(
            Decision_Record__c = d.Id,
            Control_Key__c = 'AMOUNT_LIMIT',
            Control_Label__c = 'Value within delegated authority',
            Evaluation__c = 'Passed',
            Detail__c = 'Record value 4,500 is within the 10,000 authority for this agent.',
            Threshold_Value__c = '10000',
            Actual_Value__c = '4500'
        )
    );
    checks.add(
        new Policy_Check__c(
            Decision_Record__c = d.Id,
            Control_Key__c = 'HUMAN_REVIEW',
            Control_Label__c = 'Human review required for high consequence',
            Evaluation__c = d.Autonomy_Level__c == 'Human_Approved' ? 'Passed' : 'Not_Triggered',
            Detail__c = d.Autonomy_Level__c == 'Human_Approved'
                ? 'Alex approved this decision before the action ran.'
                : 'The decision was not classified high consequence, so review was not required.',
            Threshold_Value__c = 'High',
            Actual_Value__c = 'Low'
        )
    );
    n++;
}

insert rationales;
insert considerations;
insert checks;

System.debug('Rationales: ' + rationales.size());
System.debug('Considerations: ' + considerations.size());
System.debug('Policy checks: ' + checks.size());
