/**
 * Static, org-independent constants for the Evidence console.
 * Nothing here touches the SDK or a repository.
 */

/** Data seam mode. `mock` is the default so the app runs with no org. */
export type DataMode = "mock" | "salesforce";

export const DATA_MODE: DataMode =
  (import.meta.env.VITE_DATA_MODE as DataMode | undefined) ?? "mock";

/** The bundle is served from /app/c__evidenceUi inside the org. */
export const UI_BUNDLE_REF = "c__evidenceUi";

/**
 * Reserved chain key for access-audit rows (see CONTRACT §8.6).
 * Never a real agent chain.
 */
export const ACCESS_CHAIN_KEY = "ACCESS";

/** Every route the shell knows about (CONTRACT §12.3). */
export const ROUTES = {
  dashboard: "/dashboard",
  ledger: "/ledger",
  decision: (decisionId = ":decisionId") => `/ledger/${decisionId}`,
  analysis: "/analysis",
  bundles: "/bundles",
  bundle: (bundleId = ":bundleId") => `/bundles/${bundleId}`,
  holds: "/holds",
  controls: "/controls",
  chain: "/chain",
  settings: "/settings",
  settingsCapture: "/settings/capture",
  settingsConsequence: "/settings/consequence",
  settingsRetention: "/settings/retention",
  settingsRedaction: "/settings/redaction",
  settingsPermissions: "/settings/permissions",
} as const;

/**
 * Saved ledger views, mirrors seeded `Evidence_View__mdt` (CONTRACT §7).
 * `key` matches the CMDT View_Key__c so the SF adapter can round-trip it.
 */
export interface LedgerViewDef {
  key: string;
  label: string;
}

export const LEDGER_VIEWS: LedgerViewDef[] = [
  { key: "ALL_DECISIONS", label: "All decisions" },
  { key: "HIGH_CONSEQUENCE", label: "High consequence" },
  { key: "ACTED_ALONE", label: "Acted alone" },
  { key: "OVERRIDDEN", label: "Overridden" },
  { key: "UNDER_LEGAL_HOLD", label: "Under legal hold" },
];

/** Default page size for ledger list queries. */
export const LEDGER_PAGE_SIZE = 25;

/**
 * Custom permissions (CONTRACT §8.1). The UI hides affordances the running
 * user lacks; Apex re-checks on every write, so these are UX hints only.
 */
export const PERMISSIONS = {
  viewLedger: "Evidence_View_Ledger",
  viewSubjectData: "Evidence_View_Subject_Data",
  viewRationale: "Evidence_View_Rationale",
  assembleBundle: "Evidence_Assemble_Bundle",
  sealBundle: "Evidence_Seal_Bundle",
  manageLegalHold: "Evidence_Manage_Legal_Hold",
  verifyChain: "Evidence_Verify_Chain",
  manageRetention: "Evidence_Manage_Retention",
} as const;

/** The mandatory standing note under every Declared panel (CONTRACT §12.4). */
export const DECLARED_STANDING_NOTE =
  "This is the agent's account of its reasoning, not a trace of the underlying computation. Everything else on this record is observed directly.";

/** Shown when a rationale was captured after the fact (weaker artifact). */
export const POST_HOC_WARNING =
  "This rationale was recorded after the action, not before it. A post-hoc account is a materially weaker evidentiary artifact.";

/** What the hash chain proves - and does not (CONTRACT §6.4). */
export const CHAIN_PROOF_NOTE =
  "Chain integrity proves the ledger has not been altered since it was written. It does not prove the ledger was complete at write time.";
