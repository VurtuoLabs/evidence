/**
 * /ledger - the filterable decision table (CONTRACT §12.3, mockup `Ledger`).
 *
 * Columns: When · Agent · Decision (headline) · autonomy · outcome · hash.
 * Filters mirror the seeded `Evidence_View__mdt` keys (§7): ALL_DECISIONS,
 * HIGH_CONSEQUENCE, ACTED_ALONE, OVERRIDDEN, UNDER_LEGAL_HOLD. A click sets the
 * active view key, which the ledger hook forwards to the facade as
 * `LedgerQuery.viewKey`; the Big Object index resolution lives in Apex.
 *
 * Rows are queryable index rows only. The full six-panel record opens at
 * /ledger/:decisionId, backed by `EvidenceLedgerService.getDecision` - the one
 * path allowed to touch `Decision_Ledger__b` bodies.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { useLedgerDecisions, useLedgerKpis } from "@/hooks/useLedger";
import { LEDGER_VIEWS, LEDGER_PAGE_SIZE, ROUTES } from "@/lib/constants";
import type { DecisionView, LedgerQuery } from "@/domain/types";
import { INK, MONO } from "@/features/shared/tokens";
import {
  Card,
  ColumnHeader,
  Mono,
  Pill,
  QueryBoundary,
} from "@/features/shared/ui";
import { AUTONOMY_TONE, OUTCOME_TONE } from "@/features/shared/labels";
import { formatDateTime, formatNumber, shortHash } from "@/lib/format";
import { KpiRow } from "./KpiRow";

/* --------------------------------- Row ----------------------------------- */

export function LedgerRow({ d }: { d: DecisionView }) {
  const oc = OUTCOME_TONE[d.outcome];
  const au = AUTONOMY_TONE[d.autonomyLevel];

  return (
    <Link
      to={ROUTES.decision(d.id)}
      data-testid={`ledger-row-${d.id}`}
      className="block w-full text-left px-4 py-3"
      style={{
        borderBottom: `1px solid ${INK.border}`,
        textDecoration: "none",
        color: "inherit",
        display: "block",
      }}
    >
      <div className="flex items-center gap-3">
        <span style={{ fontFamily: MONO, fontSize: 12, color: INK.weakest, width: 150, flexShrink: 0 }}>
          {formatDateTime(d.occurredAt)}
        </span>
        <span style={{ fontSize: 13, color: INK.brand, width: 130, flexShrink: 0 }}>{d.agentApiName}</span>
        <span style={{ fontSize: 13.5, fontWeight: 500, color: INK.text, flex: 1, minWidth: 0 }}>
          {d.headline}
        </span>
        {d.consequenceLevel === "High" && <Pill color={INK.error}>High consequence</Pill>}
        {d.underLegalHold && <Pill color={INK.warning}>Legal hold</Pill>}
        {d.overridden && <Pill color={INK.error}>Overridden</Pill>}
        <Pill color={au.color}>{au.label}</Pill>
        <Pill color={oc.color}>{oc.label}</Pill>
        <span
          style={{ fontFamily: MONO, fontSize: 11, color: INK.weakest, width: 72, textAlign: "right" }}
        >
          {shortHash(d.thisHash)}
        </span>
      </div>
    </Link>
  );
}

/* -------------------------------- Filters -------------------------------- */

function FilterBar({
  active,
  onChange,
  totalCount,
  shownCount,
}: {
  active: string;
  onChange: (viewKey: string) => void;
  totalCount: number;
  shownCount: number;
}) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-3"
      style={{ borderBottom: `1px solid ${INK.border}` }}
      role="tablist"
      aria-label="Ledger filters"
    >
      {LEDGER_VIEWS.map((v) => {
        const on = active === v.key;
        return (
          <button
            key={v.key}
            role="tab"
            aria-selected={on}
            data-view-key={v.key}
            onClick={() => onChange(v.key)}
            style={{
              fontSize: 12.5,
              fontWeight: on ? 600 : 400,
              padding: "5px 11px",
              borderRadius: 99,
              color: on ? "#fff" : INK.weak,
              background: on ? INK.brand : INK.page,
              border: `1px solid ${on ? INK.brand : INK.border}`,
              cursor: "pointer",
            }}
          >
            {v.label}
          </button>
        );
      })}
      <span className="ml-auto" style={{ fontSize: 12.5, color: INK.weakest }}>
        Showing {formatNumber(shownCount)} of {formatNumber(totalCount)}
      </span>
    </div>
  );
}

/* --------------------------------- Page ---------------------------------- */

export function LedgerPage() {
  const [viewKey, setViewKey] = useState<string>(LEDGER_VIEWS[0].key);

  const query: LedgerQuery = { viewKey, pageSize: LEDGER_PAGE_SIZE };
  const kpisQ = useLedgerKpis();
  const decisionsQ = useLedgerDecisions(query);

  return (
    <div className="flex flex-col gap-4">
      <QueryBoundary
        isLoading={kpisQ.isLoading}
        isError={kpisQ.isError}
        error={kpisQ.error}
        data={kpisQ.data}
      >
        {(kpis) => <KpiRow kpis={kpis} />}
      </QueryBoundary>

      <Card>
        <QueryBoundary
          isLoading={decisionsQ.isLoading}
          isError={decisionsQ.isError}
          error={decisionsQ.error}
          data={decisionsQ.data}
          isEmpty={(page) => page.items.length === 0}
          empty={
            <>
              <FilterBar active={viewKey} onChange={setViewKey} totalCount={0} shownCount={0} />
              <div className="px-4 py-12 text-center" style={{ fontSize: 13, color: INK.weak }}>
                The ledger holds no decisions matching this view.
              </div>
            </>
          }
        >
          {(page) => (
            <>
              <FilterBar
                active={viewKey}
                onChange={setViewKey}
                totalCount={page.totalCount}
                shownCount={page.items.length}
              />

              <div
                className="flex items-center gap-3 px-4 py-2"
                style={{ background: INK.page, borderBottom: `1px solid ${INK.border}` }}
              >
                <ColumnHeader style={{ width: 150 }}>When</ColumnHeader>
                <ColumnHeader style={{ width: 130 }}>Agent</ColumnHeader>
                <ColumnHeader style={{ flex: 1 }}>Decision</ColumnHeader>
                <ColumnHeader style={{ width: 72, textAlign: "right" }}>Hash</ColumnHeader>
              </div>

              <div role="table" aria-label="Decision ledger">
                {page.items.map((d) => (
                  <LedgerRow key={d.id} d={d} />
                ))}
              </div>

              {page.nextCursor && (
                <div className="px-4 py-3 flex items-center justify-center">
                  <Mono size={12}>More decisions available - refine a filter to narrow the range.</Mono>
                </div>
              )}
            </>
          )}
        </QueryBoundary>
      </Card>
    </div>
  );
}

export default LedgerPage;
