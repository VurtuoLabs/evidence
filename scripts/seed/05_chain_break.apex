/**
 * Evidence demo seed, step 5 - one deliberate chain break.
 *
 * CONTRACT §13 calls for a seeded break so the verification demo has something to
 * find. Tampering rewrites a mid-chain row's Canonical_Body__c while leaving its
 * stored This_Hash__c untouched - exactly what silent after-the-fact editing of
 * the record would look like. verify() recomputes the hash from the body and the
 * mismatch surfaces at that position.
 *
 * Big Object writes are upserts on the full index (Chain_Key, Position, Ledger_Key),
 * so writing the same triple replaces the row in place. The write happens first in
 * the transaction because insertImmediate cannot follow ordinary DML.
 */
final String TAMPER_AGENT = 'Sentinel';
final Integer TAMPER_POSITION = 12;

String tamperedChain = UserInfo.getOrganizationId() + ':' + TAMPER_AGENT;

Decision_Ledger__b target = EvidenceLedgerStore.atPosition(
    tamperedChain,
    TAMPER_POSITION,
    'LK-' + TAMPER_AGENT.left(8) + '-' + String.valueOf(TAMPER_POSITION).leftPad(5, '0')
);

if (target == null) {
    System.debug('No row at position ' + TAMPER_POSITION + ' on ' + TAMPER_AGENT + '; skipping tamper.');
} else if (target.Canonical_Body__c != null && target.Canonical_Body__c.contains('TAMPERED')) {
    System.debug('Chain already tampered at position ' + TAMPER_POSITION + '.');
} else {
    // Rebuild the row explicitly rather than cloning: a Big Object write is an
    // upsert on the full index triple, so the three index fields must carry the
    // same values for this to replace the row in place rather than add one.
    // The body changes; This_Hash__c and Prior_Hash__c are copied across
    // untouched, which is exactly what an edit made after the fact looks like.
    Decision_Ledger__b tampered = new Decision_Ledger__b();
    tampered.Chain_Key__c = target.Chain_Key__c;
    tampered.Chain_Position__c = target.Chain_Position__c;
    tampered.Ledger_Key__c = target.Ledger_Key__c;
    tampered.Occurred_At__c = target.Occurred_At__c;
    tampered.Agent_Version__c = target.Agent_Version__c;
    tampered.Canonical_Version__c = target.Canonical_Version__c;
    tampered.Canonical_Body__c = target.Canonical_Body__c.replace('Alex Imperiale', 'TAMPERED SUBJECT');
    tampered.This_Hash__c = target.This_Hash__c;
    tampered.Prior_Hash__c = target.Prior_Hash__c;
    tampered.Consequence_Level__c = target.Consequence_Level__c;
    tampered.Autonomy_Level__c = target.Autonomy_Level__c;
    tampered.Subject_Reference__c = target.Subject_Reference__c;
    tampered.Running_User_Id__c = target.Running_User_Id__c;
    tampered.Approver_Id__c = target.Approver_Id__c;
    EvidenceLedgerStore.insertLedger(new List<Decision_Ledger__b>{ tampered });
    System.debug('Tampered ' + TAMPER_AGENT + ' at chain position ' + TAMPER_POSITION + '.');
}
