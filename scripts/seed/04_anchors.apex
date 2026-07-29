/**
 * Evidence demo seed, step 4 - a daily anchor per chain.
 *
 * The anchor is the artifact a customer hands an auditor (CONTRACT §5.2): the
 * terminal hash of a chain on a given day. Anchoring reads the chain terminal and
 * writes Chain_Anchor__b, so it must run after the decisions are seeded and, being
 * a Big Object write, must be the first DML in its own transaction.
 */
Integer anchored = 0;
for (String agent : new List<String>{ 'Sentinel', 'Scribe_Agent', 'Codify_Agent' }) {
    String chainKey = UserInfo.getOrganizationId() + ':' + agent;
    try {
        EvidenceChainService.anchor(chainKey, System.today());
        anchored++;
    } catch (Exception e) {
        System.debug('Could not anchor ' + agent + ': ' + e.getMessage());
    }
}
System.debug('Chains anchored: ' + anchored);
