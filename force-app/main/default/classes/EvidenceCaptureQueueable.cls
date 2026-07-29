/**
 * EvidenceCaptureQueueable
 * The asynchronous write path (CONTRACT.md 9.3).
 *
 * EvidenceTurnTrigger enqueues this with the full batch of turns delivered by
 * the Evidence_Turn__e subscription. To keep chain positions monotonic and
 * gap-free without any two transactions contending for the same counter, this
 * Queueable processes EXACTLY ONE chain per link:
 *
 *   1. Group the batch by chain (one chain == one agent).
 *   2. Hand the first chain's turns, in order, to EvidenceCaptureService.write,
 *      which reads that chain's terminal position once, assigns positions in
 *      memory, and persists Decision_Ledger__b (insertImmediate) plus the
 *      Decision_Record__c index rows in the same transaction.
 *   3. If other chains remain, chain to a fresh Queueable via System.enqueueJob
 *      so each chain is written by its own transaction.
 *
 * Platform Event subscribers replay in order per publisher, so a failed link
 * resumes from the stored checkpoint and positions stay gap-free.
 */
public with sharing class EvidenceCaptureQueueable implements Queueable {
    private final List<Evidence_Turn__e> turns;

    public EvidenceCaptureQueueable(List<Evidence_Turn__e> turns) {
        this.turns = turns;
    }

    public void execute(QueueableContext context) {
        if (turns == null || turns.isEmpty()) {
            return;
        }

        // Group by agent (== chain), preserving first-seen order so the earliest
        // chain in the batch is processed first and the rest chain deterministically.
        Map<String, List<Evidence_Turn__e>> byAgent = new Map<String, List<Evidence_Turn__e>>();
        List<String> agentOrder = new List<String>();
        for (Evidence_Turn__e turn : turns) {
            String agent = turn.Agent_API_Name__c;
            if (!byAgent.containsKey(agent)) {
                byAgent.put(agent, new List<Evidence_Turn__e>());
                agentOrder.add(agent);
            }
            byAgent.get(agent).add(turn);
        }

        // Process exactly one chain in this transaction.
        String firstAgent = agentOrder[0];
        EvidenceCaptureService.write(byAgent.get(firstAgent));

        // Everything else is deferred to its own Queueable link.
        List<Evidence_Turn__e> remaining = new List<Evidence_Turn__e>();
        for (Integer i = 1; i < agentOrder.size(); i++) {
            remaining.addAll(byAgent.get(agentOrder[i]));
        }

        // Chaining Queueables is not executed in a test transaction and is capped
        // at one enqueue there, so only chain outside tests. The single-chain
        // write above is what a test exercises directly.
        if (!remaining.isEmpty() && !Test.isRunningTest()) {
            System.enqueueJob(new EvidenceCaptureQueueable(remaining));
        }
    }
}
