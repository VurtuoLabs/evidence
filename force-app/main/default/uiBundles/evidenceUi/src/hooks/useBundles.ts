import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BundleInput } from "@/domain";
import { getRepositories } from "@/salesforce/factory";
import { queryKeys } from "./queryKeys";

/** All evidence bundles. */
export function useBundles() {
  return useQuery({
    queryKey: queryKeys.bundles.list(),
    queryFn: () => getRepositories().bundle.listBundles(),
  });
}

/** One bundle with its decisions. */
export function useBundle(bundleId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.bundles.detail(bundleId ?? ""),
    queryFn: () => getRepositories().bundle.getBundle(bundleId as string),
    enabled: Boolean(bundleId),
  });
}

/** Draft a new bundle (requires `Evidence_Assemble_Bundle`). */
export function useDraftBundle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BundleInput) => getRepositories().bundle.draft(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.bundles.all }),
  });
}

/** Seal a bundle and generate its chain proof (requires `Evidence_Seal_Bundle`). */
export function useSealBundle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bundleId: string) => getRepositories().bundle.seal(bundleId),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: queryKeys.bundles.all });
      qc.invalidateQueries({ queryKey: queryKeys.bundles.detail(result.bundle.id) });
    },
  });
}

/** Withdraw a bundle, revoking its matter-team sharing. */
export function useWithdrawBundle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bundleId, reason }: { bundleId: string; reason: string }) =>
      getRepositories().bundle.withdraw(bundleId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.bundles.all }),
  });
}
