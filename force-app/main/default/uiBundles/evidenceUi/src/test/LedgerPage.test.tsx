/**
 * LedgerPage - the filterable decision table (CONTRACT §12.3).
 * These tests cover the five saved views (mirroring `Evidence_View__mdt`) and
 * confirm a filter click forwards the matching view key to the ledger hook,
 * which is where the Big Object index resolution happens in Apex.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { DecisionView, LedgerKpis, Paginated } from "@/domain/types";

vi.mock("@/hooks/useLedger", () => ({
  useLedgerDecisions: vi.fn(),
  useLedgerKpis: vi.fn(),
}));

import { useLedgerDecisions, useLedgerKpis } from "@/hooks/useLedger";
import { LedgerPage } from "@/features/ledger/LedgerPage";

const mockDecisions = vi.mocked(useLedgerDecisions);
const mockKpis = vi.mocked(useLedgerKpis);

const KPIS: LedgerKpis = {
  decisionsLogged: 44220,
  autonomyPercent: 94,
  overrideRatePercent: 1.9,
  overrideNumerator: 83,
  overrideDenominator: 4412,
  chainVerified: true,
  chainLinks: 44220,
  chainVerifiedAt: "2026-07-29T14:00:00.000Z",
};

function makeRow(id: string, headline: string): DecisionView {
  return {
    id,
    decisionNumber: `D-${id}`,
    ledgerKey: `org:Claims_Triage:${id}`,
    agentApiName: "Claims_Triage",
    agentVersion: "v1.9",
    occurredAt: "2026-07-29T14:12:07.000Z",
    headline,
    outcome: "Denied",
    autonomyLevel: "Autonomous",
    consequenceLevel: "High",
    subjectReference: null,
    subjectObject: "Claim",
    thisHash: "a91f3c7e5b0d1122",
    priorHash: "6b20de11c4471aa9",
    chainPosition: 42,
    chainKey: "org:Claims_Triage",
    underLegalHold: false,
    redactionState: "None",
  };
}

const PAGE: Paginated<DecisionView> = {
  items: [makeRow("88412", "Denied claim CLM-40218 without human review")],
  nextCursor: null,
  totalCount: 44220,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <LedgerPage />
    </MemoryRouter>,
  );
}

describe("LedgerPage", () => {
  beforeEach(() => {
    mockDecisions.mockReset();
    mockKpis.mockReset();
    mockKpis.mockReturnValue({
      data: KPIS,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useLedgerKpis>);
    mockDecisions.mockReturnValue({
      data: PAGE,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useLedgerDecisions>);
  });

  it("renders all five saved-view filters", () => {
    renderPage();
    const filters = within(screen.getByRole("tablist", { name: "Ledger filters" }));
    expect(filters.getByRole("tab", { name: "All decisions" })).toBeInTheDocument();
    expect(filters.getByRole("tab", { name: "High consequence" })).toBeInTheDocument();
    expect(filters.getByRole("tab", { name: "Acted alone" })).toBeInTheDocument();
    expect(filters.getByRole("tab", { name: "Overridden" })).toBeInTheDocument();
    expect(filters.getByRole("tab", { name: "Under legal hold" })).toBeInTheDocument();
  });

  it("renders decision rows with headline and short hash", () => {
    renderPage();
    expect(screen.getByText("Denied claim CLM-40218 without human review")).toBeInTheDocument();
    expect(screen.getByTestId("ledger-row-88412")).toBeInTheDocument();
  });

  it("defaults to the ALL_DECISIONS view key", () => {
    renderPage();
    expect(mockDecisions).toHaveBeenCalledWith(expect.objectContaining({ viewKey: "ALL_DECISIONS" }));
  });

  it("forwards the matching view key when a filter is clicked", () => {
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "High consequence" }));
    expect(mockDecisions).toHaveBeenCalledWith(expect.objectContaining({ viewKey: "HIGH_CONSEQUENCE" }));

    fireEvent.click(screen.getByRole("tab", { name: "Under legal hold" }));
    expect(mockDecisions).toHaveBeenCalledWith(expect.objectContaining({ viewKey: "UNDER_LEGAL_HOLD" }));
  });

  it("marks the active filter tab as selected", () => {
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Acted alone" }));
    expect(screen.getByRole("tab", { name: "Acted alone" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "All decisions" })).toHaveAttribute("aria-selected", "false");
  });
});
