import type {
  AutonomyLevel,
  BundleState,
  ChainResult,
  ConsequenceLevel,
  Evaluation,
  OptionType,
  Outcome,
  Provenance,
  RedactionState,
} from "./types";

/**
 * Human labels + colors for every enum. Colors are the literal Evidence
 * palette hexes (CONTRACT §12.6, mirrored in docs/console-mockup.jsx) so
 * that pills, charts, and inline SVG all read from one place. CSS-variable
 * tokens are used for surfaces/typography; these fixed hexes are for the
 * categorical, provenance-carrying marks that must stay stable in light
 * and dark alike.
 */
export const PALETTE = {
  brand: "#6D28D9",
  brandDark: "#4C1D95",
  accent: "#A855F7",
  autonomy: "#7C3AED",
  success: "#2E844A",
  warning: "#014486",
  error: "#B91C1C",
  weak: "#5B5468",
  weakest: "#847B93",
} as const;

export interface LabelSpec {
  label: string;
  color: string;
}

/* ------------------------------ Outcome ------------------------------ */

export const OUTCOME_LABELS: Record<Outcome, LabelSpec> = {
  Approved: { label: "Approved", color: PALETTE.success },
  Denied: { label: "Denied", color: PALETTE.error },
  Escalated: { label: "Escalated", color: PALETTE.warning },
  Completed: { label: "Completed", color: PALETTE.brand },
  Deferred: { label: "Deferred", color: PALETTE.weakest },
};

/* ----------------------------- Autonomy ------------------------------ */

export const AUTONOMY_LABELS: Record<AutonomyLevel, LabelSpec> = {
  Autonomous: { label: "Acted alone", color: PALETTE.autonomy },
  Escalated: { label: "Handed off", color: PALETTE.warning },
  Human_Approved: { label: "Human approved", color: PALETTE.success },
};

/* ---------------------------- Consequence ---------------------------- */

export const CONSEQUENCE_LABELS: Record<ConsequenceLevel, LabelSpec> = {
  Low: { label: "Low", color: PALETTE.weakest },
  Medium: { label: "Medium", color: PALETTE.warning },
  High: { label: "High consequence", color: PALETTE.error },
};

/* ---------------------------- Evaluation ----------------------------- */

export const EVALUATION_LABELS: Record<Evaluation, LabelSpec> = {
  Passed: { label: "Passed", color: PALETTE.success },
  Blocked: { label: "Blocked", color: PALETTE.error },
  Not_Triggered: { label: "Not triggered", color: PALETTE.weakest },
};

/** Glyph shown next to a policy check in the "What constrained it" panel. */
export const EVALUATION_GLYPH: Record<Evaluation, string> = {
  Passed: "✓",
  Blocked: "⊘",
  Not_Triggered: "○",
};

/* ---------------------------- Option type ---------------------------- */

export const OPTION_TYPE_LABELS: Record<OptionType, LabelSpec> = {
  Topic: { label: "Topic", color: PALETTE.brand },
  Action: { label: "Action", color: PALETTE.accent },
  Route: { label: "Route", color: PALETTE.autonomy },
};

/* -------------------------- Redaction state -------------------------- */

export const REDACTION_LABELS: Record<RedactionState, LabelSpec> = {
  None: { label: "Unredacted", color: PALETTE.weakest },
  Partial: { label: "Partially redacted", color: PALETTE.warning },
  Body_Redacted_Hash_Kept: {
    label: "Body redacted, hash kept",
    color: PALETTE.warning,
  },
};

/* ---------------------------- Bundle state --------------------------- */

export const BUNDLE_STATE_LABELS: Record<BundleState, LabelSpec> = {
  Draft: { label: "Draft", color: PALETTE.brand },
  Sealed: { label: "Sealed", color: PALETTE.success },
  Delivered: { label: "Delivered", color: PALETTE.autonomy },
  Withdrawn: { label: "Withdrawn", color: PALETTE.weakest },
};

/* ---------------------------- Chain result --------------------------- */

export const CHAIN_RESULT_LABELS: Record<ChainResult, LabelSpec> = {
  Intact: { label: "Chain verified", color: PALETTE.success },
  Break_Detected: { label: "Chain break detected", color: PALETTE.error },
};

/* ----------------------------- Provenance ---------------------------- */

/**
 * The honesty line, encoded (CONTRACT §1). Observed is neutral; Declared
 * carries the warning tone everywhere so the eye learns the distinction.
 */
export const PROVENANCE_LABELS: Record<Provenance, LabelSpec> = {
  Observed: { label: "Observed", color: PALETTE.weakest },
  Declared: { label: "Declared", color: PALETTE.warning },
};

export const PROVENANCE_DESCRIPTION: Record<Provenance, string> = {
  Observed:
    "A deterministic fact: what the agent invoked, read, considered, and who ran it.",
  Declared:
    "The agent's own account of its reasoning, captured before the action fired.",
};
