/**
 * /settings/permissions - a read-only rendering of the permission and sharing
 * model (CONTRACT §8.3). The product's whole value is that access is controlled
 * and provable, so the matrix is surfaced in-product, not buried in a doc. Two
 * intentional asymmetries are called out because an auditor will ask about both.
 *
 * The static matrix is documentation; the "you hold" column reflects the
 * running user's live custom permissions via `usePermission` (UX hint only - 
 * Apex re-checks every write).
 */

import { usePermission } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants";
import { INK } from "@/features/shared/tokens";
import { Card, CardHeader, ColumnHeader, Pill } from "@/features/shared/ui";

const ROLES = ["Analyst", "Investigator", "Auditor", "Custodian", "Administrator"] as const;
type Role = (typeof ROLES)[number];

interface PermRow {
  key: string;
  label: string;
  grants: Record<Role, boolean>;
}

/** Exactly the §8.3 matrix. */
const MATRIX: PermRow[] = [
  {
    key: PERMISSIONS.viewLedger,
    label: "View ledger",
    grants: { Analyst: true, Investigator: true, Auditor: true, Custodian: true, Administrator: true },
  },
  {
    key: PERMISSIONS.viewSubjectData,
    label: "View subject data",
    grants: { Analyst: false, Investigator: true, Auditor: true, Custodian: true, Administrator: false },
  },
  {
    key: PERMISSIONS.viewRationale,
    label: "View rationale",
    grants: { Analyst: false, Investigator: true, Auditor: true, Custodian: true, Administrator: false },
  },
  {
    key: PERMISSIONS.assembleBundle,
    label: "Assemble bundle",
    grants: { Analyst: false, Investigator: true, Auditor: false, Custodian: true, Administrator: false },
  },
  {
    key: PERMISSIONS.sealBundle,
    label: "Seal bundle",
    grants: { Analyst: false, Investigator: false, Auditor: false, Custodian: true, Administrator: false },
  },
  {
    key: PERMISSIONS.manageLegalHold,
    label: "Manage legal hold",
    grants: { Analyst: false, Investigator: false, Auditor: false, Custodian: true, Administrator: false },
  },
  {
    key: PERMISSIONS.verifyChain,
    label: "Verify chain",
    grants: { Analyst: false, Investigator: false, Auditor: true, Custodian: true, Administrator: true },
  },
  {
    key: PERMISSIONS.manageRetention,
    label: "Manage retention",
    grants: { Analyst: false, Investigator: false, Auditor: false, Custodian: true, Administrator: false },
  },
];

function Check({ on }: { on: boolean }) {
  return (
    <span style={{ color: on ? INK.success : INK.borderStrong, fontWeight: 700, fontSize: 14 }} aria-label={on ? "granted" : "not granted"}>
      {on ? "✓" : "·"}
    </span>
  );
}

/** Hook order is stable: the matrix is a compile-time constant. */
function useHeldPermissions(): Record<string, boolean> {
  return {
    [PERMISSIONS.viewLedger]: usePermission(PERMISSIONS.viewLedger),
    [PERMISSIONS.viewSubjectData]: usePermission(PERMISSIONS.viewSubjectData),
    [PERMISSIONS.viewRationale]: usePermission(PERMISSIONS.viewRationale),
    [PERMISSIONS.assembleBundle]: usePermission(PERMISSIONS.assembleBundle),
    [PERMISSIONS.sealBundle]: usePermission(PERMISSIONS.sealBundle),
    [PERMISSIONS.manageLegalHold]: usePermission(PERMISSIONS.manageLegalHold),
    [PERMISSIONS.verifyChain]: usePermission(PERMISSIONS.verifyChain),
    [PERMISSIONS.manageRetention]: usePermission(PERMISSIONS.manageRetention),
  };
}

export function PermissionsSettings() {
  const held = useHeldPermissions();

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Permission model"
          subtitle="Access to Evidence is controlled and provable. Splitting ledger access from subject-data access is the design point: a risk analyst studying autonomy trends does not need to know whose claim it was."
        />
        <div className="flex items-center gap-3 px-4 py-2" style={{ background: INK.page, borderBottom: `1px solid ${INK.border}` }}>
          <ColumnHeader style={{ flex: 1 }}>Custom permission</ColumnHeader>
          {ROLES.map((r) => (
            <ColumnHeader key={r} style={{ width: 96, textAlign: "center" }}>
              {r}
            </ColumnHeader>
          ))}
          <ColumnHeader style={{ width: 90, textAlign: "center" }}>You</ColumnHeader>
        </div>
        {MATRIX.map((row) => (
          <div
            key={row.key}
            className="flex items-center gap-3 px-4 py-3"
            style={{ borderBottom: `1px solid ${INK.border}` }}
            data-testid={`perm-row-${row.key}`}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, color: INK.text, fontWeight: 500 }}>{row.label}</div>
              <div style={{ fontSize: 11, color: INK.weakest, fontFamily: "monospace" }}>{row.key}</div>
            </div>
            {ROLES.map((r) => (
              <span key={r} style={{ width: 96, textAlign: "center" }}>
                <Check on={row.grants[r]} />
              </span>
            ))}
            <span style={{ width: 90, textAlign: "center" }}>
              {held[row.key] ? <Pill color={INK.success}>Held</Pill> : <Check on={false} />}
            </span>
          </div>
        ))}
      </Card>

      <Card>
        <CardHeader title="Two intentional asymmetries" />
        <div className="px-4 py-3 flex flex-col gap-3" style={{ fontSize: 13, color: INK.text, lineHeight: 1.6 }}>
          <div>
            <strong>Administrator cannot read subject data.</strong> The person who configures the system is not
            automatically the person who can read what it recorded. Separation of duties.
          </div>
          <div>
            <strong>No permission set both writes and reads the ledger.</strong> The auditor has View All but no write;
            the integration user has Create on <code>Decision_Ledger__b</code> but no read. That materially raises the
            bar on undetected tampering.
          </div>
        </div>
      </Card>
    </div>
  );
}

export default PermissionsSettings;
