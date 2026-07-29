/**
 * EvidenceChainService
 * The hash chain: computation, position assignment, verification, anchoring.
 *
 * Per CONTRACT.md 6:
 *   - computeHash implements the exact 6.1 payload and SHA-256 digest.
 *   - nextPosition reads the current terminal position of a per-agent chain.
 *   - verify walks a chain segment, recomputes each hash, and records a
 *     Chain_Verification__c. It also checks link continuity, so a chain whose
 *     bodies were redacted under Redact_Body_Keep_Hash still verifies (6.2, 8).
 *   - anchor writes the daily terminal Chain_Anchor__b an auditor is handed.
 *
 * Decision_Ledger__b and Chain_Anchor__b are Big Objects: query only on the
 * index in index order, insert via Database.insertImmediate, never update.
 */
public with sharing class EvidenceChainService {
    /** Input to computeHash. Assembled by the capture path and by verify(). */
    public class ChainInput {
        @AuraEnabled
        public String priorHash; // '' for position 0
        @AuraEnabled
        public String ledgerKey;
        @AuraEnabled
        public String agentApiName;
        @AuraEnabled
        public Datetime occurredAt;
        @AuraEnabled
        public String canonicalBody; // key-sorted JSON, see EvidenceCanonicalizer
    }

    /**
     * Compute the SHA-256 hash for a ledger link. Payload shape is fixed by
     * CONTRACT.md 6.1 and must never change without a canonical-version bump.
     * @param input the link's prior hash, keys, timestamp and canonical body
     * @return lowercase hex SHA-256 digest
     */
    public static String computeHash(ChainInput input) {
        if (input == null) {
            throw new EvidenceException('ChainInput is required to compute a hash.');
        }
        String payload = String.join(
            new List<String>{
                input.priorHash == null ? '' : input.priorHash,
                input.ledgerKey,
                input.agentApiName,
                String.valueOf(input.occurredAt.getTime()), // epoch millis, not a formatted string
                input.canonicalBody
            },
            '|'
        );
        Blob digest = Crypto.generateDigest('SHA-256', Blob.valueOf(payload));
        return EncodingUtil.convertToHex(digest);
    }

    /**
     * The next monotonic position for a chain. Reads the terminal row once.
     * @param chainKey the per-agent chain key (&lt;orgKey&gt;:&lt;agentApiName&gt;)
     * @return 0 for an empty chain, otherwise terminalPosition + 1
     */
    public static Long nextPosition(String chainKey) {
        Decision_Ledger__b terminal = terminalRow(chainKey);
        if (terminal == null) {
            return 0L;
        }
        return ((Long) terminal.Chain_Position__c) + 1L;
    }

    /**
     * The current terminal hash of a chain, or '' if the chain is empty.
     * Used by the capture path to seed the next link's priorHash.
     */
    public static String terminalHash(String chainKey) {
        Decision_Ledger__b terminal = terminalRow(chainKey);
        return terminal == null ? '' : terminal.This_Hash__c;
    }

    private static Decision_Ledger__b terminalRow(String chainKey) {
        // Big Object: equality on the leading index field, ordered on the index.
        return EvidenceLedgerStore.terminal(chainKey);
    }

    /**
     * Walk a chain segment, recompute each hash, and record the result.
     * Continuity (each row's Prior_Hash__c equals the previous row's This_Hash__c)
     * is always checked; body recomputation is skipped for redacted rows whose
     * Canonical_Body__c has been cleared, which is what lets a redacted chain
     * still verify.
     * @param chainKey the chain to verify
     * @param fromPosition inclusive start position
     * @param toPosition inclusive end position
     * @return the persisted Chain_Verification__c
     */
    public static Chain_Verification__c verify(String chainKey, Long fromPosition, Long toPosition) {
        Long startMillis = System.now().getTime();
        List<Decision_Ledger__b> rows = queryRange(chainKey, fromPosition, toPosition);
        String agentApiName = deriveAgentApiName(chainKey);

        Integer checked = 0;
        Long breakAt = null;
        String priorThisHash = null;
        Long firstPos = null;
        Long lastPos = null;

        for (Decision_Ledger__b row : rows) {
            Long pos = (Long) row.Chain_Position__c;
            if (firstPos == null) {
                firstPos = pos;
            }
            lastPos = pos;
            checked++;

            // Continuity: this row must point at the previous row's hash.
            if (priorThisHash != null && row.Prior_Hash__c != priorThisHash) {
                breakAt = pos;
                break;
            }

            // Body integrity: only when the body is still present (not redacted).
            if (String.isNotBlank(row.Canonical_Body__c)) {
                ChainInput ci = new ChainInput();
                ci.priorHash = row.Prior_Hash__c;
                ci.ledgerKey = row.Ledger_Key__c;
                ci.agentApiName = agentApiName;
                ci.occurredAt = row.Occurred_At__c;
                ci.canonicalBody = row.Canonical_Body__c;
                if (computeHash(ci) != row.This_Hash__c) {
                    breakAt = pos;
                    break;
                }
            }
            priorThisHash = row.This_Hash__c;
        }

        Chain_Verification__c result = new Chain_Verification__c(
            // Chains are per agent, so a result without its chain key cannot be
            // attributed to anything and the console cannot report on it.
            Chain_Key__c = chainKey,
            Verified_At__c = System.now(),
            Links_Checked__c = checked,
            First_Position__c = firstPos,
            Last_Position__c = lastPos,
            Result__c = breakAt == null ? 'Intact' : 'Break_Detected',
            Break_At_Position__c = breakAt,
            Duration_Ms__c = System.now().getTime() - startMillis
        );
        insert as user result;
        return result;
    }

    /**
     * Compute and persist the daily terminal anchor for a chain.
     * @param chainKey the chain to anchor
     * @param anchorDate the calendar day the anchor represents
     * @return the persisted Chain_Anchor__b
     */
    /**
     * Big Objects have no Date type, so Anchor_Date__c is a DateTime pinned to
     * midnight GMT. Every writer must go through here: the index filters on
     * equality, and an un-normalized value would silently never match.
     */
    public static Datetime anchorDayStart(Date anchorDate) {
        return Datetime.newInstanceGmt(anchorDate, Time.newInstance(0, 0, 0, 0));
    }

    public static Chain_Anchor__b anchor(String chainKey, Date anchorDate) {
        Decision_Ledger__b terminal = terminalRow(chainKey);
        if (terminal == null) {
            throw new EvidenceException('Cannot anchor an empty chain: ' + chainKey);
        }
        Chain_Anchor__b anchorRow = new Chain_Anchor__b();
        anchorRow.Chain_Key__c = chainKey;
        anchorRow.Anchor_Date__c = anchorDayStart(anchorDate);
        // Tiebreak only. The index prefix (Chain_Key__c, Anchor_Date__c) is already
        // unique - one anchor per chain per day - so the key does not repeat the
        // chain key. Repeating it would push the index past its 100-character
        // text budget (Chain_Key__c 60 + Anchor_Key__c 35).
        anchorRow.Anchor_Key__c = String.valueOf(anchorDate);
        anchorRow.Terminal_Hash__c = terminal.This_Hash__c;
        anchorRow.Terminal_Position__c = terminal.Chain_Position__c;
        anchorRow.Link_Count__c = ((Long) terminal.Chain_Position__c) + 1L;
        anchorRow.Computed_At__c = System.now();
        anchorRow.Computed_By__c = UserInfo.getUserId();
        // Signature is populated by an external key-management integration (CONTRACT 16);
        // the terminal hash stands alone as proof until that is wired in.
        anchorRow.Signature__c = null;

        EvidenceLedgerStore.insertAnchor(new List<Chain_Anchor__b>{ anchorRow });
        return anchorRow;
    }

    private static List<Decision_Ledger__b> queryRange(String chainKey, Long fromPosition, Long toPosition) {
        return EvidenceLedgerStore.range(chainKey, fromPosition, toPosition);
    }

    /** Chain key format is &lt;orgKey&gt;:&lt;agentApiName&gt;; the agent is the suffix. */
    private static String deriveAgentApiName(String chainKey) {
        if (String.isBlank(chainKey) || !chainKey.contains(':')) {
            return chainKey;
        }
        return chainKey.substringAfter(':');
    }
}
