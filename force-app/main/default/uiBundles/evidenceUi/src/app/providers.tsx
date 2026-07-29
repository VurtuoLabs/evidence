import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@/design-system/theme";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Inside the org the bundle is served from `/app/c__evidenceUi`, not the domain
 * root, so the router basename comes from `globalThis.SFDC_ENV.basePath`
 * (CONTRACT §12.1). Standalone `npm run dev` has no `SFDC_ENV`, so basename is
 * `undefined` and the app serves from `/`.
 */
function getBasename(): string | undefined {
  return globalThis.SFDC_ENV?.basePath;
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

/**
 * Application providers: TanStack Query, theme (light/dark class on <html>),
 * Radix tooltips, and the router. The QueryClient is created once per mount so
 * it survives re-renders but resets on a full reload.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider delayDuration={200}>
          <BrowserRouter basename={getBasename()}>{children}</BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
