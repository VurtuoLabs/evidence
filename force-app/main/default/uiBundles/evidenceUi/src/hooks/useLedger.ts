import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { LedgerQuery, LedgerSearch } from "@/domain";
import { getRepositories } from "@/salesforce/factory";
import { queryKeys } from "./queryKeys";

/**
 * Ledger list (CONTRACT §12.4). Keeps the previous page visible while a new
 * filter loads so the table does not flash empty on a view switch. Backed by
 * `LedgerRepository.listDecisions` - GraphQL over `Decision_Record__c` in the
 * org, seed data in mock mode.
 */
export function useLedgerDecisions(query: LedgerQuery) {
  return useQuery({
    queryKey: queryKeys.ledger.list(query),
    queryFn: () => getRepositories().ledger.listDecisions(query),
    placeholderData: keepPreviousData,
  });
}

/**
 * The four header KPIs (decisions logged, autonomy %, override rate, chain
 * integrity). Served by the analysis facade; rendered by the ledger `KpiRow`.
 */
export function useLedgerKpis() {
  return useQuery({
    queryKey: queryKeys.analysis.kpis(),
    queryFn: () => getRepositories().analysis.getKpis(),
  });
}

/**
 * Index-order-aware chain search. An `IndexIncompatibleError` from the
 * repository is surfaced as the query error (not retried), so the feature can
 * tell the user the Big Object index cannot serve the query rather than
 * showing an empty result set (CONTRACT §9.2).
 */
export function useLedgerSearch(search: LedgerSearch, enabled = true) {
  return useQuery({
    queryKey: queryKeys.ledger.search(search),
    queryFn: () => getRepositories().ledger.searchDecisions(search),
    enabled,
    retry: false,
  });
}
