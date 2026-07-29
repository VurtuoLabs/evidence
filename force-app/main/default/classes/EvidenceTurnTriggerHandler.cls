/**
 * EvidenceTurnTriggerHandler
 * The one subscriber to Evidence_Turn__e (CONTRACT.md 3, 10.1).
 *
 * EvidenceTurnTrigger (after insert) delegates here, and this handler does one
 * thing: hand the delivered turns to EvidenceCaptureQueueable so the write path
 * runs asynchronously, one chain per Queueable link (CONTRACT 9.3). Keeping the
 * enqueue out of the trigger body keeps the trigger thin and the logic testable.
 *
 * Capture is suppressed when EvidenceCaptureService.bypass is set (the trigger's
 * guard) or when Evidence_Setting__mdt.Capture_Enabled__c is false, so an admin
 * can turn capture off without removing the tap.
 */
public with sharing class EvidenceTurnTriggerHandler {
    /**
     * Enqueue the capture Queueable for a batch of delivered turns.
     * @param turns the Evidence_Turn__e records from Trigger.new
     */
    public static void handleAfterInsert(List<Evidence_Turn__e> turns) {
        if (turns == null || turns.isEmpty()) {
            return;
        }
        // Respect the admin capture switch. bypass is checked by the trigger, but
        // re-checking here keeps the handler safe if called directly.
        if (EvidenceCaptureService.bypass) {
            return;
        }
        Boolean captureEnabled = EvidenceConfigurationService.getSetting().Capture_Enabled__c != false;
        if (!captureEnabled) {
            return;
        }
        System.enqueueJob(new EvidenceCaptureQueueable(turns));
    }
}
