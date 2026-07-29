/**
 * CommandPalette - the ⌘K destination search opened from the Topbar.
 *
 * A search affordance that opens a palette with nothing in it is worse than no
 * affordance at all, so this renders the actual list: every primary route plus
 * a jump to each of the most recent decisions, filtered by cmdk's built-in
 * fuzzy match.
 *
 * `useLedgerDecisions` here is the same query the dashboard already runs for
 * its "Recent decisions" panel, so TanStack Query serves it from cache rather
 * than adding a palette-only fetch.
 */
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import { LayoutDashboard, FileText, BarChart3, Package, Gavel, ShieldCheck, Link2, Settings } from "lucide-react";
import { INK, FONT, DISPLAY, RADIUS, SHADOW } from "@/features/shared/tokens";
import { useUiStore } from "@/design-system/store";
import { useLedgerDecisions } from "@/hooks/useLedger";
import { ROUTES } from "@/lib/constants";

const DESTINATIONS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, keywords: "overview home" },
  { to: ROUTES.ledger, label: "Decision ledger", icon: FileText, keywords: "decisions log" },
  { to: ROUTES.analysis, label: "Analysis", icon: BarChart3, keywords: "autonomy override trend" },
  { to: ROUTES.bundles, label: "Bundles", icon: Package, keywords: "evidence export seal" },
  { to: ROUTES.holds, label: "Legal holds", icon: Gavel, keywords: "retention matter" },
  { to: ROUTES.controls, label: "Controls", icon: ShieldCheck, keywords: "compliance framework" },
  { to: ROUTES.chain, label: "Chain integrity", icon: Link2, keywords: "verify anchor hash" },
  { to: ROUTES.settings, label: "Settings", icon: Settings, keywords: "configuration admin" },
];

export function CommandPalette() {
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const navigate = useNavigate();

  const recentQ = useLedgerDecisions({ viewKey: "ALL_DECISIONS", pageSize: 8 });

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Jump to"
      shouldFilter
      style={dialogStyle}
      overlayClassName="evidence-cmdk-overlay"
    >
      <div style={{ borderBottom: `1px solid ${INK.border}`, padding: "4px 4px 0" }}>
        <Command.Input autoFocus placeholder="Jump to a page or decision…" style={inputStyle} />
      </div>
      <Command.List style={{ maxHeight: 360, overflowY: "auto", padding: 6 }}>
        <Command.Empty style={emptyStyle}>Nothing matches.</Command.Empty>

        <Command.Group heading="Pages" style={groupHeadingStyle}>
          {DESTINATIONS.map((d) => (
            <Command.Item key={d.to} value={`${d.label} ${d.keywords}`} onSelect={() => go(d.to)} style={itemStyle}>
              <d.icon size={15} strokeWidth={2} color={INK.weak} />
              {d.label}
            </Command.Item>
          ))}
        </Command.Group>

        {recentQ.data && recentQ.data.items.length > 0 && (
          <Command.Group heading="Recent decisions" style={groupHeadingStyle}>
            {recentQ.data.items.map((d) => (
              <Command.Item
                key={d.id}
                value={`${d.headline} ${d.agentApiName} ${d.decisionNumber}`}
                onSelect={() => go(ROUTES.decision(d.id))}
                style={itemStyle}
              >
                <FileText size={15} strokeWidth={2} color={INK.weak} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {d.headline}
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}

const emptyStyle: React.CSSProperties = {
  padding: "24px 10px",
  textAlign: "center",
  fontFamily: FONT,
  fontSize: 13,
  color: INK.weakest,
};

const dialogStyle: React.CSSProperties = {
  position: "fixed",
  top: "18%",
  left: "50%",
  transform: "translateX(-50%)",
  width: "min(560px, calc(100vw - 32px))",
  background: INK.surface,
  border: `1px solid ${INK.border}`,
  borderRadius: RADIUS.card,
  boxShadow: SHADOW.float,
  overflow: "hidden",
  zIndex: 91,
  fontFamily: FONT,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "none",
  outline: "none",
  padding: "12px 10px",
  fontFamily: DISPLAY,
  fontSize: 14.5,
  color: INK.text,
  background: "transparent",
};

const groupHeadingStyle: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: INK.weakest,
  padding: "8px 10px 4px",
};

const itemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  borderRadius: RADIUS.chip,
  fontFamily: FONT,
  fontSize: 13.5,
  color: INK.text,
  cursor: "pointer",
};
