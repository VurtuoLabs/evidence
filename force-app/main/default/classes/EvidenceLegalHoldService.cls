/**
 * EvidenceLegalHoldService
 * Issue and release legal holds, and answer whether a ledger key is held.
 *
 * Per CONTRACT.md 9.2 and 5.3: a Legal_Hold__c suspends purge for a matter.
 * isHeld is consulted by the retention job on every candidate, so it must be
 * cheap and correct. Scope is expressed as Scope_Filter_JSON__c, matched against
 * the candidate decision.
 *
 * Requires Evidence_Manage_Legal_Hold to issue or release.
 */
public with sharing class EvidenceLegalHoldService {
    private static final String PERM_MANAGE = 'Evidence_Manage_Legal_Hold';

    /** Input for issuing a hold. */
    public class HoldInput {
        @AuraEnabled
        public String matter;
        @AuraEnabled
        public String scopeFilterJson; // e.g. {"agentApiName":"Claims_Triage","from":..,"to":..}
        @AuraEnabled
        public Date effectiveFrom;
    }

    /**
     * Issue an active legal hold for a matter.
     * @param input matter, scope and effective date
     * @return the inserted Legal_Hold__c
     */
    public static Legal_Hold__c issue(HoldInput input) {
        requireManage();
        if (input == null || String.isBlank(input.matter)) {
            throw new EvidenceException('A matter is required to issue a legal hold.');
        }
        Legal_Hold__c hold = new Legal_Hold__c(
            Matter__c = input.matter,
            Scope_Filter_JSON__c = input.scopeFilterJson,
            Effective_From__c = input.effectiveFrom == null ? System.today() : input.effectiveFrom,
            Issued_By__c = UserInfo.getUserId(),
            Active__c = true
        );
        insert as user hold;
        return hold;
    }

    /**
     * Release an active hold.
     * @param holdId the hold to release
     * @param reason a human-readable reason (recorded on the matter annotation)
     * @return the updated Legal_Hold__c
     */
    public static Legal_Hold__c release(Id holdId, String reason) {
        requireManage();
        List<Legal_Hold__c> holds = [
            SELECT Id, Matter__c, Active__c, Released_At__c
            FROM Legal_Hold__c
            WHERE Id = :holdId
            WITH USER_MODE
            LIMIT 1
        ];
        if (holds.isEmpty()) {
            throw new EvidenceException('Legal hold not found: ' + holdId);
        }
        Legal_Hold__c hold = holds[0];
        hold.Active__c = false;
        hold.Released_At__c = System.now();
        if (String.isNotBlank(reason)) {
            hold.Matter__c = hold.Matter__c + ' | Released: ' + reason;
        }
        update as user hold;
        return hold;
    }

    /**
     * Whether the given ledger key falls within any active hold's scope.
     * Consulted by the retention job on every candidate (CONTRACT 9.2).
     * @param ledgerKey the candidate decision's ledger key
     * @return true if an active hold covers it
     */
    public static Boolean isHeld(String ledgerKey) {
        if (String.isBlank(ledgerKey)) {
            return false;
        }
        List<Legal_Hold__c> activeHolds = [
            SELECT Scope_Filter_JSON__c, Effective_From__c
            FROM Legal_Hold__c
            WHERE Active__c = TRUE
            WITH USER_MODE
        ];
        if (activeHolds.isEmpty()) {
            return false;
        }

        List<Decision_Record__c> matches = [
            SELECT Agent_API_Name__c, Occurred_At__c, Consequence_Level__c, Subject_Object__c
            FROM Decision_Record__c
            WHERE Ledger_Key__c = :ledgerKey
            WITH USER_MODE
            LIMIT 1
        ];
        if (matches.isEmpty()) {
            return false;
        }
        Decision_Record__c decision = matches[0];

        for (Legal_Hold__c hold : activeHolds) {
            if (scopeCovers(hold, decision)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Does a hold's scope filter cover a decision? A blank scope means the whole
     * matter (everything is held). Otherwise the JSON may narrow by agentApiName,
     * consequenceLevel, subjectObject and an occurrence window (from/to millis).
     */
    private static Boolean scopeCovers(Legal_Hold__c hold, Decision_Record__c decision) {
        // Effective_From__c is the date the HOLD takes force. It is not a floor on
        // which decisions the hold covers: a hold is issued precisely to preserve
        // records that already exist, so testing it against the decision's own
        // occurrence date would exclude all the history the hold was raised to
        // protect and let the retention job purge it. Narrowing a hold by when a
        // decision occurred is what the scope filter's from/to window is for.
        if (hold.Effective_From__c != null && hold.Effective_From__c > System.today()) {
            return false; // not yet in force
        }
        if (String.isBlank(hold.Scope_Filter_JSON__c)) {
            return true; // matter-wide hold
        }
        Map<String, Object> scope;
        try {
            scope = (Map<String, Object>) JSON.deserializeUntyped(hold.Scope_Filter_JSON__c);
        } catch (Exception e) {
            // A malformed scope is treated as matter-wide: fail safe toward holding.
            return true;
        }
        if (
            scope.containsKey('agentApiName') && !matchesString(scope.get('agentApiName'), decision.Agent_API_Name__c)
        ) {
            return false;
        }
        if (
            scope.containsKey('consequenceLevel') &&
            !matchesString(scope.get('consequenceLevel'), decision.Consequence_Level__c)
        ) {
            return false;
        }
        if (
            scope.containsKey('subjectObject') && !matchesString(scope.get('subjectObject'), decision.Subject_Object__c)
        ) {
            return false;
        }
        if (
            scope.containsKey('from') &&
            decision.Occurred_At__c != null &&
            decision.Occurred_At__c.getTime() < toLong(scope.get('from'))
        ) {
            return false;
        }
        if (
            scope.containsKey('to') &&
            decision.Occurred_At__c != null &&
            decision.Occurred_At__c.getTime() > toLong(scope.get('to'))
        ) {
            return false;
        }
        return true;
    }

    private static Boolean matchesString(Object scopeValue, String actual) {
        return scopeValue != null && String.valueOf(scopeValue).equalsIgnoreCase(actual);
    }

    private static Long toLong(Object value) {
        return value == null ? 0L : Long.valueOf(String.valueOf(value));
    }

    private static void requireManage() {
        if (!FeatureManagement.checkPermission(PERM_MANAGE)) {
            throw new EvidenceException('You do not have permission to manage legal holds.');
        }
    }
}
