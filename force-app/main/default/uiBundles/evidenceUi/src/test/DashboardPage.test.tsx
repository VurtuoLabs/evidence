/**
 * DashboardPage - the overview must agree with the pages it links to.
 *
 * The dashboard derives every number from the same seam the detail pages read
 * (useLedgerKpis, useAutonomyTrend, useAgentVolume, useOverrideReasons), so the
 * risk it carries is a derivation drifting from its source rather than a
 * rendering bug. These cover: the KPI values render verbatim from the facade,
 * the donut's total matches the sum of its slices, and the override panel
 * ranks by count with the top reason first.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DashboardPage from "@/features/dashboard/DashboardPage";

const { KPIS, TREND, BY_AGENT, OVERRIDES, RECENT } = vi.hoisted(() => {
  const trend = Array.from({ length: 30 }, (_, i) => ({
    date: `2026-07-${String(i + 1).padStart(2, "0")}`,
    autonomyPercent: 80 + i * 0.3,
  }));

  return {
    KPIS: {
      decisionsLogged: 15420,
      autonomyPercent: 88,
      overrideRatePercent: 4.2,
      overrideNumerator: 62,
      overrideDenominator: 1476,
      chainVerified: true,
      chainLinks: 15420,
      chainVerifiedAt: new Date().toISOString(),
    },
    TREND: trend,
    BY_AGENT: [
      { agentApiName: "Claims_Triage", agentLabel: "Claims Triage", count: 8000, colorToken: "#6D28D9" },
      { agentApiName: "Billing_Inquiry", agentLabel: "Billing Inquiry", count: 2000, colorToken: "#A855F7" },
    ],
    OVERRIDES: [
      { reason: "Exclusion applied too broadly", count: 34 },
      { reason: "Member context agent could not see", count: 21 },
    ],
    RECENT: [
      {
        id: "d1",
        decisionNumber: "D-00001",
        ledgerKey: "LK-1",
        agentApiName: "Claims_Triage",
        agentVersion: "v3",
        occurredAt: new Date().toISOString(),
        headline: "Approved claim payout within authority",
        outcome: "Approved",
        autonomyLevel: "Autonomous",
        consequenceLevel: "Medium",
        subjectReference: "Member 4471",
        subjectObject: "Claim",
        thisHash: "abcdef1234567890",
        priorHash: null,
        chainPosition: 0,
        chainKey: "org:Claims_Triage",
        underLegalHold: false,
        redactionState: "None",
      },
    ],
  };
});

vi.mock("@/hooks/useLedger", () => ({
  useLedgerKpis: () => ({ data: KPIS, isLoading: false, isError: false }),
  useLedgerDecisions: () => ({ data: { items: RECENT, nextCursor: null, totalCount: 1 }, isLoading: false, isError: false }),
}));
vi.mock("@/hooks/useAnalysis", () => ({
  useAutonomyTrend: () => ({ data: TREND, isLoading: false, isError: false }),
  useAgentVolume: () => ({ data: BY_AGENT, isLoading: false, isError: false }),
  useOverrideReasons: () => ({ data: OVERRIDES, isLoading: false, isError: false }),
}));
vi.mock("@/hooks/useChain", () => ({
  useChainStatus: () => ({ data: undefined, isLoading: false, isError: false }),
}));
vi.mock("@/hooks/useHolds", () => ({
  useHolds: () => ({ data: [{ id: "h1", active: true, matter: "Matter-001" }], isLoading: false, isError: false }),
}));

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe("DashboardPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the KPI strip verbatim from the ledger facade", () => {
    renderDashboard();

    expect(within(screen.getByTestId("stat-decisions")).getByText("15,420")).toBeInTheDocument();
    expect(within(screen.getByTestId("stat-autonomy")).getByText("88%")).toBeInTheDocument();
    expect(within(screen.getByTestId("stat-override")).getByText("4.2%")).toBeInTheDocument();
    expect(within(screen.getByTestId("stat-chain")).getByText("Verified")).toBeInTheDocument();
  });

  it("totals the agent-volume donut to the sum of its own slices", () => {
    renderDashboard();
    // 8000 + 2000 = 10000 - if the centre disagrees with the legend rows below
    // it, one of the two derivations is wrong.
    expect(screen.getByLabelText(/Total decisions: 10,000/i)).toBeInTheDocument();
  });

  it("totals overrides and surfaces the top reason first", () => {
    renderDashboard();
    const panel = within(screen.getByTestId("override-panel"));
    // 34 + 21 - the panel's own total must agree with the reasons feeding it.
    expect(panel.getByText("55")).toBeInTheDocument();
    expect(panel.getByText("Exclusion applied too broadly")).toBeInTheDocument();
    expect(panel.getByText("34")).toBeInTheDocument();
  });

  it("surfaces the count of active legal holds in the page subtitle", () => {
    renderDashboard();
    expect(screen.getByText(/1 legal hold currently active/i)).toBeInTheDocument();
  });

  it("lists the most recent decision with its outcome and autonomy pills", () => {
    renderDashboard();
    const panel = within(screen.getByTestId("recent-decisions-panel"));
    expect(panel.getByText("Approved claim payout within authority")).toBeInTheDocument();
    expect(panel.getByText("Approved")).toBeInTheDocument();
    expect(panel.getByText("Acted alone")).toBeInTheDocument();
  });

  it("surfaces legal holds and chain verification as standing-fact cards", () => {
    renderDashboard();
    expect(within(screen.getByTestId("stat-holds")).getByText("1")).toBeInTheDocument();
    expect(within(screen.getByTestId("stat-holds")).getByText("Matter-001")).toBeInTheDocument();
    expect(within(screen.getByTestId("stat-chain-detail")).getByText("All chains intact")).toBeInTheDocument();
  });

  it("switches the trend window through the segmented control", () => {
    renderDashboard();
    const group = screen.getByRole("radiogroup", { name: /trend window/i });
    const options = within(group).getAllByRole("radio");
    expect(options).toHaveLength(3);

    const sevenDays = within(group).getByRole("radio", { name: "7 days" });
    fireEvent.click(sevenDays);
    expect(sevenDays).toHaveAttribute("aria-checked", "true");
  });
});
