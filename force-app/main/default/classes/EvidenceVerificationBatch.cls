/**
 * EvidenceVerificationBatch
 * Scheduled chain integrity pass (CONTRACT.md 6.3, 10.2).
 *
 * Runs on Chain_Verification_Cron__c and walks each per-agent chain in
 * Verification_Batch_Size__c slices, delegating every slice to
 * EvidenceChainService.verify, which recomputes hashes, checks link continuity
 * (so redacted-body rows still verify), and persists a Chain_Verification__c.
 *
 * start() emits one synthetic record per distinct agent chain (derived from the
 * Decision_Record__c index, since Decision_Ledger__b can only be queried in
 * index order). Each execute() therefore handles a bounded set of chains, and
 * Database.Stateful guards against verifying the same chain twice across chunks.
 */
public with sharing class EvidenceVerificationBatch implements Database.Batchable<SObject>, Database.Stateful {
    private final Integer sliceSize;
    private Set<String> verifiedChains = new Set<String>();

    /** Verifications performed across the whole run; readable in finish/tests. */
    public Integer chainsVerified = 0;

    public EvidenceVerificationBatch() {
        Decimal configured = EvidenceConfigurationService.getSetting().Verification_Batch_Size__c;
        this.sliceSize = (configured == null || configured <= 0) ? 200 : Integer.valueOf(configured);
    }

    public EvidenceVerificationBatch(Integer sliceSize) {
        this.sliceSize = (sliceSize == null || sliceSize <= 0) ? 200 : sliceSize;
    }

    /**
     * One synthetic Decision_Record__c per distinct agent, carrying only the
     * agent API name. The batch framework then chunks these across execute().
     */
    public Iterable<SObject> start(Database.BatchableContext context) {
        List<Decision_Record__c> chains = new List<Decision_Record__c>();
        for (AggregateResult ar : [
            SELECT Agent_API_Name__c agent
            FROM Decision_Record__c
            WHERE Agent_API_Name__c != NULL
            WITH USER_MODE
            GROUP BY Agent_API_Name__c
        ]) {
            chains.add(new Decision_Record__c(Agent_API_Name__c = (String) ar.get('agent')));
        }
        return chains;
    }

    public void execute(Database.BatchableContext context, List<Decision_Record__c> scope) {
        for (Decision_Record__c chainRow : scope) {
            String chainKey = UserInfo.getOrganizationId() + ':' + chainRow.Agent_API_Name__c;
            if (verifiedChains.contains(chainKey)) {
                continue;
            }
            verifiedChains.add(chainKey);
            verifyChain(chainKey);
        }
    }

    public void finish(Database.BatchableContext context) {
        // No-op. Break findings live in the Chain_Verification__c records written
        // per slice; notification is a separate autolaunched Flow (CONTRACT 10.3).
    }

    /** Walk one chain from position 0 to its terminal in sliceSize windows. */
    private void verifyChain(String chainKey) {
        Long terminal = EvidenceChainService.nextPosition(chainKey) - 1L;
        if (terminal < 0L) {
            return; // empty chain
        }
        Long sliceStart = 0L;
        while (sliceStart <= terminal) {
            Long sliceEnd = Math.min(sliceStart + sliceSize - 1L, terminal);
            EvidenceChainService.verify(chainKey, sliceStart, sliceEnd);
            sliceStart = sliceEnd + 1L;
        }
        chainsVerified++;
    }
}
