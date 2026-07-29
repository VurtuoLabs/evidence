/**
 * Topbar - collapse toggle, chain status, command search, theme, account.
 *
 * The persistent chain-integrity pill and the "Verify now" action are
 * unchanged in substance from the original bar (CONTRACT §12.5): not buried in
 * a report, one click for anyone holding `Evidence_Verify_Chain`. Only the
 * surrounding chrome - collapse toggle, search, account - is new.
 *
 * The search field is a button, not an input: it opens the cmdk palette, and a
 * real input here would capture focus and typing that the palette should own.
 */
import * as React from "react";
import { Link } from "react-router-dom";
import { Moon, Sun, PanelLeft, Search, ChevronDown } from "lucide-react";
import type { ChainStatusView } from "@/domain";
import { PALETTE } from "@/domain";
import { PERMISSIONS } from "@/lib/constants";
import { formatNumber, formatRelative } from "@/lib/format";
import { useChainStatus, useVerifyChain } from "@/hooks/useChain";
import { usePermission } from "@/hooks/usePermissions";
import { useTheme } from "@/design-system/theme";
import { useUiStore } from "@/design-system/store";
import { Button } from "@/components/ui/button";
import { INK, FONT, DISPLAY, MONO, RADIUS, SHADOW } from "@/features/shared/tokens";
import { CommandPalette } from "./CommandPalette";

/**
 * Persistent chain-integrity status (CONTRACT §12.5). Not buried in a report:
 * link count, last verification, and result live in the top bar on every page.
 */
function ChainStatusPill({ status }: { status: ChainStatusView | undefined }) {
  if (!status) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderRadius: RADIUS.chip + 2,
          border: `1px solid ${PALETTE.weak}59`,
          background: `${PALETTE.weak}14`,
          padding: "7px 12px",
        }}
        data-testid="chain-status-pill"
        data-tone="unknown"
      >
        <span style={{ width: 6, height: 6, borderRadius: 99, background: PALETTE.weak }} />
        <span style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 600, color: PALETTE.weak }}>
          Not yet verified
        </span>
      </div>
    );
  }

  const broken = status.result === "Break_Detected";
  const color = broken ? PALETTE.error : PALETTE.success;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        borderRadius: RADIUS.chip + 2,
        border: `1px solid ${color}59`,
        background: `${color}14`,
        padding: "7px 12px",
      }}
      data-testid="chain-status-pill"
      data-tone={broken ? "break" : "verified"}
    >
      <span style={{ width: 6, height: 6, borderRadius: 99, background: color }} />
      <span style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 600, color }}>
        {broken ? "Chain break detected" : "Chain verified"}
      </span>
      {!broken && (
        <span style={{ fontFamily: FONT, fontSize: 12, color: PALETTE.weak }}>
          {formatNumber(status.totalLinks)} links · {formatRelative(status.lastVerifiedAt)}
        </span>
      )}
    </div>
  );
}

export function Topbar() {
  const { data: status } = useChainStatus();
  const verify = useVerifyChain();
  const canVerify = usePermission(PERMISSIONS.verifyChain);
  const { theme, toggleTheme } = useTheme();
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const toggleCommand = useUiStore((s) => s.toggleCommand);

  // Cmd/Ctrl-K opens the palette from anywhere in the console.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleCommand();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleCommand]);

  return (
    <>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "0 20px",
          background: INK.surface,
          borderBottom: `1px solid ${INK.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
          <IconButton label="Toggle navigation" onClick={toggleSidebar}>
            <PanelLeft size={17} strokeWidth={2} />
          </IconButton>

          <button
            type="button"
            onClick={toggleCommand}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              width: "min(380px, 100%)",
              padding: "8px 12px",
              background: INK.page,
              border: `1px solid ${INK.border}`,
              borderRadius: RADIUS.chip + 2,
              cursor: "pointer",
              color: INK.weakest,
              textAlign: "left",
            }}
          >
            <Search size={15} strokeWidth={2} />
            <span style={{ flex: 1, fontFamily: FONT, fontSize: 13 }}>Search decisions, bundles…</span>
            <kbd
              style={{
                fontFamily: MONO,
                fontSize: 10.5,
                color: INK.weak,
                background: INK.surface,
                border: `1px solid ${INK.border}`,
                borderRadius: 5,
                padding: "2px 6px",
                lineHeight: 1.4,
              }}
            >
              ⌘K
            </kbd>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ChainStatusPill status={status} />

          {canVerify && (
            <Button
              variant={status?.result === "Break_Detected" ? "danger" : "neutral"}
              size="sm"
              onClick={() => verify.mutate({})}
              disabled={verify.isPending}
            >
              {verify.isPending ? "Verifying…" : "Verify now"}
            </Button>
          )}

          <IconButton label={theme === "dark" ? "Light mode" : "Dark mode"} onClick={toggleTheme}>
            {theme === "dark" ? <Sun size={17} strokeWidth={2} /> : <Moon size={17} strokeWidth={2} />}
          </IconButton>

          <AccountMenu />
        </div>
      </header>
      <CommandPalette />
    </>
  );
}

/** Account chip. The menu is a disclosure, not a link list, so Escape closes it. */
function AccountMenu() {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 8px 5px 5px",
          background: "transparent",
          border: `1px solid ${INK.border}`,
          borderRadius: RADIUS.pill,
          cursor: "pointer",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 28,
            height: 28,
            borderRadius: 99,
            background: `linear-gradient(135deg, ${INK.brand}, ${INK.accent})`,
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontFamily: DISPLAY,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          A
        </span>
        <span style={{ fontFamily: DISPLAY, fontSize: 13, fontWeight: 500, color: INK.text }}>Alex</span>
        <ChevronDown size={14} strokeWidth={2.2} color={INK.weakest} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            minWidth: 190,
            background: INK.surface,
            border: `1px solid ${INK.border}`,
            borderRadius: RADIUS.chip + 2,
            boxShadow: SHADOW.float,
            padding: 6,
            zIndex: 30,
          }}
        >
          <div style={{ padding: "8px 10px", borderBottom: `1px solid ${INK.border}`, marginBottom: 4 }}>
            <div style={{ fontFamily: DISPLAY, fontSize: 13, fontWeight: 600, color: INK.text }}>Alex</div>
            <div style={{ fontFamily: FONT, fontSize: 11.5, color: INK.weakest }}>Evidence Auditor</div>
          </div>
          <MenuLink to="/settings/permissions" onNavigate={() => setOpen(false)}>
            Permissions
          </MenuLink>
          <MenuLink to="/settings" onNavigate={() => setOpen(false)}>
            Settings
          </MenuLink>
        </div>
      )}
    </div>
  );
}

function MenuLink({ to, children, onNavigate }: { to: string; children: React.ReactNode; onNavigate: () => void }) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={onNavigate}
      style={{
        display: "block",
        padding: "8px 10px",
        borderRadius: RADIUS.chip,
        textDecoration: "none",
        fontFamily: FONT,
        fontSize: 13,
        color: INK.weak,
      }}
      onPointerEnter={(e) => (e.currentTarget.style.background = INK.page)}
      onPointerLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </Link>
  );
}

/** Square ghost button used for the icon affordances in the bar. */
function IconButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: 36,
        height: 36,
        display: "grid",
        placeItems: "center",
        borderRadius: RADIUS.chip + 2,
        border: `1px solid ${INK.border}`,
        background: INK.surface,
        color: INK.weak,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
