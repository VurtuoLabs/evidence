/**
 * Mock seed for the admin Custom Metadata projections (CONTRACT §7) and the
 * running user's granted custom permissions (§8). Mirrors the seeded
 * customMetadata records in force-app so the read-only Settings pages render
 * with no org. The console never edits configuration - CMDT is deploy-time - 
 * so these are static.
 */
import type {
  CapturePolicyView,
  ConsequenceRuleView,
  EvidenceSettingView,
  RedactionRuleView,
  RetentionPolicyView,
} from "@/features/settings/types";
import { PERMISSIONS } from "@/lib/constants";

/** `Evidence_Setting__mdt` Default record. */
export const SEED_SETTING: EvidenceSettingView = {
  captureEnabled: true,
  requireRationaleBeforeAction: true,
  chainVerificationCron: "0 0 */4 * * ?",
  anchorCron: "0 5 0 * * ?",
  verificationBatchSize: 2000,
  canonicalVersion: 1,
  defaultRetentionDays: 2555,
  completenessCheckEnabled: true,
  completenessTolerancePercent: 1,
};

/** `Evidence_Capture_Policy__mdt`. */
export const SEED_CAPTURE_POLICIES: CapturePolicyView[] = [
  {
    policyKey: "CLAIMS_FULL",
    agentApiName: "Claims_Triage",
    consequenceLevel: null,
    captureUtterance: true,
    captureResponse: true,
    captureGrounding: true,
    captureConsiderations: true,
    captureVariables: true,
    requireRationale: true,
    active: true,
  },
  {
    policyKey: "BILLING_DECISIONS_ONLY",
    agentApiName: "Billing_Inquiry",
    consequenceLevel: "Medium",
    captureUtterance: false,
    captureResponse: false,
    captureGrounding: true,
    captureConsiderations: true,
    captureVariables: false,
    requireRationale: true,
    active: true,
  },
  {
    policyKey: "DEFAULT_ALL_AGENTS",
    agentApiName: null,
    consequenceLevel: null,
    captureUtterance: false,
    captureResponse: true,
    captureGrounding: true,
    captureConsiderations: true,
    captureVariables: false,
    requireRationale: false,
    active: true,
  },
];

/** `Evidence_Consequence_Rule__mdt`, evaluated in priority order. */
export const SEED_CONSEQUENCE_RULES: ConsequenceRuleView[] = [
  {
    ruleKey: "CLAIM_STATUS_WRITE",
    matchStrategy: "Object_Written",
    matchValue: "Claim.Status",
    consequenceLevel: "High",
    priority: 10,
    active: true,
  },
  {
    ruleKey: "ISSUE_ACTIONS",
    matchStrategy: "Action_Name",
    matchValue: "Issue_*",
    consequenceLevel: "High",
    priority: 20,
    active: true,
  },
  {
    ruleKey: "POLICY_BLOCKED",
    matchStrategy: "Policy_Blocked",
    matchValue: "*",
    consequenceLevel: "High",
    priority: 30,
    active: true,
  },
  {
    ruleKey: "AMOUNT_OVER_THRESHOLD",
    matchStrategy: "Amount_Threshold",
    matchValue: "1000",
    consequenceLevel: "Medium",
    priority: 40,
    active: true,
  },
  {
    ruleKey: "BILLING_ADJUSTMENT",
    matchStrategy: "Action_Name",
    matchValue: "Calculate_Goodwill_Credit",
    consequenceLevel: "Medium",
    priority: 50,
    active: true,
  },
];

/** `Evidence_Retention_Policy__mdt`. */
export const SEED_RETENTION_POLICIES: RetentionPolicyView[] = [
  {
    policyKey: "HIGH_CONSEQUENCE_KEEP_HASH",
    consequenceLevel: "High",
    retentionDays: 3650,
    purgeStrategy: "Redact_Body_Keep_Hash",
    active: true,
  },
  {
    policyKey: "LOW_CONSEQUENCE_DELETE",
    consequenceLevel: "Low",
    retentionDays: 365,
    purgeStrategy: "Delete",
    active: true,
  },
];

/** `Evidence_Redaction_Rule__mdt`. */
export const SEED_REDACTION_RULES: RedactionRuleView[] = [
  {
    ruleKey: "OUTSIDE_COUNSEL_SUBJECT",
    profile: "Outside_Counsel",
    fieldPath: "Subject_Reference__c",
    strategy: "Tokenize",
    appliesToExport: true,
    appliesToConsole: false,
    active: true,
  },
  {
    ruleKey: "CONSOLE_BODY_MASK",
    profile: "Internal",
    fieldPath: "Canonical_Body__c",
    strategy: "Mask",
    appliesToExport: false,
    appliesToConsole: true,
    active: true,
  },
];

/**
 * The demo user holds every custom permission so all affordances are visible
 * with no org. In `salesforce` mode the real grants come from the platform.
 */
export const SEED_GRANTED_PERMISSIONS: string[] = Object.values(PERMISSIONS);
