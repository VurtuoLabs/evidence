/**
 * EvidenceSharingServiceTest
 * Apex managed sharing for Decision_Record__c (CONTRACT.md 8.4, 13).
 *
 * grantMatterAccess writes managed __Share rows with RowCause
 * 'Evidence_Matter_Team__c' attributed to the bundle owner (the matter lead);
 * revokeMatterAccess removes them. The bundle is owned by a second user so the
 * grant targets someone other than the decision owner and is therefore a real,
 * insertable managed share.
 */
@IsTest
private class EvidenceSharingServiceTest {
    private static final String AGENT = 'Claims_Triage';
    private static final String ROW_CAUSE = 'Evidence_Matter_Team__c';

    @IsTest
    static void grantThenRevokeMatterAccess() {
        User matterLead = EvidenceTestSetup.userWith('Evidence_Investigator');

        // Decisions owned by the running (admin) user.
        List<Decision_Record__c> decisions = new List<Decision_Record__c>{
            EvidenceTestFactory.decisionRecord(AGENT, 'LK-SHARE-0'),
            EvidenceTestFactory.decisionRecord(AGENT, 'LK-SHARE-1')
        };
        insert decisions;
        List<Id> decisionIds = new List<Id>{ decisions[0].Id, decisions[1].Id };

        // Bundle owned by the matter lead so the managed share has a valid target.
        Evidence_Bundle__c bundle = EvidenceTestFactory.bundle('Matter-Share-1');
        bundle.OwnerId = matterLead.Id;
        insert bundle;

        // Link the decisions to the bundle so revoke can resolve them.
        insert new List<Bundle_Item__c>{
            EvidenceTestFactory.bundleItem(bundle.Id, decisions[0].Id, 'LK-SHARE-0'),
            EvidenceTestFactory.bundleItem(bundle.Id, decisions[1].Id, 'LK-SHARE-1')
        };

        Test.startTest();
        Integer granted = EvidenceSharingService.grantMatterAccess(bundle.Id, decisionIds);
        Assert.areEqual(2, granted, 'A managed share must be written per decision.');

        List<Decision_Record__Share> shares = [
            SELECT Id, ParentId, AccessLevel, RowCause, UserOrGroupId
            FROM Decision_Record__Share
            WHERE ParentId IN :decisionIds AND RowCause = :ROW_CAUSE
        ];
        Assert.areEqual(2, shares.size(), 'Both managed shares must exist.');
        for (Decision_Record__Share sh : shares) {
            Assert.areEqual('Read', sh.AccessLevel, 'Matter-team access is Read.');
            Assert.areEqual(matterLead.Id, sh.UserOrGroupId, 'The grant targets the matter lead.');
        }

        // Re-granting is idempotent: the existing grant is not duplicated.
        Assert.areEqual(
            0,
            EvidenceSharingService.grantMatterAccess(bundle.Id, decisionIds),
            'Duplicate grant is a no-op.'
        );

        Integer revoked = EvidenceSharingService.revokeMatterAccess(bundle.Id);
        Test.stopTest();

        Assert.areEqual(2, revoked, 'Every matter-team share must be revoked.');
        List<Decision_Record__Share> remaining = [
            SELECT Id
            FROM Decision_Record__Share
            WHERE ParentId IN :decisionIds AND RowCause = :ROW_CAUSE
        ];
        Assert.areEqual(0, remaining.size(), 'No matter-team share may remain after withdraw.');
    }

    @IsTest
    static void grantAndRevokeAreNoOpsOnEmptyInput() {
        Test.startTest();
        Assert.areEqual(
            0,
            EvidenceSharingService.grantMatterAccess(null, new List<Id>()),
            'Null bundle grants nothing.'
        );
        Assert.areEqual(0, EvidenceSharingService.revokeMatterAccess(null), 'Null bundle revokes nothing.');
        Test.stopTest();
    }
}
