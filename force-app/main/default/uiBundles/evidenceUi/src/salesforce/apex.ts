/**
 * Minimal Apex-invocation client for the non-repository admin reads
 * (configuration CMDT projections, granted-permission checks). The seven
 * ledger/bundle/hold/chain/control/analysis repositories carry their own SDK
 * access in `SalesforceRepositories`; this is the shared entry point for
 * everything else that must talk to an Apex facade in `salesforce` mode.
 *
 * The SDK is imported dynamically so a `mock`-mode dev build never needs
 * `@salesforce/platform-sdk` resolved.
 */

interface DataSDK {
  apex?: {
    invoke<T>(args: {
      apexClass: string;
      method: string;
      params?: Record<string, unknown>;
    }): Promise<T>;
  };
}

let sdkPromise: Promise<DataSDK> | null = null;

async function getSdk(): Promise<DataSDK> {
  if (!sdkPromise) {
    sdkPromise = import("@salesforce/platform-sdk").then((m) =>
      (m as unknown as { createDataSDK: () => Promise<DataSDK> }).createDataSDK(),
    );
  }
  return sdkPromise;
}

export async function apexInvoke<T>(
  apexClass: string,
  method: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const sdk = await getSdk();
  if (!sdk.apex) throw new Error("Apex invocation is unavailable in this runtime.");
  return sdk.apex.invoke<T>({ apexClass, method, params });
}
