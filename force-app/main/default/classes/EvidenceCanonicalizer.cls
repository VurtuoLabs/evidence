/**
 * EvidenceCanonicalizer
 * Deterministic, versioned serialization of a decision body for hashing.
 *
 * Per CONTRACT.md 6.2 the hash is only meaningful if the body serializes
 * identically every time. This class guarantees:
 *   - keys sorted lexicographically at every level
 *   - no whitespace
 *   - datetimes as epoch milliseconds, never formatted strings
 *   - decimals at a fixed scale
 *   - null-valued keys omitted rather than serialized as null
 *   - an explicit top-level field allowlist, so adding a field to
 *     Decision_Record__c cannot silently change historical hashes
 *
 * This is the most test-critical code in the product. Any change to a version's
 * behaviour invalidates every hash written under it, so output is versioned:
 * Canonical_Version__c is part of the hashed payload and the verifier dispatches
 * on it. To evolve the format, add a new version constant and allowlist; never
 * mutate an existing one.
 */
public with sharing class EvidenceCanonicalizer {
    /** The version new writes use unless configuration overrides it. */
    public static final Integer CURRENT_VERSION = 1;

    /** Fixed decimal scale applied to every Decimal/Double before serialization. */
    private static final Integer DECIMAL_SCALE = 4;

    /**
     * Version 1 top-level allowlist. Only these keys are hashed; anything else in
     * the supplied body is ignored. Order here is irrelevant (keys are sorted).
     */
    private static final Set<String> ALLOWLIST_V1 = new Set<String>{
        'actionsInvoked',
        'agentApiName',
        'agentVersion',
        'approverId',
        'autonomyLevel',
        'consequenceLevel',
        'declaredRationale',
        'escalatedTo',
        'headline',
        'occurredAt',
        'outcome',
        'policyEvaluations',
        'runningUserId',
        'sourcesRead',
        'subjectObject',
        'subjectReference',
        'topicsConsidered',
        'variablesSet'
    };

    /**
     * Serialize a decision body to its canonical string form.
     * @param body the decision body; nested Maps/Lists are serialized recursively
     * @param canonicalVersion the format version to apply
     * @return the canonical, whitespace-free, key-sorted JSON string
     */
    public static String canonicalize(Map<String, Object> body, Integer canonicalVersion) {
        if (body == null) {
            throw new EvidenceException('Cannot canonicalize a null decision body.');
        }
        Set<String> allow = allowlistFor(canonicalVersion);
        Map<String, Object> filtered = new Map<String, Object>();
        for (String key : body.keySet()) {
            Object value = body.get(key);
            // Null-valued keys are omitted, and only allowlisted keys are hashed.
            if (value != null && allow.contains(key)) {
                filtered.put(key, value);
            }
        }
        return writeMap(filtered);
    }

    private static Set<String> allowlistFor(Integer canonicalVersion) {
        Integer v = canonicalVersion == null ? CURRENT_VERSION : canonicalVersion;
        if (v == 1) {
            return ALLOWLIST_V1;
        }
        throw new EvidenceException('Unsupported canonical version: ' + v);
    }

    private static String writeMap(Map<String, Object> source) {
        List<String> keys = new List<String>(source.keySet());
        keys.sort(); // lexicographic ordering at this level
        List<String> parts = new List<String>();
        for (String key : keys) {
            Object value = source.get(key);
            if (value == null) {
                continue; // omit nulls at every level
            }
            parts.add(encodeString(key) + ':' + writeValue(value));
        }
        return '{' + String.join(parts, ',') + '}';
    }

    @SuppressWarnings('PMD.CyclomaticComplexity')
    private static String writeValue(Object value) {
        if (value == null) {
            return 'null';
        }
        if (value instanceof Map<String, Object>) {
            return writeMap((Map<String, Object>) value);
        }
        if (value instanceof List<Object>) {
            List<String> items = new List<String>();
            for (Object item : (List<Object>) value) {
                items.add(writeValue(item));
            }
            return '[' + String.join(items, ',') + ']';
        }
        if (value instanceof Datetime) {
            return String.valueOf(((Datetime) value).getTime()); // epoch millis
        }
        if (value instanceof Date) {
            Date d = (Date) value;
            return String.valueOf(Datetime.newInstanceGmt(d, Time.newInstance(0, 0, 0, 0)).getTime());
        }
        if (value instanceof Decimal) {
            return String.valueOf(((Decimal) value).setScale(DECIMAL_SCALE));
        }
        if (value instanceof Double) {
            return String.valueOf(Decimal.valueOf((Double) value).setScale(DECIMAL_SCALE));
        }
        if (value instanceof Integer || value instanceof Long) {
            return String.valueOf(value);
        }
        if (value instanceof Boolean) {
            return ((Boolean) value) ? 'true' : 'false';
        }
        return encodeString(String.valueOf(value));
    }

    /** JSON string encoding with correct escaping, via the platform serializer. */
    private static String encodeString(String raw) {
        return JSON.serialize(raw);
    }
}
