import { useState, useEffect } from "react";
import { TitleBar } from "./components/TitleBar";
import { TopBar } from "./components/TopBar";
import { Sidebar } from "./components/Sidebar";
import { Player } from "./components/Player";
import { SocialPanel } from "./components/SocialPanel";
import { AuthScreen } from "./components/AuthScreen";
import { HomePage } from "./components/HomePage";
import { SearchView } from "./components/SearchView";
import { PlaylistsView } from "./components/PlaylistsView";
import { ArtistDetail } from "./components/ArtistDetail";
import { ArtistsView } from "./components/ArtistsView";
import { MusicVideoManager } from "./components/MusicVideoManager";
import { useJamStore } from "./store/useJamStore";
import { useAppStore } from "./store/useAppStore";
import type { Release } from "./store/useAppStore";
import { useAuthStore } from "./store/useAuthStore";
import { usePlaylistStore } from "./store/usePlaylistStore";
import { useServerStore } from "./store/useServerStore";
import { WebView2Checker } from "./components/WebView2Checker";
import { Disc, Pencil, Trash2, X } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";

function App() {
  const [webView2Ready, setWebView2Ready] = useState(false);
  const { user, isLoading, checkSession } = useAuthStore();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  if (isLoading) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--surface-0)",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <img
          src="/logo.png"
          alt="ArtMusic"
          style={{ width: 64, height: 64, objectFit: "contain" }}
        />
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Laden…</p>
      </div>
    );
  }

  // Wrap everything with WebView2 checker - only show children when ready
  return (
    <WebView2Checker onReady={() => setWebView2Ready(true)}>
      {webView2Ready ? (!user ? <AuthScreen /> : <MainApp />) : null}
    </WebView2Checker>
  );
}

function MainApp() {
  const { isPanelOpen, togglePanel } = useJamStore();
  const { loadTracksFromDb } = useAppStore();
  const { loadPlaylists } = usePlaylistStore();
  const { loadServersFromStorage, autoConnectToOnline } = useServerStore();

  const [activeView, setActiveView] = useState("home");
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);

  useEffect(() => {
    // Load local data first
    loadTracksFromDb();
    loadPlaylists();
    
    // Then check for online servers
    loadServersFromStorage();
    // Auto-connect happens after a short delay to allow UI to render
    setTimeout(() => {
      autoConnectToOnline();
    }, 1000);
  }, [loadTracksFromDb, loadPlaylists, loadServersFromStorage, autoConnectToOnline]);

  function navigateToArtist(artist: string) {
    setSelectedArtist(artist);
    setActiveView("artist");
  }

  // Handles navigation calls from child views that pass (view, data?)
  function handleNavigate(view: string, data?: any) {
    if (view === "artist" && data?.artist) {
      navigateToArtist(data.artist);
    } else if (view === "playlists") {
      setActiveView("playlists");
      setSelectedArtist(null);
    } else {
      setActiveView(view);
      setSelectedArtist(null);
    }
  }

  function goBack() {
    setSelectedArtist(null);
    setActiveView("home");
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
        background: "var(--surface-0)",
        color: "var(--text-primary)",
      }}
    >
      <TitleBar />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Sidebar
          activeView={activeView}
          onViewChange={(v) => {
            setActiveView(v);
            setSelectedArtist(null);
          }}
          onToggleSocial={togglePanel}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            overflow: "hidden",
          }}
        >
          <TopBar />

          <main style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {/* Main Content */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {activeView === "home" && (
                <HomePage onNavigate={handleNavigate} />
              )}
              {activeView === "search" && (
                <SearchView onBack={goBack} onSelectArtist={navigateToArtist} />
              )}
              {activeView === "playlists" && <PlaylistsView onBack={goBack} />}
              {activeView === "artists" && <ArtistsView />}
              {activeView === "artist" && selectedArtist && (
                <ArtistDetail artistName={selectedArtist} onBack={goBack} />
              )}
              {activeView === "musicvideos" && (
                <MusicVideoManager onBack={goBack} />
              )}
              {activeView === "releases" && <ReleasesView />}
            </div>

            {/* Social Panel */}
            {isPanelOpen && <SocialPanel />}
          </main>
        </div>
      </div>

      {/* Player */}
      <Player />
    </div>
  );
}

function ReleasesView() {
  const {
    customReleases,
    customTracks,
    addTrackToRelease,
    removeTrackFromRelease,
    deleteRelease,
  } = useAppStore();

  const [editingRelease, setEditingRelease] = useState<Release | null>(null);

  // Keep editingRelease in sync whenever the store reloads after a mutation
  useEffect(() => {
    if (editingRelease) {
      const updated = customReleases.find((r) => r.id === editingRelease.id);
      if (updated) setEditingRelease(updated);
      else setEditingRelease(null);
    }
  }, [customReleases]);

  return (
    <>
      <div
        style={{ padding: "40px 48px", flex: 1, overflowY: "auto" }}
        className="custom-scrollbar"
      >
        <h1
          style={{
            fontSize: 42,
            fontWeight: 700,
            marginBottom: 32,
            letterSpacing: "-0.02em",
          }}
        >
          Releases
        </h1>

        {/* Group by type */}
        {["album", "single", "ep"].map((type) => {
          const typeReleases = customReleases.filter((r) => r.type === type);
          if (typeReleases.length === 0) return null;

          const typeLabel =
            type === "album" ? "Alben" : type === "single" ? "Singles" : "EPs";

          return (
            <div key={type} style={{ marginBottom: 40 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
                {typeLabel}
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                  gap: 16,
                }}
              >
                {typeReleases.map((release) => (
                  <div
                    key={release.id}
                    style={{
                      position: "relative",
                      padding: 12,
                      background: release.coverGradient || "var(--surface-1)",
                      borderRadius: 12,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      border: "1px solid var(--border)",
                      minHeight: 180,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.transform =
                        "translateY(-4px)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.transform =
                        "translateY(0)";
                    }}
                  >
                    {/* Edit / Delete buttons */}
                    <div
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        display: "flex",
                        gap: 4,
                        zIndex: 1,
                      }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingRelease(release);
                        }}
                        title="Bearbeiten"
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          background: "var(--surface-3)",
                          border: "1px solid var(--border)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--text-secondary)",
                          transition: "opacity 0.15s",
                        }}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteRelease(release.id);
                        }}
                        title="Löschen"
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          background: "var(--red-dim)",
                          border: "1px solid var(--red-border)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--red)",
                          transition: "opacity 0.15s",
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    {release.cover_path ? (
                      <img
                        src={convertFileSrc(release.cover_path)}
                        alt={release.title}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          borderRadius: 8,
                          marginBottom: 12,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: 120,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background:
                            release.coverGradient || "var(--surface-2)",
                          borderRadius: 8,
                          marginBottom: 12,
                        }}
                      >
                        <Disc size={32} color="rgba(255,255,255,0.3)" />
                      </div>
                    )}
                    <p
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        marginBottom: 4,
                        color: "white",
                        textShadow: "0 1px 3px rgba(0,0,0,0.3)",
                      }}
                    >
                      {release.title}
                    </p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
                      {release.artist}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {customReleases.length === 0 && (
          <div
            style={{
              textAlign: "center",
              color: "var(--text-secondary)",
              fontSize: 13,
              marginTop: 40,
            }}
          >
            Keine Releases vorhanden
          </div>
        )}
      </div>

      {/* ── Edit modal ── */}
      {editingRelease !== null && (
        <div
          onClick={() => setEditingRelease(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--border)",
              borderRadius: 20,
              width: 560,
              maxHeight: "80vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Modal header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "20px 24px",
                borderBottom: "1px solid var(--border)",
                flexShrink: 0,
              }}
            >
              <h2
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {editingRelease.title}
              </h2>
              <button
                onClick={() => setEditingRelease(null)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "var(--surface-3)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-secondary)",
                  flexShrink: 0,
                  marginLeft: 12,
                }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Two-column body */}
            <div
              style={{
                display: "flex",
                flex: 1,
                overflow: "hidden",
              }}
            >
              {/* Left — Im Release */}
              <div
                style={{
                  flex: 1,
                  padding: "16px 20px",
                  overflowY: "auto",
                  borderRight: "1px solid var(--border)",
                }}
                className="custom-scrollbar"
              >
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 12,
                  }}
                >
                  Im Release
                </p>
                {editingRelease.tracks.length === 0 && (
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Keine Tracks
                  </p>
                )}
                {editingRelease.tracks.map((track) => (
                  <div
                    key={track.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 0",
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        overflow: "hidden",
                      }}
                    >
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {track.title}
                      </p>
                      <p
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {track.artist}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        removeTrackFromRelease(editingRelease.id, track.id)
                      }
                      title="Entfernen"
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: "var(--red-dim)",
                        border: "1px solid var(--red-border)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--red)",
                        fontSize: 13,
                        flexShrink: 0,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* Right — Hinzufügen */}
              <div
                style={{
                  flex: 1,
                  padding: "16px 20px",
                  overflowY: "auto",
                }}
                className="custom-scrollbar"
              >
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 12,
                  }}
                >
                  Hinzufügen
                </p>
                {(() => {
                  const releaseTrackIds = new Set(
                    editingRelease.tracks.map((t) => t.id),
                  );
                  const available = customTracks.filter(
                    (t) => !releaseTrackIds.has(t.id),
                  );
                  if (available.length === 0) {
                    return (
                      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        Keine weiteren Tracks
                      </p>
                    );
                  }
                  return available.map((track) => (
                    <div
                      key={track.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 0",
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                          overflow: "hidden",
                        }}
                      >
                        <p
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {track.title}
                        </p>
                        <p
                          style={{
                            fontSize: 11,
                            color: "var(--text-muted)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {track.artist}
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          addTrackToRelease(editingRelease.id, track.id)
                        }
                        title="Hinzufügen"
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          background: "var(--accent-dim)",
                          border: "1px solid var(--accent-border)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--accent)",
                          fontSize: 16,
                          flexShrink: 0,
                        }}
                      >
                        ＋
                      </button>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
