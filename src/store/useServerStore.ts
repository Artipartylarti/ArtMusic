import { create } from 'zustand';

export interface Server {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
  isOnline?: boolean; // Add online status
  lastChecked?: number;
}

// Check if a server is online
async function checkServerOnline(serverUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(`${serverUrl}/api/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

// Fetch data from a remote server
async function fetchFromServer<T>(serverUrl: string, endpoint: string): Promise<T | null> {
  try {
    const response = await fetch(`${serverUrl}${endpoint}`, {
      headers: {
        'Accept': 'application/json',
      },
    });
    if (!response.ok) {
      console.error(`Server error: ${response.status}`);
      return null;
    }
    return await response.json();
  } catch (err) {
    console.error(`Failed to fetch from server:`, err);
    return null;
  }
}

interface ServerState {
  servers: Server[];
  activeServer: Server | null;
  isRemoteLoading: boolean;
  isCheckingServers: boolean;
  autoConnectToOnline: () => Promise<void>;
  checkServerOnline: (serverUrl: string) => Promise<boolean>;
  checkAllServers: () => Promise<void>;
  addServer: (name: string, url: string) => void;
  removeServer: (id: string) => void;
  setActiveServer: (server: Server) => void;
  loadServersFromStorage: () => void;
  saveServersToStorage: () => void;
  // Remote server functions
  fetchRemoteTracks: () => Promise<any[]>;
  fetchRemoteReleases: () => Promise<any[]>;
}

const STORAGE_KEY = 'artmusic_servers';

export const useServerStore = create<ServerState>((set, get) => ({
  servers: [],
  activeServer: null,
  isRemoteLoading: false,
  isCheckingServers: false,

  // Check single server availability
  checkServerOnline: async (serverUrl) => {
    return await checkServerOnline(serverUrl);
  },

  // Check all saved servers and auto-connect to first online
  checkAllServers: async () => {
    const { servers } = get();
    if (servers.length === 0) return;
    
    set({ isCheckingServers: true });
    
    // Check each server in parallel
    const results = await Promise.all(
      servers.map(async (server) => {
        if (!server.url || server.url === 'local') {
          return { ...server, isOnline: true };
        }
        const isOnline = await checkServerOnline(server.url);
        return { ...server, isOnline, lastChecked: Date.now() };
      })
    );
    
    set({ servers: results, isCheckingServers: false });
  },

  // Auto-connect to first available server
  autoConnectToOnline: async () => {
    const { checkAllServers, setActiveServer, fetchRemoteTracks, fetchRemoteReleases } = get();
    
    // First check all servers
    await checkAllServers();
    
    const { activeServer, servers: checkedServers } = get();
    
    // If already connected, just return
    if (activeServer) return;
    
    // Find first online server
    const onlineServer = checkedServers.find(s => s.isOnline);
    
    if (onlineServer) {
      console.log(`Auto-connecting to ${onlineServer.name}`);
      setActiveServer(onlineServer);
      
      // Load its data
      const tracks = await fetchRemoteTracks();
      await fetchRemoteReleases();
      
      console.log(`Connected to ${onlineServer.name}: ${tracks.length} tracks`);
    } else {
      console.log('No online servers found, using local mode');
    }
  },

  addServer: (name, url) => {
    // Normalize URL - remove trailing slash
    const normalizedUrl = url.replace(/\/$/, '');
    const id = `server_${Date.now()}`;
    const newServer: Server = { id, name, url: normalizedUrl, isActive: false };
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

  // Fetch tracks from remote server
  fetchRemoteTracks: async () => {
    const { activeServer } = get();
    if (!activeServer) return [];
    
    set({ isRemoteLoading: true });
    try {
      const tracks = await fetchFromServer<any[]>(activeServer.url, '/api/tracks');
      return tracks || [];
    } finally {
      set({ isRemoteLoading: false });
    }
  },

  // Fetch releases from remote server
  fetchRemoteReleases: async () => {
    const { activeServer } = get();
    if (!activeServer) return [];
    
    set({ isRemoteLoading: true });
    try {
      const releases = await fetchFromServer<any[]>(activeServer.url, '/api/releases');
      return releases || [];
    } finally {
      set({ isRemoteLoading: false });
    }
  },
}));
