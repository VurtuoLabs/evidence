/**
 * EvidenceConfigurationServiceTest
 * The single CMDT access point (CONTRACT.md 9.1).
 *
 * Tests inject the @TestVisible static caches so no org metadata is assumed
 * (tests must not depend on seeded CMDT). One method exercises the live query
 * path for coverage; the rest inject fixtures.
 */
@IsTest
private class EvidenceConfigurationServiceTest {
    @IsTest
    static void queryPathReturnsNonNull() {
        // Caches start null, so these hit SOQL. The org may or may not have seed
        // data; either way the accessors must return usable values.
        Test.startTest();
        Assert.isNotNull(
            EvidenceConfigurationService.getSetting(),
            'A setting (real or blank default) is always returned.'
        );
        Assert.isNotNull(EvidenceConfigurationService.getCapturePolicies());
        Assert.isNotNull(EvidenceConfigurationService.getConsequenceRules());
        Assert.isNotNull(EvidenceConfigurationService.getRetentionPolicies());
        Assert.isNotNull(EvidenceConfigurationService.getControlMappings());
        Assert.isNotNull(EvidenceConfigurationService.getRedactionRules());
        Assert.isNotNull(EvidenceConfigurationService.getViews());
        Test.stopTest();
    }

    @IsTest
    static void blankSettingCarriesSafeDefaults() {
        // With no cache injected and (in most orgs) no seeded Default record, the
        // service returns an in-memory blank with safe defaults so callers never NPE.
        Evidence_Setting__mdt setting = EvidenceConfigurationService.getSetting();
        Assert.isNotNull(setting);
        Assert.isNotNull(setting.Canonical_Version__c, 'A canonical version must always be resolvable.');
    }

    @IsTest
    static void injectedCachesAreReturned() {
        EvidenceConfigurationService.consequenceRuleCache = new List<Evidence_Consequence_Rule__mdt>{
            new Evidence_Consequence_Rule__mdt(Rule_Key__c = 'r1', Match_Strategy__c = 'Action_Name', Active__c = true)
        };
        EvidenceConfigurationService.retentionPolicyCache = new List<Evidence_Retention_Policy__mdt>{
            new Evidence_Retention_Policy__mdt(Policy_Key__c = 'p1', Consequence_Level__c = 'High', Active__c = true)
        };
        EvidenceConfigurationService.viewCache = new List<Evidence_View__mdt>{
            new Evidence_View__mdt(View_Key__c = 'ALL_DECISIONS', Active__c = true)
        };

        Assert.areEqual(1, EvidenceConfigurationService.getConsequenceRules().size());
        Assert.areEqual('r1', EvidenceConfigurationService.getConsequenceRules()[0].Rule_Key__c);
        Assert.areEqual(1, EvidenceConfigurationService.getRetentionPolicies().size());
        Assert.areEqual('ALL_DECISIONS', EvidenceConfigurationService.getViews()[0].View_Key__c);
    }

    @IsTest
    static void currentCanonicalVersionHonorsSetting() {
        Evidence_Setting__mdt s = new Evidence_Setting__mdt();
        s.Canonical_Version__c = 1;
        EvidenceConfigurationService.settingCache = s;
        Assert.areEqual(1, EvidenceConfigurationService.currentCanonicalVersion());

        // A null configured version falls back to the canonicalizer default.
        Evidence_Setting__mdt blank = new Evidence_Setting__mdt();
        EvidenceConfigurationService.settingCache = blank;
        Assert.areEqual(EvidenceCanonicalizer.CURRENT_VERSION, EvidenceConfigurationService.currentCanonicalVersion());
    }

    @IsTest
    static void redactionRulesForProfileFilters() {
        EvidenceConfigurationService.redactionRuleCache = new List<Evidence_Redaction_Rule__mdt>{
            new Evidence_Redaction_Rule__mdt(
                Rule_Key__c = 'a1',
                Profile__c = 'External_Counsel',
                Field_Path__c = 'Subject_Reference__c',
                Strategy__c = 'Remove',
                Applies_To_Export__c = true,
                Active__c = true
            ),
            new Evidence_Redaction_Rule__mdt(
                Rule_Key__c = 'b1',
                Profile__c = 'Internal_Console',
                Field_Path__c = 'Subject_Reference__c',
                Strategy__c = 'Mask',
                Applies_To_Console__c = true,
                Active__c = true
            )
        };

        List<Evidence_Redaction_Rule__mdt> external = EvidenceConfigurationService.redactionRulesForProfile(
            'external_counsel'
        );
        Assert.areEqual(1, external.size(), 'Profile match is case-insensitive and exact.');
        Assert.areEqual('a1', external[0].Rule_Key__c);

        Assert.areEqual(
            0,
            EvidenceConfigurationService.redactionRulesForProfile(null).size(),
            'Blank profile yields none.'
        );
        Assert.areEqual(
            0,
            EvidenceConfigurationService.redactionRulesForProfile('Nope').size(),
            'Unknown profile yields none.'
        );
    }
}
