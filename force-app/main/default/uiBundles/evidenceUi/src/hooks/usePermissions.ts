import { useQuery } from "@tanstack/react-query";
import { getGrantedPermissions } from "@/salesforce/configProvider";
import { queryKeys } from "./queryKeys";

/**
 * The running user's granted custom permissions (CONTRACT §8.1). The UI hides
 * affordances the user lacks; this is a UX hint only - every write re-checks in
 * Apex via `FeatureManagement.checkPermission`, and the facades null FLS-
 * restricted fields before they leave the server (§8.5). Never rely on this for
 * access control.
 */
export function useGrantedPermissions() {
  return useQuery({
    queryKey: queryKeys.permissions.granted(),
    queryFn: getGrantedPermissions,
    staleTime: Infinity,
  });
}

/**
 * Whether the running user holds a single custom permission. Returns `false`
 * while the grant set is still loading, so an affordance never flashes visible
 * before its gate resolves.
 */
export function usePermission(permission: string): boolean {
  const { data } = useGrantedPermissions();
  return data?.includes(permission) ?? false;
}
