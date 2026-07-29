/**
 * Domain DTOs for the Evidence console.
 *
 * These mirror the `@AuraEnabled` inner-class views returned by the Apex
 * facades (CONTRACT §9.2) and the fields of the custom objects (§4/§5).
 * The React app only ever sees these shapes - never raw SObjects - so the
 * mock and Salesforce adapters are interchangeable behind the repositories.
 */

/* --------------------------------------------------------------------- */
/* Enumerations (picklist values, kept identical to the metadata)         */
/* --------------------------------------------------------------------- */

/** `Decision_Record__c.Outcome__c` */
export type Outcome = "Approved" | "Denied" | "Escalated" | "Completed" | "Deferred";

/** `Decision_Record__c.Autonomy_Level__c` */
export type AutonomyLevel = "Autonomous" | "Escalated" | "Human_Approved";

/** `Decision_Record__c.Consequence_Level__c` and consequence rules */
export type ConsequenceLevel = "Low" | "Medium" | "High";

/** `Policy_Check__c.Evaluation__c` */
export type Evaluation = "Passed" | "Blocked" | "Not_Triggered";

/** `Consideration__c.Option_Type__c` */
export type OptionType = "Topic" | "Action" | "Route";

/** `Decision_Record__c.Redaction_State__c` */
export type RedactionState = "None" | "Partial" | "Body_Redacted_Hash_Kept";

/** `Evidence_Bundle__c.State__c` */
export type BundleState = "Draft" | "Sealed" | "Delivered" | "Withdrawn";

/** `Chain_Verification__c.Result__c` */
export type ChainResult = "Intact" | "Break_Detected";

/** Which side of the honesty line a panel sits on (CONTRACT §1). */
export type Provenance = "Observed" | "Declared";

/* --------------------------------------------------------------------- */
/* Ledger list + detail views                                             */
/* --------------------------------------------------------------------- */

/** Row shape for the ledger list - `EvidenceLedgerService.DecisionView`. */
export interface DecisionView {
  id: string;
  decisionNumber: string;
  ledgerKey: string;
  agentApiName: string;
  agentVersion: string;
  occurredAt: string;
  headline: string;
  outcome: Outcome;
  autonomyLevel: AutonomyLevel;
  consequenceLevel: ConsequenceLevel;
  /** Null when the running user lacks `Evidence_View_Subject_Data`. */
  subjectReference: string | null;
  subjectObject: string | null;
  thisHash: string;
  priorHash: string | null;
  chainPosition: number;
  chainKey: string;
  underLegalHold: boolean;
  redactionState: RedactionState;
  /** True if a human reviewer overturned the decision (analysis views). */
  overridden?: boolean;
}

/** A source the agent read, with its relevance score (Observed panel). */
export interface SourceRead {
  source: string;
  relevance: number;
}

/** `Consideration__c` - an option weighed, taken or not (Observed panel). */
export interface ConsiderationView {
  id: string;
  optionLabel: string;
  optionType: OptionType;
  confidence: number;
  taken: boolean;
  rejectionReason: string | null;
}

/** `Policy_Check__c` - a control that fired (Observed panel). */
export interface PolicyCheckView {
  id: string;
  controlKey: string;
  controlLabel: string;
  evaluation: Evaluation;
  detail: string;
  thresholdValue: string | null;
  actualValue: string | null;
}

/** `Rationale__c` - the single Declared panel. */
export interface RationaleView {
  id: string;
  statement: string | null;
  declaredAt: string;
  /** Load-bearing: false renders the post-hoc warning treatment. */
  declaredBeforeAction: boolean;
  modelVersion: string | null;
  promptTemplateVersion: string | null;
  confidence: number | null;
}

/** Who is accountable (Observed panel). */
export interface Accountability {
  runningUser: string | null;
  approver: string | null;
  escalatedTo: string | null;
}

/**
 * The full six-panel record - `EvidenceLedgerService.DecisionDetailView`.
 * Extends the list row with the child collections.
 */
export interface DecisionDetailView extends DecisionView {
  actionsTaken: string[];
  sourcesRead: SourceRead[];
  considerations: ConsiderationView[];
  policyChecks: PolicyCheckView[];
  rationale: RationaleView | null;
  accountability: Accountability;
  retentionExpiresAt: string | null;
  /** Canonical key-sorted body; null unless permitted + unredacted. */
  canonicalBody: string | null;
}

/* --------------------------------------------------------------------- */
/* Query inputs                                                           */
/* --------------------------------------------------------------------- */

/** `EvidenceLedgerService.LedgerQuery` - list filters. */
export interface LedgerQuery {
  viewKey?: string;
  agentApiName?: string;
  consequenceLevel?: ConsequenceLevel;
  autonomyLevel?: AutonomyLevel;
  outcome?: Outcome;
  underLegalHold?: boolean;
  from?: string;
  to?: string;
  pageSize?: number;
  cursor?: string | null;
}

/**
 * `EvidenceLedgerService.LedgerSearch` - index-order-aware search.
 * A query the Big Object index cannot serve throws rather than returning
 * an empty list (CONTRACT §9.2), surfaced here as `IndexIncompatibleError`.
 */
export interface LedgerSearch {
  chainKey?: string;
  fromPosition?: number;
  toPosition?: number;
  ledgerKey?: string;
  text?: string;
}

/** A page of list results plus an opaque forward cursor. */
export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
  totalCount: number;
}

/* --------------------------------------------------------------------- */
/* Chain views                                                            */
/* --------------------------------------------------------------------- */

/** `Chain_Verification__c`. */
export interface ChainVerificationView {
  id: string;
  chainKey: string;
  verifiedAt: string;
  linksChecked: number;
  firstPosition: number;
  lastPosition: number;
  result: ChainResult;
  breakAtPosition: number | null;
  durationMs: number;
}

/** `Chain_Anchor__b` - daily terminal hash per chain. */
export interface ChainAnchorView {
  chainKey: string;
  anchorDate: string;
  terminalHash: string;
  terminalPosition: number;
  linkCount: number;
  computedAt: string;
  computedBy: string;
  signature: string | null;
}

/** Aggregate chain-integrity status rendered persistently in the header. */
export interface ChainStatusView {
  result: ChainResult;
  totalLinks: number;
  chainCount: number;
  lastVerifiedAt: string;
  breakChainKey: string | null;
  breakAtPosition: number | null;
}

/* --------------------------------------------------------------------- */
/* Bundle views                                                           */
/* --------------------------------------------------------------------- */

/** `Evidence_Bundle__c` list row. */
export interface BundleView {
  id: string;
  bundleNumber: string;
  matter: string;
  purpose: string | null;
  rangeStart: string | null;
  rangeEnd: string | null;
  decisionCount: number;
  state: BundleState;
  sealedAt: string | null;
  sealedBy: string | null;
  segmentRootHash: string | null;
  anchorReference: string | null;
  redactionProfile: string | null;
  exportFormat: string | null;
}

/** Bundle detail with the decisions it contains. */
export interface BundleDetailView extends BundleView {
  decisions: DecisionView[];
}

/** `EvidenceBundleService.draft` input. */
export interface BundleInput {
  matter: string;
  purpose?: string;
  rangeStart?: string;
  rangeEnd?: string;
  redactionProfile?: string;
  exportFormat?: string;
}

/** `EvidenceBundleService.BundleResult` - result of sealing. */
export interface BundleResult {
  bundle: BundleView;
  segmentRootHash: string;
  anchorReference: string;
  verified: boolean;
}

/* --------------------------------------------------------------------- */
/* Legal hold views                                                       */
/* --------------------------------------------------------------------- */

/** `Legal_Hold__c`. */
export interface LegalHoldView {
  id: string;
  matter: string;
  scopeFilterJson: string | null;
  effectiveFrom: string;
  releasedAt: string | null;
  issuedBy: string;
  active: boolean;
  /** Live count of decisions the hold currently suspends from purge. */
  scopedDecisionCount: number;
}

/** `EvidenceLegalHoldService.issue` input. */
export interface HoldInput {
  matter: string;
  scopeFilterJson?: string;
  effectiveFrom?: string;
}

/* --------------------------------------------------------------------- */
/* Control mapping + analysis views                                       */
/* --------------------------------------------------------------------- */

/** `EvidenceControlService.ControlMappingView` (from `Evidence_Control_Mapping__mdt`). */
export interface ControlMappingView {
  controlKey: string;
  framework: string;
  controlReference: string;
  controlLabel: string;
  satisfiedBy: string;
  active: boolean;
  /** Count of decisions currently satisfying this control. */
  evidenceCount: number;
}

/** A point on the autonomy trend line (analysis). */
export interface AutonomyTrendPoint {
  date: string;
  autonomyPercent: number;
}

/** Decision volume by agent (analysis). */
export interface AgentVolume {
  agentApiName: string;
  agentLabel: string;
  count: number;
  colorToken: string;
}

/** A human-override reason with its frequency (analysis). */
export interface OverrideReason {
  reason: string;
  count: number;
}

/** The four header KPIs. */
export interface LedgerKpis {
  decisionsLogged: number;
  autonomyPercent: number;
  overrideRatePercent: number;
  overrideNumerator: number;
  overrideDenominator: number;
  chainVerified: boolean;
  chainLinks: number;
  chainVerifiedAt: string;
}
