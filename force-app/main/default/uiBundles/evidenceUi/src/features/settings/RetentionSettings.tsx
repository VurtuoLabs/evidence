/**
 * /settings/retention - read-only view of `Evidence_Retention_Policy__mdt`
 * (§7). `Redact_Body_Keep_Hash` is the important strategy: it satisfies a
 * data-minimization obligation while preserving chain integrity, because the
 * hash of the original body stays in place even after the body is gone.
 */

import { useRetentionPolicies } from "@/hooks/useConfiguration";
import type { RetentionPolicyView } from "./types";
import { CONSEQUENCE_TONE } from "@/features/shared/labels";
import { INK } from "@/features/shared/tokens";
import { Card, CardHeader, ColumnHeader, Pill, QueryBoundary, TonePill } from "@/features/shared/ui";
import { ActivePill, ReadOnlyNote } from "./parts";
import { formatNumber } from "@/lib/format";

function PurgePill({ strategy }: { strategy: RetentionPolicyView["purgeStrategy"] }) {
  const keepsHash = strategy === "Redact_Body_Keep_Hash";
  return (
    <Pill color={keepsHash ? INK.warning : INK.error}>
      {keepsHash ? "Redact body, keep hash" : "Delete"}
    </Pill>
  );
}

export function RetentionSettings() {
  const q = useRetentionPolicies();
  return (
    <Card>
      <CardHeader
        title="Retention policies"
        subtitle="Redacting the body while keeping the hash lets a purged chain still verify as a chain."
      />
      <ReadOnlyNote />
      <QueryBoundary
        isLoading={q.isLoading}
        isError={q.isError}
        error={q.error}
        data={q.data}
        isEmpty={(rows) => rows.length === 0}
        empty={<div className="px-4 py-8 text-center" style={{ fontSize: 13, color: INK.weak }}>No retention policies configured.</div>}
      >
        {(rows) => (
          <>
            <div className="flex items-center gap-3 px-4 py-2" style={{ background: INK.page, borderBottom: `1px solid ${INK.border}` }}>
              <ColumnHeader style={{ width: 160 }}>Policy</ColumnHeader>
              <ColumnHeader style={{ width: 150 }}>Consequence</ColumnHeader>
              <ColumnHeader style={{ width: 120, textAlign: "right" }}>Retention</ColumnHeader>
              <ColumnHeader style={{ flex: 1 }}>Purge strategy</ColumnHeader>
              <ColumnHeader style={{ width: 90, textAlign: "right" }}>State</ColumnHeader>
            </div>
            {rows.map((p) => (
              <div
                key={p.policyKey}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: `1px solid ${INK.border}` }}
                data-testid={`retention-row-${p.policyKey}`}
              >
                <span style={{ fontSize: 13, color: INK.text, width: 160, fontWeight: 500 }}>{p.policyKey}</span>
                <span style={{ width: 150 }}>
                  <TonePill tone={CONSEQUENCE_TONE[p.consequenceLevel]} />
                </span>
                <span style={{ fontSize: 13, color: INK.text, width: 120, textAlign: "right" }}>
                  {formatNumber(p.retentionDays)} days
                </span>
                <span style={{ flex: 1 }}>
                  <PurgePill strategy={p.purgeStrategy} />
                </span>
                <span style={{ width: 90, textAlign: "right" }}>
                  <ActivePill active={p.active} />
                </span>
              </div>
            ))}
          </>
        )}
      </QueryBoundary>
    </Card>
  );
}

export default RetentionSettings;
