/**
 * In-memory adapter set. The default (`VITE_DATA_MODE=mock`) so the whole
 * console runs, and every feature is demoable, with no org (CONTRACT §15).
 *
 * State is module-local and mutable: drafting a bundle or issuing a hold
 * updates these arrays so optimistic flows behave during a demo. A small
 * artificial latency makes loading and skeleton states visible.
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
import { sleep } from "@/lib/utils";
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
import {
  SEED_ANCHORS,
  SEED_AUTONOMY_TREND,
  SEED_BUNDLES,
  SEED_BY_AGENT,
  SEED_CHAIN_STATUS,
  SEED_CONTROL_MAPPINGS,
  SEED_DECISIONS,
  SEED_HOLDS,
  SEED_KPIS,
  SEED_OVERRIDE_REASONS,
  SEED_VERIFICATIONS,
} from "./seed";

const LATENCY = 180;

/** Strip the detail collections down to a list-row view. */
function toListView(d: DecisionDetailView): DecisionView {
  const {
    actionsTaken: _a,
    sourcesRead: _s,
    considerations: _c,
    policyChecks: _p,
    rationale: _r,
    accountability: _acc,
    retentionExpiresAt: _rx,
    canonicalBody: _cb,
    ...row
  } = d;
  return row;
}

/* --------------------------- mutable state --------------------------- */

const decisions: DecisionDetailView[] = [...SEED_DECISIONS];
const bundles: BundleView[] = [...SEED_BUNDLES];
const holds: LegalHoldView[] = [...SEED_HOLDS];
const verifications: ChainVerificationView[] = [...SEED_VERIFICATIONS];
let bundleSeq = 92;

function matchesView(d: DecisionView, viewKey?: string): boolean {
  switch (viewKey) {
    case undefined:
    case "ALL_DECISIONS":
      return true;
    case "HIGH_CONSEQUENCE":
      return d.consequenceLevel === "High";
    case "ACTED_ALONE":
      return d.autonomyLevel === "Autonomous";
    case "OVERRIDDEN":
      return d.overridden === true;
    case "UNDER_LEGAL_HOLD":
      return d.underLegalHold;
    default:
      return true;
  }
}

/* ------------------------------ ledger ------------------------------- */

class MockLedgerRepository implements LedgerRepository {
  async listDecisions(query: LedgerQuery): Promise<Paginated<DecisionView>> {
    await sleep(LATENCY);
    const rows = decisions.map(toListView).filter((d) => {
      if (!matchesView(d, query.viewKey)) return false;
      if (query.agentApiName && d.agentApiName !== query.agentApiName) return false;
      if (query.consequenceLevel && d.consequenceLevel !== query.consequenceLevel) return false;
      if (query.autonomyLevel && d.autonomyLevel !== query.autonomyLevel) return false;
      if (query.outcome && d.outcome !== query.outcome) return false;
      if (query.underLegalHold !== undefined && d.underLegalHold !== query.underLegalHold) return false;
      if (query.from && d.occurredAt < query.from) return false;
      if (query.to && d.occurredAt > query.to) return false;
      return true;
    });

    const pageSize = query.pageSize ?? LEDGER_PAGE_SIZE;
    const start = query.cursor ? Number(query.cursor) : 0;
    const items = rows.slice(start, start + pageSize);
    const nextCursor = start + pageSize < rows.length ? String(start + pageSize) : null;
    // Mirror the mockup's "Showing 3 of 44,220": real corpus is far larger
    // than the seed, so report a plausible corpus-scale total.
    const totalCount = query.viewKey && query.viewKey !== "ALL_DECISIONS" ? rows.length : 44220;
    return { items, nextCursor, totalCount };
  }

  async searchDecisions(search: LedgerSearch): Promise<DecisionView[]> {
    await sleep(LATENCY);
    // Enforce the Big Object index rule: a position range requires a chain
    // key (equality on all filters but the last), or the query is unservable.
    if ((search.fromPosition !== undefined || search.toPosition !== undefined) && !search.chainKey) {
      throw new IndexIncompatibleError(
        "A position range requires a chainKey. The Decision_Ledger__b index is Chain_Key → Chain_Position → Ledger_Key and must be filtered in order.",
      );
    }
    return decisions
      .map(toListView)
      .filter((d) => {
        if (search.chainKey && d.chainKey !== search.chainKey) return false;
        if (search.ledgerKey && d.ledgerKey !== search.ledgerKey) return false;
        if (search.fromPosition !== undefined && d.chainPosition < search.fromPosition) return false;
        if (search.toPosition !== undefined && d.chainPosition > search.toPosition) return false;
        if (search.text) {
          const t = search.text.toLowerCase();
          const hay = `${d.headline} ${d.agentApiName} ${d.decisionNumber} ${d.subjectReference ?? ""}`.toLowerCase();
          if (!hay.includes(t)) return false;
        }
        return true;
      })
      .sort((a, b) => a.chainPosition - b.chainPosition);
  }
}

/* ----------------------------- decision ------------------------------ */

class MockDecisionRepository implements DecisionRepository {
  async getDecision(decisionId: string): Promise<DecisionDetailView> {
    await sleep(LATENCY);
    const found = decisions.find((d) => d.id === decisionId || d.decisionNumber === decisionId);
    if (!found) throw new Error(`Decision not found: ${decisionId}`);
    return structuredClone(found);
  }

  async getByLedgerKey(ledgerKey: string): Promise<DecisionDetailView> {
    await sleep(LATENCY);
    const found = decisions.find((d) => d.ledgerKey === ledgerKey);
    if (!found) throw new Error(`Ledger key not found: ${ledgerKey}`);
    return structuredClone(found);
  }
}

/* ------------------------------ bundle ------------------------------- */

class MockBundleRepository implements BundleRepository {
  async listBundles(): Promise<BundleView[]> {
    await sleep(LATENCY);
    return bundles.map((b) => ({ ...b }));
  }

  async getBundle(bundleId: string): Promise<BundleDetailView> {
    await sleep(LATENCY);
    const b = bundles.find((x) => x.id === bundleId || x.bundleNumber === bundleId);
    if (!b) throw new Error(`Bundle not found: ${bundleId}`);
    // Demo association: attach a couple of seeded decisions.
    return { ...b, decisions: decisions.slice(0, 2).map(toListView) };
  }

  async draft(input: BundleInput): Promise<BundleView> {
    await sleep(LATENCY);
    const num = `EB-${String(bundleSeq++).padStart(4, "0")}`;
    const bundle: BundleView = {
      id: `draft-${num}`,
      bundleNumber: num,
      matter: input.matter,
      purpose: input.purpose ?? null,
      rangeStart: input.rangeStart ?? null,
      rangeEnd: input.rangeEnd ?? null,
      decisionCount: 0,
      state: "Draft",
      sealedAt: null,
      sealedBy: null,
      segmentRootHash: null,
      anchorReference: null,
      redactionProfile: input.redactionProfile ?? "Internal",
      exportFormat: input.exportFormat ?? "PDF",
    };
    bundles.unshift(bundle);
    return { ...bundle };
  }

  async addDecisions(bundleId: string, ledgerKeys: string[]): Promise<number> {
    await sleep(LATENCY);
    const b = bundles.find((x) => x.id === bundleId || x.bundleNumber === bundleId);
    if (!b) throw new Error(`Bundle not found: ${bundleId}`);
    b.decisionCount += ledgerKeys.length;
    return b.decisionCount;
  }

  async seal(bundleId: string): Promise<BundleResult> {
    await sleep(LATENCY);
    const b = bundles.find((x) => x.id === bundleId || x.bundleNumber === bundleId);
    if (!b) throw new Error(`Bundle not found: ${bundleId}`);
    b.state = "Sealed";
    b.sealedAt = new Date().toISOString();
    b.sealedBy = "Custodian";
    b.segmentRootHash = `${b.bundleNumber}-root-hash`;
    b.anchorReference = `org:*@${new Date().toISOString().slice(0, 10)}`;
    return {
      bundle: { ...b },
      segmentRootHash: b.segmentRootHash,
      anchorReference: b.anchorReference,
      verified: true,
    };
  }

  async withdraw(bundleId: string, _reason: string): Promise<BundleView> {
    await sleep(LATENCY);
    const b = bundles.find((x) => x.id === bundleId || x.bundleNumber === bundleId);
    if (!b) throw new Error(`Bundle not found: ${bundleId}`);
    b.state = "Withdrawn";
    return { ...b };
  }
}

/* ------------------------------- hold -------------------------------- */

class MockHoldRepository implements HoldRepository {
  async listHolds(): Promise<LegalHoldView[]> {
    await sleep(LATENCY);
    return holds.map((h) => ({ ...h }));
  }

  async issue(input: HoldInput): Promise<LegalHoldView> {
    await sleep(LATENCY);
    const hold: LegalHoldView = {
      id: `hold-${Date.now()}`,
      matter: input.matter,
      scopeFilterJson: input.scopeFilterJson ?? null,
      effectiveFrom: input.effectiveFrom ?? new Date().toISOString(),
      releasedAt: null,
      issuedBy: "Custodian",
      active: true,
      scopedDecisionCount: await this.previewScopeCount(input.scopeFilterJson ?? "{}"),
    };
    holds.unshift(hold);
    return { ...hold };
  }

  async release(holdId: string, _reason: string): Promise<LegalHoldView> {
    await sleep(LATENCY);
    const h = holds.find((x) => x.id === holdId);
    if (!h) throw new Error(`Hold not found: ${holdId}`);
    h.active = false;
    h.releasedAt = new Date().toISOString();
    h.scopedDecisionCount = 0;
    return { ...h };
  }

  async previewScopeCount(scopeFilterJson: string): Promise<number> {
    await sleep(LATENCY / 2);
    try {
      const filter = JSON.parse(scopeFilterJson) as { agentApiName?: string };
      if (filter.agentApiName) {
        return decisions.filter((d) => d.agentApiName === filter.agentApiName).length * 137;
      }
    } catch {
      /* fall through to corpus estimate */
    }
    return 412;
  }
}

/* ------------------------------- chain ------------------------------- */

class MockChainRepository implements ChainRepository {
  async getStatus(): Promise<ChainStatusView> {
    await sleep(LATENCY);
    return { ...SEED_CHAIN_STATUS, lastVerifiedAt: verifications[0]?.verifiedAt ?? SEED_CHAIN_STATUS.lastVerifiedAt };
  }

  async verify(chainKey?: string, from?: number, to?: number): Promise<ChainVerificationView> {
    await sleep(LATENCY * 2);
    const record: ChainVerificationView = {
      id: `ver-${Date.now()}`,
      chainKey: chainKey ?? "org:*",
      verifiedAt: new Date().toISOString(),
      linksChecked: SEED_CHAIN_STATUS.totalLinks,
      firstPosition: from ?? 0,
      lastPosition: to ?? SEED_CHAIN_STATUS.totalLinks - 1,
      result: "Intact",
      breakAtPosition: null,
      durationMs: 7300,
    };
    verifications.unshift(record);
    return { ...record };
  }

  async listVerifications(): Promise<ChainVerificationView[]> {
    await sleep(LATENCY);
    return verifications.map((v) => ({ ...v }));
  }

  async listAnchors(): Promise<ChainAnchorView[]> {
    await sleep(LATENCY);
    return SEED_ANCHORS.map((a) => ({ ...a }));
  }
}

/* ------------------------------ control ------------------------------ */

class MockControlRepository implements ControlRepository {
  async getMappings(): Promise<ControlMappingView[]> {
    await sleep(LATENCY);
    return SEED_CONTROL_MAPPINGS.map((m) => ({ ...m }));
  }

  async evidenceFor(controlKey: string, _from: string, _to: string): Promise<DecisionView[]> {
    await sleep(LATENCY);
    // Demo mapping: high-consequence controls surface high-consequence rows.
    const high = /ART22|ART14|SR_11_7/.test(controlKey);
    return decisions
      .map(toListView)
      .filter((d) => (high ? d.consequenceLevel !== "Low" : true));
  }
}

/* ----------------------------- analysis ------------------------------ */

class MockAnalysisRepository implements AnalysisRepository {
  async getKpis(): Promise<LedgerKpis> {
    await sleep(LATENCY);
    return { ...SEED_KPIS };
  }

  async getAutonomyTrend(): Promise<AutonomyTrendPoint[]> {
    await sleep(LATENCY);
    return SEED_AUTONOMY_TREND.map((p) => ({ ...p }));
  }

  async getDecisionsByAgent(): Promise<AgentVolume[]> {
    await sleep(LATENCY);
    return SEED_BY_AGENT.map((a) => ({ ...a }));
  }

  async getOverrideReasons(): Promise<OverrideReason[]> {
    await sleep(LATENCY);
    return SEED_OVERRIDE_REASONS.map((o) => ({ ...o }));
  }
}

/** Build the full mock repository set. */
export function createMockRepositories(): Repositories {
  return {
    ledger: new MockLedgerRepository(),
    decision: new MockDecisionRepository(),
    bundle: new MockBundleRepository(),
    hold: new MockHoldRepository(),
    chain: new MockChainRepository(),
    control: new MockControlRepository(),
    analysis: new MockAnalysisRepository(),
  };
}
