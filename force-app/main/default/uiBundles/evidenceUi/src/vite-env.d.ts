/// <reference types="vite/client" />
/// <reference types="vitest/globals" />

interface ImportMetaEnv {
  /** Data seam switch: "mock" (default) or "salesforce". */
  readonly VITE_DATA_MODE?: "mock" | "salesforce";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Injected by the Salesforce UI Bundle host at runtime. Absent under
 * `npm run dev`, so `basePath` is used as the router basename only inside
 * the org (the bundle is served from /app/c__evidenceUi, not the root).
 */
declare global {
  // eslint-disable-next-line no-var
  var SFDC_ENV:
    | {
        basePath?: string;
        [key: string]: unknown;
      }
    | undefined;
}

export {};
