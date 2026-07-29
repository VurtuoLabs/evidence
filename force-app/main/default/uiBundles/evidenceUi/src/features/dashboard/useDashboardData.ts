/**
 * Dashboard read model.
 *
 * Everything on the dashboard is derived from the existing seam - useLedgerKpis,
 * useAutonomyTrend, useAgentVolume, useOverrideReasons, useChainStatus, useHolds
 * - rather than a new endpoint. The overview is a different arrangement of what
 * the console already knows, never a second source of truth: if a number here
 * disagreed with the page it links to, the derivation would be wrong, not the
 * data.
 */
import * as React from "react";
import {
  useLedgerKpis,
  useLedgerDecisions,
} from "@/hooks/useLedger";
import { useAutonomyTrend, useAgentVolume, useOverrideReasons } from "@/hooks/useAnalysis";
import { useChainStatus } from "@/hooks/useChain";
import { useHolds } from "@/hooks/useHolds";
import type { AgentVolume, AutonomyTrendPoint, DecisionView, LedgerKpis, LegalHoldView } from "@/domain/types";
import type { ChainStatusView } from "@/domain/types";

export type RangeKey = "7d" | "14d" | "30d";

export const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "14d", label: "14 days" },
  { value: "30d", label: "30 days" },
];

const RANGE_DAYS: Record<RangeKey, number> = { "7d": 7, "14d": 14, "30d": 30 };

export interface DashboardSeries {
  labels: string[];
  autonomyPercent: number[];
}

/** Slice the trend to the requested window and format each date as a short
 *  month/day label for the axis. */
function buildSeries(points: AutonomyTrendPoint[] | undefined, range: RangeKey): DashboardSeries {
  if (!points || points.length === 0) return { labels: [], autonomyPercent: [] };
  const days = RANGE_DAYS[range];
  const sliced = points.slice(-days);
  return {
    labels: sliced.map((p) => formatShortDate(p.date)),
    autonomyPercent: sliced.map((p) => p.autonomyPercent),
  };
}

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export interface DashboardModel {
  loading: boolean;
  error: boolean;
  kpis: LedgerKpis | undefined;
  chainStatus: ChainStatusView | undefined;
  holds: LegalHoldView[];
  recentDecisions: DecisionView[];
  series: DashboardSeries;
  byAgent: AgentVolume[];
  totalByAgent: number;
  overrideReasons: { reason: string; count: number }[];
}

export function useDashboardData(range: RangeKey): DashboardModel {
  const kpisQ = useLedgerKpis();
  const trendQ = useAutonomyTrend();
  const byAgentQ = useAgentVolume();
  const overridesQ = useOverrideReasons();
  const chainQ = useChainStatus();
  const holdsQ = useHolds();
  const recentQ = useLedgerDecisions({ viewKey: "ALL_DECISIONS", pageSize: 5 });

  const series = React.useMemo(() => buildSeries(trendQ.data, range), [trendQ.data, range]);

  const byAgent = React.useMemo(
    () => [...(byAgentQ.data ?? [])].sort((a, b) => b.count - a.count),
    [byAgentQ.data],
  );
  const totalByAgent = React.useMemo(() => byAgent.reduce((sum, a) => sum + a.count, 0), [byAgent]);

  const holds = React.useMemo(() => (holdsQ.data ?? []).filter((h) => h.active), [holdsQ.data]);

  return {
    loading: kpisQ.isLoading || trendQ.isLoading,
    error: kpisQ.isError || trendQ.isError,
    kpis: kpisQ.data,
    chainStatus: chainQ.data,
    holds,
    recentDecisions: recentQ.data?.items ?? [],
    series,
    byAgent,
    totalByAgent,
    overrideReasons: overridesQ.data ?? [],
  };
}
