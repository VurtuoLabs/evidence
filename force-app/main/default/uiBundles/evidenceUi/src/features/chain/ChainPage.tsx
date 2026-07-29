/**
 * /chain - chain integrity, made persistent and legible (CONTRACT §6, §12.5).
 *
 * The banner is exported so the app shell can render it on every page; a break
 * is an unmissable, shell-wide error state. `Verify now` is one click for
 * anyone holding `Evidence_Verify_Chain`. The page also lists recent
 * verification passes and the daily anchors a customer hands an auditor, and it
 * states plainly what the chain does and does not prove.
 */

import { useChainAnchors, useChainStatus, useChainVerifications, useVerifyChain } from "@/hooks/useChain";
import { usePermission } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants";
import type { ChainAnchorView, ChainVerificationView } from "@/domain/types";
import { INK, MONO, R } from "@/features/shared/tokens";
import { Btn, Card, CardHeader, ColumnHeader, Mono, Pill, QueryBoundary } from "@/features/shared/ui";
import { formatDate, formatDateTime, formatNumber, shortHash } from "@/lib/format";
import { deriveChainShell } from "./chain-status";
import type { ChainStatusView } from "@/domain/types";

/* ----------------------------- Status banner ----------------------------- */

export function ChainStatusBanner({
  status,
  canVerify,
  onVerify,
  verifying = false,
}: {
  status: ChainStatusView | undefined;
  canVerify: boolean;
  onVerify?: () => void;
  verifying?: boolean;
}) {
  const s = deriveChainShell(status);
  return (
    <div
      role={s.broken ? "alert" : "status"}
      data-testid="chain-status-banner"
      data-tone={s.tone}
      className="flex items-center gap-3 px-4 py-3"
      style={{
        background: `${s.color}14`,
        border: `1px solid ${s.color}59`,
        borderLeft: `3px solid ${s.color}`,
        borderRadius: R,
      }}
    >
      <span
        style={{ width: 8, height: 8, borderRadius: 99, background: s.color, display: "inline-block", flexShrink: 0 }}
        aria-hidden
      />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: s.color }}>{s.title}</div>
        <div style={{ fontSize: 12, color: INK.weak }}>{s.message}</div>
      </div>
      {canVerify && onVerify && (
        <span className="ml-auto">
          <Btn variant={s.broken ? "danger" : "neutral"} onClick={onVerify} disabled={verifying}>
            {verifying ? "Verifying…" : "Verify now"}
          </Btn>
        </span>
      )}
    </div>
  );
}

/* --------------------------- Verification history ------------------------- */

function VerificationRow({ v }: { v: ChainVerificationView }) {
  const intact = v.result === "Intact";
  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{ borderBottom: `1px solid ${INK.border}` }}
      data-testid={`verification-row-${v.id}`}
    >
      <span style={{ fontSize: 12.5, color: INK.weak, width: 170 }}>{formatDateTime(v.verifiedAt)}</span>
      <span style={{ fontFamily: MONO, fontSize: 12, color: INK.brand, flex: 1, minWidth: 0 }}>{v.chainKey}</span>
      <Mono size={12} color={INK.weak}>
        {formatNumber(v.firstPosition)}–{formatNumber(v.lastPosition)}
      </Mono>
      <Mono size={12} color={INK.weakest}>
        {formatNumber(v.linksChecked)} links · {formatNumber(v.durationMs)}ms
      </Mono>
      <span style={{ width: 120, textAlign: "right" }}>
        {intact ? (
          <Pill color={INK.success}>Intact</Pill>
        ) : (
          <Pill color={INK.error}>Break @ {v.breakAtPosition != null ? formatNumber(v.breakAtPosition) : "?"}</Pill>
        )}
      </span>
    </div>
  );
}

function AnchorRow({ a }: { a: ChainAnchorView }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${INK.border}` }}>
      <span style={{ fontSize: 12.5, color: INK.weak, width: 120 }}>{formatDate(a.anchorDate)}</span>
      <span style={{ fontFamily: MONO, fontSize: 12, color: INK.brand, flex: 1, minWidth: 0 }}>{a.chainKey}</span>
      <Mono size={12} color={INK.text}>
        {shortHash(a.terminalHash, 16)}
      </Mono>
      <Mono size={12} color={INK.weakest}>
        pos {formatNumber(a.terminalPosition)} · {formatNumber(a.linkCount)} links
      </Mono>
      <span style={{ width: 90, textAlign: "right" }}>
        {a.signature ? <Pill color={INK.success}>Signed</Pill> : <Pill color={INK.weakest}>Unsigned</Pill>}
      </span>
    </div>
  );
}

/* --------------------------------- Page ---------------------------------- */

export function ChainPage() {
  const statusQ = useChainStatus();
  const verificationsQ = useChainVerifications();
  const anchorsQ = useChainAnchors();
  const verify = useVerifyChain();
  const canVerify = usePermission(PERMISSIONS.verifyChain);

  return (
    <div className="flex flex-col gap-4">
      <ChainStatusBanner
        status={statusQ.data}
        canVerify={canVerify}
        onVerify={() => verify.mutate(undefined)}
        verifying={verify.isPending}
      />

      <Card>
        <div className="px-4 py-3" style={{ fontSize: 12.5, color: INK.weak, lineHeight: 1.6 }}>
          {deriveChainShell(statusQ.data).proofNote}
        </div>
      </Card>

      <Card>
        <CardHeader title="Recent verifications" subtitle="Each pass walks a chain slice, recomputes every hash, and records the result." />
        <QueryBoundary
          isLoading={verificationsQ.isLoading}
          isError={verificationsQ.isError}
          error={verificationsQ.error}
          data={verificationsQ.data}
          isEmpty={(rows) => rows.length === 0}
          empty={<div className="px-4 py-8 text-center" style={{ fontSize: 13, color: INK.weak }}>No verifications recorded yet.</div>}
        >
          {(rows) => (
            <>
              <div className="flex items-center gap-3 px-4 py-2" style={{ background: INK.page, borderBottom: `1px solid ${INK.border}` }}>
                <ColumnHeader style={{ width: 170 }}>Verified</ColumnHeader>
                <ColumnHeader style={{ flex: 1 }}>Chain</ColumnHeader>
                <ColumnHeader style={{ width: 120, textAlign: "right" }}>Result</ColumnHeader>
              </div>
              {rows.map((v) => (
                <VerificationRow key={v.id} v={v} />
              ))}
            </>
          )}
        </QueryBoundary>
      </Card>

      <Card>
        <CardHeader title="Daily anchors" subtitle="The terminal hash per chain per day - the artifact a customer hands an auditor." />
        <QueryBoundary
          isLoading={anchorsQ.isLoading}
          isError={anchorsQ.isError}
          error={anchorsQ.error}
          data={anchorsQ.data}
          isEmpty={(rows) => rows.length === 0}
          empty={<div className="px-4 py-8 text-center" style={{ fontSize: 13, color: INK.weak }}>No anchors written yet.</div>}
        >
          {(rows) => (
            <>
              <div className="flex items-center gap-3 px-4 py-2" style={{ background: INK.page, borderBottom: `1px solid ${INK.border}` }}>
                <ColumnHeader style={{ width: 120 }}>Date</ColumnHeader>
                <ColumnHeader style={{ flex: 1 }}>Chain</ColumnHeader>
                <ColumnHeader style={{ width: 90, textAlign: "right" }}>Signature</ColumnHeader>
              </div>
              {rows.map((a) => (
                <AnchorRow key={`${a.chainKey}-${a.anchorDate}`} a={a} />
              ))}
            </>
          )}
        </QueryBoundary>
      </Card>
    </div>
  );
}

export default ChainPage;
