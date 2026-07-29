/**
 * /bundles - sealed evidence exports (CONTRACT §12.3, mockup `Bundles`).
 *
 * A sealed bundle includes every relevant decision, its chain segment, and the
 * daily anchor that proves the segment existed in that state. Assembly is gated
 * on `Evidence_Assemble_Bundle`; the button is a UX hint only, Apex re-checks.
 */

import { Link } from "react-router-dom";
import { useBundles } from "@/hooks/useBundles";
import { usePermission } from "@/hooks/usePermissions";
import { PERMISSIONS, ROUTES } from "@/lib/constants";
import type { BundleView } from "@/domain/types";
import { INK, MONO } from "@/features/shared/tokens";
import { Btn, Card, CardHeader, ColumnHeader, QueryBoundary, TonePill } from "@/features/shared/ui";
import { BUNDLE_STATE_TONE } from "@/features/shared/labels";
import { formatDate, formatNumber } from "@/lib/format";

function rangeLabel(b: BundleView): string {
  if (!b.rangeStart && !b.rangeEnd) return "All time";
  return `${b.rangeStart ? formatDate(b.rangeStart) : "…"} – ${b.rangeEnd ? formatDate(b.rangeEnd) : "…"}`;
}

function BundleRow({ b }: { b: BundleView }) {
  return (
    <Link
      to={ROUTES.bundle(b.id)}
      data-testid={`bundle-row-${b.id}`}
      className="flex items-center gap-3 px-4 py-3"
      style={{ borderBottom: `1px solid ${INK.border}`, textDecoration: "none", color: "inherit" }}
    >
      <span style={{ fontFamily: MONO, fontSize: 12, color: INK.brand, width: 74 }}>{b.bundleNumber}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: INK.text, fontWeight: 500 }}>{b.matter}</div>
        <div style={{ fontSize: 12, color: INK.weakest, marginTop: 2 }}>
          {b.sealedBy ?? "-"}
          {b.sealedAt ? ` · ${formatDate(b.sealedAt)}` : ""}
        </div>
      </div>
      <span style={{ fontSize: 12.5, color: INK.weak, width: 180 }}>{rangeLabel(b)}</span>
      <span style={{ fontFamily: MONO, fontSize: 12.5, color: INK.text, width: 80, textAlign: "right" }}>
        {formatNumber(b.decisionCount)}
      </span>
      <span style={{ width: 90, textAlign: "right" }}>
        <TonePill tone={BUNDLE_STATE_TONE[b.state]} />
      </span>
    </Link>
  );
}

export function BundlesPage() {
  const q = useBundles();
  const canAssemble = usePermission(PERMISSIONS.assembleBundle);

  return (
    <Card>
      <CardHeader
        title="Evidence bundles"
        subtitle="A sealed bundle includes every relevant decision, its chain segment, and the daily anchor that proves the segment existed in that state."
        right={canAssemble ? <Btn variant="brand">Assemble bundle</Btn> : undefined}
      />
      <QueryBoundary
        isLoading={q.isLoading}
        isError={q.isError}
        error={q.error}
        data={q.data}
        isEmpty={(rows) => rows.length === 0}
        empty={
          <div className="px-4 py-12 text-center" style={{ fontSize: 13, color: INK.weak }}>
            No bundles yet. Assemble one from a matter and a date range.
          </div>
        }
      >
        {(rows) => (
          <>
            <div
              className="flex items-center gap-3 px-4 py-2"
              style={{ background: INK.page, borderBottom: `1px solid ${INK.border}` }}
            >
              <ColumnHeader style={{ width: 74 }}>Bundle</ColumnHeader>
              <ColumnHeader style={{ flex: 1 }}>Matter</ColumnHeader>
              <ColumnHeader style={{ width: 180 }}>Range</ColumnHeader>
              <ColumnHeader style={{ width: 80, textAlign: "right" }}>Decisions</ColumnHeader>
              <ColumnHeader style={{ width: 90, textAlign: "right" }}>State</ColumnHeader>
            </div>
            {rows.map((b) => (
              <BundleRow key={b.id} b={b} />
            ))}
          </>
        )}
      </QueryBoundary>
    </Card>
  );
}

export default BundlesPage;
