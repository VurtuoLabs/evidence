/**
 * Evidence demo seed, step 3 - one active legal hold.
 *
 * Scoped to a single agent, which is the interesting case: it must cover that
 * agent's decisions and nothing else, and the retention job must skip exactly
 * those rows and no others.
 *
 * Ordinary DML only. Anchoring is a separate step because a Big Object write
 * cannot follow DML in the same transaction.
 */
final Id ISSUER = UserInfo.getUserId();

List<Legal_Hold__c> existing = [SELECT Id FROM Legal_Hold__c WHERE Matter__c = 'Matter-2026-014' LIMIT 1];
if (existing.isEmpty()) {
    insert new Legal_Hold__c(
        Matter__c = 'Matter-2026-014',
        Scope_Filter_JSON__c = JSON.serialize(new Map<String, Object>{ 'agentApiName' => 'Codify_Agent' }),
        Effective_From__c = System.today(),
        Issued_By__c = ISSUER,
        Active__c = true
    );
    System.debug('Issued legal hold Matter-2026-014 scoped to Codify_Agent.');
} else {
    System.debug('Legal hold already present.');
}
