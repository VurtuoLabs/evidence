import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import { Providers } from "@/app/providers";
import { ErrorBoundary } from "@/app/error-boundary";
import "@/design-system/globals.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Evidence console: #root element not found in index.html.");
}

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <Providers>
        <App />
      </Providers>
    </ErrorBoundary>
  </StrictMode>,
);
