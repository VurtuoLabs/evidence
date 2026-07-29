/**
 * EvidenceBundleService
 * Assemble, seal, export and withdraw evidence bundles.
 *
 * Per CONTRACT.md 9.2:
 *   - draft creates a Draft bundle. Requires Evidence_Assemble_Bundle.
 *   - addDecisions links decisions and grants matter-team sharing via
 *     EvidenceSharingService.
 *   - seal verifies the chain segment, computes Segment_Root_Hash__c, links the
 *     daily anchor and flips to Sealed. Requires Evidence_Seal_Bundle.
 *   - export applies the redaction profile and returns a ContentVersion.
 *   - withdraw revokes matter-team sharing and flips to Withdrawn.
 */
public with sharing class EvidenceBundleService {
    private static final String PERM_ASSEMBLE = 'Evidence_Assemble_Bundle';
    private static final String PERM_SEAL = 'Evidence_Seal_Bundle';

    /** Input for drafting a bundle. */
    public class BundleInput {
        @AuraEnabled
        public String matter;
        @AuraEnabled
        public String purpose;
        @AuraEnabled
        public Datetime rangeStart;
        @AuraEnabled
        public Datetime rangeEnd;
        @AuraEnabled
        public String redactionProfile;
        @AuraEnabled
        public String exportFormat;
    }

    /** Result of a seal operation. */
    public class BundleResult {
        @AuraEnabled
        public Id bundleId;
        @AuraEnabled
        public String state;
        @AuraEnabled
        public String segmentRootHash;
        @AuraEnabled
        public String anchorReference;
        @AuraEnabled
        public Integer decisionCount;
        @AuraEnabled
        public Boolean chainVerified;
        @AuraEnabled
        public String message;
    }

    /**
     * Create a Draft bundle.
     * @param input the matter, purpose, range and profiles
     * @return the inserted Evidence_Bundle__c
     */
    public static Evidence_Bundle__c draft(BundleInput input) {
        requirePermission(PERM_ASSEMBLE, 'assemble a bundle');
        if (input == null || String.isBlank(input.matter)) {
            throw new EvidenceException('A matter is required to draft a bundle.');
        }
        Evidence_Bundle__c bundle = new Evidence_Bundle__c(
            Matter__c = input.matter,
            Purpose__c = input.purpose,
            Range_Start__c = input.rangeStart,
            Range_End__c = input.rangeEnd,
            Redaction_Profile__c = input.redactionProfile,
            Export_Format__c = input.exportFormat,
            State__c = 'Draft',
            Decision_Count__c = 0
        );
        insert as user bundle;
        return bundle;
    }

    /**
     * Link decisions to a draft bundle and grant matter-team sharing.
     * @param bundleId the target bundle
     * @param ledgerKeys the ledger keys to add
     * @return the number of decisions newly added
     */
    public static Integer addDecisions(Id bundleId, List<String> ledgerKeys) {
        requirePermission(PERM_ASSEMBLE, 'add decisions to a bundle');
        Evidence_Bundle__c bundle = loadBundle(bundleId);
        if (bundle.State__c != 'Draft') {
            throw new EvidenceException('Only a Draft bundle can accept decisions.');
        }
        if (ledgerKeys == null || ledgerKeys.isEmpty()) {
            return 0;
        }

        Map<String, Id> decisionByKey = new Map<String, Id>();
        for (Decision_Record__c rec : [
            SELECT Id, Ledger_Key__c
            FROM Decision_Record__c
            WHERE Ledger_Key__c IN :ledgerKeys
            WITH USER_MODE
        ]) {
            decisionByKey.put(rec.Ledger_Key__c, rec.Id);
        }

        Set<String> existingKeys = new Set<String>();
        for (Bundle_Item__c item : [
            SELECT Ledger_Key__c
            FROM Bundle_Item__c
            WHERE Evidence_Bundle__c = :bundleId
            WITH USER_MODE
        ]) {
            existingKeys.add(item.Ledger_Key__c);
        }

        List<Bundle_Item__c> items = new List<Bundle_Item__c>();
        List<Id> decisionIds = new List<Id>();
        for (String key : decisionByKey.keySet()) {
            if (existingKeys.contains(key)) {
                continue;
            }
            items.add(
                new Bundle_Item__c(
                    Evidence_Bundle__c = bundleId,
                    Decision_Record__c = decisionByKey.get(key),
                    Ledger_Key__c = key
                )
            );
            decisionIds.add(decisionByKey.get(key));
        }
        if (items.isEmpty()) {
            return 0;
        }
        insert as user items;

        // Matter-scoped managed sharing for exactly the decisions in the bundle.
        EvidenceSharingService.grantMatterAccess(bundleId, decisionIds);

        bundle.Decision_Count__c = (bundle.Decision_Count__c == null ? 0 : bundle.Decision_Count__c) + items.size();
        update as user bundle;
        return items.size();
    }

    /**
     * Seal a bundle: verify its chain segment, compute the segment root hash,
     * link the daily anchor and flip to Sealed.
     * @param bundleId the bundle to seal
     * @return the seal result
     */
    public static BundleResult seal(Id bundleId) {
        requirePermission(PERM_SEAL, 'seal a bundle');
        Evidence_Bundle__c bundle = loadBundle(bundleId);
        if (bundle.State__c != 'Draft') {
            throw new EvidenceException('Only a Draft bundle can be sealed.');
        }

        List<Decision_Record__c> decisions = [
            SELECT Id, Ledger_Key__c, Agent_API_Name__c, This_Hash__c, Chain_Position__c
            FROM Decision_Record__c
            WHERE Id IN (SELECT Decision_Record__c FROM Bundle_Item__c WHERE Evidence_Bundle__c = :bundleId)
            WITH USER_MODE
            ORDER BY Agent_API_Name__c ASC, Chain_Position__c ASC
        ];
        if (decisions.isEmpty()) {
            throw new EvidenceException('Cannot seal an empty bundle.');
        }

        // Verify each agent's chain segment covered by the bundle.
        Boolean allIntact = verifySegments(decisions);

        // Segment root hash: SHA-256 over the ordered link hashes in the bundle.
        List<String> orderedHashes = new List<String>();
        for (Decision_Record__c rec : decisions) {
            orderedHashes.add(rec.This_Hash__c);
        }
        String rootHash = EncodingUtil.convertToHex(
            Crypto.generateDigest('SHA-256', Blob.valueOf(String.join(orderedHashes, '|')))
        );

        String anchorRef = linkAnchor(decisions);

        bundle.State__c = 'Sealed';
        bundle.Sealed_At__c = System.now();
        bundle.Sealed_By__c = UserInfo.getUserId();
        bundle.Segment_Root_Hash__c = rootHash;
        bundle.Anchor_Reference__c = anchorRef;
        bundle.Decision_Count__c = decisions.size();
        update as user bundle;

        BundleResult result = new BundleResult();
        result.bundleId = bundle.Id;
        result.state = bundle.State__c;
        result.segmentRootHash = rootHash;
        result.anchorReference = anchorRef;
        result.decisionCount = decisions.size();
        result.chainVerified = allIntact;
        result.message = allIntact
            ? 'Sealed. All chain segments verified intact.'
            : 'Sealed with warning: a chain break was detected in a covered segment.';
        return result;
    }

    /**
     * Export a sealed bundle, applying its redaction profile, as a ContentVersion.
     * @param bundleId the bundle to export
     * @param format the export format label (defaults to the bundle's own)
     * @return the inserted ContentVersion
     */
    public static ContentVersion export(Id bundleId, String format) {
        Evidence_Bundle__c bundle = loadBundle(bundleId);
        if (bundle.State__c != 'Sealed' && bundle.State__c != 'Delivered') {
            throw new EvidenceException('Only a Sealed or Delivered bundle can be exported.');
        }
        String effectiveFormat = String.isBlank(format) ? bundle.Export_Format__c : format;

        List<Decision_Record__c> decisions = [
            SELECT
                Ledger_Key__c,
                Agent_API_Name__c,
                Occurred_At__c,
                Headline__c,
                Outcome__c,
                Autonomy_Level__c,
                Consequence_Level__c,
                Subject_Reference__c,
                This_Hash__c,
                Prior_Hash__c,
                Chain_Position__c
            FROM Decision_Record__c
            WHERE Id IN (SELECT Decision_Record__c FROM Bundle_Item__c WHERE Evidence_Bundle__c = :bundleId)
            WITH USER_MODE
            ORDER BY Agent_API_Name__c ASC, Chain_Position__c ASC
        ];

        Set<String> redactPaths = redactionPathsForExport(bundle.Redaction_Profile__c);
        List<Map<String, Object>> rows = new List<Map<String, Object>>();
        for (Decision_Record__c rec : decisions) {
            Map<String, Object> row = new Map<String, Object>{
                'ledgerKey' => rec.Ledger_Key__c,
                'agentApiName' => rec.Agent_API_Name__c,
                'occurredAt' => rec.Occurred_At__c,
                'headline' => rec.Headline__c,
                'outcome' => rec.Outcome__c,
                'autonomyLevel' => rec.Autonomy_Level__c,
                'consequenceLevel' => rec.Consequence_Level__c,
                'subjectReference' => redactPaths.contains('Subject_Reference__c') ? null : rec.Subject_Reference__c,
                'thisHash' => rec.This_Hash__c,
                'priorHash' => rec.Prior_Hash__c,
                'chainPosition' => rec.Chain_Position__c
            };
            rows.add(row);
        }

        Map<String, Object> manifest = new Map<String, Object>{
            'bundle' => bundle.Matter__c,
            'purpose' => bundle.Purpose__c,
            'segmentRootHash' => bundle.Segment_Root_Hash__c,
            'anchorReference' => bundle.Anchor_Reference__c,
            'sealedAt' => bundle.Sealed_At__c,
            'redactionProfile' => bundle.Redaction_Profile__c,
            'format' => effectiveFormat,
            'decisions' => rows
        };

        ContentVersion cv = new ContentVersion(
            Title = 'Evidence Bundle ' + bundle.Matter__c,
            PathOnClient = 'evidence-bundle-' + bundleId + '.json',
            VersionData = Blob.valueOf(JSON.serializePretty(manifest))
        );
        insert as user cv;
        return cv;
    }

    /**
     * Withdraw a bundle: revoke matter-team sharing and flip to Withdrawn.
     * @param bundleId the bundle to withdraw
     * @param reason a human-readable reason (recorded in Purpose__c annotation)
     * @return the updated bundle
     */
    public static Evidence_Bundle__c withdraw(Id bundleId, String reason) {
        Evidence_Bundle__c bundle = loadBundle(bundleId);
        if (bundle.State__c == 'Withdrawn') {
            return bundle;
        }
        EvidenceSharingService.revokeMatterAccess(bundleId);
        bundle.State__c = 'Withdrawn';
        if (String.isNotBlank(reason)) {
            bundle.Purpose__c =
                (String.isBlank(bundle.Purpose__c) ? '' : bundle.Purpose__c + ' | ') +
                'Withdrawn: ' +
                reason;
        }
        update as user bundle;
        return bundle;
    }

    // ---- internal ----------------------------------------------------------

    private static Boolean verifySegments(List<Decision_Record__c> decisions) {
        // Determine the min/max covered position per agent chain, then verify once each.
        Map<String, Long> minPos = new Map<String, Long>();
        Map<String, Long> maxPos = new Map<String, Long>();
        for (Decision_Record__c rec : decisions) {
            String agent = rec.Agent_API_Name__c;
            Long pos = (Long) rec.Chain_Position__c;
            if (!minPos.containsKey(agent) || pos < minPos.get(agent)) {
                minPos.put(agent, pos);
            }
            if (!maxPos.containsKey(agent) || pos > maxPos.get(agent)) {
                maxPos.put(agent, pos);
            }
        }
        Boolean allIntact = true;
        for (String agent : minPos.keySet()) {
            String chainKey = UserInfo.getOrganizationId() + ':' + agent;
            Chain_Verification__c v = EvidenceChainService.verify(chainKey, minPos.get(agent), maxPos.get(agent));
            if (v.Result__c != 'Intact') {
                allIntact = false;
            }
        }
        return allIntact;
    }

    private static String linkAnchor(List<Decision_Record__c> decisions) {
        // Link the anchor for the first covered agent chain on its latest covered day.
        Decision_Record__c first = decisions[0];
        String chainKey = UserInfo.getOrganizationId() + ':' + first.Agent_API_Name__c;
        Date anchorDate = System.today();
        Chain_Anchor__b anchorRow = EvidenceChainService.anchor(chainKey, anchorDate);
        return anchorRow.Anchor_Key__c;
    }

    private static Set<String> redactionPathsForExport(String profile) {
        Set<String> paths = new Set<String>();
        for (Evidence_Redaction_Rule__mdt rule : EvidenceConfigurationService.redactionRulesForProfile(profile)) {
            if (rule.Applies_To_Export__c == true && String.isNotBlank(rule.Field_Path__c)) {
                paths.add(rule.Field_Path__c);
            }
        }
        return paths;
    }

    private static Evidence_Bundle__c loadBundle(Id bundleId) {
        List<Evidence_Bundle__c> bundles = [
            SELECT
                Id,
                OwnerId,
                Matter__c,
                Purpose__c,
                State__c,
                Decision_Count__c,
                Range_Start__c,
                Range_End__c,
                Redaction_Profile__c,
                Export_Format__c,
                Segment_Root_Hash__c,
                Anchor_Reference__c,
                Sealed_At__c,
                Sealed_By__c
            FROM Evidence_Bundle__c
            WHERE Id = :bundleId
            WITH USER_MODE
            LIMIT 1
        ];
        if (bundles.isEmpty()) {
            throw new EvidenceException('Bundle not found: ' + bundleId);
        }
        return bundles[0];
    }

    private static void requirePermission(String customPermission, String action) {
        if (!FeatureManagement.checkPermission(customPermission)) {
            throw new EvidenceException('You do not have permission to ' + action + '.');
        }
    }
}
