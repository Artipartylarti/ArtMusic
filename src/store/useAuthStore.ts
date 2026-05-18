import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface AuthUser {
  id: string;
  username: string;
  display_name: string;
  tunnel_slug: string;
  public_url: string;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  checkSession: () => Promise<void>;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string, displayName?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  error: null,

  checkSession: async () => {
    set({ isLoading: true, error: null });
    try {
      const session = await invoke<AuthUser | null>('get_auth_session');
      set({ user: session, isLoading: false, error: null });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Session check failed:', errorMsg);
      set({ user: null, isLoading: false, error: errorMsg });
    }
  },

  login: async (username, password) => {
    set({ error: null, isLoading: true });
    try {
      if (!username || !password) {
        set({ error: 'Benutzername und Passwort erforderlich.', isLoading: false });
        return false;
      }
      const user = await invoke<AuthUser>('login_user', { username, password });
      set({ user, error: null, isLoading: false });
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      set({ error: errorMsg, isLoading: false });
      return false;
    }
  },

  register: async (username, password, displayName) => {
    set({ error: null, isLoading: true });
    try {
      if (!username || !password) {
        set({ error: 'Benutzername und Passwort erforderlich.', isLoading: false });
        return false;
      }
      const user = await invoke<AuthUser>('register_user', {
        username,
        password,
        displayName: displayName || null,
      });
      set({ user, error: null, isLoading: false });
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      set({ error: errorMsg, isLoading: false });
      return false;
    }
  },

  logout: async () => {
    try {
      await invoke('logout_user');
    } catch {
      /* ignore */
    }
    set({ user: null });
  },

  clearError: () => set({ error: null }),
}));
