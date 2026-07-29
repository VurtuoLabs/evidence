/**
 * Shared presentational primitives for the Evidence features.
 *
 * These are intentionally inline-styled with the tokens in `tokens.ts` so the
 * console renders pixel-faithfully to the Evidence identity (Inter throughout,
 * violet lead). Feature pages compose only these; no feature reaches for a
 * raw hex or a magic font string.
 */

import * as React from "react";
import { DISPLAY, FONT, INK, MONO, R } from "./tokens";
import { PROVENANCE_TONE, type Tone } from "./labels";
import type { Provenance } from "@/domain/types";

/* --------------------------------- Card ---------------------------------- */

export function Card({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        background: INK.surface,
        border: `1px solid ${INK.border}`,
        borderRadius: R,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  right,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{ borderBottom: `1px solid ${INK.border}` }}
    >
      <div>
        <h2 style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 600, margin: 0, color: INK.text }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontSize: 12.5, color: INK.weak, margin: "3px 0 0" }}>{subtitle}</p>
        )}
      </div>
      {right}
    </div>
  );
}

/* --------------------------------- Pill ---------------------------------- */

export function Pill({
  children,
  color,
  solid = false,
  mono = false,
  title,
}: {
  children: React.ReactNode;
  color: string;
  solid?: boolean;
  mono?: boolean;
  title?: string;
}) {
  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1,
        padding: "4px 8px",
        borderRadius: 99,
        fontFamily: mono ? MONO : FONT,
        color: solid ? "#fff" : color,
        background: solid ? color : `${color}1A`,
        border: solid ? "none" : `1px solid ${color}59`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

/** Convenience: render a {label,color} tone as a pill. */
export function TonePill({ tone, solid, mono }: { tone: Tone; solid?: boolean; mono?: boolean }) {
  return (
    <Pill color={tone.color} solid={solid} mono={mono}>
      {tone.label}
    </Pill>
  );
}

/* ------------------------------- Provenance ------------------------------ */

/**
 * The provenance badge that labels every panel on the decision record
 * (CONTRACT §1, §12.4). "Declared" is styled as a caution, never as neutral,
 * because blurring the Observed/Declared line is the one thing the product
 * refuses to do.
 */
export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  const tone = PROVENANCE_TONE[provenance];
  return (
    <span data-provenance={provenance} data-testid={`provenance-${provenance}`}>
      <Pill color={tone.color}>{tone.label}</Pill>
    </span>
  );
}

/* ------------------------------- SectionLabel ---------------------------- */

export function SectionLabel({
  children,
  provenance,
}: {
  children: React.ReactNode;
  provenance?: Provenance;
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: INK.weakest,
        }}
      >
        {children}
      </span>
      {provenance && <ProvenanceBadge provenance={provenance} />}
    </div>
  );
}

/* --------------------------------- Button -------------------------------- */

type BtnVariant = "brand" | "neutral" | "quiet" | "danger";

export function Btn({
  children,
  variant = "neutral",
  onClick,
  disabled = false,
  type = "button",
  title,
}: {
  children: React.ReactNode;
  variant?: BtnVariant;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  title?: string;
}) {
  const v: Record<BtnVariant, { bg: string; fg: string; bd: string }> = {
    brand: { bg: INK.brand, fg: "#fff", bd: INK.brand },
    neutral: { bg: "#fff", fg: INK.brand, bd: INK.borderStrong },
    quiet: { bg: "transparent", fg: INK.weak, bd: "transparent" },
    danger: { bg: INK.error, fg: "#fff", bd: INK.error },
  };
  const s = v[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background: s.bg,
        color: s.fg,
        border: `1px solid ${s.bd}`,
        borderRadius: R,
        fontSize: 13,
        fontWeight: 500,
        fontFamily: FONT,
        padding: "7px 14px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

/* ---------------------------------- Mono --------------------------------- */

export function Mono({
  children,
  color = INK.weakest,
  size = 12,
}: {
  children: React.ReactNode;
  color?: string;
  size?: number;
}) {
  return <span style={{ fontFamily: MONO, fontSize: size, color }}>{children}</span>;
}

/* -------------------------------- ScoreBar ------------------------------- */

/** A relevance/confidence bar (0..1) plus its mono numeral, per the mockup. */
export function ScoreBar({ value, color = INK.brand }: { value: number; color?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="flex items-center gap-2">
      <div style={{ width: 60, height: 5, background: INK.border, borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color }} />
      </div>
      <Mono size={11} color={INK.weakest}>
        {value.toFixed(2)}
      </Mono>
    </div>
  );
}

/* ------------------------------ Column header ---------------------------- */

/** `children` is optional: an action column is a spacer with no label. */
export function ColumnHeader({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: INK.weakest,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* ------------------------------- Page shell ------------------------------ */

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-1">
      <h1
        style={{
          fontFamily: DISPLAY,
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          margin: 0,
          color: INK.text,
        }}
      >
        {title}
      </h1>
      {subtitle && <p style={{ fontSize: 13, color: INK.weak, margin: "4px 0 0" }}>{subtitle}</p>}
    </div>
  );
}

/* -------------------------- Query state renderers ------------------------ */

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-12" role="status" aria-live="polite">
      <span style={{ fontSize: 13, color: INK.weakest }}>{label}</span>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center" style={{ gap: 6 }}>
      <span style={{ fontFamily: DISPLAY, fontSize: 16, color: INK.text }}>{title}</span>
      {hint && <span style={{ fontSize: 12.5, color: INK.weak, maxWidth: 420 }}>{hint}</span>}
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div
      className="flex flex-col items-center justify-center py-12 text-center"
      role="alert"
      style={{ gap: 6 }}
    >
      <span style={{ fontFamily: DISPLAY, fontSize: 16, color: INK.error }}>Could not load</span>
      <span style={{ fontSize: 12.5, color: INK.weak, maxWidth: 480 }}>{message}</span>
    </div>
  );
}

/**
 * Standard branch for a TanStack query result. Keeps every feature page from
 * re-implementing loading / error / empty handling by hand.
 */
export function QueryBoundary<T>({
  isLoading,
  isError,
  error,
  data,
  isEmpty,
  empty,
  loadingLabel,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  data: T | undefined;
  isEmpty?: (data: T) => boolean;
  empty?: React.ReactNode;
  loadingLabel?: string;
  children: (data: T) => React.ReactNode;
}) {
  if (isLoading) return <LoadingState label={loadingLabel} />;
  if (isError) return <ErrorState error={error} />;
  if (data === undefined) return <ErrorState error={new Error("No data returned.")} />;
  if (isEmpty?.(data)) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  return <>{children(data)}</>;
}
