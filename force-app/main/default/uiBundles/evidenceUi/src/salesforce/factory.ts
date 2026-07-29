/**
 * Repository factory - the single switch on `VITE_DATA_MODE` (CONTRACT §12.1).
 * `mock` is the default so the console runs with no org; `salesforce` wires
 * the GraphQL + Apex-facade adapters. The chosen set is memoized so every
 * hook shares one instance (and the mock's mutable demo state).
 */
import { DATA_MODE } from "@/lib/constants";
import type { Repositories } from "./repositories";
import { createMockRepositories } from "./mock/MockRepositories";
import { createSalesforceRepositories } from "./salesforce/SalesforceRepositories";

let cached: Repositories | null = null;

export function getRepositories(): Repositories {
  if (cached) return cached;
  switch (DATA_MODE) {
    case "salesforce":
      cached = createSalesforceRepositories();
      break;
    case "mock":
    default:
      cached = createMockRepositories();
      break;
  }
  return cached;
}

/** Test hook: force a specific repository set (used by Vitest). */
export function __setRepositories(repos: Repositories | null): void {
  cached = repos;
}

export type { Repositories } from "./repositories";
