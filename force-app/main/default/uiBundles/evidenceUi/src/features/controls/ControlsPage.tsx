/**
 * /controls - the regulatory control mapping (CONTRACT §7 Evidence_Control_
 * Mapping__mdt, §12.3, §15 phase 5). The mapping is data, not code: seeded with
 * EU AI Act Art. 12/14, SR 11-7, SOC 2 CC7, HIPAA disclosure accounting, and
 * GDPR Art. 22. Each row shows how many ledger decisions currently satisfy it.
 */

import { useControls } from "@/hooks/useControls";
import type { ControlMappingView } from "@/domain/types";
import { INK, MONO } from "@/features/shared/tokens";
import { Card, CardHeader, ColumnHeader, Mono, Pill, QueryBoundary } from "@/features/shared/ui";
import { formatNumber } from "@/lib/format";

function groupByFramework(rows: ControlMappingView[]): [string, ControlMappingView[]][] {
  const map = new Map<string, ControlMappingView[]>();
  for (const r of rows) {
    const list = map.get(r.framework) ?? [];
    list.push(r);
    map.set(r.framework, list);
  }
  return [...map.entries()];
}

export function ControlsPage() {
  const q = useControls();

  return (
    <Card>
      <CardHeader
        title="Control mapping"
        subtitle="Each control is data, not code. Add a framework you need by adding a record - the ledger is the evidence."
      />
      <QueryBoundary
        isLoading={q.isLoading}
        isError={q.isError}
        error={q.error}
        data={q.data}
        isEmpty={(rows) => rows.length === 0}
        empty={
          <div className="px-4 py-12 text-center" style={{ fontSize: 13, color: INK.weak }}>
            No control mappings configured.
          </div>
        }
      >
        {(rows) => (
          <>
            <div
              className="flex items-center gap-3 px-4 py-2"
              style={{ background: INK.page, borderBottom: `1px solid ${INK.border}` }}
            >
              <ColumnHeader style={{ width: 120 }}>Reference</ColumnHeader>
              <ColumnHeader style={{ flex: 1 }}>Control</ColumnHeader>
              <ColumnHeader style={{ width: 220 }}>Satisfied by</ColumnHeader>
              <ColumnHeader style={{ width: 90, textAlign: "right" }}>Evidence</ColumnHeader>
            </div>

            {groupByFramework(rows).map(([framework, controls]) => (
              <div key={framework}>
                <div
                  className="px-4 py-2"
                  style={{
                    background: `${INK.brand}0A`,
                    borderBottom: `1px solid ${INK.border}`,
                    fontSize: 12,
                    fontWeight: 600,
                    color: INK.brand,
                  }}
                >
                  {framework}
                </div>
                {controls.map((c) => (
                  <div
                    key={c.controlKey}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ borderBottom: `1px solid ${INK.border}` }}
                    data-testid={`control-row-${c.controlKey}`}
                  >
                    <span style={{ fontFamily: MONO, fontSize: 12, color: INK.text, width: 120 }}>
                      {c.controlReference}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, color: INK.text, fontWeight: 500 }}>{c.controlLabel}</div>
                      {!c.active && (
                        <span style={{ fontSize: 11.5, color: INK.weakest }}>Inactive</span>
                      )}
                    </div>
                    <span style={{ fontSize: 12.5, color: INK.weak, width: 220 }}>{c.satisfiedBy}</span>
                    <span style={{ width: 90, textAlign: "right" }}>
                      {c.evidenceCount > 0 ? (
                        <Pill color={INK.success} mono>
                          {formatNumber(c.evidenceCount)}
                        </Pill>
                      ) : (
                        <Mono size={12} color={INK.weakest}>
                          0
                        </Mono>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </QueryBoundary>
    </Card>
  );
}

export default ControlsPage;
