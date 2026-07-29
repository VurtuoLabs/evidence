/**
 * Read-only projections of the admin Custom Metadata Types (CONTRACT §7),
 * returned by the configuration hooks. These are UI-facing views of
 * `Evidence_Setting__mdt`, `Evidence_Capture_Policy__mdt`,
 * `Evidence_Consequence_Rule__mdt`, `Evidence_Retention_Policy__mdt`, and
 * `Evidence_Redaction_Rule__mdt`. The console never edits configuration - 
 * CMDT is deploy-time, and the settings pages are read-only windows onto it.
 */

import type { ConsequenceLevel } from "@/domain/types";

/** `Evidence_Setting__mdt` (single `Default` record). */
export interface EvidenceSettingView {
  captureEnabled: boolean;
  requireRationaleBeforeAction: boolean;
  chainVerificationCron: string;
  anchorCron: string;
  verificationBatchSize: number;
  canonicalVersion: number;
  defaultRetentionDays: number;
  completenessCheckEnabled: boolean;
  completenessTolerancePercent: number;
}

/** `Evidence_Capture_Policy__mdt`. */
export interface CapturePolicyView {
  policyKey: string;
  /** Blank means all agents. */
  agentApiName: string | null;
  consequenceLevel: ConsequenceLevel | null;
  captureUtterance: boolean;
  captureResponse: boolean;
  captureGrounding: boolean;
  captureConsiderations: boolean;
  captureVariables: boolean;
  requireRationale: boolean;
  active: boolean;
}

export type MatchStrategy = "Action_Name" | "Object_Written" | "Amount_Threshold" | "Policy_Blocked";

/** `Evidence_Consequence_Rule__mdt`. */
export interface ConsequenceRuleView {
  ruleKey: string;
  matchStrategy: MatchStrategy;
  matchValue: string;
  consequenceLevel: ConsequenceLevel;
  priority: number;
  active: boolean;
}

export type PurgeStrategy = "Delete" | "Redact_Body_Keep_Hash";

/** `Evidence_Retention_Policy__mdt`. */
export interface RetentionPolicyView {
  policyKey: string;
  consequenceLevel: ConsequenceLevel;
  retentionDays: number;
  purgeStrategy: PurgeStrategy;
  active: boolean;
}

export type RedactionStrategy = "Mask" | "Hash" | "Remove" | "Tokenize";

/** `Evidence_Redaction_Rule__mdt`. */
export interface RedactionRuleView {
  ruleKey: string;
  profile: string;
  fieldPath: string;
  strategy: RedactionStrategy;
  appliesToExport: boolean;
  appliesToConsole: boolean;
  active: boolean;
}
