import { z } from "zod";

/**
 * Zod schemas mirroring the domain DTOs in `types.ts`. Used for:
 *  - validating form inputs (bundle assembly, legal-hold issue) with
 *    react-hook-form + @hookform/resolvers/zod, and
 *  - defensively parsing adapter output at the data seam.
 *
 * The enums here are the single client-side source of truth for the
 * picklist values and are re-exported through `domain/index.ts`.
 */

export const outcomeSchema = z.enum([
  "Approved",
  "Denied",
  "Escalated",
  "Completed",
  "Deferred",
]);

export const autonomyLevelSchema = z.enum([
  "Autonomous",
  "Escalated",
  "Human_Approved",
]);

export const consequenceLevelSchema = z.enum(["Low", "Medium", "High"]);

export const evaluationSchema = z.enum(["Passed", "Blocked", "Not_Triggered"]);

export const optionTypeSchema = z.enum(["Topic", "Action", "Route"]);

export const redactionStateSchema = z.enum([
  "None",
  "Partial",
  "Body_Redacted_Hash_Kept",
]);

export const bundleStateSchema = z.enum([
  "Draft",
  "Sealed",
  "Delivered",
  "Withdrawn",
]);

export const chainResultSchema = z.enum(["Intact", "Break_Detected"]);

export const provenanceSchema = z.enum(["Observed", "Declared"]);

/* --------------------------- view schemas ---------------------------- */

export const decisionViewSchema = z.object({
  id: z.string(),
  decisionNumber: z.string(),
  ledgerKey: z.string(),
  agentApiName: z.string(),
  agentVersion: z.string(),
  occurredAt: z.string(),
  headline: z.string(),
  outcome: outcomeSchema,
  autonomyLevel: autonomyLevelSchema,
  consequenceLevel: consequenceLevelSchema,
  subjectReference: z.string().nullable(),
  subjectObject: z.string().nullable(),
  thisHash: z.string(),
  priorHash: z.string().nullable(),
  chainPosition: z.number(),
  chainKey: z.string(),
  underLegalHold: z.boolean(),
  redactionState: redactionStateSchema,
  overridden: z.boolean().optional(),
});

export const sourceReadSchema = z.object({
  source: z.string(),
  relevance: z.number().min(0).max(1),
});

export const considerationViewSchema = z.object({
  id: z.string(),
  optionLabel: z.string(),
  optionType: optionTypeSchema,
  confidence: z.number().min(0).max(1),
  taken: z.boolean(),
  rejectionReason: z.string().nullable(),
});

export const policyCheckViewSchema = z.object({
  id: z.string(),
  controlKey: z.string(),
  controlLabel: z.string(),
  evaluation: evaluationSchema,
  detail: z.string(),
  thresholdValue: z.string().nullable(),
  actualValue: z.string().nullable(),
});

export const rationaleViewSchema = z.object({
  id: z.string(),
  statement: z.string().nullable(),
  declaredAt: z.string(),
  declaredBeforeAction: z.boolean(),
  modelVersion: z.string().nullable(),
  promptTemplateVersion: z.string().nullable(),
  confidence: z.number().nullable(),
});

export const accountabilitySchema = z.object({
  runningUser: z.string().nullable(),
  approver: z.string().nullable(),
  escalatedTo: z.string().nullable(),
});

export const decisionDetailViewSchema = decisionViewSchema.extend({
  actionsTaken: z.array(z.string()),
  sourcesRead: z.array(sourceReadSchema),
  considerations: z.array(considerationViewSchema),
  policyChecks: z.array(policyCheckViewSchema),
  rationale: rationaleViewSchema.nullable(),
  accountability: accountabilitySchema,
  retentionExpiresAt: z.string().nullable(),
  canonicalBody: z.string().nullable(),
});

/* --------------------------- form schemas ---------------------------- */

/** Bundle assembly form (`Evidence_Assemble_Bundle_Screen` equivalent). */
export const bundleInputSchema = z.object({
  matter: z.string().min(1, "Matter is required"),
  purpose: z.string().optional(),
  rangeStart: z.string().optional(),
  rangeEnd: z.string().optional(),
  redactionProfile: z.string().optional(),
  exportFormat: z.string().optional(),
});
export type BundleInputForm = z.infer<typeof bundleInputSchema>;

/** Legal-hold issue form (`Evidence_Issue_Legal_Hold_Screen` equivalent). */
export const holdInputSchema = z.object({
  matter: z.string().min(1, "Matter is required"),
  scopeFilterJson: z
    .string()
    .optional()
    .refine(
      (v) => {
        if (!v) return true;
        try {
          JSON.parse(v);
          return true;
        } catch {
          return false;
        }
      },
      { message: "Scope filter must be valid JSON" },
    ),
  effectiveFrom: z.string().optional(),
});
export type HoldInputForm = z.infer<typeof holdInputSchema>;
