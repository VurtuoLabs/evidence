/**
 * DashboardPage - the Evidence overview.
 *
 * Deliberately its own shape, not Fleet's: a header strip with the range
 * control and a primary action, four KPI cards, a ranked bar chart beside a
 * "right now" autonomy card, a donut beside a real decisions table, then a
 * closing row of two standing-fact cards (legal holds, chain verification).
 * Every number still comes from the same facade the detail pages read
 * (useLedgerKpis, useAutonomyTrend, useAgentVolume, useOverrideReasons,
 * useChainStatus, useHolds) - the overview is a different arrangement of what
 * the console already knows, never a second source of truth.
 *
 * The persistent chain-integrity pill and the shell-wide break banner live in
 * the topbar and AppShell (CONTRACT §12.5) and are deliberately not
 * duplicated here - a break is unmissable already, and repeating it on the
 * dashboard would just be a second, staler copy of the same fact.
 *
 * The range switch runs inside a transition: re-slicing the trend and
 * re-deriving the path geometry is the expensive part of this page, and
 * without a transition the click would drop frames before the new curve
 * appeared.
 */
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Bot, Undo2, Link2, ArrowRight, Table2, Gavel, Scale, ShieldCheck } from "lucide-react";
import { INK, FONT, DISPLAY, MONO } from "@/features/shared/tokens";
import { Surface, StatCard, SegmentedControl, LegendDot } from "@/features/shared/surface";
import { AreaTrendChart } from "@/components/charts/AreaTrendChart";
import { Sparkline } from "@/components/charts/Sparkline";
import { DonutChart, DonutLegendRow } from "@/components/charts/DonutChart";
import { BarChart } from "@/components/charts/BarChart";
import { LoadingState, ErrorState, EmptyState, TonePill } from "@/features/shared/ui";
import { AUTONOMY_TONE, OUTCOME_TONE } from "@/features/shared/labels";
import { formatNumber, formatPercent, formatRelative } from "@/lib/format";
import { ROUTES } from "@/lib/constants";
import { useDashboardData, RANGE_OPTIONS, type RangeKey } from "./useDashboardData";

export default function DashboardPage() {
  const [range, setRange] = React.useState<RangeKey>("30d");
  const [isPending, startTransition] = React.useTransition();
  const [activeSlice, setActiveSlice] = React.useState<string | null>(null);
  const [activeReason, setActiveReason] = React.useState<string | null>(null);
  const navigate = useNavigate();

  const model = useDashboardData(range);

  const changeRange = (next: RangeKey) => startTransition(() => setRange(next));

  const autonomyDelta =
    model.series.autonomyPercent.length > 1
      ? Math.round(
          model.series.autonomyPercent[model.series.autonomyPercent.length - 1] -
            model.series.autonomyPercent[0],
        )
      : 0;

  const topReason = model.overrideReasons[0];
  const totalOverrides = model.overrideReasons.reduce((sum, r) => sum + r.count, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Header holds={model.holds.length} range={range} onChangeRange={changeRange} />

      {/* ------------------------------ KPI strip ------------------------------ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(232px, 1fr))", gap: 20 }}>
        <StatCard
          testId="stat-decisions"
          label="Decisions logged"
          value={model.loading ? "-" : formatNumber(model.kpis?.decisionsLogged ?? 0)}
          icon={FileText}
          color={INK.brand}
          caption="Last 30 days"
          onClick={() => navigate(ROUTES.ledger)}
        />
        <StatCard
          testId="stat-autonomy"
          label="Acted without a human"
          value={model.loading ? "-" : formatPercent((model.kpis?.autonomyPercent ?? 0) / 100)}
          icon={Bot}
          color={INK.violet}
          caption={`Trend over ${range}`}
          delta={{ value: autonomyDelta, goodWhenUp: true, suffix: "pt" }}
          spark={
            model.series.autonomyPercent.length > 1 ? (
              <Sparkline values={model.series.autonomyPercent} color={INK.violet} height={40} />
            ) : undefined
          }
          onClick={() => navigate(ROUTES.analysis)}
        />
        <StatCard
          testId="stat-override"
          label="Human override rate"
          value={model.loading ? "-" : formatPercent((model.kpis?.overrideRatePercent ?? 0) / 100, 1)}
          icon={Undo2}
          color={INK.warning}
          caption={
            model.kpis
              ? `${formatNumber(model.kpis.overrideNumerator)} of ${formatNumber(model.kpis.overrideDenominator)} reviewed`
              : undefined
          }
          onClick={() => navigate(ROUTES.analysis)}
        />
        <StatCard
          testId="stat-chain"
          label="Chain integrity"
          value={model.loading ? "-" : model.kpis?.chainVerified ? "Verified" : "Break"}
          icon={Link2}
          color={model.kpis?.chainVerified === false ? INK.error : INK.success}
          caption={
            model.kpis
              ? `${formatNumber(model.kpis.chainLinks)} links · ${formatRelative(model.kpis.chainVerifiedAt)}`
              : undefined
          }
          onClick={() => navigate(ROUTES.chain)}
        />
      </div>

      {/* -------------------------- Overrides + real-time autonomy ------------- */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 1.2fr)",
          gap: 20,
          alignItems: "start",
        }}
        className="evidence-dash-split"
      >
        <Surface data-testid="override-panel">
          <Surface.Header
            title="Where humans intervene"
            subtitle="Override reasons, ranked. The top one is where to fix the agent."
            right={<Gavel size={17} strokeWidth={2} color={INK.weakest} />}
          />
          <Surface.Body>
            {model.loading ? (
              <LoadingState label="Loading override reasons" />
            ) : model.overrideReasons.length === 0 ? (
              <EmptyState title="No human overrides recorded" hint="Every reviewed decision was accepted as the agent proposed it." />
            ) : (
              <>
                <div style={{ display: "flex", gap: 28, marginBottom: 14, flexWrap: "wrap" }}>
                  <SummaryFigure value={formatNumber(totalOverrides)} label="Overrides logged" color={INK.text} />
                  {topReason && (
                    <SummaryFigure
                      value={formatNumber(topReason.count)}
                      label={topReason.reason}
                      color={INK.warning}
                    />
                  )}
                </div>
                <BarChart
                  ariaLabel="Override reasons by frequency"
                  data={model.overrideReasons.slice(0, 6).map((r) => ({ key: r.reason, label: r.reason, value: r.count }))}
                  color={INK.warning}
                  activeKey={activeReason}
                  onHover={setActiveReason}
                  height={230}
                />
              </>
            )}
          </Surface.Body>
          <Surface.Footer>
            <FooterLink onClick={() => navigate(ROUTES.analysis)} label="Open analysis" />
          </Surface.Footer>
        </Surface>

        <Surface>
          <Surface.Header
            title="Autonomy in real time"
            subtitle="Share of decisions the fleet took with no human in the loop."
          />
          <Surface.Body>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
              <span style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 700, color: INK.text, letterSpacing: "-0.015em" }}>
                {model.loading ? "-" : formatPercent((model.kpis?.autonomyPercent ?? 0) / 100)}
              </span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: autonomyDelta >= 0 ? INK.success : INK.error,
                }}
              >
                {autonomyDelta >= 0 ? "+" : "−"}
                {Math.abs(autonomyDelta)}pt over {range}
              </span>
            </div>
            <div style={{ display: "flex", gap: 18, marginBottom: 6 }}>
              <LegendDot color={INK.violet} label="Acted without a human" />
            </div>
            <div style={{ opacity: isPending ? 0.55 : 1, transition: "opacity 140ms ease" }}>
              {model.loading ? (
                <LoadingState label="Loading autonomy trend" />
              ) : model.error ? (
                <ErrorState error={new Error("Could not load the autonomy trend.")} />
              ) : model.series.labels.length === 0 ? (
                <EmptyState title="No trend data yet" hint="Autonomy history appears once decisions accumulate." />
              ) : (
                <AreaTrendChart
                  labels={model.series.labels}
                  height={230}
                  ariaLabel="Autonomy percent over the selected window"
                  series={[
                    {
                      key: "autonomy",
                      label: "Acted without a human",
                      color: INK.violet,
                      values: model.series.autonomyPercent,
                      format: (v) => `${v.toFixed(1)}%`,
                    },
                  ]}
                  valueFormat={(v) => `${Math.round(v)}%`}
                />
              )}
            </div>
          </Surface.Body>
        </Surface>
      </div>

      {/* --------------------------- Agent share + ledger ----------------------- */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 1fr) minmax(0, 1.6fr)",
          gap: 20,
          alignItems: "start",
        }}
        className="evidence-dash-split"
      >
        <Surface>
          <Surface.Header title="Decision volume by agent" subtitle="Who is generating the ledger." />
          <Surface.Body>
            {model.loading ? (
              <LoadingState label="Loading agents" />
            ) : model.byAgent.length === 0 ? (
              <EmptyState title="No decisions recorded yet" />
            ) : (
              <>
                <DonutChart
                  slices={model.byAgent.map((a) => ({
                    key: a.agentApiName,
                    label: a.agentLabel,
                    value: a.count,
                    color: a.colorToken,
                  }))}
                  centerValue={formatNumber(model.totalByAgent)}
                  centerLabel="Total decisions"
                  activeKey={activeSlice}
                  onHover={setActiveSlice}
                />
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 2 }}>
                  {model.byAgent.slice(0, 5).map((a) => (
                    <DonutLegendRow
                      key={a.agentApiName}
                      slice={{ key: a.agentApiName, label: a.agentLabel, value: a.count, color: a.colorToken }}
                      meta={`${formatPercent(a.count / Math.max(1, model.totalByAgent))} of volume`}
                      value={formatNumber(a.count)}
                      active={activeSlice === a.agentApiName}
                      onHover={setActiveSlice}
                    />
                  ))}
                </div>
              </>
            )}
          </Surface.Body>
          <Surface.Footer>
            <FooterLink onClick={() => navigate(ROUTES.analysis)} label="Open analysis" />
          </Surface.Footer>
        </Surface>

        <RecentDecisionsTable model={model} />
      </div>

      {/* ------------------------------ Standing facts --------------------------- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
        <StatCard
          testId="stat-holds"
          label="Legal holds active"
          value={model.holds.length}
          icon={Scale}
          color={model.holds.length > 0 ? INK.warning : INK.weak}
          caption={model.holds.length > 0 ? model.holds.map((h) => h.matter).join(", ") : "None currently active"}
          onClick={() => navigate(ROUTES.holds)}
        />
        <StatCard
          testId="stat-chain-detail"
          label="Chain verification"
          value={model.kpis?.chainVerified === false ? "Break detected" : "All chains intact"}
          icon={ShieldCheck}
          color={model.kpis?.chainVerified === false ? INK.error : INK.success}
          caption={
            model.chainStatus
              ? `${formatNumber(model.chainStatus.chainCount)} chains · verified ${formatRelative(model.chainStatus.lastVerifiedAt)}`
              : model.kpis
                ? `${formatNumber(model.kpis.chainLinks)} links tracked`
                : undefined
          }
          onClick={() => navigate(ROUTES.chain)}
        />
      </div>
    </div>
  );
}

/* --------------------------------- header -------------------------------- */

function Header({
  holds,
  range,
  onChangeRange,
}: {
  holds: number;
  range: RangeKey;
  onChangeRange: (next: RangeKey) => void;
}) {
  const navigate = useNavigate();
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div>
        <h1
          style={{
            fontFamily: DISPLAY,
            fontSize: 24,
            fontWeight: 700,
            color: INK.text,
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          Dashboard
        </h1>
        <div style={{ fontFamily: FONT, fontSize: 13, color: INK.weak, marginTop: 5 }}>
          What exactly did each agent do, and why
          {holds > 0 ? ` - ${holds} legal hold${holds === 1 ? "" : "s"} currently active.` : "."}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={onChangeRange} ariaLabel="Trend window" />
        <button
          type="button"
          onClick={() => navigate(ROUTES.ledger)}
          style={{
            fontFamily: FONT,
            fontSize: 13,
            fontWeight: 600,
            color: "#fff",
            background: INK.brand,
            border: "none",
            borderRadius: 8,
            padding: "9px 16px",
            cursor: "pointer",
          }}
        >
          Open ledger
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ summary figure ---------------------------- */

function SummaryFigure({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div>
      <div style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 700, color, letterSpacing: "-0.01em" }}>{value}</div>
      <div
        style={{
          fontFamily: FONT,
          fontSize: 11.5,
          color: INK.weakest,
          marginTop: 2,
          maxWidth: 180,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
    </div>
  );
}

/* --------------------------------- footer link ---------------------------- */

function FooterLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        fontFamily: FONT,
        fontSize: 12.5,
        fontWeight: 600,
        color: INK.brand,
      }}
    >
      {label}
      <ArrowRight size={14} strokeWidth={2.2} />
    </button>
  );
}

/* ---------------------------- recent decisions table ----------------------- */

/** The "Top Channels"-shaped widget: a real table, not a card feed. */
function RecentDecisionsTable({ model }: { model: ReturnType<typeof useDashboardData> }) {
  const navigate = useNavigate();
  return (
    <Surface data-testid="recent-decisions-panel">
      <Surface.Header
        title="Recent decisions"
        subtitle="The newest links on the ledger, observed and declared."
        right={<Table2 size={17} strokeWidth={2} color={INK.weakest} />}
      />
      <Surface.Body pad={0} style={{ overflowX: "auto" }}>
        {model.loading ? (
          <div style={{ padding: 18 }}>
            <LoadingState label="Loading decisions" />
          </div>
        ) : model.recentDecisions.length === 0 ? (
          <div style={{ padding: 18 }}>
            <EmptyState title="No decisions recorded yet" />
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Agent", "Decision", "Outcome", "Autonomy", "Occurred"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      fontFamily: FONT,
                      fontSize: 11,
                      fontWeight: 600,
                      color: INK.weakest,
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                      padding: "10px 16px",
                      borderBottom: `1px solid ${INK.border}`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {model.recentDecisions.map((d) => {
                const au = AUTONOMY_TONE[d.autonomyLevel];
                const oc = OUTCOME_TONE[d.outcome];
                return (
                  <tr
                    key={d.id}
                    onClick={() => navigate(ROUTES.decision(d.id))}
                    style={{ cursor: "pointer" }}
                    onPointerEnter={(e) => (e.currentTarget.style.background = INK.page)}
                    onPointerLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "12px 16px", fontFamily: FONT, fontSize: 12.5, color: INK.brand, fontWeight: 500 }}>
                      {d.agentApiName}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        fontFamily: FONT,
                        fontSize: 12.5,
                        color: INK.text,
                        maxWidth: 320,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {d.headline}
                      {d.underLegalHold && (
                        <span style={{ marginLeft: 8 }}>
                          <TonePill tone={{ label: "Held", color: INK.warning }} />
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <TonePill tone={oc} />
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <TonePill tone={au} />
                    </td>
                    <td style={{ padding: "12px 16px", fontFamily: MONO, fontSize: 11.5, color: INK.weakest, whiteSpace: "nowrap" }}>
                      {formatRelative(d.occurredAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Surface.Body>
      <Surface.Footer>
        <FooterLink onClick={() => navigate(ROUTES.ledger)} label="Open the ledger" />
      </Surface.Footer>
    </Surface>
  );
}
