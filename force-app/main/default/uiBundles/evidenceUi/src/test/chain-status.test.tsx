/**
 * deriveChainShell - the pure mapping from an aggregate chain status to the
 * shell banner state (CONTRACT §12.5, §6.4). A break must surface as an
 * unmissable error; an unverified chain must never masquerade as verified; and
 * the "integrity ≠ completeness" caveat rides along in every state.
 */

import { describe, it, expect } from "vitest";
import { deriveChainShell } from "@/features/chain/chain-status";
import { CHAIN_PROOF_NOTE } from "@/lib/constants";
import type { ChainStatusView } from "@/domain/types";

describe("deriveChainShell", () => {
  it("treats missing status as unknown, not verified", () => {
    const s = deriveChainShell(undefined);
    expect(s.tone).toBe("unknown");
    expect(s.broken).toBe(false);
    expect(s.title).toMatch(/not yet verified/i);
    expect(s.proofNote).toBe(CHAIN_PROOF_NOTE);
  });

  it("renders an intact chain as verified with link and chain counts", () => {
    const status: ChainStatusView = {
      result: "Intact",
      totalLinks: 44220,
      chainCount: 3,
      lastVerifiedAt: "2026-07-29T14:00:00.000Z",
      breakChainKey: null,
      breakAtPosition: null,
    };
    const s = deriveChainShell(status);
    expect(s.tone).toBe("verified");
    expect(s.broken).toBe(false);
    expect(s.title).toBe("Chain verified");
    expect(s.message).toContain("44,220");
    expect(s.message).toContain("3");
  });

  it("flags a detected break as an unmissable, broken state with location", () => {
    const status: ChainStatusView = {
      result: "Break_Detected",
      totalLinks: 44220,
      chainCount: 3,
      lastVerifiedAt: "2026-07-29T14:00:00.000Z",
      breakChainKey: "org:Claims_Triage",
      breakAtPosition: 88401,
    };
    const s = deriveChainShell(status);
    expect(s.tone).toBe("break");
    expect(s.broken).toBe(true);
    expect(s.title).toBe("Chain break detected");
    expect(s.message).toContain("org:Claims_Triage");
    expect(s.message).toContain("88,401");
  });

  it("keeps the integrity-not-completeness caveat in every state", () => {
    const base: ChainStatusView = {
      result: "Intact",
      totalLinks: 1,
      chainCount: 1,
      lastVerifiedAt: "2026-07-29T14:00:00.000Z",
      breakChainKey: null,
      breakAtPosition: null,
    };
    expect(deriveChainShell(base).proofNote).toBe(CHAIN_PROOF_NOTE);
    expect(deriveChainShell({ ...base, result: "Break_Detected", breakAtPosition: 5, breakChainKey: "c" }).proofNote).toBe(
      CHAIN_PROOF_NOTE,
    );
  });
});
