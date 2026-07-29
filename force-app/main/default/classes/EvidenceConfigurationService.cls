/**
 * EvidenceConfigurationService
 * Single point of Custom Metadata Type access for the Evidence package.
 *
 * Per CONTRACT.md 9.1: CMDT is read through this service's static caches,
 * one SOQL per type per transaction. Every other service reads configuration
 * from here so a transaction never issues the same CMDT query twice.
 *
 * Caches are @TestVisible so Apex tests can inject fixtures without seeding
 * org metadata (tests must not assume org data).
 */
public with sharing class EvidenceConfigurationService {
    @TestVisible
    private static Evidence_Setting__mdt settingCache;
    @TestVisible
    private static List<Evidence_Capture_Policy__mdt> capturePolicyCache;
    @TestVisible
    private static List<Evidence_Consequence_Rule__mdt> consequenceRuleCache;
    @TestVisible
    private static List<Evidence_Retention_Policy__mdt> retentionPolicyCache;
    @TestVisible
    private static List<Evidence_Control_Mapping__mdt> controlMappingCache;
    @TestVisible
    private static List<Evidence_Redaction_Rule__mdt> redactionRuleCache;
    @TestVisible
    private static List<Evidence_View__mdt> viewCache;

    /**
     * The single Evidence_Setting__mdt 'Default' record. If none is seeded a
     * blank record carrying safe in-memory defaults is returned so callers
     * never NPE on a fresh org.
     */
    public static Evidence_Setting__mdt getSetting() {
        if (settingCache == null) {
            List<Evidence_Setting__mdt> rows = [
                SELECT
                    DeveloperName,
                    Capture_Enabled__c,
                    Require_Rationale_Before_Action__c,
                    Chain_Verification_Cron__c,
                    Anchor_Cron__c,
                    Verification_Batch_Size__c,
                    Canonical_Version__c,
                    Default_Retention_Days__c,
                    Completeness_Check_Enabled__c,
                    Completeness_Tolerance_Percent__c
                FROM Evidence_Setting__mdt
                WITH USER_MODE
                ORDER BY DeveloperName
                LIMIT 1
            ];
            if (rows.isEmpty()) {
                Evidence_Setting__mdt blank = new Evidence_Setting__mdt();
                blank.Capture_Enabled__c = true;
                blank.Require_Rationale_Before_Action__c = true;
                blank.Verification_Batch_Size__c = 200;
                blank.Canonical_Version__c = EvidenceCanonicalizer.CURRENT_VERSION;
                blank.Default_Retention_Days__c = 2555; // ~7 years
                blank.Completeness_Check_Enabled__c = true;
                blank.Completeness_Tolerance_Percent__c = 0;
                settingCache = blank;
            } else {
                settingCache = rows[0];
            }
        }
        return settingCache;
    }

    public static List<Evidence_Capture_Policy__mdt> getCapturePolicies() {
        if (capturePolicyCache == null) {
            capturePolicyCache = [
                SELECT
                    DeveloperName,
                    Policy_Key__c,
                    Agent_API_Name__c,
                    Consequence_Level__c,
                    Capture_Utterance__c,
                    Capture_Response__c,
                    Capture_Grounding__c,
                    Capture_Considerations__c,
                    Capture_Variables__c,
                    Require_Rationale__c,
                    Active__c
                FROM Evidence_Capture_Policy__mdt
                WITH USER_MODE
            ];
        }
        return capturePolicyCache;
    }

    /**
     * Consequence rules ordered by Priority__c ascending so the first match in a
     * simple iteration is the highest-priority rule (see EvidenceCaptureService.classify).
     */
    public static List<Evidence_Consequence_Rule__mdt> getConsequenceRules() {
        if (consequenceRuleCache == null) {
            consequenceRuleCache = [
                SELECT
                    DeveloperName,
                    Rule_Key__c,
                    Match_Strategy__c,
                    Match_Value__c,
                    Consequence_Level__c,
                    Priority__c,
                    Active__c
                FROM Evidence_Consequence_Rule__mdt
                WHERE Active__c = TRUE
                WITH USER_MODE
                ORDER BY Priority__c ASC NULLS LAST, Rule_Key__c ASC
            ];
        }
        return consequenceRuleCache;
    }

    public static List<Evidence_Retention_Policy__mdt> getRetentionPolicies() {
        if (retentionPolicyCache == null) {
            retentionPolicyCache = [
                SELECT
                    DeveloperName,
                    Policy_Key__c,
                    Consequence_Level__c,
                    Retention_Days__c,
                    Purge_Strategy__c,
                    Active__c
                FROM Evidence_Retention_Policy__mdt
                WHERE Active__c = TRUE
                WITH USER_MODE
            ];
        }
        return retentionPolicyCache;
    }

    public static List<Evidence_Control_Mapping__mdt> getControlMappings() {
        if (controlMappingCache == null) {
            controlMappingCache = [
                SELECT
                    DeveloperName,
                    Control_Key__c,
                    Framework__c,
                    Control_Reference__c,
                    Control_Label__c,
                    Satisfied_By__c,
                    Evidence_Query_JSON__c,
                    Active__c
                FROM Evidence_Control_Mapping__mdt
                WHERE Active__c = TRUE
                WITH USER_MODE
            ];
        }
        return controlMappingCache;
    }

    public static List<Evidence_Redaction_Rule__mdt> getRedactionRules() {
        if (redactionRuleCache == null) {
            redactionRuleCache = [
                SELECT
                    DeveloperName,
                    Rule_Key__c,
                    Profile__c,
                    Field_Path__c,
                    Strategy__c,
                    Applies_To_Export__c,
                    Applies_To_Console__c,
                    Active__c
                FROM Evidence_Redaction_Rule__mdt
                WHERE Active__c = TRUE
                WITH USER_MODE
            ];
        }
        return redactionRuleCache;
    }

    public static List<Evidence_View__mdt> getViews() {
        if (viewCache == null) {
            viewCache = [
                SELECT DeveloperName, View_Key__c, Label__c, Filter_JSON__c, Display_Order__c, Active__c
                FROM Evidence_View__mdt
                WHERE Active__c = TRUE
                WITH USER_MODE
                ORDER BY Display_Order__c ASC NULLS LAST
            ];
        }
        return viewCache;
    }

    /** Convenience: the canonical version the org is currently writing with. */
    public static Integer currentCanonicalVersion() {
        Decimal v = getSetting().Canonical_Version__c;
        return v == null ? EvidenceCanonicalizer.CURRENT_VERSION : Integer.valueOf(v);
    }

    /** Redaction rules for a named profile, filtered to those active. */
    public static List<Evidence_Redaction_Rule__mdt> redactionRulesForProfile(String profile) {
        List<Evidence_Redaction_Rule__mdt> matched = new List<Evidence_Redaction_Rule__mdt>();
        if (String.isBlank(profile)) {
            return matched;
        }
        for (Evidence_Redaction_Rule__mdt rule : getRedactionRules()) {
            if (profile.equalsIgnoreCase(rule.Profile__c)) {
                matched.add(rule);
            }
        }
        return matched;
    }
}
