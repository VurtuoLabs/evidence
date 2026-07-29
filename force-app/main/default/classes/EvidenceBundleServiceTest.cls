/**
 * EvidenceBundleServiceTest
 * Assemble, seal, export and withdraw (CONTRACT.md 9.2, 13).
 *
 * Walks the full lifecycle as an Evidence_Custodian (the seat that holds both
 * Evidence_Assemble_Bundle and Evidence_Seal_Bundle):
 *   draft -> addDecisions (grants matter sharing) -> seal (verifies the covered
 *   chain segment, computes Segment_Root_Hash__c, links the anchor, flips to
 *   Sealed) -> export (a ContentVersion) -> withdraw (revokes sharing, flips to
 *   Withdrawn).
 *
 * A correctly-chained Decision_Ledger__b is seeded so seal's verify() and anchor()
 * operate on a real chain.
 */
@IsTest
private class EvidenceBundleServiceTest {
    private static final String AGENT = 'Claims_Triage';
    private static final Integer LINKS = 3;

    private static String chainKey() {
        return UserInfo.getOrganizationId() + ':' + AGENT;
    }

    /** Seed a correctly-chained ledger and its index rows; return the ledger keys. */
    private static List<String> seedChainAndIndex() {
        List<Decision_Ledger__b> ledger = new List<Decision_Ledger__b>();
        List<Decision_Record__c> index = new List<Decision_Record__c>();
        List<String> keys = new List<String>();
        Datetime base = Datetime.newInstanceGmt(2026, 1, 1, 0, 0, 0);
        String priorHash = '';
        for (Integer i = 0; i < LINKS; i++) {
            Datetime occ = base.addSeconds(i);
            String ledgerKey = 'LK-BND-' + i;
            keys.add(ledgerKey);
            Map<String, Object> body = new Map<String, Object>{ 'agentApiName' => AGENT, 'occurredAt' => occ };
            String canon = EvidenceCanonicalizer.canonicalize(body, 1);

            EvidenceChainService.ChainInput ci = new EvidenceChainService.ChainInput();
            ci.priorHash = priorHash;
            ci.ledgerKey = ledgerKey;
            ci.agentApiName = AGENT;
            ci.occurredAt = occ;
            ci.canonicalBody = canon;
            String thisHash = EvidenceChainService.computeHash(ci);

            Decision_Ledger__b row = new Decision_Ledger__b();
            row.Chain_Key__c = chainKey();
            row.Chain_Position__c = i;
            row.Ledger_Key__c = ledgerKey;
            row.Occurred_At__c = occ;
            row.Canonical_Body__c = canon;
            row.Canonical_Version__c = 1;
            row.This_Hash__c = thisHash;
            row.Prior_Hash__c = priorHash;
            ledger.add(row);

            Decision_Record__c rec = EvidenceTestFactory.decisionRecord(AGENT, ledgerKey);
            rec.Occurred_At__c = occ;
            rec.Chain_Position__c = i;
            rec.This_Hash__c = thisHash;
            rec.Prior_Hash__c = priorHash;
            index.add(rec);

            priorHash = thisHash;
        }
        EvidenceLedgerStore.insertLedger(ledger);
        insert index;
        return keys;
    }

    @IsTest
    static void fullLifecycleDraftAddSealExportWithdraw() {
        EvidenceConfigurationService.redactionRuleCache = new List<Evidence_Redaction_Rule__mdt>();
        User custodian = EvidenceTestSetup.userWith('Evidence_Custodian');
        List<String> keys = seedChainAndIndex();

        Test.startTest();
        System.runAs(custodian) {
            // draft
            EvidenceBundleService.BundleInput input = new EvidenceBundleService.BundleInput();
            input.matter = 'Matter-2026-777';
            input.purpose = 'Regulatory production';
            input.redactionProfile = 'OutsideCounsel';
            input.exportFormat = 'JSON';
            Evidence_Bundle__c bundle = EvidenceBundleService.draft(input);
            Assert.isNotNull(bundle.Id, 'Draft must be inserted.');
            Assert.areEqual('Draft', bundle.State__c);

            // addDecisions
            Integer added = EvidenceBundleService.addDecisions(bundle.Id, keys);
            Assert.areEqual(LINKS, added, 'Every seeded decision must be linked.');
            // Idempotent: re-adding the same keys adds nothing.
            Assert.areEqual(0, EvidenceBundleService.addDecisions(bundle.Id, keys), 'Duplicate add is a no-op.');

            // seal
            EvidenceBundleService.BundleResult result = EvidenceBundleService.seal(bundle.Id);
            Assert.areEqual('Sealed', result.state, 'Bundle must flip to Sealed.');
            Assert.isNotNull(result.segmentRootHash, 'A segment root hash must be computed.');
            Assert.areEqual(64, result.segmentRootHash.length(), 'Root hash is a SHA-256 hex digest.');
            Assert.isTrue(result.chainVerified, 'A well-formed segment verifies intact.');
            Assert.areEqual(LINKS, result.decisionCount);

            Evidence_Bundle__c sealed = [
                SELECT State__c, Segment_Root_Hash__c, Sealed_At__c, Sealed_By__c, Anchor_Reference__c
                FROM Evidence_Bundle__c
                WHERE Id = :bundle.Id
            ];
            Assert.areEqual('Sealed', sealed.State__c);
            Assert.isNotNull(sealed.Segment_Root_Hash__c);
            Assert.isNotNull(sealed.Sealed_At__c);
            Assert.isNotNull(sealed.Anchor_Reference__c, 'The daily anchor must be linked.');

            // export
            ContentVersion cv = EvidenceBundleService.export(bundle.Id, 'JSON');
            Assert.isNotNull(cv.Id, 'Export must produce a ContentVersion.');
            Assert.isTrue(cv.Title.contains('Matter-2026-777'), cv.Title);

            // withdraw
            Evidence_Bundle__c withdrawn = EvidenceBundleService.withdraw(bundle.Id, 'Matter closed');
            Assert.areEqual('Withdrawn', withdrawn.State__c, 'Bundle must flip to Withdrawn.');
        }
        Test.stopTest();
    }

    @IsTest
    static void draftRequiresMatter() {
        User custodian = EvidenceTestSetup.userWith('Evidence_Custodian');
        Test.startTest();
        System.runAs(custodian) {
            try {
                EvidenceBundleService.draft(new EvidenceBundleService.BundleInput());
                Assert.fail('Drafting without a matter must throw.');
            } catch (EvidenceException e) {
                Assert.isTrue(e.getMessage().contains('matter'), e.getMessage());
            }
        }
        Test.stopTest();
    }

    @IsTest
    static void draftWithoutPermissionIsRefused() {
        User analyst = EvidenceTestSetup.userWith('Evidence_Analyst'); // no Assemble permission
        Test.startTest();
        System.runAs(analyst) {
            EvidenceBundleService.BundleInput input = new EvidenceBundleService.BundleInput();
            input.matter = 'Matter-X';
            try {
                EvidenceBundleService.draft(input);
                Assert.fail('An Analyst cannot assemble a bundle.');
            } catch (EvidenceException e) {
                Assert.isTrue(e.getMessage().contains('permission'), e.getMessage());
            }
        }
        Test.stopTest();
    }

    @IsTest
    static void sealEmptyBundleThrows() {
        User custodian = EvidenceTestSetup.userWith('Evidence_Custodian');
        Test.startTest();
        System.runAs(custodian) {
            EvidenceBundleService.BundleInput input = new EvidenceBundleService.BundleInput();
            input.matter = 'Matter-Empty';
            Evidence_Bundle__c bundle = EvidenceBundleService.draft(input);
            try {
                EvidenceBundleService.seal(bundle.Id);
                Assert.fail('Sealing an empty bundle must throw.');
            } catch (EvidenceException e) {
                Assert.isTrue(e.getMessage().contains('empty'), e.getMessage());
            }
        }
        Test.stopTest();
    }
}
