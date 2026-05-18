import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface Server {
  id: string;
  name: string;
  isLocal: boolean;
  status: "online" | "offline";
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  file_path?: string;
  cover_path?: string;
  duration_ms?: number;
  play_count?: number;
}

export interface ArtistInfo {
  id: string;
  name: string;
  bio?: string;
  image_path?: string;
}

export interface Release {
  id: string;
  title: string;
  artist: string;
  type: "album" | "single" | "ep";
  coverGradient: string;
  cover_path?: string; // photo path for albums/singles/EPs
  tracks: Track[];
}

interface AppState {
  activeServer: Server | null;
  servers: Server[];
  setActiveServer: (id: string) => void;

  // Player state
  isPlaying: boolean;
  currentTrack: Track | null;
  volume: number;
  togglePlay: () => void;
  setVolume: (v: number) => void;
  playTrack: (track: Track) => void;

  // Top tracks (by play count)
  topTracks: Track[];
  loadTopTracks: () => Promise<void>;
  incrementPlayCount: (trackId: string) => Promise<void>;

  // Artist management
  upsertArtist: (name: string) => Promise<string | null>;
  getArtistByName: (name: string) => Promise<ArtistInfo | null>;
  updateArtistImage: (artistId: string, imagePath: string) => Promise<void>;

  // Release editing
  addTrackToRelease: (releaseId: string, trackId: string) => Promise<void>;
  removeTrackFromRelease: (releaseId: string, trackId: string) => Promise<void>;
  deleteRelease: (releaseId: string) => Promise<void>;

  // Custom user libraries (starts pristine & empty as requested!)
  customTracks: Track[];
  customReleases: Release[];
  loadTracksFromDb: () => Promise<void>;
  addCustomTrack: (
    title: string,
    artist: string,
    path: string,
    coverPath?: string,
  ) => Promise<void>;
  createRelease: (
    title: string,
    artist: string,
    type: "album" | "single" | "ep",
    coverGradient: string,
    selectedTrackIds: string[],
    coverPath?: string,
  ) => Promise<void>;

  // Self-Hosting state & actions
  isHosting: boolean;
  hostingPort: number;
  hostingIP: string;
  isTunneling: boolean;
  tunnelURL: string;
  stablePublicUrl: string;
  startHosting: (port: number) => Promise<void>;
  stopHosting: () => Promise<void>;
  refreshHostingStatus: () => Promise<void>;
  startTunnel: () => Promise<void>;
  stopTunnel: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  activeServer: {
    id: "local",
    name: "My Local Server",
    isLocal: true,
    status: "online",
  },
  servers: [
    { id: "local", name: "My Local Server", isLocal: true, status: "online" },
  ],
  setActiveServer: (id) =>
    set((state) => ({
      activeServer: state.servers.find((s) => s.id === id) || null,
    })),

  isPlaying: false,
  currentTrack: null,
  volume: 0.8,
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setVolume: (v) => set({ volume: v }),
  playTrack: (track) => {
    set({ currentTrack: track, isPlaying: true });
    // Fire-and-forget: increment stream count in DB
    invoke("increment_play_count", { trackId: track.id }).catch(console.error);
  },

  topTracks: [],

  loadTopTracks: async () => {
    try {
      const raw = await invoke<any[]>("get_top_tracks", { limit: 20 });
      const tracks = raw.map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        album: t.album,
        duration_ms: t.duration_ms,
        file_path: t.file_path,
        cover_path: t.cover_path || undefined,
        play_count: t.play_count,
      }));
      set({ topTracks: tracks });
    } catch (err) {
      console.error("Failed to load top tracks:", err);
    }
  },

  incrementPlayCount: async (trackId) => {
    try {
      await invoke("increment_play_count", { trackId });
    } catch (err) {
      console.error("Failed to increment play count:", err);
    }
  },

  upsertArtist: async (name) => {
    try {
      return await invoke<string>("upsert_artist", { name });
    } catch (err) {
      console.error("Failed to upsert artist:", err);
      return null;
    }
  },

  getArtistByName: async (name) => {
    try {
      return await invoke<ArtistInfo | null>("get_artist_by_name", { name });
    } catch (err) {
      console.error("Failed to get artist:", err);
      return null;
    }
  },

  updateArtistImage: async (artistId, imagePath) => {
    try {
      await invoke("update_artist_image", { artistId, imagePath });
    } catch (err) {
      console.error("Failed to update artist image:", err);
    }
  },

  addTrackToRelease: async (releaseId, trackId) => {
    try {
      await invoke("add_track_to_release", { releaseId, trackId });
      await get().loadTracksFromDb();
    } catch (err) {
      console.error("Failed to add track to release:", err);
    }
  },

  removeTrackFromRelease: async (releaseId, trackId) => {
    try {
      await invoke("remove_track_from_release", { releaseId, trackId });
      await get().loadTracksFromDb();
    } catch (err) {
      console.error("Failed to remove track from release:", err);
    }
  },

  deleteRelease: async (releaseId) => {
    try {
      await invoke("delete_release", { releaseId });
      await get().loadTracksFromDb();
    } catch (err) {
      console.error("Failed to delete release:", err);
    }
  },

  // Empty initial library
  customTracks: [],
  customReleases: [],

  // Load indexed tracks & releases directly from SQLite!
  loadTracksFromDb: async () => {
    try {
      const tracks = await invoke<any[]>("get_all_tracks");
      const mapped = tracks.map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        album: t.album,
        duration_ms: t.duration_ms,
        file_path: t.file_path,
        cover_path: t.cover_path || undefined,
        play_count: t.play_count ?? 0,
      }));

      const releases = await invoke<any[]>("get_all_releases");
      const mappedReleases = releases.map((r) => ({
        id: r.id,
        title: r.title,
        artist: r.artist,
        type: r.release_type as "album" | "single" | "ep",
        coverGradient: r.cover_gradient,
        cover_path: r.cover_path || undefined,
        tracks: r.tracks.map((t: any) => ({
          id: t.id,
          title: t.title,
          artist: t.artist,
          album: t.album,
          file_path: t.file_path,
          cover_path: t.cover_path || undefined,
        })),
      }));

      set({ customTracks: mapped, customReleases: mappedReleases });
    } catch (err) {
      console.error("Failed to load library from SQLite:", err);
    }
  },

  // Write track to SQLite so local Server and Clients can read & play it instantly!
  addCustomTrack: async (title, artist, path, coverPath) => {
    try {
      await invoke("add_track_to_db", {
        title,
        artist,
        album: "Single / Self-Published",
        filePath: path,
        coverPath: coverPath || null,
      });
      await get().loadTracksFromDb();
    } catch (err) {
      console.error("Failed to write track to SQLite:", err);
      alert(`Error writing track: ${err}`);
    }
  },

  createRelease: async (
    title,
    artist,
    type,
    coverGradient,
    selectedTrackIds,
    coverPath,
  ) => {
    try {
      await invoke("add_release_to_db", {
        title,
        artist,
        releaseType: type,
        coverGradient,
        coverPath: coverPath || null,
        trackIds: selectedTrackIds,
      });
      await get().loadTracksFromDb();
    } catch (err) {
      console.error("Failed to save release in SQLite:", err);
      alert(`Error saving release: ${err}`);
    }
  },

  // Self-Hosting implementation
  isHosting: false,
  hostingPort: 8088,
  hostingIP: "",
  isTunneling: false,
  tunnelURL: "",
  stablePublicUrl: "",

  startHosting: async (port) => {
    try {
      const res = await invoke<string>("start_hosting_server", { port });
      console.log(res);
      await get().refreshHostingStatus();
    } catch (err) {
      console.error("Failed to start hosting server:", err);
      alert(`Error starting server: ${err}`);
    }
  },

  stopHosting: async () => {
    try {
      const res = await invoke<string>("stop_hosting_server");
      console.log(res);
      await get().refreshHostingStatus();
    } catch (err) {
      console.error("Failed to stop hosting server:", err);
    }
  },

  startTunnel: async () => {
    try {
      const port = get().hostingPort;
      const url = await invoke<string>("start_public_tunnel", { port });
      set({ isTunneling: true, tunnelURL: url });
    } catch (err) {
      console.error("Failed to start public tunnel:", err);
      alert(
        `Failed to start tunnel (Check if OpenSSH is installed and internet connection is active): ${err}`,
      );
    }
  },

  stopTunnel: async () => {
    try {
      await invoke<string>("stop_public_tunnel");
      await get().refreshHostingStatus();
    } catch (err) {
      console.error("Failed to stop public tunnel:", err);
    }
  },

  refreshHostingStatus: async () => {
    try {
      const info = await invoke<{
        is_running: boolean;
        port: number | null;
        local_ip: string | null;
        tunnel_url: string | null;
        stable_public_url: string | null;
      }>("get_hosting_status");
      set({
        isHosting: info.is_running,
        hostingPort: info.port || 8088,
        hostingIP: info.local_ip || "127.0.0.1",
        isTunneling: info.is_running && !!info.tunnel_url,
        tunnelURL: info.tunnel_url || info.stable_public_url || "",
        stablePublicUrl: info.stable_public_url || info.tunnel_url || "",
      });
    } catch (err) {
      console.error("Failed to refresh hosting status:", err);
    }
  },
}));
