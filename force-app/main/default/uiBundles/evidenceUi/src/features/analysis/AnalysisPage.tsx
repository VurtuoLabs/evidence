/**
 * /analysis - the three risk-officer questions (CONTRACT §12.3, §15 phase 5,
 * mockup `Analysis`):
 *   1. How autonomous are these agents, over time?
 *   2. Which agents decide the most?
 *   3. When a human overrode, why?
 *
 * Charts are recharts (CONTRACT §12.6) on the Evidence palette; violet leads
 * because autonomy is the signature metric. Rising autonomy without a rising
 * override rate is the pattern the copy calls out.
 */

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  useAgentVolume,
  useAutonomyTrend,
  useOverrideReasons,
} from "@/hooks/useAnalysis";
import { INK, MONO } from "@/features/shared/tokens";
import { Card, CardHeader, QueryBoundary } from "@/features/shared/ui";
import { formatDate, formatNumber } from "@/lib/format";
import type { AgentVolume, AutonomyTrendPoint, OverrideReason } from "@/domain/types";

const AXIS = { fontFamily: MONO, fontSize: 10, fill: INK.weakest };

/* ---------------------------- Autonomy over time -------------------------- */

function AutonomyTrend({ points }: { points: AutonomyTrendPoint[] }) {
  return (
    <Card>
      <CardHeader
        title="How autonomous are these agents"
        subtitle="Share of decisions taken with no human in the loop, last 30 days. Rising autonomy without a rising override rate is the pattern you want."
      />
      <div className="px-2 py-3" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="autonomyFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={INK.violet} stopOpacity={0.18} />
                <stop offset="100%" stopColor={INK.violet} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={AXIS}
              tickLine={false}
              axisLine={{ stroke: INK.border }}
              tickFormatter={(value) => formatDate(String(value))}
              minTickGap={48}
            />
            <YAxis
              domain={[60, 100]}
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              width={34}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              formatter={(value) => [`${value}%`, "Autonomy"]}
              labelFormatter={(label) => formatDate(String(label))}
              contentStyle={{ borderRadius: 4, border: `1px solid ${INK.border}`, fontSize: 12 }}
            />
            <Area
              type="monotone"
              dataKey="autonomyPercent"
              stroke={INK.violet}
              strokeWidth={2.5}
              fill="url(#autonomyFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* ----------------------------- Decisions by agent ------------------------- */

function AgentVolumeChart({ rows }: { rows: AgentVolume[] }) {
  const data = [...rows].sort((a, b) => b.count - a.count);
  return (
    <Card>
      <CardHeader title="Decisions by agent" subtitle="Last 30 days" />
      <div className="px-2 py-3" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
            <XAxis
              type="number"
              tick={AXIS}
              tickLine={false}
              axisLine={{ stroke: INK.border }}
              tickFormatter={(value) => formatNumber(Number(value))}
            />
            <YAxis
              type="category"
              dataKey="agentLabel"
              tick={{ ...AXIS, fontFamily: undefined, fontSize: 12, fill: INK.text }}
              tickLine={false}
              axisLine={false}
              width={110}
            />
            <Tooltip
              formatter={(value) => [formatNumber(Number(value)), "Decisions"]}
              contentStyle={{ borderRadius: 4, border: `1px solid ${INK.border}`, fontSize: 12 }}
            />
            <Bar dataKey="count" radius={[0, 3, 3, 0]} barSize={14}>
              {data.map((r) => (
                <Cell key={r.agentApiName} fill={r.colorToken} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* ------------------------------ Why humans overrode ----------------------- */

function OverrideReasons({ rows }: { rows: OverrideReason[] }) {
  const data = [...rows].sort((a, b) => b.count - a.count);
  const total = data.reduce((s, r) => s + r.count, 0);
  const top = data[0];
  return (
    <Card>
      <CardHeader
        title="Why humans overrode"
        subtitle={`${formatNumber(total)} overrides. The top reason is where to fix the agent.`}
      />
      <div className="px-2 py-3" style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
            <XAxis type="number" tick={AXIS} tickLine={false} axisLine={{ stroke: INK.border }} />
            <YAxis
              type="category"
              dataKey="reason"
              tick={{ fontSize: 12, fill: INK.text }}
              tickLine={false}
              axisLine={false}
              width={180}
            />
            <Tooltip
              formatter={(value) => [formatNumber(Number(value)), "Overrides"]}
              contentStyle={{ borderRadius: 4, border: `1px solid ${INK.border}`, fontSize: 12 }}
            />
            <Bar dataKey="count" radius={[0, 3, 3, 0]} barSize={14} fill={INK.warning} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {top && total > 0 && (
        <div
          className="px-4 py-3"
          style={{ fontSize: 12.5, color: INK.weak, lineHeight: 1.55, borderTop: `1px solid ${INK.border}` }}
        >
          {`"${top.reason}" accounts for ${Math.round((top.count / total) * 100)} percent of overrides - a prompt or grounding fix, not a training issue.`}
        </div>
      )}
    </Card>
  );
}

/* --------------------------------- Page ---------------------------------- */

export function AnalysisPage() {
  const trendQ = useAutonomyTrend();
  const agentQ = useAgentVolume();
  const overrideQ = useOverrideReasons();

  return (
    <div className="flex flex-col gap-4">
      <QueryBoundary isLoading={trendQ.isLoading} isError={trendQ.isError} error={trendQ.error} data={trendQ.data}>
        {(points) => <AutonomyTrend points={points} />}
      </QueryBoundary>

      <div className="grid grid-cols-2 gap-4">
        <QueryBoundary isLoading={agentQ.isLoading} isError={agentQ.isError} error={agentQ.error} data={agentQ.data}>
          {(rows) => <AgentVolumeChart rows={rows} />}
        </QueryBoundary>
        <QueryBoundary
          isLoading={overrideQ.isLoading}
          isError={overrideQ.isError}
          error={overrideQ.error}
          data={overrideQ.data}
        >
          {(rows) => <OverrideReasons rows={rows} />}
        </QueryBoundary>
      </div>
    </div>
  );
}

export default AnalysisPage;
