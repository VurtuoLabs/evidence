/**
 * Rich mock seed for the Evidence console. Mirrors the data shape and the
 * three hero decisions in docs/console-mockup.jsx, expanded into valid
 * per-agent hash chains so the ledger, chain header, analysis, bundles,
 * holds, and controls all render with no org (CONTRACT §15, phase 2).
 *
 * Chains are per-agent (CONTRACT §5.1): each agent's decisions form one
 * chain, ordered by `chainPosition`, with `priorHash` linking each row to
 * the one before it. Hashes here are produced by a non-cryptographic FNV
 * variant purely so the demo chain is internally consistent; the real
 * hashes come from `EvidenceCanonicalizer` + SHA-256 in Apex.
 */
import type {
  AgentVolume,
  AutonomyTrendPoint,
  BundleView,
  ChainAnchorView,
  ChainStatusView,
  ChainVerificationView,
  ControlMappingView,
  DecisionDetailView,
  LedgerKpis,
  LegalHoldView,
  OverrideReason,
} from "@/domain";
import { PALETTE } from "@/domain";

/** Deterministic 64-char hex. NOT cryptographic - demo consistency only. */
function fauxHash(seed: string): string {
  let h = 0x811c9dc5;
  const out: string[] = [];
  for (let i = 0; i < 64; i++) {
    const c = seed.charCodeAt((i + 7) % seed.length) || i + 1;
    h ^= c;
    h = Math.imul(h, 0x01000193) >>> 0;
    out.push((h & 0xf).toString(16));
  }
  return out.join("");
}

const ORG = "00Dxx0000001evd";
const chainKeyFor = (agentApiName: string) => `${ORG}:${agentApiName}`;

/** A hero decision before hashing/positioning is applied. */
type DecisionSpec = Omit<
  DecisionDetailView,
  "thisHash" | "priorHash" | "chainPosition" | "chainKey"
>;

/* --------------------------------------------------------------------- */
/* Per-agent decision specs, oldest first within each chain               */
/* --------------------------------------------------------------------- */

const CLAIMS_TRIAGE: DecisionSpec[] = [
  {
    id: "a0Bxx0000001001",
    decisionNumber: "D-88395",
    ledgerKey: "LK-CLM-88395",
    agentApiName: "Claims_Triage",
    agentVersion: "v1.9",
    occurredAt: "2026-07-29T11:04:52.000Z",
    headline: "Approved claim CLM-40109 within auto-approve limit",
    outcome: "Approved",
    autonomyLevel: "Autonomous",
    consequenceLevel: "Low",
    subjectReference: "Devon Alcott",
    subjectObject: "Claim",
    underLegalHold: false,
    redactionState: "None",
    overridden: false,
    actionsTaken: [
      "Invoked Evaluate_Claim_Eligibility with claim CLM-40109",
      "Updated Claim.Status to Approved",
      "Invoked Issue_Payment for $312.00",
    ],
    sourcesRead: [
      { source: "Policy POL-77120, coverage section", relevance: 0.92 },
      { source: "Claim CLM-40109 photos and estimate", relevance: 0.85 },
    ],
    considerations: [
      {
        id: "c001",
        optionLabel: "Approve within auto limit",
        optionType: "Action",
        confidence: 0.9,
        taken: true,
        rejectionReason: null,
      },
      {
        id: "c002",
        optionLabel: "Route to Manual_Review topic",
        optionType: "Topic",
        confidence: 0.17,
        taken: false,
        rejectionReason: "Claim value below manual-review threshold.",
      },
    ],
    policyChecks: [
      {
        id: "p001",
        controlKey: "AUTO_APPROVE_CEILING",
        controlLabel: "Auto-approve ceiling $500",
        evaluation: "Passed",
        detail: "Passed. Claim value $312.",
        thresholdValue: "$500",
        actualValue: "$312",
      },
    ],
    rationale: {
      id: "r001",
      statement:
        "The estimate and photos matched a covered peril with no exclusions, and the amount fell under the auto-approve ceiling, so I approved and issued payment directly.",
      declaredAt: "2026-07-29T11:04:50.000Z",
      declaredBeforeAction: true,
      modelVersion: "atlas-2026-06",
      promptTemplateVersion: "Evidence_Narrative_v1",
      confidence: 0.9,
    },
    accountability: {
      runningUser: "Integration User",
      approver: null,
      escalatedTo: null,
    },
    retentionExpiresAt: "2033-07-29T11:04:52.000Z",
    canonicalBody: null,
  },
  {
    id: "a0Bxx0000001002",
    decisionNumber: "D-88412",
    ledgerKey: "LK-CLM-88412",
    agentApiName: "Claims_Triage",
    agentVersion: "v1.9",
    occurredAt: "2026-07-29T14:12:07.000Z",
    headline: "Denied claim CLM-40218 without human review",
    outcome: "Denied",
    autonomyLevel: "Autonomous",
    consequenceLevel: "High",
    subjectReference: "Marguerite Ellis",
    subjectObject: "Claim",
    underLegalHold: true,
    redactionState: "None",
    overridden: false,
    actionsTaken: [
      "Invoked Evaluate_Claim_Eligibility with claim CLM-40218",
      "Invoked Apply_Policy_Exclusion with exclusion code EX-14",
      "Updated Claim.Status to Denied",
      "Created Case 00418822 for member notification",
    ],
    sourcesRead: [
      { source: "Policy POL-77120, exclusions section", relevance: 0.94 },
      { source: "KB-2209 Water damage exclusions", relevance: 0.88 },
      { source: "Claim CLM-40218 adjuster notes", relevance: 0.71 },
    ],
    considerations: [
      {
        id: "c101",
        optionLabel: "Route to Manual_Review topic",
        optionType: "Route",
        confidence: 0.31,
        taken: false,
        rejectionReason: "Exclusion match confidence cleared the review threshold.",
      },
      {
        id: "c102",
        optionLabel: "Apply Policy_Exclusion topic",
        optionType: "Topic",
        confidence: 0.87,
        taken: true,
        rejectionReason: null,
      },
      {
        id: "c103",
        optionLabel: "Request additional documentation",
        optionType: "Action",
        confidence: 0.22,
        taken: false,
        rejectionReason: "Adjuster notes already established the timeline.",
      },
    ],
    policyChecks: [
      {
        id: "p101",
        controlKey: "AUTO_DENY_CEILING",
        controlLabel: "Auto-deny ceiling $5,000",
        evaluation: "Passed",
        detail: "Passed. Claim value $2,840.",
        thresholdValue: "$5,000",
        actualValue: "$2,840",
      },
      {
        id: "p102",
        controlKey: "VULNERABLE_MEMBER",
        controlLabel: "Vulnerable member flag check",
        evaluation: "Passed",
        detail: "Passed. No flag on record.",
        thresholdValue: null,
        actualValue: null,
      },
      {
        id: "p103",
        controlKey: "AMBIGUOUS_EXCLUSION",
        controlLabel: "Escalate on ambiguous exclusion",
        evaluation: "Not_Triggered",
        detail: "Not triggered. Exclusion match confidence 0.94.",
        thresholdValue: "0.80",
        actualValue: "0.94",
      },
    ],
    rationale: {
      id: "r101",
      statement:
        "The claim describes gradual seepage over an extended period. Policy POL-77120 exclusion EX-14 excludes damage from continuous or repeated seepage, and the adjuster notes confirm a multi-week timeline. Confidence in the exclusion match was high enough to clear the manual review threshold, and the claim value fell below the auto-deny ceiling, so I applied the exclusion directly rather than routing for review.",
      declaredAt: "2026-07-29T14:12:05.000Z",
      declaredBeforeAction: true,
      modelVersion: "atlas-2026-06",
      promptTemplateVersion: "Evidence_Narrative_v1",
      confidence: 0.94,
    },
    accountability: {
      runningUser: "Integration User",
      approver: null,
      escalatedTo: null,
    },
    retentionExpiresAt: "2033-07-29T14:12:07.000Z",
    canonicalBody: null,
  },
];

const RENEWAL_OUTREACH: DecisionSpec[] = [
  {
    id: "a0Bxx0000001003",
    decisionNumber: "D-88370",
    ledgerKey: "LK-REN-88370",
    agentApiName: "Renewal_Outreach",
    agentVersion: "v3.1",
    occurredAt: "2026-07-29T09:47:31.000Z",
    headline: "Sent renewal offer to account ACC-8801",
    outcome: "Completed",
    autonomyLevel: "Autonomous",
    consequenceLevel: "Low",
    subjectReference: "Lena Whitfield",
    subjectObject: "Account",
    underLegalHold: false,
    redactionState: "None",
    overridden: false,
    actionsTaken: [
      "Invoked Check_Renewal_Eligibility for account ACC-8801",
      "Invoked Send_Renewal_Offer with tier Standard",
    ],
    sourcesRead: [{ source: "KB-1102 Renewal terms", relevance: 0.9 }],
    considerations: [
      {
        id: "c201",
        optionLabel: "Send standard offer",
        optionType: "Action",
        confidence: 0.88,
        taken: true,
        rejectionReason: null,
      },
    ],
    policyChecks: [
      {
        id: "p201",
        controlKey: "OFFER_ELIGIBILITY",
        controlLabel: "Retention offer eligibility",
        evaluation: "Passed",
        detail: "Passed. Account eligible.",
        thresholdValue: null,
        actualValue: null,
      },
    ],
    rationale: {
      id: "r201",
      statement:
        "The account was in good standing and eligible for a standard renewal, so I sent the offer without escalation.",
      declaredAt: "2026-07-29T09:47:29.000Z",
      declaredBeforeAction: true,
      modelVersion: "atlas-2026-06",
      promptTemplateVersion: "Evidence_Narrative_v1",
      confidence: 0.88,
    },
    accountability: {
      runningUser: "Integration User",
      approver: null,
      escalatedTo: null,
    },
    retentionExpiresAt: "2033-07-29T09:47:31.000Z",
    canonicalBody: null,
  },
  {
    id: "a0Bxx0000001004",
    decisionNumber: "D-88409",
    ledgerKey: "LK-REN-88409",
    agentApiName: "Renewal_Outreach",
    agentVersion: "v3.1",
    occurredAt: "2026-07-29T13:58:44.000Z",
    headline: "Escalated cancellation request to human queue",
    outcome: "Escalated",
    autonomyLevel: "Escalated",
    consequenceLevel: "Medium",
    subjectReference: "Tomas Beaulieu",
    subjectObject: "Account",
    underLegalHold: false,
    redactionState: "None",
    overridden: false,
    actionsTaken: [
      "Invoked Check_Renewal_Eligibility for account ACC-9921",
      "Invoked Transfer_To_Human with queue Retention_Tier2",
      "Created Case 00418819",
    ],
    sourcesRead: [
      { source: "KB-1102 Renewal terms", relevance: 0.91 },
      { source: "Account ACC-9921 renewal history", relevance: 0.83 },
    ],
    considerations: [
      {
        id: "c301",
        optionLabel: "Process reversal directly",
        optionType: "Action",
        confidence: 0.44,
        taken: false,
        rejectionReason: "Amount exceeds agent reversal authority.",
      },
      {
        id: "c302",
        optionLabel: "Transfer to Retention_Tier2",
        optionType: "Route",
        confidence: 0.79,
        taken: true,
        rejectionReason: null,
      },
    ],
    policyChecks: [
      {
        id: "p301",
        controlKey: "REVERSAL_AUTHORITY",
        controlLabel: "Reversal authority limit",
        evaluation: "Blocked",
        detail: "Blocked. Amount $1,240 exceeds agent authority of $500.",
        thresholdValue: "$500",
        actualValue: "$1,240",
      },
      {
        id: "p302",
        controlKey: "OFFER_ELIGIBILITY",
        controlLabel: "Retention offer eligibility",
        evaluation: "Passed",
        detail: "Passed. Account eligible.",
        thresholdValue: null,
        actualValue: null,
      },
    ],
    rationale: {
      id: "r301",
      statement:
        "The member requested a reversal of $1,240, which is above my reversal authority of $500. I confirmed eligibility first so the human agent would not have to repeat that step, then transferred to the Tier 2 retention queue with the eligibility result attached.",
      declaredAt: "2026-07-29T13:58:42.000Z",
      declaredBeforeAction: true,
      modelVersion: "atlas-2026-06",
      promptTemplateVersion: "Evidence_Narrative_v1",
      confidence: 0.79,
    },
    accountability: {
      runningUser: "Integration User",
      approver: null,
      escalatedTo: "Retention_Tier2",
    },
    retentionExpiresAt: "2033-07-29T13:58:44.000Z",
    canonicalBody: null,
  },
];

const BILLING_INQUIRY: DecisionSpec[] = [
  {
    id: "a0Bxx0000001005",
    decisionNumber: "D-88388",
    ledgerKey: "LK-BIL-88388",
    agentApiName: "Billing_Inquiry",
    agentVersion: "v4.2",
    occurredAt: "2026-07-29T10:22:18.000Z",
    headline: "Explained charge and closed inquiry for ACC-3120",
    outcome: "Completed",
    autonomyLevel: "Autonomous",
    consequenceLevel: "Low",
    subjectReference: "Harold Nkemelu",
    subjectObject: "Account",
    underLegalHold: false,
    redactionState: "None",
    overridden: true,
    actionsTaken: [
      "Invoked Explain_Charge for account ACC-3120",
      "Closed inquiry with resolution code RESOLVED_EXPLAINED",
    ],
    sourcesRead: [
      { source: "Account ACC-3120 billing history, 6 months", relevance: 0.87 },
    ],
    considerations: [
      {
        id: "c401",
        optionLabel: "Explain the prorated charge",
        optionType: "Action",
        confidence: 0.82,
        taken: true,
        rejectionReason: null,
      },
      {
        id: "c402",
        optionLabel: "Issue courtesy credit",
        optionType: "Action",
        confidence: 0.29,
        taken: false,
        rejectionReason: "Charge was correct; no credit warranted.",
      },
    ],
    policyChecks: [
      {
        id: "p401",
        controlKey: "GOODWILL_CEILING",
        controlLabel: "Goodwill ceiling without approval $50",
        evaluation: "Not_Triggered",
        detail: "Not triggered. No credit issued.",
        thresholdValue: "$50",
        actualValue: "$0",
      },
    ],
    rationale: {
      id: "r401",
      statement:
        "The charge reflected a mid-cycle plan change and was calculated correctly, so I explained the proration rather than issuing a credit.",
      declaredAt: "2026-07-29T10:22:16.000Z",
      declaredBeforeAction: true,
      modelVersion: "atlas-2026-06",
      promptTemplateVersion: "Evidence_Narrative_v1",
      confidence: 0.82,
    },
    accountability: {
      runningUser: "Integration User",
      approver: null,
      escalatedTo: null,
    },
    retentionExpiresAt: "2033-07-29T10:22:18.000Z",
    canonicalBody: null,
  },
  {
    id: "a0Bxx0000001006",
    decisionNumber: "D-88401",
    ledgerKey: "LK-BIL-88401",
    agentApiName: "Billing_Inquiry",
    agentVersion: "v4.2",
    occurredAt: "2026-07-29T13:31:12.000Z",
    headline: "Issued goodwill credit of $85 with supervisor approval",
    outcome: "Approved",
    autonomyLevel: "Human_Approved",
    consequenceLevel: "Medium",
    subjectReference: "Priya Raghunathan",
    subjectObject: "Account",
    underLegalHold: false,
    redactionState: "None",
    overridden: false,
    actionsTaken: [
      "Invoked Calculate_Goodwill_Credit for account ACC-3390",
      "Requested approval from Billing_Supervisor queue",
      "Invoked Issue_Credit for $85.00 after approval",
    ],
    sourcesRead: [
      { source: "Account ACC-3390 billing history, 18 months", relevance: 0.96 },
      { source: "KB-3301 Goodwill credit guidelines", relevance: 0.89 },
    ],
    considerations: [
      {
        id: "c501",
        optionLabel: "Deny and explain policy",
        optionType: "Action",
        confidence: 0.18,
        taken: false,
        rejectionReason: "A known provisioning defect caused the double-billing.",
      },
      {
        id: "c502",
        optionLabel: "Issue partial credit",
        optionType: "Action",
        confidence: 0.72,
        taken: true,
        rejectionReason: null,
      },
      {
        id: "c503",
        optionLabel: "Issue full refund of $210",
        optionType: "Action",
        confidence: 0.35,
        taken: false,
        rejectionReason: "Service was delivered; only the overlap should be credited.",
      },
    ],
    policyChecks: [
      {
        id: "p501",
        controlKey: "GOODWILL_CEILING",
        controlLabel: "Goodwill ceiling without approval $50",
        evaluation: "Passed",
        detail: "Triggered approval. Amount $85 exceeds ceiling.",
        thresholdValue: "$50",
        actualValue: "$85",
      },
      {
        id: "p502",
        controlKey: "GOODWILL_FREQUENCY",
        controlLabel: "Frequency limit, one per 12 months",
        evaluation: "Passed",
        detail: "Passed. Last credit 19 months ago.",
        thresholdValue: "12 months",
        actualValue: "19 months",
      },
    ],
    rationale: {
      id: "r501",
      statement:
        "The account was double-billed for two months due to a known provisioning defect. Guidelines KB-3301 suggest crediting the overlap rather than a full refund since service was delivered. I calculated $85 as the overlap value and requested approval because it exceeds my unassisted ceiling of $50.",
      declaredAt: "2026-07-29T13:30:58.000Z",
      declaredBeforeAction: false,
      modelVersion: "atlas-2026-06",
      promptTemplateVersion: "Evidence_Narrative_v1",
      confidence: 0.72,
    },
    accountability: {
      runningUser: "Integration User",
      approver: "D. Okonjo",
      escalatedTo: null,
    },
    retentionExpiresAt: "2033-07-29T13:31:12.000Z",
    canonicalBody: null,
  },
];

/** Assemble one agent's specs into a positioned, hash-chained list. */
function buildChain(specs: DecisionSpec[]): DecisionDetailView[] {
  const chainKey = chainKeyFor(specs[0].agentApiName);
  let prior: string | null = null;
  return specs.map((spec, position) => {
    const thisHash = fauxHash(`${chainKey}|${position}|${spec.ledgerKey}`);
    const row: DecisionDetailView = {
      ...spec,
      chainKey,
      chainPosition: position,
      priorHash: prior,
      thisHash,
    };
    prior = thisHash;
    return row;
  });
}

/** Every seeded decision, newest first (ledger default order). */
export const SEED_DECISIONS: DecisionDetailView[] = [
  ...buildChain(CLAIMS_TRIAGE),
  ...buildChain(RENEWAL_OUTREACH),
  ...buildChain(BILLING_INQUIRY),
].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

/* --------------------------------------------------------------------- */
/* Bundles                                                                */
/* --------------------------------------------------------------------- */

export const SEED_BUNDLES: BundleView[] = [
  {
    id: "a0Cxx0000000091",
    bundleNumber: "EB-0091",
    matter: "Ellis v. Northbay, discovery request",
    purpose: "Litigation discovery production",
    rangeStart: "2026-01-01T00:00:00.000Z",
    rangeEnd: "2026-06-30T23:59:59.000Z",
    decisionCount: 412,
    state: "Sealed",
    sealedAt: "2026-07-24T16:20:00.000Z",
    sealedBy: "Legal Ops",
    segmentRootHash: fauxHash("EB-0091-root"),
    anchorReference: "org:Claims_Triage@2026-06-30",
    redactionProfile: "Outside_Counsel",
    exportFormat: "PDF",
  },
  {
    id: "a0Cxx0000000088",
    bundleNumber: "EB-0088",
    matter: "SOC 2 Type II, CC7 evidence",
    purpose: "Annual SOC 2 audit",
    rangeStart: "2026-04-01T00:00:00.000Z",
    rangeEnd: "2026-06-30T23:59:59.000Z",
    decisionCount: 18940,
    state: "Sealed",
    sealedAt: "2026-07-12T09:05:00.000Z",
    sealedBy: "A. Imperiale",
    segmentRootHash: fauxHash("EB-0088-root"),
    anchorReference: "org:*@2026-06-30",
    redactionProfile: "Internal",
    exportFormat: "JSON",
  },
  {
    id: "a0Cxx0000000084",
    bundleNumber: "EB-0084",
    matter: "GDPR subject access, Raghunathan",
    purpose: "GDPR Art. 15 subject access request",
    rangeStart: null,
    rangeEnd: null,
    decisionCount: 27,
    state: "Delivered",
    sealedAt: "2026-06-30T14:00:00.000Z",
    sealedBy: "Privacy Office",
    segmentRootHash: fauxHash("EB-0084-root"),
    anchorReference: "org:Billing_Inquiry@2026-06-29",
    redactionProfile: "Data_Subject",
    exportFormat: "PDF",
  },
];

/* --------------------------------------------------------------------- */
/* Legal holds                                                            */
/* --------------------------------------------------------------------- */

export const SEED_HOLDS: LegalHoldView[] = [
  {
    id: "a0Dxx0000000001",
    matter: "Ellis v. Northbay",
    scopeFilterJson: '{"agentApiName":"Claims_Triage","subjectContains":"Ellis"}',
    effectiveFrom: "2026-07-02T00:00:00.000Z",
    releasedAt: null,
    issuedBy: "Legal Ops",
    active: true,
    scopedDecisionCount: 412,
  },
  {
    id: "a0Dxx0000000002",
    matter: "Prior audit inquiry, closed",
    scopeFilterJson: '{"framework":"SOC2"}',
    effectiveFrom: "2025-11-01T00:00:00.000Z",
    releasedAt: "2026-05-14T00:00:00.000Z",
    issuedBy: "Internal Audit",
    active: false,
    scopedDecisionCount: 0,
  },
];

/* --------------------------------------------------------------------- */
/* Chain verifications, anchors, and status                               */
/* --------------------------------------------------------------------- */

export const SEED_VERIFICATIONS: ChainVerificationView[] = [
  {
    id: "a0Exx0000000010",
    chainKey: chainKeyFor("Claims_Triage"),
    verifiedAt: "2026-07-29T14:06:00.000Z",
    linksChecked: 14820,
    firstPosition: 0,
    lastPosition: 14819,
    result: "Intact",
    breakAtPosition: null,
    durationMs: 8420,
  },
  {
    id: "a0Exx0000000009",
    chainKey: chainKeyFor("Billing_Inquiry"),
    verifiedAt: "2026-07-29T14:05:40.000Z",
    linksChecked: 11240,
    firstPosition: 0,
    lastPosition: 11239,
    result: "Intact",
    breakAtPosition: null,
    durationMs: 6110,
  },
  {
    id: "a0Exx0000000008",
    chainKey: chainKeyFor("Renewal_Outreach"),
    verifiedAt: "2026-07-29T14:05:12.000Z",
    linksChecked: 8630,
    firstPosition: 0,
    lastPosition: 8629,
    result: "Intact",
    breakAtPosition: null,
    durationMs: 4870,
  },
];

export const SEED_ANCHORS: ChainAnchorView[] = [
  {
    chainKey: chainKeyFor("Claims_Triage"),
    anchorDate: "2026-07-28",
    terminalHash: fauxHash("Claims_Triage@2026-07-28"),
    terminalPosition: 14780,
    linkCount: 14781,
    computedAt: "2026-07-29T00:05:00.000Z",
    computedBy: "EvidenceAnchorSchedulable",
    signature: fauxHash("sig:Claims_Triage@2026-07-28"),
  },
  {
    chainKey: chainKeyFor("Billing_Inquiry"),
    anchorDate: "2026-07-28",
    terminalHash: fauxHash("Billing_Inquiry@2026-07-28"),
    terminalPosition: 11201,
    linkCount: 11202,
    computedAt: "2026-07-29T00:05:00.000Z",
    computedBy: "EvidenceAnchorSchedulable",
    signature: fauxHash("sig:Billing_Inquiry@2026-07-28"),
  },
  {
    chainKey: chainKeyFor("Renewal_Outreach"),
    anchorDate: "2026-07-28",
    terminalHash: fauxHash("Renewal_Outreach@2026-07-28"),
    terminalPosition: 8600,
    linkCount: 8601,
    computedAt: "2026-07-29T00:05:00.000Z",
    computedBy: "EvidenceAnchorSchedulable",
    signature: fauxHash("sig:Renewal_Outreach@2026-07-28"),
  },
];

export const SEED_CHAIN_STATUS: ChainStatusView = {
  result: "Intact",
  totalLinks: 44220,
  chainCount: 5,
  lastVerifiedAt: "2026-07-29T14:06:00.000Z",
  breakChainKey: null,
  breakAtPosition: null,
};

/* --------------------------------------------------------------------- */
/* Analysis aggregates (mirror docs/console-mockup.jsx)                   */
/* --------------------------------------------------------------------- */

const AUTONOMY_30D = [
  72, 74, 71, 75, 78, 76, 79, 81, 80, 83, 82, 85, 84, 86, 85, 87, 86, 88, 87,
  89, 88, 90, 89, 91, 90, 92, 91, 93, 92, 94,
];

export const SEED_AUTONOMY_TREND: AutonomyTrendPoint[] = AUTONOMY_30D.map(
  (autonomyPercent, i) => {
    const d = new Date("2026-07-29T00:00:00.000Z");
    d.setUTCDate(d.getUTCDate() - (AUTONOMY_30D.length - 1 - i));
    return { date: d.toISOString().slice(0, 10), autonomyPercent };
  },
);

export const SEED_BY_AGENT: AgentVolume[] = [
  { agentApiName: "Claims_Triage", agentLabel: "Claims Triage", count: 14820, colorToken: PALETTE.brand },
  { agentApiName: "Billing_Inquiry", agentLabel: "Billing Inquiry", count: 11240, colorToken: PALETTE.accent },
  { agentApiName: "Renewal_Outreach", agentLabel: "Renewal Outreach", count: 8630, colorToken: PALETTE.autonomy },
  { agentApiName: "Refund_Concierge", agentLabel: "Refund Concierge", count: 6410, colorToken: PALETTE.success },
  { agentApiName: "Field_Dispatch", agentLabel: "Field Dispatch", count: 3120, colorToken: PALETTE.warning },
];

export const SEED_OVERRIDE_REASONS: OverrideReason[] = [
  { reason: "Exclusion applied too broadly", count: 34 },
  { reason: "Member context agent could not see", count: 21 },
  { reason: "Policy interpretation disputed", count: 17 },
  { reason: "Documentation actually sufficient", count: 11 },
];

export const SEED_KPIS: LedgerKpis = {
  decisionsLogged: 44220,
  autonomyPercent: 94,
  overrideRatePercent: 1.9,
  overrideNumerator: 83,
  overrideDenominator: 4412,
  chainVerified: true,
  chainLinks: 44220,
  chainVerifiedAt: "2026-07-29T14:06:00.000Z",
};

/* --------------------------------------------------------------------- */
/* Control mappings (CONTRACT §7, seeded frameworks)                      */
/* --------------------------------------------------------------------- */

export const SEED_CONTROL_MAPPINGS: ControlMappingView[] = [
  {
    controlKey: "EU_AI_ACT_ART12",
    framework: "EU AI Act",
    controlReference: "Article 12",
    controlLabel: "Record-keeping and automatic logging",
    satisfiedBy: "Hash-chained decision ledger with per-agent chains",
    active: true,
    evidenceCount: 44220,
  },
  {
    controlKey: "EU_AI_ACT_ART14",
    framework: "EU AI Act",
    controlReference: "Article 14",
    controlLabel: "Human oversight",
    satisfiedBy: "Autonomy level and escalation captured on every decision",
    active: true,
    evidenceCount: 2648,
  },
  {
    controlKey: "SR_11_7",
    framework: "Federal Reserve",
    controlReference: "SR 11-7",
    controlLabel: "Model risk management, effective challenge",
    satisfiedBy: "Declared rationale plus considered-and-rejected options",
    active: true,
    evidenceCount: 44220,
  },
  {
    controlKey: "SOC2_CC7",
    framework: "SOC 2",
    controlReference: "CC7.2",
    controlLabel: "System monitoring and anomaly detection",
    satisfiedBy: "Chain verification runs and completeness reconciliation",
    active: true,
    evidenceCount: 18940,
  },
  {
    controlKey: "HIPAA_DISCLOSURE",
    framework: "HIPAA",
    controlReference: "§164.528",
    controlLabel: "Accounting of disclosures",
    satisfiedBy: "Access-audit chain records every subject-data read",
    active: true,
    evidenceCount: 512,
  },
  {
    controlKey: "GDPR_ART22",
    framework: "GDPR",
    controlReference: "Article 22",
    controlLabel: "Automated individual decision-making",
    satisfiedBy: "Autonomous decisions flagged with declared rationale on record",
    active: true,
    evidenceCount: 41572,
  },
];
