# Evidence - Build Spec

**Every choice an agent made, what it did, and why.**
Salesforce-native. React UI Bundle on Multi-Framework. No external services.

This file is the single source of truth for every name and shape shared between `force-app` and `uiBundles/evidenceUi`. Both halves MUST use these exact identifiers.

- **API version:** `sourceApiVersion` **67.0** (required by `UIBundle`). Apex classes declare 64.0+.
- **Namespace:** none in the base repo. Add the ISV namespace at packaging time.
- **Security posture:** all service classes `public with sharing`. SOQL `WITH USER_MODE`, DML `AccessLevel.USER_MODE`. The one exception is documented in §9.1.
- **Deploy as one unit:** Apex tests read seeded Custom Metadata, so `customMetadata/` must deploy with `classes/`.

---

## 1. Scope

| | |
|---|---|
| **Question** | What exactly did this agent do, and why? |
| **Core artifact** | A hash-chained, append-only decision ledger |
| **Loop** | Capture → Classify → Chain → Anchor → Attest |
| **Buyer** | Compliance, risk, internal audit, legal |
| **Sibling product** | None. Evidence is a standalone product with its own capture layer. |

### The honesty principle, stated up front

Agentforce reasoning is not fully transparent, and a product that claims to read the model's mind will not survive a real audit. Evidence separates two categories and labels them everywhere, in the data model, in the API, and in the UI:

- **Observed.** Deterministic facts. Actions invoked with inputs and outputs, records read, topics considered with confidence scores, policy evaluations, who ran it, who approved it.
- **Declared.** The agent's own account of its reasoning, captured by a mandatory `Declare_Rationale` action that must fire before any consequential action.

Auditors respect a system that draws this line. They do not respect one that blurs it. This distinction is a product feature, not a disclaimer.

---

## 2. Project scaffold

Prerequisites: Node.js v22+, Salesforce CLI v2.130.7+ (ships the UI Bundle plugin), org on Summer '26 or later (Multi-Framework is GA and enabled by default). The CLI template ships React + TypeScript + Vite + Tailwind + shadcn/ui with the SDK preconfigured.

```bash
sf project generate --name evidence --template standard
cd evidence
sf template generate ui-bundle
# rename the generated folder to evidenceUi
```

### 2.1 Tree

```
evidence/
├── sfdx-project.json                  # sourceApiVersion 67.0
├── package.json
├── CONTRACT.md
├── scripts/{auth.sh,deploy.sh,seed.sh}
└── force-app/main/default/
    ├── objects/
    │   ├── Decision_Record__c/
    │   ├── Rationale__c/
    │   ├── Consideration__c/
    │   ├── Policy_Check__c/
    │   ├── Evidence_Bundle__c/
    │   ├── Bundle_Item__c/
    │   ├── Legal_Hold__c/
    │   ├── Chain_Verification__c/
    │   ├── Decision_Ledger__b/        # Big Object, hash-chained
    │   ├── Chain_Anchor__b/           # Big Object, daily terminal hashes
    │   ├── Evidence_Turn__e/             # Evidence-owned Platform Event (see §3)
    │   ├── Evidence_Setting__mdt/
    │   ├── Evidence_Capture_Policy__mdt/
    │   ├── Evidence_Consequence_Rule__mdt/
    │   ├── Evidence_Retention_Policy__mdt/
    │   ├── Evidence_Control_Mapping__mdt/
    │   ├── Evidence_Redaction_Rule__mdt/
    │   └── Evidence_View__mdt/
    ├── customMetadata/
    ├── classes/
    ├── triggers/
    ├── flows/
    ├── permissionsets/
    ├── customPermissions/
    ├── tabs/
    ├── applications/Evidence.app-meta.xml
    ├── genAiPlannerBundles/Evidence_Engine/
    ├── aiAuthoringBundles/Evidence_Analyst/
    ├── genAiPromptTemplates/{Evidence_Narrative_v1,Evidence_Ledger_Query_v1}/
    └── uiBundles/evidenceUi/
        ├── evidenceUi.uibundle-meta.xml
        ├── ui-bundle.json
        ├── vite.config.ts
        └── src/
            ├── app/ domain/ salesforce/ hooks/ components/ lib/ test/
            └── features/{ledger,decision,analysis,bundles,holds,controls,settings}
```

### 2.2 `evidenceUi.uibundle-meta.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<UIBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <masterLabel>Evidence</masterLabel>
    <description>Agent decision record. Observed and declared, chained and anchored.</description>
    <isActive>true</isActive>
    <version>1</version>
    <target>CustomApplication</target>
</UIBundle>
```

### 2.3 `ui-bundle.json`, `vite.config.ts`, `Evidence.app-meta.xml`

Three files, three non-negotiables.

`ui-bundle.json`:

```json
{
  "outputDir": "dist",
  "routing": { "trailingSlash": "never", "fallback": "index.html" }
}
```

The `fallback` is what makes client-side routing survive a hard refresh. Without it, `/ledger` returns a 404 from the bundle host.

`vite.config.ts` - the three non-negotiables are `base: "./"` (the bundle is served from `/app/c__evidenceUi`, not the domain root), the `salesforce()` Vite plugin (consumes `ui-bundle.json` and emits the artifacts the host expects; without it the metadata deploys and the app renders an empty shell), and `sourcemap: false` (sourcemaps ship inside the `UIBundle` and count toward its 2,500-file limit):

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import salesforce from "@salesforce/vite-plugin-ui-bundle";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  base: "./",
  plugins: [react(), salesforce()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: { outDir: "dist", assetsDir: "assets", sourcemap: false },
  test: { globals: true, environment: "jsdom", setupFiles: ["./src/test/setup.ts"], css: true },
});
```

`Evidence.app-meta.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CustomApplication xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Evidence</label>
    <description>Agent decision record. Observed and declared, chained and anchored.</description>
    <brand>
        <headerColor>#6D28D9</headerColor>
        <shouldOverrideOrgTheme>false</shouldOverrideOrgTheme>
    </brand>
    <formFactors>Large</formFactors>
    <navType>Standard</navType>
    <uiBundle>c__evidenceUi</uiBundle>
    <uiType>Lightning</uiType>
</CustomApplication>
```

---

## 3. Capture layer

Evidence owns its capture end to end. Nothing is shared with any other product: Evidence ships and instruments its own tap, publishes to its own `Evidence_Turn__e` Platform Event, and subscribes to it with its own trigger.

`Evidence_Turn__e` (Published `PublishAfterCommit`, one per agent turn) carries every field Evidence needs directly: `Agent_API_Name__c`, `Agent_Version__c`, `Session_Key__c`, `Ledger_Key__c`, `Occurred_At__c`, `Subject_Reference__c`, `Subject_Object__c`, `Declared_Rationale__c`, `Policy_Evaluations__c`, `Variables_Set__c`, `Topics_Considered__c`, `Actions_Invoked__c` (full input and output payloads), `Sources_Read__c`, `Running_User_Id__c`, `Approver_Id__c`, `Escalated_To__c`.

The tap on the monitored agent is:
- `before_reasoning` and `after_reasoning` lifecycle hooks
- `Declare_Rationale` action, marked required before any action classified high-consequence
- **`EvidenceTap`** - the Apex invocable that publishes the event `PublishAfterCommit`. A monitored agent calls it once per consequential turn via an action targeting `apex://EvidenceTap`. `@InvocableVariable` names are the agent-facing contract; changing one silently breaks every bundle that maps to it.

**Attaching the tap is a per-agent change to that agent's own bundle**, not something Evidence can do to an agent from the outside. Installing Evidence gives an org the capability; each monitored agent still has to add the action.

A decision submitted with no `declared_rationale` is still recorded, and the response reports `rationale_declared = false`. Dropping it would hide exactly what an auditor is looking for.

---

## 4. Custom objects

| Object | Purpose | OWD | Notes |
|---|---|---|---|
| `Decision_Record__c` | Queryable index into the ledger | **Private** | Contains subject references. See §7.4. |
| `Rationale__c` | Declared reasoning, structured | Controlled by Parent | Master-detail |
| `Consideration__c` | An option weighed, taken or not | Controlled by Parent | Master-detail |
| `Policy_Check__c` | A control that fired | Controlled by Parent | Master-detail |
| `Evidence_Bundle__c` | A sealed export with chain proof | **Private** | Manual sharing to the matter team |
| `Bundle_Item__c` | Junction, bundle to decision | Controlled by Parent | |
| `Legal_Hold__c` | Suspends purge for a matter | Public Read Only | Existence is not sensitive; scope is |
| `Chain_Verification__c` | Result of an integrity pass | Public Read Only | Append-only by convention |

### Key fields

**`Decision_Record__c`**: `Decision_Number__c` (Auto Number `D-{00000}`), `Ledger_Key__c` (External Id, unique: the pointer into `Decision_Ledger__b`), `Agent_API_Name__c`, `Agent_Version__c`, `Occurred_At__c`, `Headline__c`, `Outcome__c`, `Autonomy_Level__c`, `Consequence_Level__c`, `Subject_Reference__c`, `Subject_Object__c`, `Actions_Taken__c` (Long Text), `Sources_Read__c` (Long Text), `Running_User__c`, `Approver__c`, `Escalated_To__c`, `This_Hash__c`, `Prior_Hash__c`, `Chain_Position__c`, `Under_Legal_Hold__c`, `Retention_Expires_At__c`, `Redaction_State__c`.

**`Rationale__c`**: `Decision_Record__c` (MD), `Statement__c` (Long Text), `Declared_At__c`, `Declared_Before_Action__c` (Boolean), `Model_Version__c`, `Prompt_Template_Version__c`, `Confidence__c`.

`Declared_Before_Action__c` is load-bearing. A rationale captured after the fact is a different evidentiary artifact from one captured before, and the UI must show which it was.

**`Consideration__c`**: `Decision_Record__c` (MD), `Option_Label__c`, `Option_Type__c` (`Topic` | `Action` | `Route`), `Confidence__c`, `Taken__c`, `Rejection_Reason__c`.

**`Policy_Check__c`**: `Decision_Record__c` (MD), `Control_Key__c`, `Control_Label__c`, `Evaluation__c` (`Passed` | `Blocked` | `Not_Triggered`), `Detail__c`, `Threshold_Value__c`, `Actual_Value__c`.

**`Evidence_Bundle__c`**: `Bundle_Number__c` (Auto Number `EB-{0000}`), `Matter__c`, `Purpose__c`, `Range_Start__c`, `Range_End__c`, `Decision_Count__c`, `State__c` (`Draft` | `Sealed` | `Delivered` | `Withdrawn`), `Sealed_At__c`, `Sealed_By__c`, `Segment_Root_Hash__c`, `Anchor_Reference__c`, `Redaction_Profile__c`, `Export_Format__c`.

**`Legal_Hold__c`**: `Matter__c`, `Scope_Filter_JSON__c`, `Effective_From__c`, `Released_At__c`, `Issued_By__c`, `Active__c`.

**`Chain_Verification__c`**: `Chain_Key__c`, `Verified_At__c`, `Links_Checked__c`, `First_Position__c`, `Last_Position__c`, `Result__c` (`Intact` | `Break_Detected`), `Break_At_Position__c`, `Duration_Ms__c`.

`Chain_Key__c` is not optional. Chains are per agent (§5.1), so a verification row without it records that *something* verified and gives no way to say what - the console cannot attribute a break to an agent, which is the only thing anyone wants to know when one is found.

---

## 5. Big Objects

### 5.1 `Decision_Ledger__b`

The record of record. Append-only, hash-chained.

**Index (immutable after first deploy):**

```
1. Chain_Key__c      (Text 60)       // one chain per agent: <orgKey>:<agentApiName>
2. Chain_Position__c (Number 18,0)   // monotonic within the chain
3. Ledger_Key__c     (Text 35)       // uniqueness tiebreak
```

**The text budget is 100 characters, total, across every text field in the index.**
60 + 35 = 95 fits. A split summing to exactly 100 is REJECTED - the budget carries
per-field overhead, so treat 100 as unreachable rather than as a ceiling you can sit on.
`Chain_Key__c` gets the room because it carries real content - an 18-character org id,
a colon, and the agent API name - while the tiebreak does not.

Chaining per agent rather than one global chain is deliberate. A single org-wide chain serializes every write through one counter and turns concurrent agent traffic into contention. Per-agent chains parallelize cleanly and still anchor together daily.

Fields: `Occurred_At__c`, `Agent_Version__c`, `Canonical_Body__c` (Long Text: the full key-sorted JSON), `This_Hash__c`, `Prior_Hash__c`, `Consequence_Level__c`, `Autonomy_Level__c`, `Subject_Reference__c`, `Running_User_Id__c`, `Approver_Id__c`.

### 5.2 `Chain_Anchor__b`

Daily terminal hash per chain. This is what a customer hands an auditor.

**Index:** `Chain_Key__c` (Text 60) → `Anchor_Date__c` → `Anchor_Key__c` (Text 35).

**`Anchor_Date__c` is a `DateTime`, not a `Date`.** Big Objects do not support the
`Date` type at all - it fails deploy with a bare `Invalid data type`. It is pinned to
midnight GMT via `EvidenceChainService.anchorDayStart()`, and every writer must go
through that helper: the index filters on equality, so an un-normalized value would
silently never match.

`Anchor_Key__c` is the date alone, not `chainKey:date`. The index prefix
(`Chain_Key__c`, `Anchor_Date__c`) is already unique - one anchor per chain per day - 
so repeating the chain key in the tiebreak buys nothing and would blow the same
100-character budget.

Fields: `Terminal_Hash__c`, `Terminal_Position__c`, `Link_Count__c`, `Computed_At__c`, `Computed_By__c`, `Signature__c`.

### 5.3 Big Object constraints that shape this design

These are not footnotes. They are why the architecture looks the way it does.

- **No record-level sharing.** Object permission only. This is the single most important security fact in the product. `Decision_Ledger__b` Read is granted **only** to `Evidence_Integration` and `Evidence_Auditor`, never to a general user permission set. All user-facing reads go through `EvidenceLedgerService`, which enforces its own access checks and redaction before returning anything.
- **Query only on the index, in index order.** Equality on all filters but the last. Every access pattern in §8 was designed backward from this constraint. Three specifics, each of which fails at *runtime* rather than at compile or deploy time, so none of them show up until real data exists:
  - **A filter may not skip an index column.** `WHERE Chain_Key__c = :k AND Ledger_Key__c = :lk` jumps over `Chain_Position__c` and throws `Filters may not have any gaps within the composite key`. Filter on the leading columns and match the rest in memory.
  - **`ORDER BY` must start at the leading index field** and follow index order. `ORDER BY Chain_Position__c` alone throws the same gap error; `ORDER BY Chain_Key__c, Chain_Position__c` is fine.
  - **`DESC` is not supported on an index column.** It throws `Unsupported order direction on filter column`. This is the big one: it means *there is no cheap way to read the terminal row of a chain*. `EvidenceLedgerStore.terminal()` reads the chain ascending and takes the last row, which is O(chain length) on every capture. See the note there before scaling.
- **No triggers, no flows, no processes.** Writes are Apex only, which is exactly what you want for an immutable ledger.
- **Insert and upsert only.** There is no update path, which is the property that makes "append-only" a platform guarantee rather than a convention.
- **Deletion is `Database.deleteImmediate`,** used only by the retention job and blocked entirely while a matching `Legal_Hold__c` is active.

---

## 6. The hash chain

### 6.1 Computation

```apex
// EvidenceChainService.computeHash
String payload = String.join(new List<String>{
    priorHash,                              // '' for position 0
    ledgerKey,
    agentApiName,
    String.valueOf(occurredAt.getTime()),   // epoch millis, not a formatted string
    canonicalBody                           // key-sorted JSON, see 6.2
}, '|');

Blob digest = Crypto.generateDigest('SHA-256', Blob.valueOf(payload));
String thisHash = EncodingUtil.convertToHex(digest);
```

### 6.2 Canonicalization

The hash is only meaningful if the body serializes identically every time. `EvidenceCanonicalizer` enforces:

- Keys sorted lexicographically at every level
- No whitespace
- Datetimes as epoch milliseconds, never formatted strings
- Decimals with a fixed scale
- Null-valued keys omitted rather than serialized as null
- Explicit field allowlist, so adding a field to `Decision_Record__c` cannot silently change historical hashes

This class is the most test-critical code in the product. Any change to it invalidates every hash written before it, so it is versioned: `Canonical_Version__c` is part of the hashed payload and the verifier dispatches on it.

### 6.3 Verification

`EvidenceChainService.verify(chainKey, fromPosition, toPosition)` walks the chain sequentially, recomputes each hash, and compares. Writes a `Chain_Verification__c`. Runs on a schedule and on demand from the console header.

### 6.4 What this proves, stated plainly

It proves the ledger has not been altered since it was written. **It does not prove the ledger was complete at write time.** Say this in the compliance documentation, in the product UI, and in the sales conversation. It is exactly what a competent auditor will probe, and having the answer ready is a differentiator rather than a weakness.

Completeness is addressed separately and partially: `EvidenceCompletenessService` reconciles decision counts against Agentforce session counts and opens a gap finding on mismatch. That is a detective control, not a proof.

---

## 7. Custom Metadata Types: admin configuration

### `Evidence_Setting__mdt` (single record `Default`)
`Capture_Enabled__c`, `Require_Rationale_Before_Action__c`, `Chain_Verification_Cron__c`, `Anchor_Cron__c`, `Verification_Batch_Size__c`, `Canonical_Version__c`, `Default_Retention_Days__c`, `Completeness_Check_Enabled__c`, `Completeness_Tolerance_Percent__c`.

### `Evidence_Capture_Policy__mdt`
`Policy_Key__c`, `Agent_API_Name__c` (blank means all), `Consequence_Level__c`, `Capture_Utterance__c`, `Capture_Response__c`, `Capture_Grounding__c`, `Capture_Considerations__c`, `Capture_Variables__c`, `Require_Rationale__c`, `Active__c`.

Lets a customer say "record everything for Claims Triage, record decisions only for Billing." Capture volume is a cost, and the customer should control it per agent.

### `Evidence_Consequence_Rule__mdt`
`Rule_Key__c`, `Match_Strategy__c` (`Action_Name` | `Object_Written` | `Amount_Threshold` | `Policy_Blocked`), `Match_Value__c`, `Consequence_Level__c` (`Low` | `Medium` | `High`), `Priority__c`, `Active__c`.

This is how an admin declares what "high consequence" means in their business without a code change. Seeded examples: any write to `Claim.Status`, any action named `Issue_*`, any amount over a configured threshold, any decision where a policy check returned `Blocked`.

### `Evidence_Retention_Policy__mdt`
`Policy_Key__c`, `Consequence_Level__c`, `Retention_Days__c`, `Purge_Strategy__c` (`Delete` | `Redact_Body_Keep_Hash`), `Active__c`.

`Redact_Body_Keep_Hash` is the important one. It satisfies a data-minimization obligation while preserving chain integrity, because the hash of the original body stays in place even after the body is gone. A chain with redacted bodies still verifies as a chain.

### `Evidence_Control_Mapping__mdt`
`Control_Key__c`, `Framework__c`, `Control_Reference__c`, `Control_Label__c`, `Satisfied_By__c`, `Evidence_Query_JSON__c`, `Active__c`.

The regulatory mapping is data, not code. Seeded with EU AI Act Art. 12 and Art. 14, SR 11-7, SOC 2 CC7, HIPAA disclosure accounting, and GDPR Art. 22. A customer in a framework you did not anticipate adds a record.

### `Evidence_Redaction_Rule__mdt`
`Rule_Key__c`, `Profile__c`, `Field_Path__c`, `Strategy__c` (`Mask` | `Hash` | `Remove` | `Tokenize`), `Applies_To_Export__c`, `Applies_To_Console__c`, `Active__c`.

Bundles going to outside counsel need a different redaction profile from the internal console view. Both are configuration.

### `Evidence_View__mdt`
`View_Key__c`, `Label__c`, `Filter_JSON__c`, `Display_Order__c`, `Active__c`.

Seeded: `ALL_DECISIONS`, `HIGH_CONSEQUENCE`, `ACTED_ALONE`, `OVERRIDDEN`, `UNDER_LEGAL_HOLD`.

---

## 8. Permission and sharing model

This is the part that matters most in Evidence. The product's whole value is that access to it is controlled and provable.

### 8.1 Custom permissions

| Custom permission | Gates |
|---|---|
| `Evidence_View_Ledger` | See decision records at all |
| `Evidence_View_Subject_Data` | See `Subject_Reference__c` and unredacted bodies |
| `Evidence_View_Rationale` | See declared reasoning |
| `Evidence_Assemble_Bundle` | Create a draft bundle |
| `Evidence_Seal_Bundle` | Seal a bundle and generate its chain proof |
| `Evidence_Manage_Legal_Hold` | Issue or release a hold |
| `Evidence_Verify_Chain` | Trigger an on-demand verification |
| `Evidence_Manage_Retention` | Run or configure purge |

Splitting `Evidence_View_Ledger` from `Evidence_View_Subject_Data` is the design point. A risk analyst studying autonomy trends needs the ledger. They do not need to know the claim belonged to a named person. Most seats get the former.

### 8.2 Permission sets

| Permission set | Intent | Notable grants |
|---|---|---|
| `Evidence_Analyst` | Read aggregate and de-identified ledger | `Evidence_View_Ledger` only |
| `Evidence_Investigator` | Work a specific matter | Adds Subject Data, Rationale, Assemble Bundle |
| `Evidence_Auditor` | Independent assurance | Adds Verify Chain, Read on `Decision_Ledger__b`, **View All** on `Decision_Record__c`, no write anywhere |
| `Evidence_Custodian` | Legal hold and retention | Adds Manage Legal Hold, Seal Bundle, Manage Retention |
| `Evidence_Administrator` | Configuration | CMDT, permission set assignment. **Deliberately excludes** Subject Data. |
| `Evidence_Integration` | Headless capture | Publish on `Evidence_Turn__e`, Create on `Decision_Ledger__b` and `Chain_Anchor__b`. Read is granted too - see below. |

Two intentional asymmetries, both of which an auditor will ask about and both of which have a good answer:

1. **`Evidence_Administrator` cannot read subject data.** The person who configures the system is not automatically the person who can read what it recorded. Separation of duties.
2. **`Evidence_Auditor` has View All but no write.** The auditor can never alter what they attest to.

**A correction to an earlier claim, because an auditor will check it.** This spec previously said `Evidence_Integration` has "Create but no read", and therefore that *no single permission set can both write the ledger and read it back*. **That is not achievable on the platform.** Salesforce refuses to grant Create on a Big Object without Read - the deploy fails with `Permission Create Chain_Anchor__b depends on permission(s): Read Chain_Anchor__b` - so `Evidence_Integration` necessarily carries Read on both `Decision_Ledger__b` and `Chain_Anchor__b`.

What actually holds the line is weaker, and should be described as such:

- The seat is assigned to the integration user and to no human (install checklist item 1), so no interactive login holds it.
- It grants no custom permission, so `EvidenceLedgerService` returns nothing through it - every user-facing read is gated on `Evidence_View_Ledger` and friends, not on object permissions.
- Read at the object layer is reachable only by running Apex or the API as that user, which is itself a privileged act.

Do not claim the stronger separation in a sales conversation or a control narrative. Claim this one.

### 8.3 Matrix

| Custom permission | Analyst | Investigator | Auditor | Custodian | Administrator |
|---|:---:|:---:|:---:|:---:|:---:|
| `Evidence_View_Ledger` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `Evidence_View_Subject_Data` | | ✅ | ✅ | ✅ | |
| `Evidence_View_Rationale` | | ✅ | ✅ | ✅ | |
| `Evidence_Assemble_Bundle` | | ✅ | | ✅ | |
| `Evidence_Seal_Bundle` | | | | ✅ | |
| `Evidence_Manage_Legal_Hold` | | | | ✅ | |
| `Evidence_Verify_Chain` | | | ✅ | ✅ | ✅ |
| `Evidence_Manage_Retention` | | | | ✅ | |

### 8.4 Record-level sharing

`Decision_Record__c` is **Private**, and stays private. Access comes from exactly three places:

1. **Apex managed sharing** with `RowCause = 'Evidence_Matter_Team__c'`, written by `EvidenceSharingService` when a decision is added to a bundle. Scoped to the matter, revoked when the bundle is withdrawn. Managed sharing with a custom row cause cannot be deleted by users, which is the point.
2. **View All** in `Evidence_Auditor` only.
3. **Owner** is the integration user, which owns nothing a human can reach by default.

No sharing rules. No sharing sets. No manual sharing. A record-level grant in this product should always be traceable to a matter or to the auditor role, and criteria-based rules make that untrue.

### 8.5 Field-level security

`Subject_Reference__c`, `Rationale__c.Statement__c`, and `Canonical_Body__c` are FLS-restricted to the permission sets holding the matching custom permission. Because the facades return DTOs and DTO fields are not FLS-protected, `EvidenceLedgerService` re-checks with `FeatureManagement.checkPermission` and nulls the field before it leaves Apex. Both layers, always.

### 8.6 Auditing the auditors

Every read through `EvidenceLedgerService` that returns subject data publishes an `Evidence_Access__e` event, archived to `Decision_Ledger__b` under a reserved chain key `ACCESS`. Reads of the evidence system are themselves evidence. If Shield Event Monitoring is licensed, correlate; if not, this stands alone.

---

## 9. Apex

### 9.1 Conventions

`public with sharing` on every service class. All SOQL `WITH USER_MODE`, all DML `AccessLevel.USER_MODE`. CMDT read through `EvidenceConfigurationService` static caches, one SOQL per type per transaction. DTOs are inner classes with `@AuraEnabled` fields so the same shape serves the React SDK and any future LWC. No SOQL or DML inside loops, ever. Custom permission checks via `FeatureManagement.checkPermission`. Target 90% coverage on service classes.

**The one documented system-mode exception:** `EvidenceCaptureService.write` runs in system mode. A user whose profile lacks Evidence access must never cause an agent conversation to fail, and the capture path must never be suppressible by the running user's permissions. Commented in-line with this rationale. Nothing else in the codebase runs in system mode.

### 9.2 Facades

**`EvidenceLedgerService`**
- `getDecisions(LedgerQuery q) → List<DecisionView>`: applies redaction and permission checks before returning
- `getDecision(Id) → DecisionDetailView`: the full six-part record
- `getByLedgerKey(String) → DecisionDetailView`
- `search(LedgerSearch s) → List<DecisionView>`: index-order aware, rejects a query the Big Object index cannot serve rather than silently returning nothing

**`EvidenceCaptureService`**
- `write(List<Evidence_Turn__e>) → Integer`: classify, canonicalize, chain, insert ledger, insert index record
- `classify(Evidence_Turn__e) → ConsequenceResult`: evaluates `Evidence_Consequence_Rule__mdt` in priority order

**`EvidenceChainService`**
- `computeHash(ChainInput) → String`
- `nextPosition(String chainKey) → Long`
- `verify(String chainKey, Long from, Long to) → Chain_Verification__c`
- `anchor(String chainKey, Date d) → Chain_Anchor__b`

**`EvidenceCanonicalizer`**
- `canonicalize(Map<String, Object> body, Integer canonicalVersion) → String`

**`EvidenceBundleService`**
- `draft(BundleInput) → Evidence_Bundle__c`
- `addDecisions(Id bundleId, List<String> ledgerKeys) → Integer`: also calls `EvidenceSharingService`
- `seal(Id bundleId) → BundleResult`: verifies the chain segment, computes `Segment_Root_Hash__c`, links the anchor, flips to `Sealed`. Requires `Evidence_Seal_Bundle`.
- `export(Id bundleId, String format) → ContentVersion`: applies the redaction profile
- `withdraw(Id bundleId, String reason) → Evidence_Bundle__c`

**`EvidenceLegalHoldService`**
- `issue(HoldInput) → Legal_Hold__c`
- `release(Id, String reason) → Legal_Hold__c`
- `isHeld(String ledgerKey) → Boolean`: consulted by the retention job on every candidate

**`EvidenceRetentionService`**
- `purge(Integer batchSize) → PurgeResult`: honors `Evidence_Retention_Policy__mdt`, skips anything held, uses `Redact_Body_Keep_Hash` where configured so the chain still verifies

**`EvidenceCompletenessService`**
- `reconcile(Date d) → CompletenessResult`

**`EvidenceControlService`**
- `getMappings() → List<ControlMappingView>`
- `evidenceFor(String controlKey, Date from, Date to) → List<DecisionView>`

**`EvidenceSharingService`**
- `grantMatterAccess(Id bundleId, List<Id> decisionIds) → Integer`
- `revokeMatterAccess(Id bundleId) → Integer`

**`EvidenceConfigurationService`**
- `getSetting()`, `getCapturePolicies()`, `getConsequenceRules()`, `getRetentionPolicies()`, `getControlMappings()`, `getRedactionRules()`, `getViews()`

Supporting: `EvidenceException`, `EvidenceTestFactory`, `EvidenceCaptureQueueable`, `EvidenceVerificationBatch`, `EvidenceAnchorSchedulable`, `EvidenceRetentionBatch`, `EvidenceTurnTriggerHandler`.

### 9.3 Write path concurrency

Chain position must be monotonic and gap-free within a chain. The write path is:

1. `EvidenceTurnTrigger` (after insert on the Platform Event) enqueues `EvidenceCaptureQueueable` with the batch.
2. The Queueable processes **one chain at a time**, in order, reading the current terminal position once.
3. Position is assigned in memory across the batch, then written in a single `Database.insertImmediate` to `Decision_Ledger__b`.
4. The `Decision_Record__c` index rows insert in the same transaction.

Platform Event subscribers replay in order per publisher, and processing one chain per Queueable link means no two transactions ever contend for the same counter. If a link fails, the replay resumes from the stored checkpoint and positions stay gap-free.

---

## 10. Automation

### 10.1 Triggers

**`EvidenceTurnTrigger`** (`after insert` on `Evidence_Turn__e`) → `EvidenceTurnTriggerHandler.handleAfterInsert` → enqueue `EvidenceCaptureQueueable`. Guarded by `EvidenceCaptureService.bypass`.

One trigger per object, always. `EvidenceTurnTrigger` is the only subscriber to `Evidence_Turn__e`, and it does one thing: enqueue the capture Queueable.

### 10.2 Scheduled

- `EvidenceAnchorSchedulable`: daily, writes a `Chain_Anchor__b` per chain
- `EvidenceVerificationBatch`: on `Chain_Verification_Cron__c`, walks chains in `Verification_Batch_Size__c` slices
- `EvidenceRetentionBatch`: nightly, hold-aware
- `EvidenceCompletenessService.reconcile`: daily

### 10.3 Flows

| Flow | Type | Contract |
|---|---|---|
| `Evidence_Notify_Chain_Break_Flow` | Autolaunched | In: `verificationId`, `chainKey`, `position`. Out: `resultMessage`. A chain break is a serious event and the customer decides who hears about it. |
| `Evidence_Issue_Legal_Hold_Screen` | Screen | Guided hold: matter, scope preview with a live count, effective date, confirmation. |
| `Evidence_Assemble_Bundle_Screen` | Screen | Guided assembly: matter, range, filter, redaction profile, preview, seal. |
| `Evidence_Onboard_Agent_Screen` | Screen | Setup wizard: pick an agent, choose a capture policy, set consequence rules, verify the tap fires. |
| `Evidence_Approval_Recorded_Flow` | Autolaunched | In: `decisionId`, `approverId`. Out: `resultMessage`. Lets a customer wire their own approval process into the record. |

Flow contract rules: every autolaunched flow takes `recordId`-style scalar inputs and returns a single `resultMessage` string. Apex passes inputs by those exact names and reads `resultMessage`, so adding a flow needs no Apex change. Keep bulk logic in Apex; keep Flow for declarative, admin-visible, org-specific side effects.

No record-triggered flows ship in the package. The ledger objects must not have customer automation on them, and `Decision_Ledger__b` cannot have any by platform rule, which is a feature here.

---

## 11. Agentforce agents

### 11.1 `Evidence_Engine`: `GenAiPlannerBundle`

Topics: `verify_chain`, `summarize_decision`, `assemble_bundle`, `flag_anomalous_autonomy`, `answer_from_ledger`.

Needs `GenAiPlannerBundle` for the `run` keyword and `filter_from_agent`, since bundle assembly is a conditional multi-step process.

```agentscript
topic answer_from_ledger:
	label: "Answer From Ledger"
	description: "Answer a natural language question about agent decisions using only the recorded ledger."

	actions:
		Resolve_Query:
			description: "Translate the question into an index-compatible ledger query"
			inputs:
				"Input:question": string
					description: "The user's question"
					is_required: True
			outputs:
				promptResponse: string
					description: "Structured LedgerQuery JSON"
					is_used_by_planner: True
			target: "generatePromptResponse://Evidence_Ledger_Query_v1"

		Run_Ledger_Query:
			description: "Execute the resolved query against the decision ledger"
			inputs:
				query_json: string
					description: "Structured LedgerQuery"
					is_required: True
			outputs:
				decisions: string
					description: "Matching decisions, already redacted for the running user"
					is_used_by_planner: True
			target: "apex://EvidenceLedgerService"

	reasoning:
		instructions: ->
			| Translate the question into a ledger query, then run it.
			| Answer only from what Run_Ledger_Query returned.
			| Never infer a decision that is not in the result set, and never
			| describe an agent's reasoning beyond the declared rationale on
			| the record. If the result set is empty, say the ledger holds no
			| matching decisions rather than speculating.
			| Always state the count you are answering from.
```

That last instruction block is the product. An evidence tool that hallucinates is worse than no evidence tool.

### 11.2 `Evidence_Analyst`: `AiAuthoringBundle`

Customer-facing, visible in Agentforce Studio. Plain-language narrative for a single decision, and conversational ledger query for the risk officer who will not open a console. Uses `go_to_escalate` rather than the reserved `escalate`.

### 11.3 Conventions

Agent Script conventions: tabs not spaces · `instructions: ->` with the space · `@variables` plural · `True`/`False` capitalized · actions defined inside topics, never top level · both `label` and `description` on every topic · `language:` block present · no reserved words as input names (`description` is reserved, use `case_description`) · Flow input and output names match the Flow variable API names exactly · `sf agent validate authoring-bundle` returns zero errors before any deploy.

---

## 12. Frontend contract

### 12.1 Base path and data seam

Inside the org the bundle is served from `/app/c__evidenceUi`, not `/`. `src/app/providers.tsx` reads `globalThis.SFDC_ENV.basePath` and passes it to `BrowserRouter` as `basename`; standalone `npm run dev` has no `SFDC_ENV`, so basename is `undefined` and the app serves from `/`. Never hardcode a route path that assumes the domain root. Components never touch the SDK: the chain is feature → TanStack Query hook → repository interface → adapter chosen by `getRepositories()` on `VITE_DATA_MODE` (`mock` default, `salesforce`). This is what lets the whole UI be built and demoed before a single Apex class exists.

Repository interfaces: `LedgerRepository`, `DecisionRepository`, `BundleRepository`, `HoldRepository`, `ChainRepository`, `ControlRepository`, `AnalysisRepository`.

### 12.2 SDK usage

```ts
import { createDataSDK, gql } from "@salesforce/platform-sdk";
const sdk = await createDataSDK();
const r = await sdk.graphql?.query<DecisionsResponse>({ query: RECENT_DECISIONS });
const rows = r?.data?.uiapi?.query?.Decision_Record__c?.edges ?? [];
```

**The one rule that matters most here:** GraphQL is used only for `Decision_Record__c` list views, where Private OWD plus managed sharing already enforces access correctly at the platform layer. **Everything touching `Decision_Ledger__b` goes through Apex**, because Big Objects have no record-level sharing and the facade is the only place access control can live. Do not add a GraphQL path to the ledger. There is no safe version of it.

### 12.3 Routes

`/ledger` · `/ledger/:decisionId` · `/analysis` · `/bundles` · `/bundles/:bundleId` · `/holds` · `/controls` · `/chain` · `/settings` (`/settings/capture`, `/settings/consequence`, `/settings/retention`, `/settings/redaction`, `/settings/permissions`)

### 12.4 The decision record UI

The hero. Six panels, each labeled with its provenance badge:

| Panel | Badge | Source |
|---|---|---|
| What it did | Observed | `Actions_Taken__c` |
| What it read | Observed | `Sources_Read__c` with relevance bars |
| What it considered | Observed | `Consideration__c`, taken option marked |
| What constrained it | Observed | `Policy_Check__c` with pass, blocked, not triggered |
| Why it chose this | **Declared** | `Rationale__c`, visually distinct, with the standing note that this is the agent's account and not a computation trace |
| Who is accountable | Observed | Running user, approver, escalation target |

The chain position renders as `prior → this` in the record header. If `Declared_Before_Action__c` is false, the Declared panel carries a warning treatment, because a post-hoc rationale is a materially weaker artifact and the interface should not let that pass unnoticed.

### 12.5 Chain integrity in the header

Persistent, not buried in a report. Shows link count, last verification time, and result. `Verify now` is one click for anyone with `Evidence_Verify_Chain`. A break renders as an unmissable error state across the whole shell, because a broken chain invalidates every claim the product makes.

### 12.6 Stack and tokens

React 18 · TanStack Query, Table, Virtual · Radix primitives with shadcn/ui · Tailwind · zustand · react-router-dom · react-hook-form with zod · recharts · date-fns · 4px radius.

Evidence has its own visual identity, deliberately off the SLDS blue so the record reads as a formal ledger rather than a dashboard. Autonomy is the product's signature metric, so violet leads.

- **Palette:** primary violet `#6D28D9` (`brandDark` `#4C1D95`), accent `#A855F7`, autonomy `#7C3AED`; semantics success `#2E844A`, warning `#B45309`, error `#B91C1C`; ink neutrals with a faint violet cast - page `#F5F3F8`, surface `#FFFFFF`, border `#E7E2EE`, text `#1C1626`.
- **Typography:** `Inter` for everything - body, display headings, KPI numerals, the wordmark, and hashes/scores. No serif, no monospace break.

---

## 13. Test strategy

**Apex.** 95% on `EvidenceCanonicalizer` and `EvidenceChainService`, 90% elsewhere. Mandatory cases:

- Canonicalization is stable across field-order permutations and across two runs in different transactions
- A hash chain of 1,000 links verifies, and a single mutated body is detected at the right position
- `Redact_Body_Keep_Hash` purge leaves the chain verifiable
- Legal hold blocks purge for exactly the held scope and nothing more
- Every permission set in §8.3 is asserted positively and negatively
- `Evidence_Administrator` cannot read subject data
- An index-incompatible ledger query throws rather than returning an empty list
- Concurrent capture across two chains produces gap-free positions in both

**Frontend.** Vitest, Testing Library, jsdom. Cover the provenance badges, the post-hoc rationale warning state, the chain-break shell state, and redaction rendering.

**Integration.** A scratch org with `scripts/seed.sh` generating 500 decisions across three agents, one deliberate chain break for the verification demo, and one active legal hold.

---

## 14. Deployment

```bash
bash scripts/auth.sh
bash scripts/deploy.sh
bash scripts/deploy.sh --check
sf agent validate authoring-bundle --api-name Evidence_Analyst
sf org open --path lightning/app/Evidence
```

Order: objects and Big Objects → Apex → Flows → agent bundles.

**Packaging.** Multi-Framework apps cannot ship in a managed package yet. Ship the objects, Big Objects, Apex, Flows, CMDT, and agent bundles as the managed package, and the UI Bundle as an unlocked package installed alongside. Collapse them into one when Multi-Framework managed-package support lands.

**Install-time checklist for the customer admin:**
1. Assign `Evidence_Integration` to the integration user and to nobody else
2. Run `Evidence_Onboard_Agent_Screen` for each agent
3. Review `Evidence_Consequence_Rule__mdt` and set the amount threshold to a real number
4. Set the retention policy and confirm the legal hold owner
5. Verify `Decision_Ledger__b` Read is absent from every user-facing permission set

Item 5 belongs in a post-install validation Apex script that fails loudly.

---

## 15. Build order

| Phase | Deliverable | Done when |
|---|---|---|
| **1** | Objects, Big Objects, event, CMDT, permission sets, tap, capture, canonicalizer, chain | A live conversation writes a verifiable chained ledger row |
| **2** | UI Bundle with mock adapter: ledger list, decision record, chain header | The six-panel record is demoable with no org data |
| **3** | Salesforce adapter, consequence classification, redaction, access auditing | Real decisions render with correct redaction per permission set |
| **4** | Bundles, sealing, anchors, legal hold, export | A sealed bundle with chain proof exports and verifies |
| **5** | Analysis tab, control mapping, completeness reconciliation | The three risk-officer questions answer themselves |
| **6** | `Evidence_Engine` conversational ledger query, anomalous autonomy detection | Weekly use rather than annual use |

Phases 1 through 4 are the sellable MVP. Phase 6 is what makes it a daily tool rather than an audit artifact.

---

## 16. Open questions to close before Phase 1

- ~~**Big Object index, both objects.** Confirm §5.1 and §5.2 before the first deploy. Immutable once data lands, and getting `Chain_Key__c` wrong means rebuilding the chain.~~ **Closed 2026-07-29.** Both originally used a 60/60 text split that exceeded the 100-character index budget and failed to deploy. Both are now 60/35, and `Anchor_Key__c` no longer embeds the chain key. Verified deployed against `imperialealex@gmail.com`.
- **Big Object record allowance.** Custom Big Objects have a record allowance beyond which capacity must be purchased. Model expected volume at target customer scale and confirm the commercial path before promising unlimited retention.
- **Canonical version migration.** Decide now how a future `Canonical_Version__c = 2` coexists with v1 records. The verifier dispatching on the stored version is the answer, but it has to be built in from the first release, not retrofitted.
- **Shield dependency.** Field Audit Trail and Event Monitoring strengthen the story but must not be hard requirements. Confirm the product degrades cleanly without them.
- **Signature on `Chain_Anchor__b`.** `Crypto.sign` with a key stored where? A protected custom setting is not good enough for an anchor signature. Evaluate named credential external key management before committing to the field.
