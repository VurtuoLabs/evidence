/**
 * Admin configuration + permission provider (CONTRACT §7, §8).
 *
 * Configuration CMDT and the running user's granted custom permissions are
 * NOT among the seven ledger repositories (§12.1) - they are read-only,
 * deploy-time, and org-scoped - so they live here behind their own
 * `VITE_DATA_MODE` switch. `mock` returns the static seed so the Settings
 * pages render with no org; `salesforce` calls the `EvidenceConfigurationService`
 * Apex facade (§9.2).
 */
import { DATA_MODE } from "@/lib/constants";
import type {
  CapturePolicyView,
  ConsequenceRuleView,
  EvidenceSettingView,
  RedactionRuleView,
  RetentionPolicyView,
} from "@/features/settings/types";
import { apexInvoke } from "./apex";
import {
  SEED_CAPTURE_POLICIES,
  SEED_CONSEQUENCE_RULES,
  SEED_GRANTED_PERMISSIONS,
  SEED_REDACTION_RULES,
  SEED_RETENTION_POLICIES,
  SEED_SETTING,
} from "./mock/configSeed";

const FACADE = "EvidenceConfigurationService";
const isMock = DATA_MODE !== "salesforce";

export function getSetting(): Promise<EvidenceSettingView> {
  return isMock
    ? Promise.resolve(SEED_SETTING)
    : apexInvoke<EvidenceSettingView>(FACADE, "getSetting");
}

export function getCapturePolicies(): Promise<CapturePolicyView[]> {
  return isMock
    ? Promise.resolve(SEED_CAPTURE_POLICIES)
    : apexInvoke<CapturePolicyView[]>(FACADE, "getCapturePolicies");
}

export function getConsequenceRules(): Promise<ConsequenceRuleView[]> {
  return isMock
    ? Promise.resolve(SEED_CONSEQUENCE_RULES)
    : apexInvoke<ConsequenceRuleView[]>(FACADE, "getConsequenceRules");
}

export function getRetentionPolicies(): Promise<RetentionPolicyView[]> {
  return isMock
    ? Promise.resolve(SEED_RETENTION_POLICIES)
    : apexInvoke<RetentionPolicyView[]>(FACADE, "getRetentionPolicies");
}

export function getRedactionRules(): Promise<RedactionRuleView[]> {
  return isMock
    ? Promise.resolve(SEED_REDACTION_RULES)
    : apexInvoke<RedactionRuleView[]>(FACADE, "getRedactionRules");
}

/** The running user's granted custom permissions (UX hints only). */
export function getGrantedPermissions(): Promise<string[]> {
  return isMock
    ? Promise.resolve(SEED_GRANTED_PERMISSIONS)
    : apexInvoke<string[]>(FACADE, "getGrantedPermissions");
}
