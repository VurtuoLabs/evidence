/**
 * /settings/redaction - read-only view of `Evidence_Redaction_Rule__mdt` (§7).
 * Bundles going to outside counsel need a different redaction profile from the
 * internal console view; both are configuration, and a rule may apply to the
 * export, the console, or both.
 */

import { useRedactionRules } from "@/hooks/useConfiguration";
import type { RedactionRuleView } from "./types";
import { INK, MONO } from "@/features/shared/tokens";
import { Card, CardHeader, ColumnHeader, Pill, QueryBoundary } from "@/features/shared/ui";
import { ActivePill, BoolCell, ReadOnlyNote } from "./parts";

const STRATEGY_COLOR: Record<RedactionRuleView["strategy"], string> = {
  Mask: INK.warning,
  Hash: INK.brand,
  Remove: INK.error,
  Tokenize: INK.violet,
};

export function RedactionSettings() {
  const q = useRedactionRules();
  return (
    <Card>
      <CardHeader
        title="Redaction rules"
        subtitle="Per profile and field path. Console and export can redact differently."
      />
      <ReadOnlyNote />
      <QueryBoundary
        isLoading={q.isLoading}
        isError={q.isError}
        error={q.error}
        data={q.data}
        isEmpty={(rows) => rows.length === 0}
        empty={<div className="px-4 py-8 text-center" style={{ fontSize: 13, color: INK.weak }}>No redaction rules configured.</div>}
      >
        {(rows) => (
          <>
            <div className="flex items-center gap-3 px-4 py-2" style={{ background: INK.page, borderBottom: `1px solid ${INK.border}` }}>
              <ColumnHeader style={{ width: 150 }}>Profile</ColumnHeader>
              <ColumnHeader style={{ flex: 1 }}>Field path</ColumnHeader>
              <ColumnHeader style={{ width: 100 }}>Strategy</ColumnHeader>
              <ColumnHeader style={{ width: 90 }}>Console</ColumnHeader>
              <ColumnHeader style={{ width: 90 }}>Export</ColumnHeader>
              <ColumnHeader style={{ width: 90, textAlign: "right" }}>State</ColumnHeader>
            </div>
            {rows.map((r) => (
              <div
                key={r.ruleKey}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: `1px solid ${INK.border}` }}
                data-testid={`redaction-row-${r.ruleKey}`}
              >
                <span style={{ fontSize: 13, color: INK.text, width: 150, fontWeight: 500 }}>{r.profile}</span>
                <span style={{ fontFamily: MONO, fontSize: 12.5, color: INK.text, flex: 1, minWidth: 0 }}>
                  {r.fieldPath}
                </span>
                <span style={{ width: 100 }}>
                  <Pill color={STRATEGY_COLOR[r.strategy]}>{r.strategy}</Pill>
                </span>
                <span style={{ width: 90 }}>
                  <BoolCell value={r.appliesToConsole} on="Applies" off="-" />
                </span>
                <span style={{ width: 90 }}>
                  <BoolCell value={r.appliesToExport} on="Applies" off="-" />
                </span>
                <span style={{ width: 90, textAlign: "right" }}>
                  <ActivePill active={r.active} />
                </span>
              </div>
            ))}
          </>
        )}
      </QueryBoundary>
    </Card>
  );
}

export default RedactionSettings;
