/**
 * EvidenceTurnTrigger
 * The single subscriber to Evidence_Turn__e (CONTRACT.md 3, 10.1).
 *
 * One trigger per object, thin by design: it guards on the capture bypass and
 * delegates to EvidenceTurnTriggerHandler, which enqueues EvidenceCaptureQueueable.
 * Nothing else subscribes to this event.
 */
trigger EvidenceTurnTrigger on Evidence_Turn__e(after insert) {
    if (!EvidenceCaptureService.bypass) {
        EvidenceTurnTriggerHandler.handleAfterInsert(Trigger.new);
    }
}
