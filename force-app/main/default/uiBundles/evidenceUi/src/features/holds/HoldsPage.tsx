/**
 * /holds - legal holds that suspend purge for a matter (CONTRACT §4, §12.3).
 *
 * A hold blocks retention deletion for exactly its scoped decisions and nothing
 * more; the live scoped count is what the custodian watches. Issuing/releasing
 * a hold is gated on `Evidence_Manage_Legal_Hold`.
 */

import { useHolds } from "@/hooks/useHolds";
import { usePermission } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants";
import type { LegalHoldView } from "@/domain/types";
import { INK } from "@/features/shared/tokens";
import { Btn, Card, CardHeader, ColumnHeader, Mono, Pill, QueryBoundary } from "@/features/shared/ui";
import { formatDate, formatNumber } from "@/lib/format";

function HoldRow({ h, canManage }: { h: LegalHoldView; canManage: boolean }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{ borderBottom: `1px solid ${INK.border}` }}
      data-testid={`hold-row-${h.id}`}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: INK.text, fontWeight: 500 }}>{h.matter}</div>
        <div style={{ fontSize: 12, color: INK.weakest, marginTop: 2 }}>
          Issued by {h.issuedBy} · from {formatDate(h.effectiveFrom)}
          {h.releasedAt ? ` · released ${formatDate(h.releasedAt)}` : ""}
        </div>
      </div>
      <span style={{ width: 130, textAlign: "right" }}>
        <Mono size={12.5} color={INK.text}>
          {formatNumber(h.scopedDecisionCount)}
        </Mono>
        <div style={{ fontSize: 10.5, color: INK.weakest }}>held from purge</div>
      </span>
      <span style={{ width: 90, textAlign: "right" }}>
        <Pill color={h.active ? INK.warning : INK.weakest}>{h.active ? "Active" : "Released"}</Pill>
      </span>
      {canManage && (
        <span style={{ width: 90, textAlign: "right" }}>
          {h.active ? <Btn variant="neutral">Release</Btn> : <span style={{ fontSize: 12, color: INK.weakest }}> - </span>}
        </span>
      )}
    </div>
  );
}

export function HoldsPage() {
  const q = useHolds();
  const canManage = usePermission(PERMISSIONS.manageLegalHold);

  return (
    <Card>
      <CardHeader
        title="Legal holds"
        subtitle="A hold suspends retention purge for exactly its scoped decisions. Existence of a hold is not sensitive; its scope is."
        right={canManage ? <Btn variant="brand">Issue hold</Btn> : undefined}
      />
      <QueryBoundary
        isLoading={q.isLoading}
        isError={q.isError}
        error={q.error}
        data={q.data}
        isEmpty={(rows) => rows.length === 0}
        empty={
          <div className="px-4 py-12 text-center" style={{ fontSize: 13, color: INK.weak }}>
            No legal holds. Nothing is currently exempt from retention purge.
          </div>
        }
      >
        {(rows) => (
          <>
            <div
              className="flex items-center gap-3 px-4 py-2"
              style={{ background: INK.page, borderBottom: `1px solid ${INK.border}` }}
            >
              <ColumnHeader style={{ flex: 1 }}>Matter</ColumnHeader>
              <ColumnHeader style={{ width: 130, textAlign: "right" }}>Scope</ColumnHeader>
              <ColumnHeader style={{ width: 90, textAlign: "right" }}>Status</ColumnHeader>
              {canManage && <ColumnHeader style={{ width: 90, textAlign: "right" }} />}
            </div>
            {rows.map((h) => (
              <HoldRow key={h.id} h={h} canManage={canManage} />
            ))}
          </>
        )}
      </QueryBoundary>
    </Card>
  );
}

export default HoldsPage;
