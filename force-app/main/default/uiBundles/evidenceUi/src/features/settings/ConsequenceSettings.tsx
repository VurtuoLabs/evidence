/**
 * /settings/consequence - read-only view of `Evidence_Consequence_Rule__mdt`
 * (§7). How an admin declares what "high consequence" means in their business
 * without a code change, evaluated in priority order.
 */

import { useConsequenceRules } from "@/hooks/useConfiguration";
import type { ConsequenceRuleView } from "./types";
import { CONSEQUENCE_TONE } from "@/features/shared/labels";
import { INK, MONO } from "@/features/shared/tokens";
import { Card, CardHeader, ColumnHeader, Mono, QueryBoundary, TonePill } from "@/features/shared/ui";
import { ActivePill, ReadOnlyNote } from "./parts";

const STRATEGY_LABEL: Record<ConsequenceRuleView["matchStrategy"], string> = {
  Action_Name: "Action name",
  Object_Written: "Object written",
  Amount_Threshold: "Amount threshold",
  Policy_Blocked: "Policy blocked",
};

export function ConsequenceSettings() {
  const q = useConsequenceRules();
  return (
    <Card>
      <CardHeader
        title="Consequence rules"
        subtitle="Evaluated in priority order. The first matching rule sets a decision's consequence level."
      />
      <ReadOnlyNote />
      <QueryBoundary
        isLoading={q.isLoading}
        isError={q.isError}
        error={q.error}
        data={q.data}
        isEmpty={(rows) => rows.length === 0}
        empty={<div className="px-4 py-8 text-center" style={{ fontSize: 13, color: INK.weak }}>No consequence rules configured.</div>}
      >
        {(rows) => {
          const sorted = [...rows].sort((a, b) => a.priority - b.priority);
          return (
            <>
              <div className="flex items-center gap-3 px-4 py-2" style={{ background: INK.page, borderBottom: `1px solid ${INK.border}` }}>
                <ColumnHeader style={{ width: 60, textAlign: "right" }}>Priority</ColumnHeader>
                <ColumnHeader style={{ width: 160 }}>Match strategy</ColumnHeader>
                <ColumnHeader style={{ flex: 1 }}>Match value</ColumnHeader>
                <ColumnHeader style={{ width: 150 }}>Consequence</ColumnHeader>
                <ColumnHeader style={{ width: 90, textAlign: "right" }}>State</ColumnHeader>
              </div>
              {sorted.map((r) => (
                <div
                  key={r.ruleKey}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: `1px solid ${INK.border}` }}
                  data-testid={`consequence-row-${r.ruleKey}`}
                >
                  <span style={{ width: 60, textAlign: "right" }}>
                    <Mono size={12} color={INK.weak}>
                      {r.priority}
                    </Mono>
                  </span>
                  <span style={{ fontSize: 13, color: INK.text, width: 160 }}>{STRATEGY_LABEL[r.matchStrategy]}</span>
                  <span style={{ fontFamily: MONO, fontSize: 12.5, color: INK.text, flex: 1, minWidth: 0 }}>
                    {r.matchValue}
                  </span>
                  <span style={{ width: 150 }}>
                    <TonePill tone={CONSEQUENCE_TONE[r.consequenceLevel]} />
                  </span>
                  <span style={{ width: 90, textAlign: "right" }}>
                    <ActivePill active={r.active} />
                  </span>
                </div>
              ))}
            </>
          );
        }}
      </QueryBoundary>
    </Card>
  );
}

export default ConsequenceSettings;
