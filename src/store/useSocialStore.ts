import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface Friend {
  id: string;
  username: string;
  display_name: string;
  status: string; // "online" | "offline" | "in_jam"
  last_seen: number;
}

export interface Jam {
  id: string;
  name: string;
  host: string;
  participants: string[];
  current_track: string | null;
  is_playing: boolean;
  position_ms: number;
  created_at: number;
}

interface FriendsState {
  friends: Friend[];
  isLoading: boolean;
  
  addFriend: (username: string) => Promise<Friend | null>;
  removeFriend: (friendId: string) => Promise<void>;
  loadFriends: () => Promise<void>;
}

export const useFriendsStore = create<FriendsState>((set) => ({
  friends: [],
  isLoading: false,
  
  addFriend: async (username) => {
    set({ isLoading: true });
    try {
      const friend = await invoke<Friend>('add_friend', { friendUsername: username });
      set((state) => ({ friends: [...state.friends, friend] }));
      return friend;
    } catch (e) {
      console.error('Failed to add friend:', e);
      return null;
    } finally {
      set({ isLoading: false });
    }
  },
  
  removeFriend: async (friendId) => {
    try {
      await invoke('remove_friend', { friendId });
      set((state) => ({ 
        friends: state.friends.filter(f => f.id !== friendId) 
      }));
    } catch (e) {
      console.error('Failed to remove friend:', e);
    }
  },
  
  loadFriends: async () => {
    set({ isLoading: true });
    try {
      const friends = await invoke<Friend[]>('get_friends');
      set({ friends });
    } catch (e) {
      console.error('Failed to load friends:', e);
    } finally {
      set({ isLoading: false });
    }
  },
}));

interface JamsState {
  jams: Jam[];
  currentJam: Jam | null;
  isLoading: boolean;
  
  createJam: (name: string) => Promise<Jam | null>;
  joinJam: (jamId: string) => Promise<Jam | null>;
  leaveJam: (jamId: string) => Promise<void>;
  syncJam: (jamId: string, trackId: string | null, isPlaying: boolean, positionMs: number) => Promise<Jam | null>;
  loadJams: () => Promise<void>;
}

export const useJamsStore = create<JamsState>((set) => ({
  jams: [],
  currentJam: null,
  isLoading: false,
  
  createJam: async (name) => {
    set({ isLoading: true });
    try {
      const jam = await invoke<Jam>('create_jam', { name });
      set((state) => ({ 
        jams: [...state.jams, jam],
        currentJam: jam,
      }));
      return jam;
    } catch (e) {
      console.error('Failed to create jam:', e);
      return null;
    } finally {
      set({ isLoading: false });
    }
  },
  
  joinJam: async (jamId) => {
    set({ isLoading: true });
    try {
      const jam = await invoke<Jam>('join_jam', { jamId });
      set({ currentJam: jam });
      return jam;
    } catch (e) {
      console.error('Failed to join jam:', e);
      return null;
    } finally {
      set({ isLoading: false });
    }
  },
  
  leaveJam: async (jamId) => {
    try {
      await invoke('leave_jam', { jamId });
      set({ currentJam: null });
    } catch (e) {
      console.error('Failed to leave jam:', e);
    }
  },
  
  syncJam: async (jamId, trackId, isPlaying, positionMs) => {
    try {
      const jam = await invoke<Jam>('sync_jam', { 
        jamId, 
        trackId, 
        isPlaying, 
        positionMs,
      });
      set({ currentJam: jam });
      return jam;
    } catch (e) {
      console.error('Failed to sync jam:', e);
      return null;
    }
  },
  
  loadJams: async () => {
    set({ isLoading: true });
    try {
      const jams = await invoke<Jam[]>('get_jams');
      set({ jams });
    } catch (e) {
      console.error('Failed to load jams:', e);
    } finally {
      set({ isLoading: false });
    }
  },
}));