/**
 * EvidenceVerificationBatchTest
 * The scheduled integrity pass (CONTRACT.md 6.3, 10.2, 13).
 *
 * start() derives one synthetic row per distinct agent from the Decision_Record__c
 * index; execute() verifies each chain in slices via EvidenceChainService.verify,
 * which persists a Chain_Verification__c. A correctly-chained ledger must produce an
 * Intact verification.
 */
@IsTest
private class EvidenceVerificationBatchTest {
    private static final String AGENT = 'Claims_Triage';
    private static final Integer LINKS = 5;

    private static String chainKey() {
        return UserInfo.getOrganizationId() + ':' + AGENT;
    }

    private static void seedChainAndIndex() {
        List<Decision_Ledger__b> ledger = new List<Decision_Ledger__b>();
        List<Decision_Record__c> index = new List<Decision_Record__c>();
        Datetime base = Datetime.newInstanceGmt(2026, 1, 1, 0, 0, 0);
        String priorHash = '';
        for (Integer i = 0; i < LINKS; i++) {
            Datetime occ = base.addSeconds(i);
            String ledgerKey = 'LK-VB-' + i;
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
            index.add(rec);

            priorHash = thisHash;
        }
        EvidenceLedgerStore.insertLedger(ledger);
        insert index;
    }

    @IsTest
    static void batchVerifiesEachChainIntact() {
        // Slice size smaller than the chain to exercise the slicing loop.
        seedChainAndIndex();

        Test.startTest();
        Database.executeBatch(new EvidenceVerificationBatch(2), 200);
        Test.stopTest();

        List<Chain_Verification__c> verifications = [
            SELECT Result__c, Links_Checked__c
            FROM Chain_Verification__c
            ORDER BY First_Position__c ASC
        ];
        Assert.isFalse(verifications.isEmpty(), 'The batch must persist at least one verification.');
        Integer totalChecked = 0;
        for (Chain_Verification__c v : verifications) {
            Assert.areEqual('Intact', v.Result__c, 'A well-formed chain must verify Intact.');
            totalChecked += (Integer) v.Links_Checked__c;
        }
        Assert.areEqual(LINKS, totalChecked, 'Every link must be checked across the slices.');
    }
}
