/**
 * Pure derivation of the chain-integrity shell state (CONTRACT §12.5).
 *
 * A broken chain invalidates every claim the product makes, so it renders as an
 * unmissable error state across the whole shell - never buried in a report. The
 * mapping from a `ChainStatusView` to the banner treatment is pure and lives
 * here so it can be unit-tested without a DOM.
 */

import type { ChainStatusView } from "@/domain/types";
import { INK } from "@/features/shared/tokens";
import { formatNumber, formatRelative } from "@/lib/format";
import { CHAIN_PROOF_NOTE } from "@/lib/constants";

export type ChainShellTone = "verified" | "break" | "unknown";

export interface ChainShellState {
  tone: ChainShellTone;
  /** True only when a break was detected - drives the shell-wide error state. */
  broken: boolean;
  title: string;
  message: string;
  /** Hex from the Evidence palette for the banner accent. */
  color: string;
  /** The standing caveat: integrity ≠ completeness (CONTRACT §6.4). */
  proofNote: string;
}

/**
 * Map the aggregate chain status into a banner state.
 * `undefined` (not yet loaded / never verified) is a distinct "unknown" tone - 
 * it must not masquerade as verified.
 */
export function deriveChainShell(status: ChainStatusView | undefined): ChainShellState {
  if (!status) {
    return {
      tone: "unknown",
      broken: false,
      title: "Chain not yet verified",
      message: "Run a verification to establish integrity.",
      color: INK.weak,
      proofNote: CHAIN_PROOF_NOTE,
    };
  }

  if (status.result === "Break_Detected") {
    const where =
      status.breakChainKey != null && status.breakAtPosition != null
        ? `Break in chain ${status.breakChainKey} at position ${formatNumber(status.breakAtPosition)}.`
        : "A break was detected.";
    return {
      tone: "break",
      broken: true,
      title: "Chain break detected",
      message: `${where} Every claim below is suspect until this is resolved.`,
      color: INK.error,
      proofNote: CHAIN_PROOF_NOTE,
    };
  }

  return {
    tone: "verified",
    broken: false,
    title: "Chain verified",
    message: `${formatNumber(status.totalLinks)} links across ${formatNumber(
      status.chainCount,
    )} chains · verified ${formatRelative(status.lastVerifiedAt)}`,
    color: INK.success,
    proofNote: CHAIN_PROOF_NOTE,
  };
}
