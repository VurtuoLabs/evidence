/**
 * Sidebar - grouped primary navigation.
 *
 * Sections are labelled; the section holding the current route stays open, so
 * a deep link never lands on a page whose nav parent is shut. Collapsed mode
 * keeps the icons and drops the labels.
 */
import * as React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Package,
  Gavel,
  ShieldCheck,
  Link2,
  Settings,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { ROUTES } from "@/lib/constants";
import { INK, FONT, DISPLAY, RADIUS } from "@/features/shared/tokens";
import { useUiStore } from "@/design-system/store";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  deep?: boolean;
}

interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

/** Routes and their icons (CONTRACT.md §12.3). */
const SECTIONS: NavSection[] = [
  {
    id: "record",
    label: "Record",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: ROUTES.ledger, label: "Decision ledger", icon: FileText, deep: true },
      { to: ROUTES.analysis, label: "Analysis", icon: BarChart3 },
    ],
  },
  {
    id: "assurance",
    label: "Assurance",
    items: [
      { to: ROUTES.bundles, label: "Bundles", icon: Package, deep: true },
      { to: ROUTES.holds, label: "Legal holds", icon: Gavel },
      { to: ROUTES.controls, label: "Controls", icon: ShieldCheck },
      { to: ROUTES.chain, label: "Chain integrity", icon: Link2 },
    ],
  },
  {
    id: "configure",
    label: "Configure",
    items: [{ to: ROUTES.settings, label: "Settings", icon: Settings, deep: true }],
  },
];

/** The Evidence mark: a sealed record with a check. */
function Wordmark({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: collapsed ? "18px 0" : "18px 20px",
        justifyContent: collapsed ? "center" : "flex-start",
      }}
    >
      <span
        style={{
          width: 32,
          height: 32,
          borderRadius: 9,
          background: INK.brand,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
          <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" fill="none" stroke="#fff" strokeWidth="1.5" />
          <path
            d="M5.5 8.2 L7.2 10 L10.5 6.2"
            fill="none"
            stroke="#fff"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {!collapsed && (
        <span style={{ lineHeight: 1.15 }}>
          <span
            style={{
              display: "block",
              fontFamily: DISPLAY,
              fontSize: 17,
              fontWeight: 600,
              color: INK.text,
              letterSpacing: "-0.01em",
            }}
          >
            Evidence
          </span>
          <span style={{ display: "block", fontFamily: FONT, fontSize: 11, color: INK.weakest }}>
            Agent decision record
          </span>
        </span>
      )}
    </div>
  );
}

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const { pathname } = useLocation();

  const sectionOwning = React.useCallback(
    (section: NavSection) =>
      section.items.some((i) => pathname === i.to || (i.deep && pathname.startsWith(`${i.to}/`))),
    [pathname],
  );

  const [open, setOpen] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(SECTIONS.map((s) => [s.id, true])),
  );

  React.useEffect(() => {
    const owner = SECTIONS.find(sectionOwning);
    if (owner) setOpen((prev) => (prev[owner.id] ? prev : { ...prev, [owner.id]: true }));
  }, [sectionOwning]);

  return (
    <aside
      aria-label="Primary"
      style={{
        width: collapsed ? 76 : 248,
        flexShrink: 0,
        background: INK.surface,
        borderRight: `1px solid ${INK.border}`,
        transition: "width 200ms ease",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Wordmark collapsed={collapsed} />

      <nav className="evidence-scroll" style={{ flex: 1, overflowY: "auto", padding: "4px 12px 16px" }}>
        {SECTIONS.map((section) => {
          const isOpen = open[section.id];
          return (
            <section key={section.id} style={{ marginBottom: 14 }}>
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => setOpen((p) => ({ ...p, [section.id]: !p[section.id] }))}
                  aria-expanded={isOpen}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 6,
                    padding: "6px 8px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: FONT,
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: "0.07em",
                    textTransform: "uppercase",
                    color: INK.weakest,
                  }}
                >
                  {section.label}
                  <ChevronDown
                    size={13}
                    strokeWidth={2.4}
                    style={{
                      transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
                      transition: "transform 180ms ease",
                    }}
                  />
                </button>
              )}

              {(isOpen || collapsed) && (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  {section.items.map((item) => (
                    <li key={item.to}>
                      <NavItemLink item={item} collapsed={collapsed} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </nav>

      {!collapsed && (
        <div style={{ padding: "12px 20px", borderTop: `1px solid ${INK.border}` }}>
          <div style={{ fontFamily: FONT, fontSize: 11, color: INK.weakest, lineHeight: 1.5 }}>
            Capture → Classify → Chain →<br />
            Anchor → Attest
          </div>
        </div>
      )}
    </aside>
  );
}

function NavItemLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const { icon: Icon } = item;
  return (
    <NavLink
      to={item.to}
      end={!item.deep}
      title={collapsed ? item.label : undefined}
      style={({ isActive }) => ({
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: collapsed ? "10px 0" : "9px 10px",
        justifyContent: collapsed ? "center" : "flex-start",
        borderRadius: RADIUS.chip + 1,
        textDecoration: "none",
        fontFamily: DISPLAY,
        fontSize: 13.5,
        fontWeight: 500,
        color: isActive ? INK.brand : INK.weak,
        background: isActive ? `${INK.brand}14` : "transparent",
        transition: "background 140ms ease, color 140ms ease",
      })}
      onPointerEnter={(e) => {
        const el = e.currentTarget;
        if (!el.getAttribute("aria-current")) el.style.background = INK.page;
      }}
      onPointerLeave={(e) => {
        const el = e.currentTarget;
        if (!el.getAttribute("aria-current")) el.style.background = "transparent";
      }}
    >
      <Icon size={17} strokeWidth={2} style={{ flexShrink: 0 }} />
      {!collapsed && <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>}
    </NavLink>
  );
}
