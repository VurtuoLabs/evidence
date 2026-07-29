/**
 * EvidenceLegalHoldServiceTest
 * Issue, release and scope-aware isHeld (CONTRACT.md 5.3, 9.2, 13).
 *
 * Mandatory case: a hold blocks purge for exactly the held scope and nothing more,
 * exercised here through isHeld - a scoped hold covers its own agent's decision and
 * not another agent's.
 *
 * issue/release require Evidence_Manage_Legal_Hold (an Evidence_Custodian seat);
 * isHeld carries no gate because the retention job consults it on every candidate.
 */
@IsTest
private class EvidenceLegalHoldServiceTest {
    private static final String HELD_AGENT = 'Claims_Triage';
    private static final String FREE_AGENT = 'Billing';

    private static Decision_Record__c insertDecision(String agent, String ledgerKey) {
        Decision_Record__c rec = EvidenceTestFactory.decisionRecord(agent, ledgerKey);
        rec.Occurred_At__c = System.now();
        insert rec;
        return rec;
    }

    @IsTest
    static void issueAndReleaseFlipsActive() {
        User custodian = EvidenceTestSetup.userWith('Evidence_Custodian');
        insertDecision(HELD_AGENT, 'LK-HOLD-0');

        Test.startTest();
        System.runAs(custodian) {
            EvidenceLegalHoldService.HoldInput input = new EvidenceLegalHoldService.HoldInput();
            input.matter = 'Matter-Hold-1';
            Legal_Hold__c hold = EvidenceLegalHoldService.issue(input);
            Assert.isTrue(hold.Active__c, 'A newly issued hold is active.');
            Assert.isTrue(EvidenceLegalHoldService.isHeld('LK-HOLD-0'), 'A matter-wide hold covers the decision.');

            Legal_Hold__c released = EvidenceLegalHoldService.release(hold.Id, 'Litigation resolved');
            Assert.isFalse(released.Active__c, 'A released hold is inactive.');
            Assert.isNotNull(released.Released_At__c, 'Release timestamp must be set.');
            Assert.isFalse(
                EvidenceLegalHoldService.isHeld('LK-HOLD-0'),
                'A released hold no longer covers the decision.'
            );
        }
        Test.stopTest();
    }

    @IsTest
    static void scopedHoldCoversOnlyItsScope() {
        User custodian = EvidenceTestSetup.userWith('Evidence_Custodian');
        insertDecision(HELD_AGENT, 'LK-HELD');
        insertDecision(FREE_AGENT, 'LK-FREE');

        Test.startTest();
        System.runAs(custodian) {
            EvidenceLegalHoldService.HoldInput input = new EvidenceLegalHoldService.HoldInput();
            input.matter = 'Matter-Scoped';
            input.scopeFilterJson = JSON.serialize(new Map<String, Object>{ 'agentApiName' => HELD_AGENT });
            EvidenceLegalHoldService.issue(input);

            Assert.isTrue(EvidenceLegalHoldService.isHeld('LK-HELD'), 'The held agent decision is in scope.');
            Assert.isFalse(EvidenceLegalHoldService.isHeld('LK-FREE'), 'A different agent is out of scope.');
        }
        Test.stopTest();
    }

    @IsTest
    static void isHeldFalseForUnknownAndBlankKey() {
        User custodian = EvidenceTestSetup.userWith('Evidence_Custodian');
        Test.startTest();
        System.runAs(custodian) {
            Assert.isFalse(EvidenceLegalHoldService.isHeld(null), 'A blank key is never held.');
            Assert.isFalse(EvidenceLegalHoldService.isHeld('LK-NONE'), 'No active hold, nothing is held.');
        }
        Test.stopTest();
    }

    @IsTest
    static void issueRequiresPermissionAndMatter() {
        User analyst = EvidenceTestSetup.userWith('Evidence_Analyst'); // lacks Manage Legal Hold
        User custodian = EvidenceTestSetup.userWith('Evidence_Custodian');

        Test.startTest();
        System.runAs(analyst) {
            EvidenceLegalHoldService.HoldInput input = new EvidenceLegalHoldService.HoldInput();
            input.matter = 'Matter-Denied';
            try {
                EvidenceLegalHoldService.issue(input);
                Assert.fail('An Analyst cannot manage legal holds.');
            } catch (EvidenceException e) {
                Assert.isTrue(e.getMessage().contains('permission'), e.getMessage());
            }
        }
        System.runAs(custodian) {
            try {
                EvidenceLegalHoldService.issue(new EvidenceLegalHoldService.HoldInput());
                Assert.fail('Issuing without a matter must throw.');
            } catch (EvidenceException e) {
                Assert.isTrue(e.getMessage().contains('matter'), e.getMessage());
            }
        }
        Test.stopTest();
    }
}
