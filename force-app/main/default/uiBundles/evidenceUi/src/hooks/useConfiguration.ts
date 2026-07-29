import { useQuery } from "@tanstack/react-query";
import {
  getCapturePolicies,
  getConsequenceRules,
  getRedactionRules,
  getRetentionPolicies,
  getSetting,
} from "@/salesforce/configProvider";
import { queryKeys } from "./queryKeys";

/**
 * Read-only configuration hooks over the admin CMDT (CONTRACT §7). The console
 * never edits configuration - it is deploy-time Custom Metadata - so these are
 * cached indefinitely (they never change within a session).
 */

const STATIC = { staleTime: Infinity } as const;

export function useEvidenceSettings() {
  return useQuery({ queryKey: queryKeys.configuration.setting(), queryFn: getSetting, ...STATIC });
}

export function useCapturePolicies() {
  return useQuery({
    queryKey: queryKeys.configuration.capturePolicies(),
    queryFn: getCapturePolicies,
    ...STATIC,
  });
}

export function useConsequenceRules() {
  return useQuery({
    queryKey: queryKeys.configuration.consequenceRules(),
    queryFn: getConsequenceRules,
    ...STATIC,
  });
}

export function useRetentionPolicies() {
  return useQuery({
    queryKey: queryKeys.configuration.retentionPolicies(),
    queryFn: getRetentionPolicies,
    ...STATIC,
  });
}

export function useRedactionRules() {
  return useQuery({
    queryKey: queryKeys.configuration.redactionRules(),
    queryFn: getRedactionRules,
    ...STATIC,
  });
}
