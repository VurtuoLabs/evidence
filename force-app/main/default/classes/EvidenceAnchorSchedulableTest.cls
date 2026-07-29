/**
 * EvidenceAnchorSchedulableTest
 * Daily terminal-hash anchoring (CONTRACT.md 5.2, 10.2, 13).
 *
 * For each distinct agent chain (derived from the index) the schedulable writes one
 * Chain_Anchor__b carrying the terminal hash and position. A chain with no ledger
 * rows is skipped rather than failing the run.
 */
@IsTest
private class EvidenceAnchorSchedulableTest {
    private static final String AGENT = 'Claims_Triage';
    private static final Integer LINKS = 4;

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
            String ledgerKey = 'LK-ANC-' + i;
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
    static void executeWritesOneAnchorPerChain() {
        seedChainAndIndex();

        EvidenceAnchorSchedulable job = new EvidenceAnchorSchedulable();
        Test.startTest();
        job.execute(null);
        Test.stopTest();

        Assert.areEqual(1, job.anchorsWritten, 'One anchor must be written for the single chain.');

        List<Chain_Anchor__b> anchors = EvidenceLedgerStore.anchors(chainKey());
        Assert.areEqual(1, anchors.size(), 'The anchor must be persisted to the Big Object.');
        Assert.areEqual(LINKS - 1, (Integer) anchors[0].Terminal_Position__c, 'Terminal position is count - 1.');
        Assert.areEqual(LINKS, (Integer) anchors[0].Link_Count__c, 'Link count is the chain length.');
        Assert.isNotNull(anchors[0].Terminal_Hash__c, 'The anchor carries the terminal hash.');
    }

    @IsTest
    static void executeWithNoChainsWritesNothing() {
        EvidenceAnchorSchedulable job = new EvidenceAnchorSchedulable();
        Test.startTest();
        job.execute(null);
        Test.stopTest();
        Assert.areEqual(0, job.anchorsWritten, 'With no index rows there is nothing to anchor.');
    }
}
