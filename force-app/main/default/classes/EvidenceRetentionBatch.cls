/**
 * EvidenceRetentionBatch
 * Nightly, hold-aware purge (CONTRACT.md 5.3, 9.2, 10.2).
 *
 * The purge decision logic lives once, in EvidenceRetentionService.purge:
 * it honors Evidence_Retention_Policy__mdt, skips anything
 * EvidenceLegalHoldService.isHeld reports as held, and where a policy specifies
 * Redact_Body_Keep_Hash it clears Canonical_Body__c while leaving the hashes in
 * place so the chain still verifies. This batch is the nightly driver that walks
 * the expired backlog in chunks and delegates each chunk to that service, so the
 * hold-aware / redaction-aware behavior is never re-implemented or divergent.
 *
 * start() locates expired, not-yet-purged index rows to size the run; the batch
 * scope size (set by the caller in Database.executeBatch) bounds how many rows
 * each delegated purge examines, keeping the per-transaction Big Object reads and
 * DML within limits. Totals accumulate across chunks via Database.Stateful.
 *
 * Requires Evidence_Manage_Retention (enforced inside the service).
 */
public with sharing class EvidenceRetentionBatch implements Database.Batchable<SObject>, Database.Stateful {
    /** Running totals across every chunk of the run. */
    public Integer totalExamined = 0;
    public Integer totalDeleted = 0;
    public Integer totalRedacted = 0;
    public Integer totalSkippedHeld = 0;
    public Integer totalSkippedNoPolicy = 0;

    public Database.QueryLocator start(Database.BatchableContext context) {
        // Only rows whose retention has expired and that have not already been
        // fully purged drive the iteration count.
        return Database.getQueryLocator(
            [
                SELECT Id
                FROM Decision_Record__c
                WHERE Retention_Expires_At__c <= :System.today() AND Redaction_State__c != 'Purged'
                WITH USER_MODE
                ORDER BY Retention_Expires_At__c ASC
            ]
        );
    }

    public void execute(Database.BatchableContext context, List<Decision_Record__c> scope) {
        if (scope == null || scope.isEmpty()) {
            return;
        }
        // Delegate the actual hold check, policy lookup and redact/delete to the
        // service, bounded to this chunk's size.
        EvidenceRetentionService.PurgeResult result = EvidenceRetentionService.purge(scope.size());
        totalExamined += result.examined;
        totalDeleted += result.deleted;
        totalRedacted += result.redacted;
        totalSkippedHeld += result.skippedHeld;
        totalSkippedNoPolicy += result.skippedNoPolicy;
    }

    public void finish(Database.BatchableContext context) {
        // No-op. Retention findings are the mutations the service applied to the
        // ledger and index; there is no separate summary object in the package.
    }
}
