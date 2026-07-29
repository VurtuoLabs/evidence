import { Outlet } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { PALETTE } from "@/domain";
import { CHAIN_PROOF_NOTE } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import { useChainStatus } from "@/hooks/useChain";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

/**
 * A chain break invalidates every claim the product makes, so it renders as an
 * unmissable error state across the whole shell (CONTRACT §12.5) - above the
 * routed content, on every page, until it is resolved.
 */
function ChainBreakBanner() {
  const { data: status } = useChainStatus();
  if (!status || status.result !== "Break_Detected") return null;

  const where =
    status.breakChainKey != null && status.breakAtPosition != null
      ? `Break in chain ${status.breakChainKey} at position ${formatNumber(status.breakAtPosition)}.`
      : "A break was detected.";

  return (
    <div
      role="alert"
      data-testid="shell-chain-break"
      className="flex items-start gap-3 px-5 py-3"
      style={{
        background: `${PALETTE.error}14`,
        borderBottom: `2px solid ${PALETTE.error}`,
        color: PALETTE.error,
      }}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <div className="text-sm font-semibold">Chain break detected</div>
        <div className="text-xs" style={{ color: PALETTE.weak }}>
          {where} Every claim in the console is suspect until this is resolved. {CHAIN_PROOF_NOTE}
        </div>
      </div>
    </div>
  );
}

/**
 * The application chrome: fixed sidebar, sticky topbar with persistent chain
 * status, a shell-wide break banner, and the routed page in a scroll region.
 */
export function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <ChainBreakBanner />
        <main className="evidence-scroll flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-[1500px] px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
