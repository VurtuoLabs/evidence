/**
 * EvidenceCanonicalizerTest
 * The most test-critical code in the product (CONTRACT.md 6.2, 13).
 *
 * Mandatory cases covered:
 *   - canonical JSON is stable across field-order permutations
 *   - canonical JSON is stable across two runs (determinism of the pure function)
 *   - versioned dispatch: v1 succeeds, an unsupported version throws
 *   - allowlist enforcement, null omission, and every writeValue branch
 */
@IsTest
private class EvidenceCanonicalizerTest {
    /**
     * Keys supplied in different insertion orders (including nested) must
     * produce byte-identical canonical output, because the class sorts keys at
     * every level. This is what makes the hash meaningful.
     */
    @IsTest
    static void canonicalStableAcrossFieldOrderPermutations() {
        Datetime occ = Datetime.newInstanceGmt(2026, 1, 1, 12, 0, 0);

        Map<String, Object> ascending = new Map<String, Object>();
        ascending.put('agentApiName', 'Claims_Triage');
        ascending.put('headline', 'Issued payment');
        ascending.put('occurredAt', occ);
        ascending.put('outcome', 'Approved');

        Map<String, Object> descending = new Map<String, Object>();
        descending.put('outcome', 'Approved');
        descending.put('occurredAt', occ);
        descending.put('headline', 'Issued payment');
        descending.put('agentApiName', 'Claims_Triage');

        Test.startTest();
        String a = EvidenceCanonicalizer.canonicalize(ascending, 1);
        String b = EvidenceCanonicalizer.canonicalize(descending, 1);
        Test.stopTest();

        Assert.areEqual(a, b, 'Field order must not change canonical output.');
        // Keys land in lexicographic order regardless of insertion order.
        Assert.isTrue(a.indexOf('"agentApiName"') < a.indexOf('"headline"'), 'Keys must be sorted.');
        Assert.isTrue(a.indexOf('"headline"') < a.indexOf('"occurredAt"'), 'Keys must be sorted.');
    }

    /**
     * The function is pure and stateless, so repeated invocations (which in
     * production happen in different transactions) yield identical output.
     */
    @IsTest
    static void canonicalStableAcrossRuns() {
        Map<String, Object> body = new Map<String, Object>{
            'agentApiName' => 'Billing',
            'consequenceLevel' => 'High',
            'occurredAt' => Datetime.newInstanceGmt(2026, 3, 5, 9, 30, 0)
        };
        String first = EvidenceCanonicalizer.canonicalize(body, 1);
        String second = EvidenceCanonicalizer.canonicalize(body, 1);
        Assert.areEqual(first, second, 'Canonicalization must be deterministic across runs.');
    }

    @IsTest
    static void versionedDispatch() {
        Map<String, Object> body = new Map<String, Object>{ 'headline' => 'x' };

        // v1 is supported.
        Assert.areEqual('{"headline":"x"}', EvidenceCanonicalizer.canonicalize(body, 1));

        // A null version defaults to CURRENT_VERSION (1) rather than throwing.
        Assert.areEqual('{"headline":"x"}', EvidenceCanonicalizer.canonicalize(body, null));

        // An unsupported version is rejected: the verifier dispatches on version.
        try {
            EvidenceCanonicalizer.canonicalize(body, 2);
            Assert.fail('Unsupported canonical version should throw.');
        } catch (EvidenceException e) {
            Assert.isTrue(e.getMessage().contains('Unsupported canonical version'), e.getMessage());
        }
    }

    @IsTest
    static void nullBodyThrows() {
        try {
            EvidenceCanonicalizer.canonicalize(null, 1);
            Assert.fail('A null body should throw.');
        } catch (EvidenceException e) {
            Assert.isTrue(e.getMessage().contains('null decision body'), e.getMessage());
        }
    }

    /**
     * Only allowlisted keys are hashed; null-valued keys are omitted; a body of
     * nothing-but-ignored-keys serializes to an empty object. This is what keeps
     * a newly added field from silently changing historical hashes.
     */
    @IsTest
    static void allowlistAndNullOmission() {
        Datetime occ = Datetime.newInstanceGmt(2026, 1, 1, 0, 0, 0);
        Map<String, Object> body = new Map<String, Object>{
            'headline' => 'kept',
            'notInAllowlist' => 'dropped',
            'consequenceLevel' => null,
            'occurredAt' => occ
        };

        String out = EvidenceCanonicalizer.canonicalize(body, 1);

        Assert.isTrue(out.contains('"headline":"kept"'), out);
        Assert.isFalse(out.contains('notInAllowlist'), 'Non-allowlisted keys must be dropped.');
        Assert.isFalse(out.contains('consequenceLevel'), 'Null-valued keys must be omitted.');
        Assert.isTrue(out.contains(String.valueOf(occ.getTime())), 'Datetime must serialize as epoch millis.');

        Map<String, Object> onlyIgnored = new Map<String, Object>{ 'notAllowed' => 'x', 'alsoNot' => null };
        Assert.areEqual('{}', EvidenceCanonicalizer.canonicalize(onlyIgnored, 1));
    }

    /**
     * Exercises every writeValue branch: nested map, list, Datetime, Date,
     * Decimal, Double, Integer, Long, Boolean, String and a null list element.
     */
    @IsTest
    static void writeValueBranches() {
        Datetime occ = Datetime.newInstanceGmt(2026, 1, 1, 12, 0, 0);
        Date d = Date.newInstance(2026, 1, 1);
        String expectedDateMillis = String.valueOf(Datetime.newInstanceGmt(d, Time.newInstance(0, 0, 0, 0)).getTime());

        Map<String, Object> body = new Map<String, Object>{
            'occurredAt' => occ,
            'headline' => 'Complex',
            'actionsInvoked' => new List<Object>{
                'issue_payment', // String
                Math.PI, // Double -> scale 4 -> 3.1416
                (Decimal) 3.14, // Decimal -> scale 4 -> 3.1400
                42, // Integer
                5L, // Long
                true, // Boolean
                d, // Date
                null, // null element -> 'null'
                new Map<String, Object>{ 'nestedKey' => 'nestedVal' } // nested map
            }
        };

        String out = EvidenceCanonicalizer.canonicalize(body, 1);

        Assert.isTrue(out.contains('"issue_payment"'), out);
        Assert.isTrue(out.contains('3.1416'), 'Double must be scaled to 4 places: ' + out);
        Assert.isTrue(out.contains('3.1400'), 'Decimal must be scaled to 4 places: ' + out);
        Assert.isTrue(out.contains('42'), out);
        Assert.isTrue(out.contains('true'), out);
        Assert.isTrue(out.contains('null'), 'A null list element serializes as null.');
        Assert.isTrue(out.contains(expectedDateMillis), 'Date must serialize as GMT-midnight epoch millis.');
        Assert.isTrue(out.contains('"nestedKey":"nestedVal"'), 'Nested maps must recurse.');
        Assert.isTrue(out.contains(String.valueOf(occ.getTime())), out);
    }
}
