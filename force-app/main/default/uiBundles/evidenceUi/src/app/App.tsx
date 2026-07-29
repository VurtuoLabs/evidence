import { AppRoutes } from "./routes";

/**
 * Root application component. Providers (query, theme, tooltip, router) wrap it
 * in `main.tsx`; App just renders the route table, which mounts every page
 * inside the `AppShell` layout.
 */
export function App() {
  return <AppRoutes />;
}

export default App;
