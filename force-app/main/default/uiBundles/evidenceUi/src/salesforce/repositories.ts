/**
 * Repository interfaces - the data seam (CONTRACT §12.1).
 *
 * Components never touch the SDK. The chain is:
 *   feature → TanStack Query hook → repository interface → adapter
 * The adapter is chosen by `getRepositories()` on `VITE_DATA_MODE`
 * (`mock` default, `salesforce`). This is what lets the whole UI be built
 * and demoed before a single Apex class exists.
 *
 * Access-control rule baked into these signatures (CONTRACT §12.2):
 * `Decision_Record__c` LISTS may come from GraphQL (Private OWD + managed
 * sharing enforce access at the platform layer), but everything touching
 * `Decision_Ledger__b` - detail, search by chain, chain verification,
 * bundles, holds - goes through the Apex facades.
 */
import type {
  AgentVolume,
  AutonomyTrendPoint,
  BundleDetailView,
  BundleInput,
  BundleResult,
  BundleView,
  ChainAnchorView,
  ChainStatusView,
  ChainVerificationView,
  ControlMappingView,
  DecisionDetailView,
  DecisionView,
  HoldInput,
  LedgerKpis,
  LegalHoldView,
  LedgerQuery,
  LedgerSearch,
  OverrideReason,
  Paginated,
} from "@/domain";

/** Thrown when a search cannot be served by the Big Object index (§9.2). */
export class IndexIncompatibleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndexIncompatibleError";
  }
}

/** Thrown when the running user lacks the custom permission a call needs. */
export class PermissionDeniedError extends Error {
  constructor(public readonly permission: string) {
    super(`Missing custom permission: ${permission}`);
    this.name = "PermissionDeniedError";
  }
}

/** List views over `Decision_Record__c` (GraphQL-backed in the org). */
export interface LedgerRepository {
  listDecisions(query: LedgerQuery): Promise<Paginated<DecisionView>>;
  /** Index-order-aware; throws `IndexIncompatibleError` if unservable. */
  searchDecisions(search: LedgerSearch): Promise<DecisionView[]>;
}

/** Single-record detail (Apex facade - reads `Decision_Ledger__b`). */
export interface DecisionRepository {
  getDecision(decisionId: string): Promise<DecisionDetailView>;
  getByLedgerKey(ledgerKey: string): Promise<DecisionDetailView>;
}

/** Bundles: draft, add, seal, withdraw, export (Apex facade). */
export interface BundleRepository {
  listBundles(): Promise<BundleView[]>;
  getBundle(bundleId: string): Promise<BundleDetailView>;
  draft(input: BundleInput): Promise<BundleView>;
  addDecisions(bundleId: string, ledgerKeys: string[]): Promise<number>;
  seal(bundleId: string): Promise<BundleResult>;
  withdraw(bundleId: string, reason: string): Promise<BundleView>;
}

/** Legal holds (Apex facade). */
export interface HoldRepository {
  listHolds(): Promise<LegalHoldView[]>;
  issue(input: HoldInput): Promise<LegalHoldView>;
  release(holdId: string, reason: string): Promise<LegalHoldView>;
  /** Live count for the scope-preview step of the issue wizard. */
  previewScopeCount(scopeFilterJson: string): Promise<number>;
}

/** Chain integrity (Apex facade - the header lives on this). */
export interface ChainRepository {
  getStatus(): Promise<ChainStatusView>;
  verify(chainKey?: string, from?: number, to?: number): Promise<ChainVerificationView>;
  listVerifications(): Promise<ChainVerificationView[]>;
  listAnchors(): Promise<ChainAnchorView[]>;
}

/** Regulatory control mapping (Apex facade over `Evidence_Control_Mapping__mdt`). */
export interface ControlRepository {
  getMappings(): Promise<ControlMappingView[]>;
  evidenceFor(controlKey: string, from: string, to: string): Promise<DecisionView[]>;
}

/** Aggregate analysis views for the risk officer. */
export interface AnalysisRepository {
  getKpis(): Promise<LedgerKpis>;
  getAutonomyTrend(): Promise<AutonomyTrendPoint[]>;
  getDecisionsByAgent(): Promise<AgentVolume[]>;
  getOverrideReasons(): Promise<OverrideReason[]>;
}

/** The full set, handed out by `getRepositories()`. */
export interface Repositories {
  ledger: LedgerRepository;
  decision: DecisionRepository;
  bundle: BundleRepository;
  hold: HoldRepository;
  chain: ChainRepository;
  control: ControlRepository;
  analysis: AnalysisRepository;
}
