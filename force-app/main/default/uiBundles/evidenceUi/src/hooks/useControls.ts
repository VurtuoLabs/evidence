import { useQuery } from "@tanstack/react-query";
import type { DecisionView } from "@/domain";
import { getRepositories } from "@/salesforce/factory";
import { queryKeys } from "./queryKeys";

/**
 * Control mapping (CONTRACT §7 `Evidence_Control_Mapping__mdt`, §12.3). The
 * mapping is data, not code: each row shows how many ledger decisions satisfy
 * a regulatory control.
 */
export function useControls() {
  return useQuery({
    queryKey: queryKeys.controls.mappings(),
    queryFn: () => getRepositories().control.getMappings(),
  });
}

/** The decisions that currently satisfy one control, over a date range. */
export function useControlEvidence(
  controlKey: string | undefined,
  from: string,
  to: string,
  enabled = true,
) {
  return useQuery<DecisionView[]>({
    queryKey: queryKeys.controls.evidence(controlKey ?? "", from, to),
    queryFn: () => getRepositories().control.evidenceFor(controlKey as string, from, to),
    enabled: Boolean(controlKey) && enabled,
  });
}
