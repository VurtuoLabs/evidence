import { useQuery } from "@tanstack/react-query";
import { getRepositories } from "@/salesforce/factory";
import { queryKeys } from "./queryKeys";

/** The full six-panel decision record, by record Id or Decision Number. */
export function useDecision(decisionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.decision.byId(decisionId ?? ""),
    queryFn: () => getRepositories().decision.getDecision(decisionId as string),
    enabled: Boolean(decisionId),
  });
}

/** The full record by its `Ledger_Key__c` external id. */
export function useDecisionByLedgerKey(ledgerKey: string | undefined) {
  return useQuery({
    queryKey: queryKeys.decision.byLedgerKey(ledgerKey ?? ""),
    queryFn: () => getRepositories().decision.getByLedgerKey(ledgerKey as string),
    enabled: Boolean(ledgerKey),
  });
}
