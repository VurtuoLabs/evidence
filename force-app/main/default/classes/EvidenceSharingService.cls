/**
 * EvidenceSharingService
 * Apex managed sharing for Decision_Record__c, scoped to a matter.
 *
 * Per CONTRACT.md 8.4: Decision_Record__c is Private and stays Private. The only
 * programmatic grant is Apex managed sharing with a custom RowCause of
 * 'Evidence_Matter_Team__c', written when a decision is added to a bundle and
 * revoked when the bundle is withdrawn. A managed-sharing grant with a custom row
 * cause cannot be deleted by users, which is the point. No sharing rules, no
 * sharing sets, no manual sharing.
 *
 * Sharing rows are written in SYSTEM mode: Apex managed sharing is a platform
 * operation on the __Share object rather than on the ledger itself, and the grant
 * must not depend on the running user's own access to the target records.
 */
public with sharing class EvidenceSharingService {
    private static final String ROW_CAUSE = 'Evidence_Matter_Team__c';

    /**
     * Grant matter-team Read on a set of decisions, attributed to a bundle.
     * The grant target is the bundle owner (the matter lead).
     * @param bundleId the bundle the decisions belong to
     * @param decisionIds the Decision_Record__c Ids to share
     * @return the number of share rows inserted
     */
    public static Integer grantMatterAccess(Id bundleId, List<Id> decisionIds) {
        if (bundleId == null || decisionIds == null || decisionIds.isEmpty()) {
            return 0;
        }
        Id matterLeadId = resolveMatterLead(bundleId);

        // Skip decisions that already carry this grant for this user.
        Set<Id> alreadyShared = new Set<Id>();
        for (Decision_Record__Share existing : [
            SELECT ParentId
            FROM Decision_Record__Share
            WHERE ParentId IN :decisionIds AND UserOrGroupId = :matterLeadId AND RowCause = :ROW_CAUSE
        ]) {
            alreadyShared.add(existing.ParentId);
        }

        List<Decision_Record__Share> shares = new List<Decision_Record__Share>();
        for (Id decisionId : new Set<Id>(decisionIds)) {
            if (alreadyShared.contains(decisionId)) {
                continue;
            }
            shares.add(
                new Decision_Record__Share(
                    ParentId = decisionId,
                    UserOrGroupId = matterLeadId,
                    AccessLevel = 'Read',
                    RowCause = ROW_CAUSE
                )
            );
        }
        if (shares.isEmpty()) {
            return 0;
        }
        Database.SaveResult[] results = Database.insert(shares, false);
        Integer inserted = 0;
        for (Database.SaveResult sr : results) {
            if (sr.isSuccess()) {
                inserted++;
            }
        }
        return inserted;
    }

    /**
     * Revoke every matter-team grant tied to a bundle's decisions.
     * @param bundleId the bundle whose grants are revoked
     * @return the number of share rows deleted
     */
    public static Integer revokeMatterAccess(Id bundleId) {
        if (bundleId == null) {
            return 0;
        }
        Set<Id> decisionIds = new Set<Id>();
        for (Bundle_Item__c item : [
            SELECT Decision_Record__c
            FROM Bundle_Item__c
            WHERE Evidence_Bundle__c = :bundleId
            WITH USER_MODE
        ]) {
            if (item.Decision_Record__c != null) {
                decisionIds.add(item.Decision_Record__c);
            }
        }
        if (decisionIds.isEmpty()) {
            return 0;
        }
        List<Decision_Record__Share> toDelete = [
            SELECT Id
            FROM Decision_Record__Share
            WHERE ParentId IN :decisionIds AND RowCause = :ROW_CAUSE
        ];
        if (toDelete.isEmpty()) {
            return 0;
        }
        delete toDelete;
        return toDelete.size();
    }

    /** The matter lead is the bundle owner; grants are attributed to them. */
    private static Id resolveMatterLead(Id bundleId) {
        List<Evidence_Bundle__c> bundles = [
            SELECT OwnerId
            FROM Evidence_Bundle__c
            WHERE Id = :bundleId
            WITH USER_MODE
            LIMIT 1
        ];
        if (bundles.isEmpty()) {
            throw new EvidenceException('Bundle not found: ' + bundleId);
        }
        return bundles[0].OwnerId;
    }
}
