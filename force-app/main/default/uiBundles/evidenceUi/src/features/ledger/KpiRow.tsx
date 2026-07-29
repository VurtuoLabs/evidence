/**
 * The four header KPIs (CONTRACT §12.5, mockup `Kpis`). Numerals render in the
 * serif display face so the console reads as a record artifact. Chain integrity
 * is a first-class KPI, not a footnote.
 */

import { DISPLAY, INK } from "@/features/shared/tokens";
import { Card } from "@/features/shared/ui";
import { formatNumber, formatPercent, formatRelative } from "@/lib/format";
import type { LedgerKpis } from "@/domain/types";

function Kpi({
  label,
  value,
  sub,
  tint,
}: {
  label: string;
  value: string;
  sub: string;
  tint: string;
}) {
  return (
    <Card className="px-4 py-3">
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: INK.weakest,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: DISPLAY,
          fontSize: 32,
          fontWeight: 600,
          color: tint,
          lineHeight: 1.15,
          marginTop: 6,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: INK.weak, marginTop: 3 }}>{sub}</div>
    </Card>
  );
}

export function KpiRow({ kpis }: { kpis: LedgerKpis }) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <Kpi
        label="Decisions logged"
        value={formatNumber(kpis.decisionsLogged)}
        sub="Last 30 days"
        tint={INK.text}
      />
      <Kpi
        label="Acted without a human"
        value={formatPercent(kpis.autonomyPercent / 100)}
        sub="Share taken with no human in the loop"
        tint={INK.violet}
      />
      <Kpi
        label="Human override rate"
        value={formatPercent(kpis.overrideRatePercent / 100, 1)}
        sub={`${formatNumber(kpis.overrideNumerator)} of ${formatNumber(kpis.overrideDenominator)} reviewed`}
        tint={INK.warning}
      />
      <Kpi
        label="Chain integrity"
        value={kpis.chainVerified ? "Verified" : "Break detected"}
        sub={`${formatNumber(kpis.chainLinks)} links · ${formatRelative(kpis.chainVerifiedAt)}`}
        tint={kpis.chainVerified ? INK.success : INK.error}
      />
    </div>
  );
}
