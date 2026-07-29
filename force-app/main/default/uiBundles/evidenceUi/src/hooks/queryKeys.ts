import type { LedgerQuery, LedgerSearch } from "@/domain";

/**
 * Centralized TanStack Query keys. Every hook reads from here so cache
 * invalidation stays consistent (e.g. sealing a bundle invalidates
 * `bundles.all`, verifying the chain invalidates `chain.status`).
 */
export const queryKeys = {
  ledger: {
    all: ["ledger"] as const,
    list: (query: LedgerQuery) => ["ledger", "list", query] as const,
    search: (search: LedgerSearch) => ["ledger", "search", search] as const,
  },
  decision: {
    all: ["decision"] as const,
    byId: (id: string) => ["decision", "id", id] as const,
    byLedgerKey: (key: string) => ["decision", "ledgerKey", key] as const,
  },
  bundles: {
    all: ["bundles"] as const,
    list: () => ["bundles", "list"] as const,
    detail: (id: string) => ["bundles", "detail", id] as const,
  },
  holds: {
    all: ["holds"] as const,
    list: () => ["holds", "list"] as const,
    scopePreview: (filter: string) => ["holds", "scopePreview", filter] as const,
  },
  chain: {
    all: ["chain"] as const,
    status: () => ["chain", "status"] as const,
    verifications: () => ["chain", "verifications"] as const,
    anchors: () => ["chain", "anchors"] as const,
  },
  controls: {
    all: ["controls"] as const,
    mappings: () => ["controls", "mappings"] as const,
    evidence: (controlKey: string, from: string, to: string) =>
      ["controls", "evidence", controlKey, from, to] as const,
  },
  analysis: {
    all: ["analysis"] as const,
    kpis: () => ["analysis", "kpis"] as const,
    autonomyTrend: () => ["analysis", "autonomyTrend"] as const,
    byAgent: () => ["analysis", "byAgent"] as const,
    overrides: () => ["analysis", "overrides"] as const,
  },
  configuration: {
    all: ["configuration"] as const,
    setting: () => ["configuration", "setting"] as const,
    capturePolicies: () => ["configuration", "capturePolicies"] as const,
    consequenceRules: () => ["configuration", "consequenceRules"] as const,
    retentionPolicies: () => ["configuration", "retentionPolicies"] as const,
    redactionRules: () => ["configuration", "redactionRules"] as const,
  },
  permissions: {
    all: ["permissions"] as const,
    granted: () => ["permissions", "granted"] as const,
  },
} as const;
