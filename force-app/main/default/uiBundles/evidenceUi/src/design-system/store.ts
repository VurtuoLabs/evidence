import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark";

interface UiState {
  /** Active color theme; applied to <html> by the ThemeProvider. */
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;

  /** Left navigation collapsed state. */
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  /** Last-selected saved ledger view key (persists across sessions). */
  activeViewKey: string;
  setActiveViewKey: (key: string) => void;

  /** The ⌘K command palette. Not persisted - it should always open closed. */
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  toggleCommand: () => void;
}

/**
 * Global UI store. Query/server state lives in TanStack Query; this holds
 * only view-preference state, persisted to localStorage under one key.
 */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: "light",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),

      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

      activeViewKey: "ALL_DECISIONS",
      setActiveViewKey: (activeViewKey) => set({ activeViewKey }),

      commandOpen: false,
      setCommandOpen: (commandOpen) => set({ commandOpen }),
      toggleCommand: () => set((s) => ({ commandOpen: !s.commandOpen })),
    }),
    {
      name: "evidence-ui",
      // commandOpen must never be restored from storage: a palette that was
      // open when the tab closed should not reopen itself on the next visit.
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        activeViewKey: state.activeViewKey,
      }),
    },
  ),
);
