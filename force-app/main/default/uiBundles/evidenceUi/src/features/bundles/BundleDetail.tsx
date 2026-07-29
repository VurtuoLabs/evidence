/**
 * /bundles/:bundleId - one bundle, its chain proof, and the decisions it holds.
 *
 * The chain proof (segment root hash + anchor reference) is what a customer
 * hands an auditor. Sealing is gated on `Evidence_Seal_Bundle`; export applies
 * the bundle's redaction profile. Both are UX hints - Apex re-checks (§8).
 */

import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useBundle } from "@/hooks/useBundles";
import { usePermission } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants";
import type { BundleDetailView } from "@/domain/types";
import { DISPLAY, INK, R } from "@/features/shared/tokens";
import {
  Btn,
  Card,
  ColumnHeader,
  Mono,
  Pill,
  QueryBoundary,
  TonePill,
} from "@/features/shared/ui";
import { BUNDLE_STATE_TONE } from "@/features/shared/labels";
import { formatDate, formatDateTime, formatNumber, shortHash } from "@/lib/format";
import { LedgerRow } from "@/features/ledger/LedgerPage";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: INK.weakest,
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, color: INK.text }}>{children}</div>
    </div>
  );
}

function ChainProof({ b }: { b: BundleDetailView }) {
  const sealed = b.state === "Sealed" || b.state === "Delivered";
  return (
    <div
      style={{
        background: sealed ? `${INK.success}0F` : INK.page,
        border: `1px solid ${sealed ? `${INK.success}59` : INK.border}`,
        borderRadius: R,
        padding: 14,
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span style={{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 600, color: INK.text }}>
          Chain proof
        </span>
        {sealed ? (
          <Pill color={INK.success}>Verified segment</Pill>
        ) : (
          <Pill color={INK.weak}>Not yet sealed</Pill>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Segment root hash">
          <Mono size={12.5} color={INK.text}>
            {b.segmentRootHash ? shortHash(b.segmentRootHash, 16) : "-"}
          </Mono>
        </Field>
        <Field label="Daily anchor">
          <Mono size={12.5} color={INK.text}>
            {b.anchorReference ? shortHash(b.anchorReference, 16) : "-"}
          </Mono>
        </Field>
        <Field label="Sealed">
          {b.sealedAt ? `${formatDateTime(b.sealedAt)}${b.sealedBy ? ` · ${b.sealedBy}` : ""}` : "-"}
        </Field>
        <Field label="Redaction profile">{b.redactionProfile ?? "None"}</Field>
      </div>
    </div>
  );
}

export function BundleDetail({ bundleId: propId }: { bundleId?: string }) {
  const params = useParams<{ bundleId: string }>();
  const bundleId = propId ?? params.bundleId ?? "";
  const q = useBundle(bundleId);
  const canSeal = usePermission(PERMISSIONS.sealBundle);

  return (
    <QueryBoundary isLoading={q.isLoading} isError={q.isError} error={q.error} data={q.data}>
      {(b) => (
        <div className="flex flex-col gap-4">
          <Card>
            <div
              className="flex items-start justify-between px-4 py-3"
              style={{ borderBottom: `1px solid ${INK.border}` }}
            >
              <div style={{ minWidth: 0 }}>
                <div className="flex items-center gap-2">
                  <Mono size={12} color={INK.brand}>
                    {b.bundleNumber}
                  </Mono>
                  <TonePill tone={BUNDLE_STATE_TONE[b.state]} />
                </div>
                <h1 style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 600, margin: "6px 0 0", color: INK.text }}>
                  {b.matter}
                </h1>
                {b.purpose && (
                  <p style={{ fontSize: 12.5, color: INK.weak, margin: "3px 0 0" }}>{b.purpose}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {canSeal && b.state === "Draft" && <Btn variant="brand">Seal bundle</Btn>}
                <Btn variant="neutral">Export</Btn>
              </div>
            </div>

            <div className="p-4 flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-4">
                <Field label="Range">
                  {b.rangeStart || b.rangeEnd
                    ? `${b.rangeStart ? formatDate(b.rangeStart) : "…"} – ${b.rangeEnd ? formatDate(b.rangeEnd) : "…"}`
                    : "All time"}
                </Field>
                <Field label="Decisions">{formatNumber(b.decisionCount)}</Field>
                <Field label="Export format">{b.exportFormat ?? "-"}</Field>
              </div>
              <ChainProof b={b} />
            </div>
          </Card>

          <Card>
            <div
              className="flex items-center gap-3 px-4 py-2"
              style={{ background: INK.page, borderBottom: `1px solid ${INK.border}` }}
            >
              <ColumnHeader style={{ width: 150 }}>When</ColumnHeader>
              <ColumnHeader style={{ width: 130 }}>Agent</ColumnHeader>
              <ColumnHeader style={{ flex: 1 }}>Decision</ColumnHeader>
              <ColumnHeader style={{ width: 72, textAlign: "right" }}>Hash</ColumnHeader>
            </div>
            {b.decisions.length === 0 ? (
              <div className="px-4 py-8 text-center" style={{ fontSize: 13, color: INK.weak }}>
                No decisions in this bundle yet.
              </div>
            ) : (
              b.decisions.map((d) => <LedgerRow key={d.id} d={d} />)
            )}
          </Card>
        </div>
      )}
    </QueryBoundary>
  );
}

export default BundleDetail;
