import { create } from 'zustand';

interface UiState {
  sidebarCollapsed: boolean;
  theme: 'dark' | 'light';
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: 'dark' | 'light') => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  theme: 'dark',

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed: boolean) => set({ sidebarCollapsed: collapsed }),
  setTheme: (theme: 'dark' | 'light') => set({ theme })
}));
