import { format, formatDistanceToNowStrict, parseISO } from "date-fns";

/** Parse an ISO string or Date into a Date, tolerant of already-Date input. */
function toDate(value: string | number | Date): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  return parseISO(value);
}

/** e.g. "Jul 29, 2026 14:12:07" - the ledger's canonical timestamp rendering. */
export function formatDateTime(value: string | number | Date): string {
  try {
    return format(toDate(value), "MMM d, yyyy HH:mm:ss");
  } catch {
    return String(value);
  }
}

/** e.g. "Jul 29, 2026" - used in bundle ranges. */
export function formatDate(value: string | number | Date): string {
  try {
    return format(toDate(value), "MMM d, yyyy");
  } catch {
    return String(value);
  }
}

/** e.g. "6 min ago" - used by the chain-integrity header. */
export function formatRelative(value: string | number | Date): string {
  try {
    return `${formatDistanceToNowStrict(toDate(value))} ago`;
  } catch {
    return String(value);
  }
}

/** Group-separated integers, e.g. 44220 -> "44,220". */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

/** Percentage with no decimals, e.g. 0.94 -> "94%". */
export function formatPercent(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

/** Fixed two-decimal confidence/relevance score, e.g. 0.9 -> "0.90". */
export function formatScore(value: number): string {
  return value.toFixed(2);
}

/** USD currency, used in constraint thresholds. */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

/**
 * Shorten a 64-char hex hash to the 8-char prefix the console shows,
 * e.g. "a91f3c7e...". Pass `full` already short and it is returned as-is.
 */
export function shortHash(hash: string | null | undefined, chars = 8): string {
  if (!hash) return "-";
  return hash.length <= chars ? hash : hash.slice(0, chars);
}

/** Render a chain link as "prior → this" using short hashes. */
export function chainLink(prior: string | null | undefined, self: string): string {
  return `${shortHash(prior)} → ${shortHash(self)}`;
}
