/**
 * DecisionRecord - the hero. These tests protect the two things that make the
 * record trustworthy (CONTRACT §1, §12.4):
 *   1. Every panel carries the correct provenance badge - five Observed, one
 *      Declared. Blurring that line is the one thing the product must not do.
 *   2. A rationale captured after the action (Declared_Before_Action = false)
 *      renders the post-hoc warning; captured before, it does not.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { DecisionDetailView } from "@/domain/types";
import { POST_HOC_WARNING, DECLARED_STANDING_NOTE } from "@/lib/constants";

// The data seam is mocked: the component is exercised in isolation from Apex.
vi.mock("@/hooks/useDecision", () => ({
  useDecision: vi.fn(),
}));

import { useDecision } from "@/hooks/useDecision";
import { DecisionRecord } from "@/features/decision/DecisionRecord";

const mockUseDecision = vi.mocked(useDecision);

function makeDecision(overrides: Partial<DecisionDetailView> = {}): DecisionDetailView {
  return {
    id: "d1",
    decisionNumber: "D-88412",
    ledgerKey: "org:Claims_Triage:88412",
    agentApiName: "Claims_Triage",
    agentVersion: "v1.9",
    occurredAt: "2026-07-29T14:12:07.000Z",
    headline: "Denied claim CLM-40218 without human review",
    outcome: "Denied",
    autonomyLevel: "Autonomous",
    consequenceLevel: "High",
    subjectReference: "Marguerite Ellis",
    subjectObject: "Claim",
    thisHash: "a91f3c7e5b0d1122a91f3c7e5b0d1122",
    priorHash: "6b20de11c4471aa96b20de11c4471aa9",
    chainPosition: 42,
    chainKey: "org:Claims_Triage",
    underLegalHold: false,
    redactionState: "None",
    actionsTaken: [
      "Invoked Evaluate_Claim_Eligibility with claim CLM-40218",
      "Updated Claim.Status to Denied",
    ],
    sourcesRead: [
      { source: "Policy POL-77120, exclusions section", relevance: 0.94 },
      { source: "KB-2209 Water damage exclusions", relevance: 0.88 },
    ],
    considerations: [
      { id: "c1", optionLabel: "Route to Manual_Review", optionType: "Topic", confidence: 0.31, taken: false, rejectionReason: "Confidence below threshold" },
      { id: "c2", optionLabel: "Apply Policy_Exclusion", optionType: "Topic", confidence: 0.87, taken: true, rejectionReason: null },
    ],
    policyChecks: [
      { id: "p1", controlKey: "AUTO_DENY_CEILING", controlLabel: "Auto-deny ceiling $5,000", evaluation: "Passed", detail: "Claim value $2,840.", thresholdValue: "5000", actualValue: "2840" },
      { id: "p2", controlKey: "VULN_FLAG", controlLabel: "Vulnerable member flag", evaluation: "Not_Triggered", detail: "No flag on record.", thresholdValue: null, actualValue: null },
    ],
    rationale: {
      id: "r1",
      statement: "The claim describes gradual seepage; exclusion EX-14 applies and confidence cleared the review threshold.",
      declaredAt: "2026-07-29T14:12:05.000Z",
      declaredBeforeAction: true,
      modelVersion: "model-x",
      promptTemplateVersion: "Evidence_Narrative_v1",
      confidence: 0.94,
    },
    accountability: { runningUser: "Integration User", approver: null, escalatedTo: null },
    retentionExpiresAt: null,
    canonicalBody: null,
    ...overrides,
  };
}

function renderRecord() {
  return render(
    <MemoryRouter>
      <DecisionRecord decisionId="d1" />
    </MemoryRouter>,
  );
}

describe("DecisionRecord", () => {
  beforeEach(() => {
    mockUseDecision.mockReset();
  });

  it("renders all six provenance-labelled panels", () => {
    mockUseDecision.mockReturnValue({
      data: makeDecision(),
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useDecision>);

    renderRecord();

    expect(screen.getByText("What it did")).toBeInTheDocument();
    expect(screen.getByText("What it read")).toBeInTheDocument();
    expect(screen.getByText("What it considered")).toBeInTheDocument();
    expect(screen.getByText("What constrained it")).toBeInTheDocument();
    expect(screen.getByText("Why it chose this")).toBeInTheDocument();
    expect(screen.getByText("Who is accountable")).toBeInTheDocument();
  });

  it("badges five panels Observed and exactly one Declared", () => {
    mockUseDecision.mockReturnValue({
      data: makeDecision(),
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useDecision>);

    renderRecord();

    // Five section badges + one footer badge = six Observed; one Declared.
    expect(screen.getAllByTestId("provenance-Observed").length).toBeGreaterThanOrEqual(5);
    expect(screen.getAllByTestId("provenance-Declared")).toHaveLength(1);
  });

  it("renders the chain position as prior → this in the header", () => {
    mockUseDecision.mockReturnValue({
      data: makeDecision(),
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useDecision>);

    renderRecord();

    // The chain-link pill carries the position in its title and shows both hashes.
    const link = screen.getByTitle("Chain position 42");
    expect(link).toHaveTextContent("6b20de11");
    expect(link).toHaveTextContent("a91f3c7e");
    expect(link).toHaveTextContent("→");
  });

  it("always shows the Declared standing note but no warning when declared before the action", () => {
    mockUseDecision.mockReturnValue({
      data: makeDecision({
        rationale: {
          id: "r1",
          statement: "Declared up front.",
          declaredAt: "2026-07-29T14:12:05.000Z",
          declaredBeforeAction: true,
          modelVersion: null,
          promptTemplateVersion: null,
          confidence: null,
        },
      }),
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useDecision>);

    renderRecord();

    expect(screen.getByText(DECLARED_STANDING_NOTE)).toBeInTheDocument();
    expect(screen.queryByTestId("post-hoc-warning")).not.toBeInTheDocument();

    const panel = screen.getByTestId("declared-panel");
    expect(panel).toHaveAttribute("data-post-hoc", "false");
  });

  it("renders the post-hoc warning when the rationale was recorded after the action", () => {
    mockUseDecision.mockReturnValue({
      data: makeDecision({
        rationale: {
          id: "r1",
          statement: "Explained after the fact.",
          declaredAt: "2026-07-29T14:20:00.000Z",
          declaredBeforeAction: false,
          modelVersion: null,
          promptTemplateVersion: null,
          confidence: null,
        },
      }),
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useDecision>);

    renderRecord();

    const warning = screen.getByTestId("post-hoc-warning");
    expect(warning).toBeInTheDocument();
    expect(warning).toHaveTextContent(POST_HOC_WARNING);

    const panel = screen.getByTestId("declared-panel");
    expect(panel).toHaveAttribute("data-post-hoc", "true");
    // The standing note still stands alongside the warning.
    expect(within(panel).getByText(DECLARED_STANDING_NOTE)).toBeInTheDocument();
  });
});
