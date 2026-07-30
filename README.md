# Evidence

**Every choice an agent made, what it did, and why.**

Evidence is a Salesforce-native, hash-chained, append-only decision ledger for
Agentforce. It answers one question an auditor actually asks: _what exactly did
this agent do, and why?_ It is built for compliance, risk, internal audit, and
legal - not for demos.

## The honesty principle

Agent reasoning is not fully transparent, and a product that claims to read the
model's mind will not survive a real audit. Evidence draws one line and labels
it everywhere - in the data model, the API, and the UI:

- **Observed.** Deterministic facts: actions invoked with their inputs and
  outputs, records read, options considered with confidence scores, policy
  evaluations, who ran it, who approved it.
- **Declared.** The agent's own account of its reasoning, captured by a
  mandatory `Declare_Rationale` action that must fire before any consequential
  action. It is the agent's account, not a computation trace, and the interface
  never lets that pass unnoticed.

## What's in the box

- **`Decision_Ledger__b` / `Chain_Anchor__b`** - the record of record. Append-only,
  per-agent hash chains (`SHA-256` over a canonicalized, key-sorted body), with a
  daily terminal-hash anchor that is what a customer hands an auditor.
- **`Decision_Record__c`** and children (`Rationale__c`, `Consideration__c`,
  `Policy_Check__c`) - the queryable index and the six-panel decision record.
- **Evidence bundles, legal holds, retention, control mapping** - a sealed
  bundle carries its chain segment and anchor proof; legal holds block purge;
  retention can redact bodies while keeping the hash so the chain still verifies.
- **A React UI Bundle (`evidenceUi`)** on Salesforce Multi-Framework - the
  Evidence console. No external services.

## Layout

```
evidence/
├── sfdx-project.json            # sourceApiVersion 67.0
├── config/project-scratch-def.json
├── scripts/{auth.sh,deploy.sh}
└── force-app/main/default/
    ├── applications/Evidence.app-meta.xml
    ├── objects/  classes/  triggers/  flows/  permissionsets/
    ├── customMetadata/  customPermissions/  tabs/
    └── uiBundles/evidenceUi/     # React + TS + Vite + Tailwind
```

## Prerequisites

- Node.js **v22+**
- Salesforce CLI **v2.130.7+** (ships the UI Bundle plugin)
- A Dev Hub, and a target org on **Summer '26 or later** (Multi-Framework GA)

## Deploy (per §14)

```bash
# 1. Create the scratch org and set it as default (alias: evidence)
bash scripts/auth.sh

# 2. Build the UI Bundle and deploy force-app, then assign the base permset
bash scripts/deploy.sh

# Validate only, committing nothing:
bash scripts/deploy.sh --check

# Deploy without rebuilding the UI:
bash scripts/deploy.sh --no-ui

# 3. Validate the customer-facing agent bundle
sf agent validate authoring-bundle --api-name Evidence_Analyst

# 4. Open the app
sf org open --path lightning/app/Evidence
```

`deploy.sh` builds the UI (`npm run build` inside `uiBundles/evidenceUi`), runs
`sf project deploy start --source-dir force-app`, then assigns the
**`Evidence_Analyst`** base permission set. Deploy order is objects and Big
Objects → Apex → Flows → agent bundles.

## The UI, standalone

The console is built against a mock data seam and runs with no org:

```bash
npm run ui:install
npm run ui:dev        # http://localhost:5173, VITE_DATA_MODE defaults to "mock"
```

Components never touch the SDK directly. The chain is
`feature → TanStack Query hook → repository interface → adapter` chosen by
`getRepositories()` on `VITE_DATA_MODE`. Everything touching `Decision_Ledger__b`
goes through Apex; GraphQL is used only for `Decision_Record__c` list views,
where Private OWD plus managed sharing enforces access at the platform layer.

## Security posture

Access to Evidence is controlled and provable - that is the whole product.
`Decision_Record__c` is **Private** and stays private; Big Objects have no
record-level sharing, so all user-facing reads route through
`EvidenceLedgerService`, which re-checks custom permissions and applies
redaction before anything leaves Apex. The base seat, `Evidence_Analyst`, gets the
de-identified ledger and nothing more.

One caveat stated plainly, because an auditor will test it: the platform will not
grant Create on a Big Object without Read, so `Evidence_Integration` holds Read on
`Decision_Ledger__b`. It is assigned to the integration user and to no human, and it
carries no custom permission, so it reads nothing back through `EvidenceLedgerService`.
See CONTRACT.md §8.2.

## What the chain proves

It proves the ledger has not been altered since it was written. It does **not**
prove the ledger was complete at write time - completeness is a separate,
detective control (`EvidenceCompletenessService`). Evidence says so plainly, in
the docs, the UI, and the sales conversation, because a competent auditor will
probe exactly that.

## Packaging

Multi-Framework apps cannot yet ship in a managed package. Ship the objects, Big
Objects, Apex, Flows, CMDT, and agent bundles as the managed package, and the UI
Bundle as an unlocked package installed alongside. Collapse them into one when
Multi-Framework managed-package support lands.

## Testing

The Apex suite and the UI suite run independently.

```bash
npm run apex:test                                 # Apex, with coverage
cd force-app/main/default/uiBundles/evidenceUi
npm test                                          # Vitest, jsdom
npm run lint                                      # ESLint, zero-warning policy
npm run build                                     # tsc -b && vite build
```

Coverage targets are set in `CONTRACT.md` §13. `EvidenceCanonicalizer` and
`EvidenceChainService` carry the highest bar, because canonicalization that is not stable
across field order or across transactions produces a chain that fails verification for a
reason that has nothing to do with tampering.

### Testing note on big objects

`Decision_Ledger__b` and `Chain_Anchor__b` cannot be written in an Apex test context, and
`Database.insertImmediate` behaves like a callout, so it fails after ordinary DML in the same
transaction. Every ledger read and write therefore goes through `EvidenceLedgerStore`, which
swaps a `BigObjectStore` for an `InMemoryStore` under test. Do not remove that seam.

Big objects also constrain queries in ways that are easy to get wrong: a composite index
cannot be queried with gaps, `ORDER BY` must begin at the leading index field, `DESC` is
unsupported on index columns, and `Date` is not a supported field type. The store encodes
those rules in one place so the features do not have to.

## Repository layout

```
evidence/
  CONTRACT.md                     single source of truth for shared names and shapes
  force-app/main/default/
    classes/                      Apex services, invocable actions, tests
    objects/                      custom objects, two big objects, platform event, CMDT
    permissionsets/               Administrator, Auditor, Investigator, Viewer, Integration
    genAiPlannerBundles/          Agentforce agent definitions
    uiBundles/evidenceUi/         React console (source, tests, Vite config)
  scripts/                        auth, deploy, seed
  docs/                           design notes
```

## License

MIT. Copyright (c) 2026 VurtuoLabs
