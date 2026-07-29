/**
 * EvidenceControlService
 * The regulatory control mapping, which is data not code (CONTRACT.md 7).
 *
 * getMappings surfaces Evidence_Control_Mapping__mdt (EU AI Act Art. 12/14,
 * SR 11-7, SOC 2 CC7, HIPAA disclosure accounting, GDPR Art. 22, and whatever a
 * customer adds). evidenceFor resolves a control's Evidence_Query_JSON__c into a
 * LedgerQuery and runs it through EvidenceLedgerService, so control evidence is
 * redacted for the running user exactly like any other ledger read.
 */
public with sharing class EvidenceControlService {
    /** A control mapping surfaced to the console. */
    public class ControlMappingView {
        @AuraEnabled
        public String controlKey;
        @AuraEnabled
        public String framework;
        @AuraEnabled
        public String controlReference;
        @AuraEnabled
        public String controlLabel;
        @AuraEnabled
        public String satisfiedBy;
        @AuraEnabled
        public String evidenceQueryJson;
    }

    /**
     * All active control mappings, ordered by framework then reference.
     * @return the control mapping views
     */
    public static List<ControlMappingView> getMappings() {
        List<ControlMappingView> views = new List<ControlMappingView>();
        for (Evidence_Control_Mapping__mdt mapping : EvidenceConfigurationService.getControlMappings()) {
            ControlMappingView v = new ControlMappingView();
            v.controlKey = mapping.Control_Key__c;
            v.framework = mapping.Framework__c;
            v.controlReference = mapping.Control_Reference__c;
            v.controlLabel = mapping.Control_Label__c;
            v.satisfiedBy = mapping.Satisfied_By__c;
            v.evidenceQueryJson = mapping.Evidence_Query_JSON__c;
            views.add(v);
        }
        views.sort(new MappingComparator());
        return views;
    }

    /**
     * The decisions that evidence a control over a window. Resolves the control's
     * stored query, overlays the date range, and delegates to the ledger facade
     * so redaction and permission checks apply.
     * @param controlKey the Control_Key__c to resolve
     * @param fromDate inclusive window start
     * @param toDate inclusive window end
     * @return matching decision views, redacted for the running user
     */
    public static List<EvidenceLedgerService.DecisionView> evidenceFor(
        String controlKey,
        Datetime fromDate,
        Datetime toDate
    ) {
        Evidence_Control_Mapping__mdt mapping = findMapping(controlKey);
        if (mapping == null) {
            throw new EvidenceException('No control mapping found for key ' + controlKey);
        }

        EvidenceLedgerService.LedgerQuery query = new EvidenceLedgerService.LedgerQuery();
        if (String.isNotBlank(mapping.Evidence_Query_JSON__c)) {
            applyStoredFilters(query, mapping.Evidence_Query_JSON__c);
        }
        // The caller-supplied window overrides whatever the stored query carried.
        if (fromDate != null) {
            query.fromDate = fromDate;
        }
        if (toDate != null) {
            query.toDate = toDate;
        }
        return EvidenceLedgerService.getDecisions(query);
    }

    // ---- internal ----------------------------------------------------------

    // The parameter must not be named `json`: Apex identifiers are case-insensitive,
    // so it would shadow the System.JSON class and break the deserialize call below.
    private static void applyStoredFilters(EvidenceLedgerService.LedgerQuery query, String filterJson) {
        Map<String, Object> filters;
        try {
            filters = (Map<String, Object>) JSON.deserializeUntyped(filterJson);
        } catch (Exception e) {
            throw new EvidenceException('Control mapping Evidence_Query_JSON is not valid JSON.');
        }
        if (filters.get('agentApiName') != null) {
            query.agentApiName = String.valueOf(filters.get('agentApiName'));
        }
        if (filters.get('consequenceLevel') != null) {
            query.consequenceLevel = String.valueOf(filters.get('consequenceLevel'));
        }
        if (filters.get('outcome') != null) {
            query.outcome = String.valueOf(filters.get('outcome'));
        }
        if (filters.get('autonomyLevel') != null) {
            query.autonomyLevel = String.valueOf(filters.get('autonomyLevel'));
        }
        if (filters.get('maxRows') != null) {
            query.maxRows = Integer.valueOf(String.valueOf(filters.get('maxRows')));
        }
    }

    private static Evidence_Control_Mapping__mdt findMapping(String controlKey) {
        for (Evidence_Control_Mapping__mdt mapping : EvidenceConfigurationService.getControlMappings()) {
            if (mapping.Control_Key__c == controlKey) {
                return mapping;
            }
        }
        return null;
    }

    /** Orders mappings by framework, then control reference, for a stable UI. */
    private class MappingComparator implements Comparator<ControlMappingView> {
        public Integer compare(ControlMappingView a, ControlMappingView b) {
            Integer byFramework = nullSafe(a.framework).compareTo(nullSafe(b.framework));
            if (byFramework != 0) {
                return byFramework;
            }
            return nullSafe(a.controlReference).compareTo(nullSafe(b.controlReference));
        }
        private String nullSafe(String value) {
            return value == null ? '' : value;
        }
    }
}
