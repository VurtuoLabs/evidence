/**
 * EvidenceTestSetup
 * @IsTest-only helpers that build users for permission and sharing assertions.
 *
 * The Evidence facades gate on custom permissions (CONTRACT.md 8) that a fresh
 * test-running user does not hold, and Decision_Record__c is Private (8.4). Every
 * user built here carries the System Administrator profile - so CRUD, FLS and
 * record visibility never get in the way - and then adds exactly the Evidence
 * permission set(s) whose custom permissions are under test. That isolation lets
 * a test assert the custom-permission gate itself rather than incidental access.
 *
 * User (setup object) DML is wrapped in System.runAs to avoid MIXED_DML_OPERATION
 * with the non-setup ledger DML a test performs afterwards.
 */
@IsTest
public class EvidenceTestSetup {
    private static Integer userSeq = 0;

    /** A System Administrator user granted a single Evidence permission set. */
    public static User userWith(String permissionSetName) {
        return userWith(permissionSetName == null ? new List<String>() : new List<String>{ permissionSetName });
    }

    /** A System Administrator user granted every named Evidence permission set. */
    public static User userWith(List<String> permissionSetNames) {
        User u = buildUser();
        System.runAs(new User(Id = UserInfo.getUserId())) {
            insert u;
            if (permissionSetNames != null && !permissionSetNames.isEmpty()) {
                Map<String, Id> byName = new Map<String, Id>();
                for (PermissionSet ps : [
                    SELECT Id, Name
                    FROM PermissionSet
                    WHERE Name IN :permissionSetNames
                ]) {
                    byName.put(ps.Name, ps.Id);
                }
                List<PermissionSetAssignment> assigns = new List<PermissionSetAssignment>();
                for (String name : permissionSetNames) {
                    if (byName.containsKey(name)) {
                        assigns.add(new PermissionSetAssignment(AssigneeId = u.Id, PermissionSetId = byName.get(name)));
                    }
                }
                if (!assigns.isEmpty()) {
                    insert assigns;
                }
            }
        }
        return u;
    }

    /** A System Administrator user with no Evidence permission set at all. */
    public static User userWithNoEvidenceAccess() {
        return userWith(new List<String>());
    }

    private static User buildUser() {
        userSeq++;
        Profile admin = [SELECT Id FROM Profile WHERE Name = 'System Administrator' LIMIT 1];
        String unique = String.valueOf(System.now().getTime()) + String.valueOf(userSeq);
        String alias = ('ev' + unique);
        return new User(
            FirstName = 'Evidence',
            LastName = 'Tester' + userSeq,
            Alias = alias.length() > 8 ? alias.substring(alias.length() - 8) : alias,
            Email = 'evidence.tester' + unique + '@example.com',
            Username = 'evidence.tester' + unique + '@evidence.test.example.com',
            ProfileId = admin.Id,
            TimeZoneSidKey = 'America/Los_Angeles',
            LocaleSidKey = 'en_US',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'en_US'
        );
    }
}
