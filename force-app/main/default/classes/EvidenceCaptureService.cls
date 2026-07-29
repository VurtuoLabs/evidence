/**
 * EvidenceCaptureService
 * The write path: classify, canonicalize, chain, append the ledger and its index.
 *
 * Per CONTRACT.md 9.3 the caller (EvidenceCaptureQueueable) hands this service one
 * chain at a time, in order. write() reads the terminal position once per chain,
 * assigns positions in memory across the batch, then persists Decision_Ledger__b
 * with a single Database.insertImmediate and the Decision_Record__c index rows in
 * the same transaction.
 *
 * THE ONE DOCUMENTED SYSTEM-MODE EXCEPTION (CONTRACT.md 9.1):
 * write() persists in SYSTEM mode (AccessLevel.SYSTEM_MODE), not USER_MODE. This is
 * the only code in the package that does so. Rationale: a user whose profile lacks
 * Evidence access must never cause an agent conversation to fail, and the capture
 * path must never be suppressible by the running user's permissions. Everything
 * that reads the ledger back (EvidenceLedgerService) runs in USER_MODE with
 * redaction, so this asymmetry is exactly the write-but-cannot-read posture 8.2
 * relies on.
 */
public with sharing class EvidenceCaptureService {
    /** Set true by tests / bulk tools to suppress the capture trigger enqueue. */
    public static Boolean bypass = false;

    /** Result of consequence classification for a single turn. */
    public class ConsequenceResult {
        @AuraEnabled
        public String consequenceLevel; // Low | Medium | High
        @AuraEnabled
        public String matchedRuleKey; // null when nothing matched
        @AuraEnabled
        public String autonomyLevel; // autonomous | escalated | approved
    }

    /**
     * Classify, canonicalize, chain and append a batch of turns.
     * Callers must pass turns for a single chain (one agent) at a time so the
     * terminal position is read exactly once and positions stay gap-free.
     * @param turns the platform events for one chain, in occurrence order
     * @return the number of ledger links written
     */
    public static Integer write(List<Evidence_Turn__e> turns) {
        if (turns == null || turns.isEmpty()) {
            return 0;
        }
        Integer canonicalVersion = EvidenceConfigurationService.currentCanonicalVersion();

        // Group by chain key so each chain's counter is read once, in order.
        Map<String, List<Evidence_Turn__e>> byChain = new Map<String, List<Evidence_Turn__e>>();
        for (Evidence_Turn__e turn : turns) {
            String chainKey = chainKeyFor(turn.Agent_API_Name__c);
            if (!byChain.containsKey(chainKey)) {
                byChain.put(chainKey, new List<Evidence_Turn__e>());
            }
            byChain.get(chainKey).add(turn);
        }

        List<Decision_Ledger__b> ledgerRows = new List<Decision_Ledger__b>();
        List<Decision_Record__c> indexRows = new List<Decision_Record__c>();

        for (String chainKey : byChain.keySet()) {
            Long position = EvidenceChainService.nextPosition(chainKey);
            String priorHash = EvidenceChainService.terminalHash(chainKey);

            for (Evidence_Turn__e turn : byChain.get(chainKey)) {
                ConsequenceResult classification = classify(turn);
                Map<String, Object> body = buildBody(turn, classification);
                String canonicalBody = EvidenceCanonicalizer.canonicalize(body, canonicalVersion);

                EvidenceChainService.ChainInput ci = new EvidenceChainService.ChainInput();
                ci.priorHash = priorHash;
                ci.ledgerKey = turn.Ledger_Key__c;
                ci.agentApiName = turn.Agent_API_Name__c;
                ci.occurredAt = turn.Occurred_At__c;
                ci.canonicalBody = canonicalBody;
                String thisHash = EvidenceChainService.computeHash(ci);

                ledgerRows.add(
                    buildLedgerRow(
                        turn,
                        chainKey,
                        position,
                        priorHash,
                        thisHash,
                        canonicalBody,
                        canonicalVersion,
                        classification
                    )
                );
                indexRows.add(buildIndexRow(turn, position, priorHash, thisHash, classification));

                priorHash = thisHash; // chain forward within the batch, in memory
                position++;
            }
        }

        // SYSTEM MODE - see class header. Capture must not fail on the running
        // user's permissions, and Big Object writes are insertImmediate only.
        EvidenceLedgerStore.insertLedger(ledgerRows);
        insert as system indexRows;
        return ledgerRows.size();
    }

    /**
     * Evaluate Evidence_Consequence_Rule__mdt in priority order and return the
     * first match. Defaults to Low when nothing matches.
     * @param turn the turn to classify
     * @return the resolved consequence and autonomy levels
     */
    public static ConsequenceResult classify(Evidence_Turn__e turn) {
        ConsequenceResult out = new ConsequenceResult();
        out.consequenceLevel = 'Low';
        out.autonomyLevel = deriveAutonomy(turn);

        for (Evidence_Consequence_Rule__mdt rule : EvidenceConfigurationService.getConsequenceRules()) {
            if (matches(rule, turn)) {
                out.consequenceLevel = String.isBlank(rule.Consequence_Level__c) ? 'Low' : rule.Consequence_Level__c;
                out.matchedRuleKey = rule.Rule_Key__c;
                return out; // rules are pre-sorted by priority; first match wins
            }
        }
        return out;
    }

    private static Boolean matches(Evidence_Consequence_Rule__mdt rule, Evidence_Turn__e turn) {
        String strategy = rule.Match_Strategy__c;
        String needle = rule.Match_Value__c;
        if (String.isBlank(strategy)) {
            return false;
        }
        if (strategy == 'Action_Name') {
            return containsToken(turn.Actions_Invoked__c, needle);
        }
        if (strategy == 'Object_Written') {
            return containsToken(turn.Actions_Invoked__c, needle) || containsToken(turn.Subject_Object__c, needle);
        }
        if (strategy == 'Policy_Blocked') {
            return containsToken(turn.Policy_Evaluations__c, 'Blocked');
        }
        if (strategy == 'Amount_Threshold') {
            Decimal threshold = safeDecimal(needle);
            return threshold != null && exceedsAmount(turn.Actions_Invoked__c, threshold);
        }
        return false;
    }

    private static Boolean containsToken(String haystack, String needle) {
        if (String.isBlank(haystack) || String.isBlank(needle)) {
            return false;
        }
        // Treat a trailing * as a prefix wildcard, e.g. Issue_*.
        if (needle.endsWith('*')) {
            return haystack.contains(needle.removeEnd('*'));
        }
        return haystack.contains(needle);
    }

    /** Scan action payloads for any numeric literal exceeding the threshold. */
    private static Boolean exceedsAmount(String actionsJson, Decimal threshold) {
        if (String.isBlank(actionsJson)) {
            return false;
        }
        Matcher m = Pattern.compile('[0-9]+\\.?[0-9]*').matcher(actionsJson);
        while (m.find()) {
            Decimal value = safeDecimal(m.group());
            if (value != null && value > threshold) {
                return true;
            }
        }
        return false;
    }

    private static Decimal safeDecimal(String raw) {
        if (String.isBlank(raw)) {
            return null;
        }
        try {
            return Decimal.valueOf(raw.trim());
        } catch (Exception e) {
            return null;
        }
    }

    private static String deriveAutonomy(Evidence_Turn__e turn) {
        // Values must match the Autonomy_Level__c value set (Autonomous / Human_Approved / Escalated).
        if (String.isNotBlank(turn.Approver_Id__c)) {
            return 'Human_Approved';
        }
        if (String.isNotBlank(turn.Escalated_To__c)) {
            return 'Escalated';
        }
        return 'Autonomous';
    }

    private static Map<String, Object> buildBody(Evidence_Turn__e turn, ConsequenceResult classification) {
        // Keys here must be a subset of EvidenceCanonicalizer's allowlist.
        Map<String, Object> body = new Map<String, Object>();
        body.put('agentApiName', turn.Agent_API_Name__c);
        body.put('agentVersion', turn.Agent_Version__c);
        body.put('occurredAt', turn.Occurred_At__c);
        body.put('subjectReference', turn.Subject_Reference__c);
        body.put('subjectObject', turn.Subject_Object__c);
        body.put('actionsInvoked', turn.Actions_Invoked__c);
        body.put('sourcesRead', turn.Sources_Read__c);
        body.put('topicsConsidered', turn.Topics_Considered__c);
        body.put('policyEvaluations', turn.Policy_Evaluations__c);
        body.put('variablesSet', turn.Variables_Set__c);
        body.put('declaredRationale', turn.Declared_Rationale__c);
        body.put('runningUserId', turn.Running_User_Id__c);
        body.put('approverId', turn.Approver_Id__c);
        body.put('escalatedTo', turn.Escalated_To__c);
        body.put('consequenceLevel', classification.consequenceLevel);
        body.put('autonomyLevel', classification.autonomyLevel);
        return body;
    }

    private static Decision_Ledger__b buildLedgerRow(
        Evidence_Turn__e turn,
        String chainKey,
        Long position,
        String priorHash,
        String thisHash,
        String canonicalBody,
        Integer canonicalVersion,
        ConsequenceResult classification
    ) {
        Decision_Ledger__b row = new Decision_Ledger__b();
        row.Chain_Key__c = chainKey;
        row.Chain_Position__c = position;
        row.Ledger_Key__c = turn.Ledger_Key__c;
        row.Occurred_At__c = turn.Occurred_At__c;
        row.Agent_Version__c = turn.Agent_Version__c;
        row.Canonical_Body__c = canonicalBody;
        row.Canonical_Version__c = canonicalVersion;
        row.This_Hash__c = thisHash;
        row.Prior_Hash__c = priorHash;
        row.Consequence_Level__c = classification.consequenceLevel;
        row.Autonomy_Level__c = classification.autonomyLevel;
        row.Subject_Reference__c = turn.Subject_Reference__c;
        row.Running_User_Id__c = turn.Running_User_Id__c;
        row.Approver_Id__c = turn.Approver_Id__c;
        return row;
    }

    private static Decision_Record__c buildIndexRow(
        Evidence_Turn__e turn,
        Long position,
        String priorHash,
        String thisHash,
        ConsequenceResult classification
    ) {
        Decision_Record__c rec = new Decision_Record__c();
        rec.Ledger_Key__c = turn.Ledger_Key__c;
        rec.Agent_API_Name__c = turn.Agent_API_Name__c;
        rec.Agent_Version__c = turn.Agent_Version__c;
        rec.Occurred_At__c = turn.Occurred_At__c;
        rec.Headline__c = buildHeadline(turn);
        rec.Autonomy_Level__c = classification.autonomyLevel;
        rec.Consequence_Level__c = classification.consequenceLevel;
        rec.Subject_Reference__c = turn.Subject_Reference__c;
        rec.Subject_Object__c = turn.Subject_Object__c;
        rec.Actions_Taken__c = turn.Actions_Invoked__c;
        rec.Sources_Read__c = turn.Sources_Read__c;
        rec.Running_User__c = turn.Running_User_Id__c;
        rec.Approver__c = turn.Approver_Id__c;
        rec.Escalated_To__c = turn.Escalated_To__c;
        rec.This_Hash__c = thisHash;
        rec.Prior_Hash__c = priorHash;
        rec.Chain_Position__c = position;
        rec.Under_Legal_Hold__c = false;
        rec.Redaction_State__c = 'None';
        Decimal retentionDays = EvidenceConfigurationService.getSetting().Default_Retention_Days__c;
        if (retentionDays != null && turn.Occurred_At__c != null) {
            rec.Retention_Expires_At__c = turn.Occurred_At__c.date().addDays(Integer.valueOf(retentionDays));
        }
        return rec;
    }

    private static String buildHeadline(Evidence_Turn__e turn) {
        String first = turn.Actions_Invoked__c;
        if (String.isBlank(first)) {
            return 'Agent turn recorded';
        }
        return first.length() > 255 ? first.substring(0, 255) : first;
    }

    private static String chainKeyFor(String agentApiName) {
        return UserInfo.getOrganizationId() + ':' + agentApiName;
    }
}
