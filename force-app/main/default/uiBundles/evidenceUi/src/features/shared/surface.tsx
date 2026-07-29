/**
 * Dashboard surface primitives.
 *
 * These are the raised-card language of the overview: soft radius, one-pixel
 * border, a shadow that lifts the card off the page. `features/shared/ui.tsx`
 * keeps the flat, dense `Card` the ledger and record pages use; this file is
 * the presentational layer the dashboard is built from.
 *
 * Numerals use the same Inter face as the rest of the console (CONTRACT
 * §12.6) - the dashboard is still Evidence, not a generic analytics screen
 * wearing Evidence's colors.
 */
import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { INK, FONT, DISPLAY, MONO, RADIUS, SHADOW } from "./tokens";

/* -------------------------------- Surface -------------------------------- */

interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  interactive?: boolean;
  padded?: boolean;
}

function SurfaceRoot({ children, interactive, padded, style, ...rest }: SurfaceProps) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      {...rest}
      onPointerEnter={(e) => {
        setHover(true);
        rest.onPointerEnter?.(e);
      }}
      onPointerLeave={(e) => {
        setHover(false);
        rest.onPointerLeave?.(e);
      }}
      style={{
        background: INK.surface,
        border: `1px solid ${INK.border}`,
        borderRadius: RADIUS.card,
        boxShadow: interactive && hover ? SHADOW.cardHover : SHADOW.card,
        transform: interactive && hover ? "translateY(-1px)" : undefined,
        transition: "box-shadow 180ms ease, transform 180ms ease",
        padding: padded ? 18 : undefined,
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SurfaceHeader({
  title,
  subtitle,
  right,
  divider = false,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  divider?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        padding: "16px 18px",
        borderBottom: divider ? `1px solid ${INK.border}` : undefined,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h2
          style={{
            fontFamily: DISPLAY,
            fontSize: 16,
            fontWeight: 600,
            color: INK.text,
            margin: 0,
            letterSpacing: "-0.005em",
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <div style={{ fontFamily: FONT, fontSize: 12.5, color: INK.weakest, marginTop: 4, lineHeight: 1.5 }}>
            {subtitle}
          </div>
        )}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  );
}

function SurfaceBody({
  children,
  pad = 18,
  style,
}: {
  children: React.ReactNode;
  pad?: number;
  style?: React.CSSProperties;
}) {
  return <div style={{ padding: pad, paddingTop: 0, minWidth: 0, ...style }}>{children}</div>;
}

function SurfaceFooter({ children }: { children: React.ReactNode }) {
  return <div style={{ borderTop: `1px solid ${INK.border}`, padding: "12px 18px" }}>{children}</div>;
}

export const Surface = Object.assign(SurfaceRoot, {
  Header: SurfaceHeader,
  Body: SurfaceBody,
  Footer: SurfaceFooter,
});

/* ------------------------------- IconChip -------------------------------- */

export function IconChip({
  icon: Icon,
  color,
  size = 42,
}: {
  icon: LucideIcon;
  color: string;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: RADIUS.chip + 2,
        background: `${color}1A`,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      <Icon size={Math.round(size * 0.45)} strokeWidth={2} color={color} />
    </span>
  );
}

/* ------------------------------- DeltaPill ------------------------------- */

/**
 * Period-over-period change. `goodWhenUp` exists because falling is not
 * always bad: an override rate dropping is an improvement, and painting that
 * red would read as a regression.
 */
export function DeltaPill({
  value,
  goodWhenUp = true,
  suffix = "%",
}: {
  value: number;
  goodWhenUp?: boolean;
  suffix?: string;
}) {
  const up = value >= 0;
  const good = up === goodWhenUp;
  const color = value === 0 ? INK.weak : good ? INK.success : INK.error;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontFamily: MONO,
        fontSize: 11.5,
        fontWeight: 600,
        color,
        background: `${color}14`,
        border: `1px solid ${color}33`,
        borderRadius: RADIUS.pill,
        padding: "3px 7px",
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden>
        <path d={up ? "M5 1.5 L9 7 L1 7 Z" : "M5 8.5 L1 3 L9 3 Z"} fill={color} />
      </svg>
      {up ? "+" : "−"}
      {Math.abs(value)}
      {suffix}
    </span>
  );
}

/* -------------------------------- StatCard ------------------------------- */

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  color: string;
  caption?: string;
  delta?: { value: number; goodWhenUp?: boolean; suffix?: string };
  spark?: React.ReactNode;
  onClick?: () => void;
  /** Stable hook for tests - labels are intentionally repeated elsewhere on
   *  the page (a chart legend, a panel title). */
  testId?: string;
}

export function StatCard({ label, value, icon, color, caption, delta, spark, onClick, testId }: StatCardProps) {
  const clickable = Boolean(onClick);
  return (
    <Surface
      interactive={clickable}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      data-testid={testId}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      style={{ cursor: clickable ? "pointer" : undefined, padding: 18, display: "flex", flexDirection: "column" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontFamily: FONT, fontSize: 12.5, color: INK.weak, fontWeight: 500, lineHeight: 1.35 }}>
          {label}
        </span>
        <IconChip icon={icon} color={color} />
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginTop: 14, flexWrap: "wrap" }}>
        <span
          style={{
            fontFamily: DISPLAY,
            fontSize: 30,
            fontWeight: 700,
            color: INK.text,
            letterSpacing: "-0.015em",
            lineHeight: 1.1,
          }}
        >
          {value}
        </span>
        {delta && <DeltaPill value={delta.value} goodWhenUp={delta.goodWhenUp} suffix={delta.suffix} />}
      </div>

      {caption && (
        <div style={{ marginTop: 8 }}>
          <span style={{ fontFamily: FONT, fontSize: 11.5, color: INK.weakest }}>{caption}</span>
        </div>
      )}

      {spark && <div style={{ marginTop: 12 }}>{spark}</div>}
    </Surface>
  );
}

/* --------------------------- SegmentedControl ---------------------------- */

/**
 * Real radiogroup with roving tabindex: one tab stop for the whole control,
 * arrow keys move between options.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));

  const move = (delta: number) => {
    const next = (activeIndex + delta + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        display: "inline-flex",
        gap: 2,
        padding: 3,
        background: INK.page,
        border: `1px solid ${INK.border}`,
        borderRadius: RADIUS.chip + 2,
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          move(1);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          move(-1);
        }
      }}
    >
      {options.map((option, i) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            style={{
              fontFamily: DISPLAY,
              fontSize: 12.5,
              fontWeight: 500,
              padding: "6px 13px",
              borderRadius: RADIUS.chip,
              border: "none",
              cursor: "pointer",
              color: selected ? INK.text : INK.weak,
              background: selected ? INK.surface : "transparent",
              boxShadow: selected ? SHADOW.card : undefined,
              transition: "background 150ms ease, color 150ms ease",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------- Legend -------------------------------- */

export function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: 99, background: color }} />
      <span style={{ fontFamily: FONT, fontSize: 12, color: INK.weak }}>{label}</span>
    </span>
  );
}
