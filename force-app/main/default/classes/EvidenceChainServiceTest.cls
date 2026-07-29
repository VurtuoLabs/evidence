/**
 * EvidenceChainServiceTest
 * The hash chain (CONTRACT.md 6, 13).
 *
 * Mandatory cases covered:
 *   - a chain of many links verifies Intact
 *   - a single mutated Canonical_Body__c is detected at the right position
 *   - nextPosition is monotonic and gap-free
 *   - anchor writes a Chain_Anchor__b carrying the terminal hash/position
 *
 * Decision_Ledger__b / Chain_Anchor__b are Big Objects: rows are written with
 * Database.insertImmediate and queried on the index within the same transaction.
 */
@IsTest
private class EvidenceChainServiceTest {
    private static final String AGENT = 'Claims_Triage';
    // Production target per CONTRACT.md 13 is 1,000 links; scaled here to stay
    // within the Apex test CPU limit while still exercising a long chain.
    private static final Integer LINKS = 200;

    private static String chainKey() {
        return UserInfo.getOrganizationId() + ':' + AGENT;
    }

    /**
     * Build a correctly-chained set of ledger rows and insert them. Each link's
     * hash is computed exactly as the capture path would, so verify() recomputes
     * to the same value.
     */
    private static List<Decision_Ledger__b> buildChain(Integer n) {
        List<Decision_Ledger__b> rows = new List<Decision_Ledger__b>();
        Datetime base = Datetime.newInstanceGmt(2026, 1, 1, 0, 0, 0);
        String priorHash = '';
        for (Integer i = 0; i < n; i++) {
            Datetime occ = base.addSeconds(i);
            String ledgerKey = 'LK-' + AGENT + '-' + i;
            Map<String, Object> body = new Map<String, Object>{
                'agentApiName' => AGENT,
                'occurredAt' => occ,
                'headline' => 'turn ' + i
            };
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
            rows.add(row);

            priorHash = thisHash;
        }
        EvidenceLedgerStore.insertLedger(rows);
        return rows;
    }

    @IsTest
    static void computeHashIsDeterministicAndRejectsNull() {
        EvidenceChainService.ChainInput ci = new EvidenceChainService.ChainInput();
        ci.priorHash = '';
        ci.ledgerKey = 'LK-1';
        ci.agentApiName = AGENT;
        ci.occurredAt = Datetime.newInstanceGmt(2026, 1, 1, 0, 0, 0);
        ci.canonicalBody = '{"headline":"x"}';

        String h1 = EvidenceChainService.computeHash(ci);
        String h2 = EvidenceChainService.computeHash(ci);
        Assert.areEqual(h1, h2, 'Hash must be deterministic for identical input.');
        Assert.areEqual(64, h1.length(), 'SHA-256 hex digest is 64 chars.');

        try {
            EvidenceChainService.computeHash(null);
            Assert.fail('A null ChainInput should throw.');
        } catch (EvidenceException e) {
            Assert.isTrue(e.getMessage().contains('ChainInput'), e.getMessage());
        }
    }

    @IsTest
    static void longChainVerifiesIntact() {
        buildChain(LINKS);

        Test.startTest();
        Chain_Verification__c result = EvidenceChainService.verify(chainKey(), 0, LINKS - 1);
        Test.stopTest();

        Assert.areEqual('Intact', result.Result__c, 'A well-formed chain must verify Intact.');
        Assert.areEqual(LINKS, (Integer) result.Links_Checked__c, 'Every link must be checked.');
        Assert.areEqual(0, (Integer) result.First_Position__c);
        Assert.areEqual(LINKS - 1, (Integer) result.Last_Position__c);
        Assert.isNull(result.Break_At_Position__c, 'No break should be recorded.');
    }

    @IsTest
    static void mutatedBodyDetectedAtRightPosition() {
        Integer n = 25;
        List<Decision_Ledger__b> rows = buildChain(n);
        Integer tamperPos = 12;

        // Overwrite only Canonical_Body__c at the tamper position, keeping the
        // original This_Hash__c / Prior_Hash__c so continuity still holds and the
        // break surfaces from the body-integrity recomputation, not continuity.
        Decision_Ledger__b original = rows[tamperPos];
        Decision_Ledger__b tampered = new Decision_Ledger__b();
        tampered.Chain_Key__c = original.Chain_Key__c;
        tampered.Chain_Position__c = original.Chain_Position__c;
        tampered.Ledger_Key__c = original.Ledger_Key__c;
        tampered.Occurred_At__c = original.Occurred_At__c;
        tampered.Canonical_Version__c = original.Canonical_Version__c;
        tampered.This_Hash__c = original.This_Hash__c;
        tampered.Prior_Hash__c = original.Prior_Hash__c;
        tampered.Canonical_Body__c = original.Canonical_Body__c + '{"injected":"tamper"}';
        EvidenceLedgerStore.insertLedger(new List<Decision_Ledger__b>{ tampered });

        Test.startTest();
        Chain_Verification__c result = EvidenceChainService.verify(chainKey(), 0, n - 1);
        Test.stopTest();

        Assert.areEqual('Break_Detected', result.Result__c, 'Tampering must be detected.');
        Assert.areEqual(
            tamperPos,
            (Integer) result.Break_At_Position__c,
            'The break must be reported at the tampered position.'
        );
    }

    @IsTest
    static void nextPositionIsMonotonicAndGapFree() {
        // Empty chain starts at 0 with an empty terminal hash.
        Assert.areEqual(0L, EvidenceChainService.nextPosition(chainKey()), 'Empty chain starts at position 0.');
        Assert.areEqual('', EvidenceChainService.terminalHash(chainKey()), 'Empty chain has no terminal hash.');

        List<Decision_Ledger__b> rows = buildChain(10);

        Assert.areEqual(10L, EvidenceChainService.nextPosition(chainKey()), 'Next position must be count, gap-free.');
        Assert.areEqual(
            rows[9].This_Hash__c,
            EvidenceChainService.terminalHash(chainKey()),
            'Terminal hash must be the last link hash.'
        );
    }

    @IsTest
    static void anchorWritesChainAnchor() {
        List<Decision_Ledger__b> rows = buildChain(5);
        Date anchorDate = Date.newInstance(2026, 1, 1);

        Test.startTest();
        Chain_Anchor__b anchorRow = EvidenceChainService.anchor(chainKey(), anchorDate);
        Test.stopTest();

        Assert.areEqual(chainKey(), anchorRow.Chain_Key__c);
        Assert.areEqual(4, (Integer) anchorRow.Terminal_Position__c, 'Terminal position is count - 1.');
        Assert.areEqual(5, (Integer) anchorRow.Link_Count__c, 'Link count is the chain length.');
        Assert.areEqual(rows[4].This_Hash__c, anchorRow.Terminal_Hash__c, 'Anchor carries the terminal hash.');

        List<Chain_Anchor__b> persisted = EvidenceLedgerStore.anchors(chainKey());
        Assert.areEqual(1, persisted.size(), 'The anchor must be persisted to the Big Object.');
    }

    @IsTest
    static void anchorEmptyChainThrows() {
        try {
            EvidenceChainService.anchor(chainKey(), Date.today());
            Assert.fail('Anchoring an empty chain should throw.');
        } catch (EvidenceException e) {
            Assert.isTrue(e.getMessage().contains('empty chain'), e.getMessage());
        }
    }
}
