import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { HoldInput } from "@/domain";
import { getRepositories } from "@/salesforce/factory";
import { queryKeys } from "./queryKeys";

/**
 * Legal holds (CONTRACT §4, §12.3). A hold suspends retention purge for
 * exactly its scoped decisions; the live scoped count is what the custodian
 * watches. Issue/release are gated on `Evidence_Manage_Legal_Hold` - the UI
 * hides the affordance, Apex re-checks on every write.
 */
export function useHolds() {
  return useQuery({
    queryKey: queryKeys.holds.list(),
    queryFn: () => getRepositories().hold.listHolds(),
  });
}

/** Live scope-preview count for the issue wizard. */
export function useScopePreview(scopeFilterJson: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.holds.scopePreview(scopeFilterJson),
    queryFn: () => getRepositories().hold.previewScopeCount(scopeFilterJson),
    enabled,
  });
}

export function useIssueHold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: HoldInput) => getRepositories().hold.issue(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.holds.all }),
  });
}

export function useReleaseHold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ holdId, reason }: { holdId: string; reason: string }) =>
      getRepositories().hold.release(holdId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.holds.all }),
  });
}
