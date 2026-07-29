import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRepositories } from "@/salesforce/factory";
import { queryKeys } from "./queryKeys";

/**
 * Persistent chain-integrity status for the topbar (CONTRACT §12.5).
 * Polls on an interval so a break surfaces without a manual refresh.
 */
export function useChainStatus() {
  return useQuery({
    queryKey: queryKeys.chain.status(),
    queryFn: () => getRepositories().chain.getStatus(),
    refetchInterval: 60_000,
  });
}

export function useChainVerifications() {
  return useQuery({
    queryKey: queryKeys.chain.verifications(),
    queryFn: () => getRepositories().chain.listVerifications(),
  });
}

export function useChainAnchors() {
  return useQuery({
    queryKey: queryKeys.chain.anchors(),
    queryFn: () => getRepositories().chain.listAnchors(),
  });
}

/**
 * On-demand verification (requires `Evidence_Verify_Chain`). Invalidates the
 * status and verification history so the header updates immediately.
 */
export function useVerifyChain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args?: { chainKey?: string; from?: number; to?: number }) =>
      getRepositories().chain.verify(args?.chainKey, args?.from, args?.to),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.chain.status() });
      qc.invalidateQueries({ queryKey: queryKeys.chain.verifications() });
    },
  });
}
