import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";

import DashboardPage from "@/features/dashboard/DashboardPage";
import LedgerPage from "@/features/ledger/LedgerPage";
import DecisionRecord from "@/features/decision/DecisionRecord";
import AnalysisPage from "@/features/analysis/AnalysisPage";
import BundlesPage from "@/features/bundles/BundlesPage";
import BundleDetail from "@/features/bundles/BundleDetail";
import HoldsPage from "@/features/holds/HoldsPage";
import ControlsPage from "@/features/controls/ControlsPage";
import ChainPage from "@/features/chain/ChainPage";
import SettingsPage, { SettingsOverview } from "@/features/settings/SettingsPage";
import CaptureSettings from "@/features/settings/CaptureSettings";
import ConsequenceSettings from "@/features/settings/ConsequenceSettings";
import RetentionSettings from "@/features/settings/RetentionSettings";
import RedactionSettings from "@/features/settings/RedactionSettings";
import PermissionsSettings from "@/features/settings/PermissionsSettings";

/** 404 for an unknown path under the shell. */
function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <div className="font-display text-2xl font-semibold">Nothing at this address</div>
      <p className="max-w-md text-sm text-muted-foreground">
        Evidence has no page here. Return to the dashboard to keep working.
      </p>
      <Button variant="brand" onClick={() => navigate(ROUTES.dashboard)}>
        Back to the dashboard
      </Button>
    </div>
  );
}

/**
 * Route table (CONTRACT §12.3). Everything renders inside the `AppShell`
 * layout route so the sidebar, persistent chain status, and shell-wide break
 * banner are present on every page. The decision record and bundle detail read
 * their id from the URL params directly.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to={ROUTES.dashboard} replace />} />
        <Route path={ROUTES.dashboard.slice(1)} element={<DashboardPage />} />

        <Route path="ledger" element={<LedgerPage />} />
        <Route path="ledger/:decisionId" element={<DecisionRecord />} />

        <Route path="analysis" element={<AnalysisPage />} />

        <Route path="bundles" element={<BundlesPage />} />
        <Route path="bundles/:bundleId" element={<BundleDetail />} />

        <Route path="holds" element={<HoldsPage />} />
        <Route path="controls" element={<ControlsPage />} />
        <Route path="chain" element={<ChainPage />} />

        <Route path="settings" element={<SettingsPage />}>
          <Route index element={<SettingsOverview />} />
          <Route path="capture" element={<CaptureSettings />} />
          <Route path="consequence" element={<ConsequenceSettings />} />
          <Route path="retention" element={<RetentionSettings />} />
          <Route path="redaction" element={<RedactionSettings />} />
          <Route path="permissions" element={<PermissionsSettings />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
