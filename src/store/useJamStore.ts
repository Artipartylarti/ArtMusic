import { create } from 'zustand';

interface User {
  id: string;
  username: string;
  avatarUrl?: string;
  isOnline: boolean;
  currentTrack?: string;
}

interface JamSession {
  id: string;
  hostId: string;
  participants: User[];
  sharedQueue: { id: string; title: string }[];
  playbackState: 'playing' | 'paused';
}

interface JamState {
  friends: User[];
  activeJam: JamSession | null;
  isPanelOpen: boolean;
  togglePanel: () => void;
  joinJam: (jamId: string) => void;
  leaveJam: () => void;
}

export const useJamStore = create<JamState>((set) => ({
  friends: [],
  activeJam: null,
  isPanelOpen: false,
  togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),

  joinJam: (_jamId) => {
    console.warn('[Jam] P2P-Sync ist im PoC noch nicht verbunden (Signal-Server fehlt).');
  },

  leaveJam: () => set({ activeJam: null }),
}));
