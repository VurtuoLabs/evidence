/**
 * EvidencePermissionMatrixTest
 * The §8.3 custom-permission matrix, asserted positively and negatively
 * (CONTRACT.md 8.3, 13).
 *
 * Each Evidence permission set is assigned to its own System Administrator user,
 * and under System.runAs every one of the eight custom permissions is checked with
 * FeatureManagement.checkPermission against the exact matrix. The two intentional
 * asymmetries are enforced here - in particular Evidence_Administrator holds
 * configuration rights but CANNOT read subject data (separation of duties).
 */
@IsTest
private class EvidencePermissionMatrixTest {
    private static final List<String> ALL_PERMS = new List<String>{
        'Evidence_View_Ledger',
        'Evidence_View_Subject_Data',
        'Evidence_View_Rationale',
        'Evidence_Assemble_Bundle',
        'Evidence_Seal_Bundle',
        'Evidence_Manage_Legal_Hold',
        'Evidence_Verify_Chain',
        'Evidence_Manage_Retention'
    };

    /** Assert the running user holds exactly the granted set and nothing else. */
    private static void assertMatrix(String permissionSet, Set<String> granted) {
        for (String perm : ALL_PERMS) {
            Boolean expected = granted.contains(perm);
            Boolean actual = FeatureManagement.checkPermission(perm);
            Assert.areEqual(
                expected,
                actual,
                permissionSet + ' expected ' + (expected ? 'to hold ' : 'NOT to hold ') + perm
            );
        }
    }

    @IsTest
    static void analystMatrix() {
        User u = EvidenceTestSetup.userWith('Evidence_Analyst');
        Test.startTest();
        System.runAs(u) {
            assertMatrix('Evidence_Analyst', new Set<String>{ 'Evidence_View_Ledger' });
        }
        Test.stopTest();
    }

    @IsTest
    static void investigatorMatrix() {
        User u = EvidenceTestSetup.userWith('Evidence_Investigator');
        Test.startTest();
        System.runAs(u) {
            assertMatrix(
                'Evidence_Investigator',
                new Set<String>{
                    'Evidence_View_Ledger',
                    'Evidence_View_Subject_Data',
                    'Evidence_View_Rationale',
                    'Evidence_Assemble_Bundle'
                }
            );
        }
        Test.stopTest();
    }

    @IsTest
    static void auditorMatrix() {
        User u = EvidenceTestSetup.userWith('Evidence_Auditor');
        Test.startTest();
        System.runAs(u) {
            assertMatrix(
                'Evidence_Auditor',
                new Set<String>{
                    'Evidence_View_Ledger',
                    'Evidence_View_Subject_Data',
                    'Evidence_View_Rationale',
                    'Evidence_Verify_Chain'
                }
            );
        }
        Test.stopTest();
    }

    @IsTest
    static void custodianMatrix() {
        User u = EvidenceTestSetup.userWith('Evidence_Custodian');
        Test.startTest();
        System.runAs(u) {
            assertMatrix(
                'Evidence_Custodian',
                new Set<String>{
                    'Evidence_View_Ledger',
                    'Evidence_View_Subject_Data',
                    'Evidence_View_Rationale',
                    'Evidence_Assemble_Bundle',
                    'Evidence_Seal_Bundle',
                    'Evidence_Manage_Legal_Hold',
                    'Evidence_Verify_Chain',
                    'Evidence_Manage_Retention'
                }
            );
        }
        Test.stopTest();
    }

    @IsTest
    static void administratorMatrixAndCannotReadSubjectData() {
        User u = EvidenceTestSetup.userWith('Evidence_Administrator');
        Test.startTest();
        System.runAs(u) {
            assertMatrix('Evidence_Administrator', new Set<String>{ 'Evidence_View_Ledger', 'Evidence_Verify_Chain' });
            // The headline separation-of-duties assertion, called out explicitly.
            Assert.isFalse(
                FeatureManagement.checkPermission('Evidence_View_Subject_Data'),
                'Evidence_Administrator must NOT be able to read subject data.'
            );
        }
        Test.stopTest();
    }
}
