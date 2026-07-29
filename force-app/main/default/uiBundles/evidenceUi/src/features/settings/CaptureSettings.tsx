/**
 * /settings/capture - read-only view of `Evidence_Capture_Policy__mdt` (§7).
 * Lets a customer see "record everything for Claims Triage, decisions only for
 * Billing." Capture volume is a cost, controlled per agent.
 */

import { useCapturePolicies } from "@/hooks/useConfiguration";
import type { CapturePolicyView } from "./types";
import { INK } from "@/features/shared/tokens";
import { Card, CardHeader, ColumnHeader, QueryBoundary } from "@/features/shared/ui";
import { ActivePill, BoolCell, ReadOnlyNote } from "./parts";

function Row({ p }: { p: CapturePolicyView }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{ borderBottom: `1px solid ${INK.border}` }}
      data-testid={`capture-row-${p.policyKey}`}
    >
      <span style={{ fontSize: 13, color: INK.text, width: 150, fontWeight: 500 }}>{p.policyKey}</span>
      <span style={{ fontSize: 12.5, color: INK.weak, width: 140 }}>{p.agentApiName ?? "All agents"}</span>
      <span style={{ fontSize: 12.5, color: INK.weak, width: 90 }}>{p.consequenceLevel ?? "Any"}</span>
      <span className="flex items-center gap-1" style={{ flex: 1 }}>
        <BoolCell value={p.captureUtterance} on="Utterance" off="-" />
        <BoolCell value={p.captureResponse} on="Response" off="-" />
        <BoolCell value={p.captureGrounding} on="Grounding" off="-" />
        <BoolCell value={p.captureConsiderations} on="Considered" off="-" />
        <BoolCell value={p.captureVariables} on="Variables" off="-" />
      </span>
      <span style={{ width: 90 }}>
        <BoolCell value={p.requireRationale} on="Rationale" off="Optional" />
      </span>
      <span style={{ width: 90, textAlign: "right" }}>
        <ActivePill active={p.active} />
      </span>
    </div>
  );
}

export function CaptureSettings() {
  const q = useCapturePolicies();
  return (
    <Card>
      <CardHeader title="Capture policies" subtitle="What Evidence records, per agent and consequence level." />
      <ReadOnlyNote />
      <QueryBoundary
        isLoading={q.isLoading}
        isError={q.isError}
        error={q.error}
        data={q.data}
        isEmpty={(rows) => rows.length === 0}
        empty={<div className="px-4 py-8 text-center" style={{ fontSize: 13, color: INK.weak }}>No capture policies configured.</div>}
      >
        {(rows) => (
          <>
            <div className="flex items-center gap-3 px-4 py-2" style={{ background: INK.page, borderBottom: `1px solid ${INK.border}` }}>
              <ColumnHeader style={{ width: 150 }}>Policy</ColumnHeader>
              <ColumnHeader style={{ width: 140 }}>Agent</ColumnHeader>
              <ColumnHeader style={{ width: 90 }}>Consequence</ColumnHeader>
              <ColumnHeader style={{ flex: 1 }}>Captures</ColumnHeader>
              <ColumnHeader style={{ width: 90 }}>Rationale</ColumnHeader>
              <ColumnHeader style={{ width: 90, textAlign: "right" }}>State</ColumnHeader>
            </div>
            {rows.map((p) => (
              <Row key={p.policyKey} p={p} />
            ))}
          </>
        )}
      </QueryBoundary>
    </Card>
  );
}

export default CaptureSettings;
