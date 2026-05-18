import { create } from 'zustand';

export interface Server {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
}

interface ServerState {
  servers: Server[];
  activeServer: Server | null;
  addServer: (name: string, url: string) => void;
  removeServer: (id: string) => void;
  setActiveServer: (server: Server) => void;
  loadServersFromStorage: () => void;
  saveServersToStorage: () => void;
}

const STORAGE_KEY = 'artmusic_servers';

export const useServerStore = create<ServerState>((set, get) => ({
  servers: [],
  activeServer: null,

  addServer: (name, url) => {
    const id = `server_${Date.now()}`;
    const newServer: Server = { id, name, url, isActive: false };
    set((state) => ({
      servers: [...state.servers, newServer],
    }));
    get().saveServersToStorage();
  },

  removeServer: (id) => {
    set((state) => ({
      servers: state.servers.filter((s) => s.id !== id),
      activeServer: state.activeServer?.id === id ? null : state.activeServer,
    }));
    get().saveServersToStorage();
  },

  setActiveServer: (server) => {
    set((state) => ({
      servers: state.servers.map((s) => ({ ...s, isActive: s.id === server.id })),
      activeServer: server,
    }));
    get().saveServersToStorage();
  },

  saveServersToStorage: () => {
    const { servers, activeServer } = get();
    const data = { servers, activeServerId: activeServer?.id };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  loadServersFromStorage: () => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      const activeServer =
        parsed.servers.find((s: Server) => s.id === parsed.activeServerId) || null;
      set({
        servers: parsed.servers,
        activeServer,
      });
    }
  },
}));
