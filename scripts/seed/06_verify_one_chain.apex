/**
 * Evidence demo seed, step 6 - verify one chain.
 *
 * Verifies a single chain per execution, on purpose. verify() reads the ledger
 * (a Big Object) and then inserts a Chain_Verification__c. A Big Object operation
 * behaves like a callout, so once the first chain's verification row is inserted,
 * the next chain's ledger read in the same transaction fails with "pending
 * uncommitted work". One chain per transaction is the only safe shape, and it is
 * the same reason EvidenceVerificationBatch must scope one chain per execute().
 *
 * seed.sh runs this once per chain. Each run picks the first chain with no
 * verification in the last hour, so repeated runs walk through all of them.
 */
List<String> agents = new List<String>{ 'Sentinel', 'Scribe_Agent', 'Codify_Agent' };
Datetime cutoff = System.now().addHours(-1);

Set<String> recentlyVerified = new Set<String>();
for (Chain_Verification__c v : [
    SELECT Chain_Key__c
    FROM Chain_Verification__c
    WHERE Verified_At__c >= :cutoff AND Chain_Key__c != NULL
]) {
    recentlyVerified.add(v.Chain_Key__c);
}

for (String agent : agents) {
    String chainKey = UserInfo.getOrganizationId() + ':' + agent;
    Long terminal = EvidenceChainService.nextPosition(chainKey) - 1;
    if (terminal < 0) {
        continue;
    }
    if (recentlyVerified.contains(chainKey)) {
        continue; // already verified in this run
    }
    Chain_Verification__c v = EvidenceChainService.verify(chainKey, 0, terminal);
    System.debug(
        agent + ': ' + v.Result__c + ' over ' + v.Links_Checked__c + ' links' +
        (v.Break_At_Position__c == null ? '' : ', break at position ' + v.Break_At_Position__c)
    );
    break; // one chain per transaction
}
