import { useQuery } from "@tanstack/react-query";
import { getRepositories } from "@/salesforce/factory";
import { queryKeys } from "./queryKeys";

/**
 * Analysis hooks - the three risk-officer questions (CONTRACT §12.3, §15
 * phase 5). Each maps to one `AnalysisRepository` method; the ledger KPIs live
 * in `useLedgerKpis` alongside the list.
 */

/** Autonomy rate over the last 30 days - the signature trend line. */
export function useAutonomyTrend() {
  return useQuery({
    queryKey: queryKeys.analysis.autonomyTrend(),
    queryFn: () => getRepositories().analysis.getAutonomyTrend(),
  });
}

/** Decision volume by agent. */
export function useAgentVolume() {
  return useQuery({
    queryKey: queryKeys.analysis.byAgent(),
    queryFn: () => getRepositories().analysis.getDecisionsByAgent(),
  });
}

/** Why humans overrode - the top reason is where to fix the agent. */
export function useOverrideReasons() {
  return useQuery({
    queryKey: queryKeys.analysis.overrides(),
    queryFn: () => getRepositories().analysis.getOverrideReasons(),
  });
}
