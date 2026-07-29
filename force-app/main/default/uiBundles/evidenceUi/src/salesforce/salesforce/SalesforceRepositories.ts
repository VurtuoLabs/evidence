/**
 * Salesforce adapter set (`VITE_DATA_MODE=salesforce`).
 *
 * The one rule that matters most here (CONTRACT §12.2): GraphQL is used
 * ONLY for `Decision_Record__c` list views, where Private OWD plus managed
 * sharing already enforce access at the platform layer. EVERYTHING touching
 * `Decision_Ledger__b` - decision detail, chain search, verification,
 * bundles, holds, controls - goes through the Apex facades, because Big
 * Objects have no record-level sharing and the facade is the only place
 * access control and redaction can live. There is no safe GraphQL path to
 * the ledger, so none exists here.
 *
 * The SDK is imported dynamically so a `mock`-mode dev build never needs
 * `@salesforce/platform-sdk` resolved.
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
  LedgerQuery,
  LedgerSearch,
  LegalHoldView,
  OverrideReason,
  Paginated,
} from "@/domain";
import { LEDGER_PAGE_SIZE } from "@/lib/constants";
import type {
  AnalysisRepository,
  BundleRepository,
  ChainRepository,
  ControlRepository,
  DecisionRepository,
  HoldRepository,
  LedgerRepository,
  Repositories,
} from "../repositories";
import { IndexIncompatibleError } from "../repositories";

/* --------------------------------------------------------------------- */
/* SDK access                                                             */
/* --------------------------------------------------------------------- */

interface DataSDK {
  graphql?: {
    query<T>(args: { query: string; variables?: Record<string, unknown> }): Promise<{ data?: T }>;
  };
  apex?: {
    invoke<T>(args: {
      apexClass: string;
      method: string;
      params?: Record<string, unknown>;
    }): Promise<T>;
  };
}

let sdkPromise: Promise<DataSDK> | null = null;

async function getSdk(): Promise<DataSDK> {
  if (!sdkPromise) {
    sdkPromise = import("@salesforce/platform-sdk").then((m) =>
      (m as unknown as { createDataSDK: () => Promise<DataSDK> }).createDataSDK(),
    );
  }
  return sdkPromise;
}

/**
 * Invoke an Apex facade. Every ledger-touching read and every state
 * transition routes through here - never GraphQL (CONTRACT §12.2).
 */
async function apex<T>(apexClass: string, method: string, params?: Record<string, unknown>): Promise<T> {
  const sdk = await getSdk();
  if (!sdk.apex) throw new Error("Apex invocation is unavailable in this runtime.");
  try {
    return await sdk.apex.invoke<T>({ apexClass, method, params });
  } catch (err) {
    // The facade throws a typed AuraHandledException when a query cannot be
    // served by the Big Object index; surface it as the domain error so the
    // ledger UI can tell the user rather than silently showing nothing.
    const message = err instanceof Error ? err.message : String(err);
    if (/index/i.test(message) && /incompatible|order|serve/i.test(message)) {
      throw new IndexIncompatibleError(message);
    }
    throw err;
  }
}

/* --------------------------------------------------------------------- */
/* GraphQL - Decision_Record__c list views only                          */
/* --------------------------------------------------------------------- */

const DECISIONS_QUERY = /* GraphQL */ `
  query RecentDecisions($first: Int!, $after: String) {
    uiapi {
      query {
        Decision_Record__c(first: $first, after: $after, orderBy: { Occurred_At__c: { order: DESC } }) {
          edges {
            node {
              Id
              Decision_Number__c { value }
              Ledger_Key__c { value }
              Agent_API_Name__c { value }
              Agent_Version__c { value }
              Occurred_At__c { value }
              Headline__c { value }
              Outcome__c { value }
              Autonomy_Level__c { value }
              Consequence_Level__c { value }
              Subject_Reference__c { value }
              Subject_Object__c { value }
              This_Hash__c { value }
              Prior_Hash__c { value }
              Chain_Position__c { value }
              Under_Legal_Hold__c { value }
              Redaction_State__c { value }
            }
          }
          totalCount
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  }
`;

interface GqlField<T> {
  value: T | null;
}
interface DecisionNode {
  Id: string;
  Decision_Number__c: GqlField<string>;
  Ledger_Key__c: GqlField<string>;
  Agent_API_Name__c: GqlField<string>;
  Agent_Version__c: GqlField<string>;
  Occurred_At__c: GqlField<string>;
  Headline__c: GqlField<string>;
  Outcome__c: GqlField<string>;
  Autonomy_Level__c: GqlField<string>;
  Consequence_Level__c: GqlField<string>;
  Subject_Reference__c: GqlField<string>;
  Subject_Object__c: GqlField<string>;
  This_Hash__c: GqlField<string>;
  Prior_Hash__c: GqlField<string>;
  Chain_Position__c: GqlField<number>;
  Under_Legal_Hold__c: GqlField<boolean>;
  Redaction_State__c: GqlField<string>;
}
interface DecisionsResponse {
  uiapi: {
    query: {
      Decision_Record__c: {
        edges: { node: DecisionNode }[];
        totalCount: number;
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    };
  };
}

function nodeToView(n: DecisionNode): DecisionView {
  return {
    id: n.Id,
    decisionNumber: n.Decision_Number__c.value ?? "",
    ledgerKey: n.Ledger_Key__c.value ?? "",
    agentApiName: n.Agent_API_Name__c.value ?? "",
    agentVersion: n.Agent_Version__c.value ?? "",
    occurredAt: n.Occurred_At__c.value ?? "",
    headline: n.Headline__c.value ?? "",
    outcome: (n.Outcome__c.value ?? "Completed") as DecisionView["outcome"],
    autonomyLevel: (n.Autonomy_Level__c.value ?? "Autonomous") as DecisionView["autonomyLevel"],
    consequenceLevel: (n.Consequence_Level__c.value ?? "Low") as DecisionView["consequenceLevel"],
    subjectReference: n.Subject_Reference__c.value,
    subjectObject: n.Subject_Object__c.value,
    thisHash: n.This_Hash__c.value ?? "",
    priorHash: n.Prior_Hash__c.value,
    chainPosition: n.Chain_Position__c.value ?? 0,
    chainKey: "",
    underLegalHold: n.Under_Legal_Hold__c.value ?? false,
    redactionState: (n.Redaction_State__c.value ?? "None") as DecisionView["redactionState"],
  };
}

/* ------------------------------ ledger ------------------------------- */

class SalesforceLedgerRepository implements LedgerRepository {
  async listDecisions(query: LedgerQuery): Promise<Paginated<DecisionView>> {
    const sdk = await getSdk();
    if (!sdk.graphql) throw new Error("GraphQL is unavailable in this runtime.");
    const r = await sdk.graphql.query<DecisionsResponse>({
      query: DECISIONS_QUERY,
      variables: { first: query.pageSize ?? LEDGER_PAGE_SIZE, after: query.cursor ?? null },
    });
    const conn = r.data?.uiapi.query.Decision_Record__c;
    const edges = conn?.edges ?? [];
    return {
      items: edges.map((e) => nodeToView(e.node)),
      nextCursor: conn?.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null,
      totalCount: conn?.totalCount ?? edges.length,
    };
  }

  searchDecisions(search: LedgerSearch): Promise<DecisionView[]> {
    // Chain search hits the Big Object index - facade only, never GraphQL.
    return apex<DecisionView[]>("EvidenceLedgerService", "search", { search });
  }
}

/* ----------------------------- decision ------------------------------ */

class SalesforceDecisionRepository implements DecisionRepository {
  getDecision(decisionId: string): Promise<DecisionDetailView> {
    return apex<DecisionDetailView>("EvidenceLedgerService", "getDecision", { decisionId });
  }
  getByLedgerKey(ledgerKey: string): Promise<DecisionDetailView> {
    return apex<DecisionDetailView>("EvidenceLedgerService", "getByLedgerKey", { ledgerKey });
  }
}

/* ------------------------------ bundle ------------------------------- */

class SalesforceBundleRepository implements BundleRepository {
  listBundles() {
    return apex<BundleView[]>("EvidenceBundleService", "list");
  }
  getBundle(bundleId: string) {
    return apex<BundleDetailView>("EvidenceBundleService", "get", { bundleId });
  }
  draft(input: BundleInput) {
    return apex<BundleView>("EvidenceBundleService", "draft", { input });
  }
  addDecisions(bundleId: string, ledgerKeys: string[]) {
    return apex<number>("EvidenceBundleService", "addDecisions", { bundleId, ledgerKeys });
  }
  seal(bundleId: string) {
    return apex<BundleResult>("EvidenceBundleService", "seal", { bundleId });
  }
  withdraw(bundleId: string, reason: string) {
    return apex<BundleView>("EvidenceBundleService", "withdraw", { bundleId, reason });
  }
}

/* ------------------------------- hold -------------------------------- */

class SalesforceHoldRepository implements HoldRepository {
  listHolds() {
    return apex<LegalHoldView[]>("EvidenceLegalHoldService", "list");
  }
  issue(input: HoldInput) {
    return apex<LegalHoldView>("EvidenceLegalHoldService", "issue", { input });
  }
  release(holdId: string, reason: string) {
    return apex<LegalHoldView>("EvidenceLegalHoldService", "release", { holdId, reason });
  }
  previewScopeCount(scopeFilterJson: string) {
    return apex<number>("EvidenceLegalHoldService", "previewScopeCount", { scopeFilterJson });
  }
}

/* ------------------------------- chain ------------------------------- */

class SalesforceChainRepository implements ChainRepository {
  getStatus() {
    return apex<ChainStatusView>("EvidenceChainService", "getStatus");
  }
  verify(chainKey?: string, from?: number, to?: number) {
    return apex<ChainVerificationView>("EvidenceChainService", "verify", { chainKey, from, to });
  }
  listVerifications() {
    return apex<ChainVerificationView[]>("EvidenceChainService", "listVerifications");
  }
  listAnchors() {
    return apex<ChainAnchorView[]>("EvidenceChainService", "listAnchors");
  }
}

/* ------------------------------ control ------------------------------ */

class SalesforceControlRepository implements ControlRepository {
  getMappings() {
    return apex<ControlMappingView[]>("EvidenceControlService", "getMappings");
  }
  evidenceFor(controlKey: string, from: string, to: string) {
    return apex<DecisionView[]>("EvidenceControlService", "evidenceFor", { controlKey, from, to });
  }
}

/* ----------------------------- analysis ------------------------------ */

class SalesforceAnalysisRepository implements AnalysisRepository {
  getKpis() {
    return apex<LedgerKpis>("EvidenceAnalysisService", "getKpis");
  }
  getAutonomyTrend() {
    return apex<AutonomyTrendPoint[]>("EvidenceAnalysisService", "getAutonomyTrend");
  }
  getDecisionsByAgent() {
    return apex<AgentVolume[]>("EvidenceAnalysisService", "getDecisionsByAgent");
  }
  getOverrideReasons() {
    return apex<OverrideReason[]>("EvidenceAnalysisService", "getOverrideReasons");
  }
}

/** Build the full Salesforce repository set. */
export function createSalesforceRepositories(): Repositories {
  return {
    ledger: new SalesforceLedgerRepository(),
    decision: new SalesforceDecisionRepository(),
    bundle: new SalesforceBundleRepository(),
    hold: new SalesforceHoldRepository(),
    chain: new SalesforceChainRepository(),
    control: new SalesforceControlRepository(),
    analysis: new SalesforceAnalysisRepository(),
  };
}
