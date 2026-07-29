/**
 * Evidence visual identity, lifted verbatim from docs/console-mockup.jsx and
 * CONTRACT §12.6. Autonomy is the product's signature metric, so violet leads;
 * the palette is deliberately off the SLDS blue so the record reads as a
 * formal ledger rather than a dashboard.
 *
 * These are inline-style tokens (the console renders as a court/record artifact
 * with tight control over type and colour), used by the shared primitives in
 * `ui.tsx`. Tailwind still backs layout via the design-system CSS variables;
 * these constants exist so a panel colour is never a magic hex in a feature.
 */

export const INK = {
  brand: "#6D28D9",
  brandDark: "#4C1D95",
  accent: "#A855F7",
  success: "#2E844A",
  warning: "#014486",
  error: "#B91C1C",
  violet: "#7C3AED",
  page: "#F3F3F3",
  surface: "#FFFFFF",
  border: "#E7E2EE",
  borderStrong: "#CDC4DA",
  text: "#1C1626",
  weak: "#5B5468",
  weakest: "#847B93",
  /** Violet-tinted selection wash (mockup used a stray blue here; identity is violet). */
  selected: "#F3EEFB",
} as const;

export const FONT = "'Inter', -apple-system, system-ui, Arial, sans-serif";
/** Inter everywhere - display headings and numerals share the body face, no serif. */
export const DISPLAY = FONT;
/** Inter everywhere - hashes/scores no longer break into a monospace face. */
export const MONO = FONT;

/** 4px radius token (CONTRACT §12.6), used for controls, pills, and chips. */
export const R = 4;

/**
 * Card radius is larger than the control radius. A 4px card at dashboard scale
 * reads as a table cell, not a panel - the overview depends on cards being
 * legible as discrete objects, the record pages depend on controls staying
 * crisp. Two scales, not one.
 */
export const RADIUS = {
  control: 4,
  chip: 8,
  card: 14,
  pill: 999,
} as const;

/** Elevation. Shadows are tinted with the ink rather than neutral black, so a
 *  raised card sits in the violet-cast palette instead of greying it out. */
export const SHADOW = {
  card: "0 1px 2px rgba(28,22,38,0.05), 0 1px 3px rgba(28,22,38,0.07)",
  cardHover: "0 4px 12px -2px rgba(28,22,38,0.12), 0 2px 6px -2px rgba(28,22,38,0.07)",
  float: "0 12px 32px -8px rgba(28,22,38,0.26), 0 4px 12px -4px rgba(28,22,38,0.14)",
} as const;
