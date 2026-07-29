/**
 * Evidence - the one gateway to Big Object storage.
 *
 * Every read and write of Decision_Ledger__b and Chain_Anchor__b goes through here.
 * Two reasons, both structural:
 *
 * 1. Apex test context cannot touch Big Object storage. `Database.insertImmediate`
 *    throws "Internal Salesforce.com Query Error" there, and once any DML has run in
 *    the transaction it instead throws "a callout was unsuccessful because of pending
 *    uncommitted work" - Big Object writes behave like callouts. Chain behaviour is
 *    the most test-critical logic in the product (CONTRACT §13), so it has to be
 *    testable without that storage. `EvidenceLedgerStore.useInMemory()` swaps in a
 *    faithful in-memory chain that honours the same index semantics.
 *
 * 2. It keeps the "query only on the index, in index order" rule (CONTRACT §5.3) in
 *    one place instead of spread across five services.
 *
 * The production implementation is a thin pass-through; it adds no behaviour of its
 * own, so what tests exercise through the in-memory store is the callers' logic.
 */
public with sharing class EvidenceLedgerStore {
    public interface Store {
        void insertLedger(List<Decision_Ledger__b> rows);
        void deleteLedger(List<Decision_Ledger__b> rows);
        void insertAnchor(List<Chain_Anchor__b> rows);
        /** Highest-position row on the chain, or null when the chain is empty. */
        Decision_Ledger__b terminal(String chainKey);
        /** Rows from fromPosition to toPosition inclusive, ascending. */
        List<Decision_Ledger__b> range(String chainKey, Long fromPosition, Long toPosition);
        /** Every row on the chain, ascending. */
        List<Decision_Ledger__b> chain(String chainKey);
        /** One row addressed by the full index, or null. */
        Decision_Ledger__b atPosition(String chainKey, Decimal position, String ledgerKey);
        /** Anchors written for a chain, ascending by anchor date. */
        List<Chain_Anchor__b> anchors(String chainKey);
    }

    /** Real Big Object storage. */
    public class BigObjectStore implements Store {
        public void insertLedger(List<Decision_Ledger__b> rows) {
            Database.insertImmediate(rows);
        }

        public void deleteLedger(List<Decision_Ledger__b> rows) {
            Database.deleteImmediate(rows);
        }

        public void insertAnchor(List<Chain_Anchor__b> rows) {
            Database.insertImmediate(rows);
        }

        public Decision_Ledger__b terminal(String chainKey) {
            // Two Big Object rules bite here, and together they rule out the obvious
            // "ORDER BY Chain_Position__c DESC LIMIT 1":
            //
            //   1. ORDER BY must begin at the leading index field and follow index
            //      order. Ordering on Chain_Position__c alone fails with "Filters may
            //      not have any gaps within the composite key".
            //   2. DESC is not supported on an index column at all - it fails with
            //      "Unsupported order direction on filter column: ... DESCENDING".
            //      The index declares ascending and the index is immutable.
            //
            // So the chain is read ascending and the last row is the terminal. That
            // is O(chain length) per capture. It is fine at demo and mid scale, but
            // it is the first thing to revisit for a long-lived chain: the fix is to
            // keep the terminal position on a cheap queryable record rather than to
            // rediscover it from the ledger each time.
            // System mode, deliberately, and this is CONTRACT §9.1's documented
            // capture-path exception. Every append needs the terminal position and
            // hash, and the capture path runs from a platform-event trigger as the
            // Automated Process user, which holds no permission set and therefore no
            // FLS. Under WITH USER_MODE this fails with "No such column
            // 'This_Hash__c'" and the whole ledger silently stops recording.
            //
            // The exposure is bounded: this returns a chain position and two hashes.
            // No subject data, no canonical body. Everything that can carry subject
            // data - atPosition, range, chain - stays in user mode.
            List<Decision_Ledger__b> rows = [
                SELECT Chain_Key__c, Chain_Position__c, This_Hash__c, Prior_Hash__c
                FROM Decision_Ledger__b
                WHERE Chain_Key__c = :chainKey
                ORDER BY Chain_Key__c, Chain_Position__c
            ];
            return rows.isEmpty() ? null : rows[rows.size() - 1];
        }

        public List<Decision_Ledger__b> range(String chainKey, Long fromPosition, Long toPosition) {
            // Bind as Decimal, not Long. Chain_Position__c is Number(18,0), and an
            // inequality filter bound to a Long fails against the Big Object index
            // with a bare UNKNOWN_EXCEPTION - no message, no field name. Binding the
            // same values as Decimal works. Do not "simplify" this back to a Long.
            Decimal fromPos = fromPosition;
            Decimal toPos = toPosition;
            return [
                SELECT
                    Chain_Key__c,
                    Chain_Position__c,
                    Ledger_Key__c,
                    Occurred_At__c,
                    Canonical_Body__c,
                    This_Hash__c,
                    Prior_Hash__c
                FROM Decision_Ledger__b
                WHERE
                    Chain_Key__c = :chainKey
                    AND Chain_Position__c >= :fromPos
                    AND Chain_Position__c <= :toPos
                WITH USER_MODE
                ORDER BY Chain_Key__c, Chain_Position__c
            ];
        }

        public List<Decision_Ledger__b> chain(String chainKey) {
            return [
                SELECT Chain_Key__c, Chain_Position__c, Ledger_Key__c, Occurred_At__c
                FROM Decision_Ledger__b
                WHERE Chain_Key__c = :chainKey
                WITH USER_MODE
                ORDER BY Chain_Key__c, Chain_Position__c
            ];
        }

        public Decision_Ledger__b atPosition(String chainKey, Decimal position, String ledgerKey) {
            List<Decision_Ledger__b> rows = [
                SELECT
                    Chain_Key__c,
                    Chain_Position__c,
                    Ledger_Key__c,
                    Occurred_At__c,
                    Agent_Version__c,
                    Canonical_Body__c,
                    Canonical_Version__c,
                    This_Hash__c,
                    Prior_Hash__c,
                    Consequence_Level__c,
                    Autonomy_Level__c,
                    Subject_Reference__c,
                    Running_User_Id__c,
                    Approver_Id__c
                FROM Decision_Ledger__b
                WHERE
                    Chain_Key__c = :chainKey
                    AND Chain_Position__c = :position
                    AND Ledger_Key__c = :ledgerKey
                WITH USER_MODE
                LIMIT 1
            ];
            return rows.isEmpty() ? null : rows[0];
        }

        public List<Chain_Anchor__b> anchors(String chainKey) {
            return [
                SELECT
                    Chain_Key__c,
                    Anchor_Date__c,
                    Anchor_Key__c,
                    Terminal_Hash__c,
                    Terminal_Position__c,
                    Link_Count__c,
                    Computed_At__c
                FROM Chain_Anchor__b
                WHERE Chain_Key__c = :chainKey
                WITH USER_MODE
                ORDER BY Chain_Key__c, Anchor_Date__c
            ];
        }
    }

    /**
     * In-memory stand-in used by tests. Keyed the same way the Big Object index is
     * (Chain_Key__c, then Chain_Position__c), so callers that respect the index
     * behave identically against it. Writes are upserts on the full index triple,
     * which is what the platform does and what makes Redact_Body_Keep_Hash work.
     */
    public class InMemoryStore implements Store {
        private Map<String, Map<String, Decision_Ledger__b>> byChain = new Map<String, Map<String, Decision_Ledger__b>>();
        public List<Chain_Anchor__b> anchors = new List<Chain_Anchor__b>();

        private String rowKey(Decision_Ledger__b row) {
            return String.valueOf(row.Chain_Position__c) + '|' + row.Ledger_Key__c;
        }

        public void insertLedger(List<Decision_Ledger__b> rows) {
            for (Decision_Ledger__b row : rows) {
                if (!byChain.containsKey(row.Chain_Key__c)) {
                    byChain.put(row.Chain_Key__c, new Map<String, Decision_Ledger__b>());
                }
                byChain.get(row.Chain_Key__c).put(rowKey(row), row);
            }
        }

        public void deleteLedger(List<Decision_Ledger__b> rows) {
            for (Decision_Ledger__b row : rows) {
                if (byChain.containsKey(row.Chain_Key__c)) {
                    byChain.get(row.Chain_Key__c).remove(rowKey(row));
                }
            }
        }

        public void insertAnchor(List<Chain_Anchor__b> rows) {
            anchors.addAll(rows);
        }

        public List<Decision_Ledger__b> chain(String chainKey) {
            List<Decision_Ledger__b> out = byChain.containsKey(chainKey)
                ? byChain.get(chainKey).values()
                : new List<Decision_Ledger__b>();
            // Ascending by position, mirroring the index order.
            for (Integer i = 1; i < out.size(); i++) {
                Decision_Ledger__b current = out[i];
                Integer j = i - 1;
                while (j >= 0 && out[j].Chain_Position__c > current.Chain_Position__c) {
                    out[j + 1] = out[j];
                    j--;
                }
                out[j + 1] = current;
            }
            return out;
        }

        public Decision_Ledger__b terminal(String chainKey) {
            List<Decision_Ledger__b> rows = chain(chainKey);
            return rows.isEmpty() ? null : rows[rows.size() - 1];
        }

        public List<Decision_Ledger__b> range(String chainKey, Long fromPosition, Long toPosition) {
            List<Decision_Ledger__b> out = new List<Decision_Ledger__b>();
            for (Decision_Ledger__b row : chain(chainKey)) {
                if (row.Chain_Position__c >= fromPosition && row.Chain_Position__c <= toPosition) {
                    out.add(row);
                }
            }
            return out;
        }

        public Decision_Ledger__b atPosition(String chainKey, Decimal position, String ledgerKey) {
            if (!byChain.containsKey(chainKey)) {
                return null;
            }
            return byChain.get(chainKey).get(String.valueOf(position) + '|' + ledgerKey);
        }

        public List<Chain_Anchor__b> anchors(String chainKey) {
            List<Chain_Anchor__b> out = new List<Chain_Anchor__b>();
            for (Chain_Anchor__b a : anchors) {
                if (a.Chain_Key__c == chainKey) {
                    out.add(a);
                }
            }
            return out;
        }
    }

    /**
     * Test context defaults to the in-memory chain, because Big Object storage is
     * not merely awkward to test against - it is unavailable. Every write throws
     * there, so the alternative is that no test may touch the chain at all. This is
     * the one place the codebase branches on Test.isRunningTest(), and it is why:
     * the branch selects storage, never behaviour.
     */
    @TestVisible
    private static Store impl = Test.isRunningTest()
        ? (Store) new InMemoryStore()
        : (Store) new BigObjectStore();

    /** Swap in a fresh in-memory chain and return it for assertions. Tests only. */
    @TestVisible
    private static InMemoryStore useInMemory() {
        InMemoryStore stub = new InMemoryStore();
        impl = stub;
        return stub;
    }

    /** The active store, for tests that need to read back what was written. */
    @TestVisible
    private static Store current() {
        return impl;
    }

    public static void insertLedger(List<Decision_Ledger__b> rows) {
        impl.insertLedger(rows);
    }

    public static void deleteLedger(List<Decision_Ledger__b> rows) {
        impl.deleteLedger(rows);
    }

    public static void insertAnchor(List<Chain_Anchor__b> rows) {
        impl.insertAnchor(rows);
    }

    public static Decision_Ledger__b terminal(String chainKey) {
        return impl.terminal(chainKey);
    }

    public static List<Decision_Ledger__b> range(String chainKey, Long fromPosition, Long toPosition) {
        return impl.range(chainKey, fromPosition, toPosition);
    }

    public static List<Decision_Ledger__b> chain(String chainKey) {
        return impl.chain(chainKey);
    }

    public static Decision_Ledger__b atPosition(String chainKey, Decimal position, String ledgerKey) {
        return impl.atPosition(chainKey, position, ledgerKey);
    }

    public static List<Chain_Anchor__b> anchors(String chainKey) {
        return impl.anchors(chainKey);
    }
}
