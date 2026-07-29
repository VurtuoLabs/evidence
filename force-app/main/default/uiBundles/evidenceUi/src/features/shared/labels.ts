/**
 * Presentation maps for the enumerations declared in `domain/types.ts`.
 *
 * The *values* (picklist API names) are the shared source of truth; the human
 * label and the colour are UI concerns and live here, next to the primitives
 * that consume them, rather than in the domain layer.
 */

import type {
  AutonomyLevel,
  BundleState,
  ConsequenceLevel,
  Evaluation,
  Outcome,
  Provenance,
  RedactionState,
} from "@/domain/types";
import { INK } from "./tokens";

export interface Tone {
  label: string;
  color: string;
}

export const OUTCOME_TONE: Record<Outcome, Tone> = {
  Approved: { label: "Approved", color: INK.success },
  Denied: { label: "Denied", color: INK.error },
  Escalated: { label: "Escalated", color: INK.warning },
  Completed: { label: "Completed", color: INK.brand },
  Deferred: { label: "Deferred", color: INK.weak },
};

export const AUTONOMY_TONE: Record<AutonomyLevel, Tone> = {
  Autonomous: { label: "Acted alone", color: INK.violet },
  Escalated: { label: "Handed off", color: INK.warning },
  Human_Approved: { label: "Human approved", color: INK.success },
};

export const CONSEQUENCE_TONE: Record<ConsequenceLevel, Tone> = {
  Low: { label: "Low consequence", color: INK.weak },
  Medium: { label: "Medium consequence", color: INK.brand },
  High: { label: "High consequence", color: INK.error },
};

export const EVALUATION_TONE: Record<Evaluation, Tone & { glyph: string }> = {
  Passed: { label: "Passed", color: INK.success, glyph: "✓" }, // ✓
  Blocked: { label: "Blocked", color: INK.error, glyph: "⊘" }, // ⊘
  Not_Triggered: { label: "Not triggered", color: INK.weakest, glyph: "○" }, // ○
};

export const REDACTION_TONE: Record<RedactionState, Tone> = {
  None: { label: "Unredacted", color: INK.weakest },
  Partial: { label: "Partially redacted", color: INK.warning },
  Body_Redacted_Hash_Kept: { label: "Body redacted, hash kept", color: INK.warning },
};

export const BUNDLE_STATE_TONE: Record<BundleState, Tone> = {
  Draft: { label: "Draft", color: INK.brand },
  Sealed: { label: "Sealed", color: INK.success },
  Delivered: { label: "Delivered", color: INK.violet },
  Withdrawn: { label: "Withdrawn", color: INK.weakest },
};

/** The two sides of the honesty line (CONTRACT §1). Declared reads as a caution. */
export const PROVENANCE_TONE: Record<Provenance, Tone> = {
  Observed: { label: "Observed", color: INK.weakest },
  Declared: { label: "Declared", color: INK.warning },
};
