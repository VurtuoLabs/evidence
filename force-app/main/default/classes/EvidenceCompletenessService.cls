/**
 * EvidenceCompletenessService
 * A detective control, not a proof (CONTRACT.md 6.4).
 *
 * The hash chain proves the ledger was not altered after write. It does NOT prove
 * the ledger was complete at write time. This service reconciles the queryable
 * index (Decision_Record__c) against the record of record (Decision_Ledger__b) for
 * a day, per agent chain, and opens a gap finding when the two disagree beyond the
 * configured tolerance. A mismatch means an index row is missing its ledger link
 * or vice versa: exactly the kind of silent gap a competent auditor probes for.
 */
public with sharing class EvidenceCompletenessService {
    /** Per-agent reconciliation detail. */
    public class AgentReconciliation {
        @AuraEnabled
        public String agentApiName;
        @AuraEnabled
        public Integer indexCount;
        @AuraEnabled
        public Integer ledgerCount;
        @AuraEnabled
        public Integer variance;
        @AuraEnabled
        public Boolean withinTolerance;
    }

    /** Result of a day's reconciliation. */
    public class CompletenessResult {
        @AuraEnabled
        public Date checkedDate;
        @AuraEnabled
        public Integer totalIndexCount = 0;
        @AuraEnabled
        public Integer totalLedgerCount = 0;
        @AuraEnabled
        public Decimal tolerancePercent;
        @AuraEnabled
        public Boolean gapDetected = false;
        @AuraEnabled
        public List<AgentReconciliation> agents = new List<AgentReconciliation>();
        @AuraEnabled
        public String message;
    }

    /**
     * Reconcile index rows against ledger rows for a calendar day.
     * @param d the day to reconcile
     * @return the reconciliation result, with gapDetected set on any mismatch
     *         beyond Completeness_Tolerance_Percent__c
     */
    public static CompletenessResult reconcile(Date d) {
        Date day = d == null ? System.today() : d;
        Datetime dayStart = Datetime.newInstanceGmt(day, Time.newInstance(0, 0, 0, 0));
        Datetime dayEnd = dayStart.addDays(1);

        Decimal tolerance = EvidenceConfigurationService.getSetting().Completeness_Tolerance_Percent__c;
        if (tolerance == null) {
            tolerance = 0;
        }

        CompletenessResult result = new CompletenessResult();
        result.checkedDate = day;
        result.tolerancePercent = tolerance;

        // Index side: count Decision_Record__c per agent for the day.
        Map<String, Integer> indexByAgent = new Map<String, Integer>();
        for (AggregateResult ar : [
            SELECT Agent_API_Name__c agent, COUNT(Id) cnt
            FROM Decision_Record__c
            WHERE Occurred_At__c >= :dayStart AND Occurred_At__c < :dayEnd
            WITH USER_MODE
            GROUP BY Agent_API_Name__c
        ]) {
            indexByAgent.put((String) ar.get('agent'), (Integer) ar.get('cnt'));
        }

        // Ledger side: count Decision_Ledger__b per chain for the day.
        //
        // Occurred_At__c is NOT part of the Big Object index (Chain_Key__c ->
        // Chain_Position__c -> Ledger_Key__c), and a Big Object can only be filtered
        // on its index, in index order (CONTRACT 5.3). Filtering the ledger by date
        // in SOQL is rejected outright with "field 'Occurred_At__c' can not be
        // filtered in a query call". So the ledger is read one chain at a time --
        // equality on the index-leading Chain_Key__c -- and the day window is applied
        // in memory.
        //
        // This is the one place the "no SOQL in a loop" rule is relaxed. There is no
        // bulk alternative for a Big Object, the loop is bounded by the number of
        // monitored agents rather than by data volume, and reconcile() runs once a
        // day in a batch context.
        Set<String> candidateAgents = new Set<String>(indexByAgent.keySet());
        for (Evidence_Capture_Policy__mdt policy : EvidenceConfigurationService.getCapturePolicies()) {
            // A blank Agent_API_Name__c means "all agents" and names no chain of its own.
            if (String.isNotBlank(policy.Agent_API_Name__c)) {
                candidateAgents.add(policy.Agent_API_Name__c);
            }
        }

        Map<String, Integer> ledgerByAgent = new Map<String, Integer>();
        for (String agent : candidateAgents) {
            String chainKey = UserInfo.getOrganizationId() + ':' + agent;
            Integer counted = 0;
            for (Decision_Ledger__b row : EvidenceLedgerStore.chain(chainKey)) {
                if (row.Occurred_At__c >= dayStart && row.Occurred_At__c < dayEnd) {
                    counted++;
                }
            }
            ledgerByAgent.put(agent, counted);
        }

        Set<String> agents = new Set<String>();
        agents.addAll(indexByAgent.keySet());
        agents.addAll(ledgerByAgent.keySet());

        for (String agent : agents) {
            Integer indexCount = indexByAgent.containsKey(agent) ? indexByAgent.get(agent) : 0;
            Integer ledgerCount = ledgerByAgent.containsKey(agent) ? ledgerByAgent.get(agent) : 0;
            Integer variance = Math.abs(indexCount - ledgerCount);

            Integer basis = Math.max(indexCount, ledgerCount);
            Boolean withinTolerance = basis == 0 ? true : (Decimal.valueOf(variance) / basis * 100) <= tolerance;

            AgentReconciliation recon = new AgentReconciliation();
            recon.agentApiName = agent;
            recon.indexCount = indexCount;
            recon.ledgerCount = ledgerCount;
            recon.variance = variance;
            recon.withinTolerance = withinTolerance;
            result.agents.add(recon);

            result.totalIndexCount += indexCount;
            result.totalLedgerCount += ledgerCount;
            if (!withinTolerance) {
                result.gapDetected = true;
            }
        }

        result.message = result.gapDetected
            ? 'Completeness gap detected: index and ledger counts diverge beyond tolerance. This is a detective finding, not proof of tampering.'
            : 'Index and ledger reconcile within tolerance for ' + String.valueOf(day) + '.';
        return result;
    }

    private static String deriveAgentApiName(String chainKey) {
        if (String.isBlank(chainKey) || !chainKey.contains(':')) {
            return chainKey;
        }
        return chainKey.substringAfter(':');
    }
}
