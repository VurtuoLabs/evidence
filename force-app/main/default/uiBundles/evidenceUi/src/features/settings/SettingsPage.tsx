/**
 * /settings - configuration shell (CONTRACT §7, §12.3).
 *
 * A left sub-nav and an <Outlet> for the read-only category views:
 * capture, consequence, retention, redaction, permissions. The index shows the
 * single `Evidence_Setting__mdt` Default record. All views are read-only;
 * configuration is deploy-time Custom Metadata.
 */

import { NavLink, Outlet } from "react-router-dom";
import { useEvidenceSettings } from "@/hooks/useConfiguration";
import { ROUTES } from "@/lib/constants";
import { INK, R } from "@/features/shared/tokens";
import { Card, CardHeader, QueryBoundary } from "@/features/shared/ui";
import { BoolCell, KeyValue, ReadOnlyNote } from "./parts";
import { formatNumber } from "@/lib/format";

const NAV: { to: string; label: string; end?: boolean }[] = [
  { to: ROUTES.settings, label: "Overview", end: true },
  { to: ROUTES.settingsCapture, label: "Capture" },
  { to: ROUTES.settingsConsequence, label: "Consequence" },
  { to: ROUTES.settingsRetention, label: "Retention" },
  { to: ROUTES.settingsRedaction, label: "Redaction" },
  { to: ROUTES.settingsPermissions, label: "Permissions" },
];

function SubNav() {
  return (
    <nav className="flex flex-col gap-1" style={{ width: 180, flexShrink: 0 }} aria-label="Settings sections">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          style={({ isActive }) => ({
            fontSize: 13,
            padding: "8px 12px",
            borderRadius: R,
            textDecoration: "none",
            fontWeight: isActive ? 600 : 400,
            color: isActive ? INK.brand : INK.weak,
            background: isActive ? `${INK.brand}12` : "transparent",
          })}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

/** Index view: the single `Evidence_Setting__mdt` Default record. */
export function SettingsOverview() {
  const q = useEvidenceSettings();
  return (
    <Card>
      <CardHeader title="Evidence settings" subtitle="The single Default configuration record for capture, chaining, and retention." />
      <ReadOnlyNote />
      <QueryBoundary isLoading={q.isLoading} isError={q.isError} error={q.error} data={q.data}>
        {(s) => (
          <div className="px-4 py-2">
            <KeyValue label="Capture enabled" value={<BoolCell value={s.captureEnabled} />} />
            <KeyValue label="Require rationale before action" value={<BoolCell value={s.requireRationaleBeforeAction} />} />
            <KeyValue label="Chain verification schedule" value={<code>{s.chainVerificationCron}</code>} />
            <KeyValue label="Anchor schedule" value={<code>{s.anchorCron}</code>} />
            <KeyValue label="Verification batch size" value={formatNumber(s.verificationBatchSize)} />
            <KeyValue label="Canonical version" value={`v${s.canonicalVersion}`} />
            <KeyValue label="Default retention" value={`${formatNumber(s.defaultRetentionDays)} days`} />
            <KeyValue label="Completeness check" value={<BoolCell value={s.completenessCheckEnabled} />} />
            <KeyValue label="Completeness tolerance" value={`${s.completenessTolerancePercent}%`} />
          </div>
        )}
      </QueryBoundary>
    </Card>
  );
}

export function SettingsPage() {
  return (
    <div className="flex gap-4">
      <SubNav />
      <div style={{ flex: 1, minWidth: 0 }}>
        <Outlet />
      </div>
    </div>
  );
}

export default SettingsPage;
