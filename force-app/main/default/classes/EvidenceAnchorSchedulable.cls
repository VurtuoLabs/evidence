/**
 * EvidenceAnchorSchedulable
 * Daily terminal-hash anchoring (CONTRACT.md 5.2, 10.2).
 *
 * Scheduled on Anchor_Cron__c. For every distinct agent chain it writes one
 * Chain_Anchor__b via EvidenceChainService.anchor for the run date. The anchor
 * is the daily terminal hash a customer hands an auditor.
 *
 * Distinct chains are derived from the Decision_Record__c index, because
 * Decision_Ledger__b is queryable only in index order. A chain that anchor()
 * rejects as empty (e.g. every row purged) is skipped rather than failing the
 * whole run.
 */
public with sharing class EvidenceAnchorSchedulable implements Schedulable {
    /** Anchors written on the most recent execute; readable in tests. */
    public Integer anchorsWritten = 0;

    public void execute(SchedulableContext context) {
        Date anchorDate = System.today();
        anchorsWritten = 0;

        for (AggregateResult ar : [
            SELECT Agent_API_Name__c agent
            FROM Decision_Record__c
            WHERE Agent_API_Name__c != NULL
            WITH USER_MODE
            GROUP BY Agent_API_Name__c
        ]) {
            String agent = (String) ar.get('agent');
            String chainKey = UserInfo.getOrganizationId() + ':' + agent;
            try {
                EvidenceChainService.anchor(chainKey, anchorDate);
                anchorsWritten++;
            } catch (EvidenceException e) {
                // Empty chain (nothing to anchor). Skip and continue the run.
                continue;
            }
        }
    }
}
