import { useState, useEffect, useRef } from "react";
import { usePlaylistStore } from "../store/usePlaylistStore";
import { useAppStore } from "../store/useAppStore";
import {
  Plus,
  ChevronLeft,
  Trash2,
  X,
  Music,
  Search,
  Edit2,
} from "lucide-react";

interface PlaylistsViewProps {
  onBack: () => void;
}

const stripGradients = [
  "linear-gradient(135deg, #0f3d2e, #1e6b4d)",
  "linear-gradient(135deg, #132b3d, #1d4e6b)",
  "linear-gradient(135deg, #2e1333, #521d5e)",
  "linear-gradient(135deg, #332e13, #5e521d)",
  "linear-gradient(135deg, #1a3333, #1d5e5e)",
];

function formatDuration(ms?: number): string {
  if (!ms) return "--:--";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ─────────────────────────── helpers ─────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: "var(--text-muted)",
        letterSpacing: "0.10em",
        textTransform: "uppercase",
        marginBottom: 14,
      }}
    >
      {children}
    </p>
  );
}

function ArtPlaceholder() {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: "var(--surface-3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        color: "var(--text-muted)",
      }}
    >
      <Music size={14} />
    </div>
  );
}

/* ══════════════════════════ main component ══════════════════════════ */

export function PlaylistsView({ onBack }: PlaylistsViewProps) {
  const {
    playlists,
    generateAutoPlaylist,
    deletePlaylist,
    createPlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
  } = usePlaylistStore();
  const { customTracks, playTrack } = useAppStore();

  /* ── list-view state ── */
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [showForm, setShowForm] = useState(false);

  /* ── detail-view state ── */
  const [editingName, setEditingName] = useState<string | null>(null);
  const [showAddTracks, setShowAddTracks] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const nameInputRef = useRef<HTMLInputElement>(null);

  /* focus the rename input whenever it mounts */
  useEffect(() => {
    if (editingName !== null) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [editingName !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  /* generate auto-playlists on first load */
  useEffect(() => {
    if (playlists.length === 0) {
      generateAutoPlaylist("Entdecke neue Musik", 15);
      generateAutoPlaylist("Deine Lieblingshits", 20);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const currentPlaylist = playlists.find((p) => p.id === selectedPlaylist);

  /* ── rename helper (writes directly into Zustand store) ── */
  const commitRename = (name: string) => {
    const trimmed = name.trim();
    if (trimmed && selectedPlaylist) {
      usePlaylistStore.setState((state) => ({
        playlists: state.playlists.map((p) =>
          p.id === selectedPlaylist ? { ...p, name: trimmed } : p,
        ),
      }));
    }
    setEditingName(null);
  };

  const handleBackToList = () => {
    setSelectedPlaylist(null);
    setShowAddTracks(false);
    setSearchQuery("");
    setEditingName(null);
  };

  /* ══════════════ DETAIL VIEW ══════════════ */
  if (selectedPlaylist && currentPlaylist) {
    const playlistTracks = customTracks.filter((t) =>
      currentPlaylist.trackIds.includes(t.id),
    );
    const availableTracks = customTracks.filter(
      (t) => !currentPlaylist.trackIds.includes(t.id),
    );
    const filteredAvailable =
      searchQuery.trim() === ""
        ? availableTracks
        : availableTracks.filter((t) => {
            const q = searchQuery.toLowerCase();
            return (
              t.title.toLowerCase().includes(q) ||
              t.artist.toLowerCase().includes(q)
            );
          });

    return (
      <div
        style={{ padding: "40px 48px", flex: 1, overflowY: "auto" }}
        className="custom-scrollbar"
      >
        {/* ── back ── */}
        <button
          onClick={handleBackToList}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: "var(--text-muted)",
            background: "none",
            border: "none",
            cursor: "pointer",
            marginBottom: 32,
            padding: 0,
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color =
              "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
          }}
        >
          <ChevronLeft size={16} />
          Zurück
        </button>

        {/* ── header: editable title ── */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 8,
            }}
          >
            {editingName !== null ? (
              <input
                ref={nameInputRef}
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => commitRename(editingName)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename(editingName);
                  if (e.key === "Escape") setEditingName(null);
                }}
                className="input-field"
                style={{
                  fontSize: 34,
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  border: "2px solid var(--accent)",
                  borderRadius: 10,
                  padding: "4px 14px",
                  color: "var(--text-primary)",
                  background: "var(--surface-2)",
                  width: "100%",
                  maxWidth: 520,
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            ) : (
              <h1
                onClick={() => setEditingName(currentPlaylist.name)}
                title="Klicken zum Umbenennen"
                style={{
                  fontSize: 40,
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  cursor: "text",
                  margin: 0,
                  lineHeight: 1.1,
                }}
              >
                {currentPlaylist.name}
              </h1>
            )}

            {/* pencil toggle */}
            <button
              onClick={() =>
                setEditingName(
                  editingName === null ? currentPlaylist.name : null,
                )
              }
              title="Playlist umbenennen"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: "50%",
                background:
                  editingName !== null ? "var(--accent)" : "var(--accent-dim)",
                border: "1px solid var(--accent-border)",
                cursor: "pointer",
                color:
                  editingName !== null ? "var(--surface-0)" : "var(--accent)",
                flexShrink: 0,
                transition: "background 0.15s, color 0.15s",
              }}
            >
              <Edit2 size={14} />
            </button>
          </div>

          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
            {currentPlaylist.trackIds.length}{" "}
            {currentPlaylist.trackIds.length === 1 ? "Track" : "Tracks"}
            {currentPlaylist.description && ` · ${currentPlaylist.description}`}
          </p>
        </div>

        {/* ── action bar ── */}
        <div style={{ display: "flex", gap: 10, marginBottom: 36 }}>
          <button
            onClick={() => setShowAddTracks((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 18px",
              background: showAddTracks ? "var(--accent)" : "var(--accent-dim)",
              color: showAddTracks ? "var(--surface-0)" : "var(--accent)",
              border: "1px solid var(--accent-border)",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              transition: "background 0.15s, color 0.15s",
            }}
          >
            <Plus size={15} />
            Tracks hinzufügen
          </button>
        </div>

        {/* ══ IN-PLAYLIST TRACKS ══ */}
        <div style={{ marginBottom: 32 }}>
          <SectionLabel>In dieser Playlist</SectionLabel>

          {playlistTracks.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
                background: "var(--surface-2)",
                border: "1px dashed var(--accent-border)",
                borderRadius: 12,
                color: "var(--text-muted)",
                fontSize: 13,
              }}
            >
              Noch keine Tracks. Füge welche hinzu ↓
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {playlistTracks.map((track) => (
                <div
                  key={track.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    transition: "background 0.15s, border-color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.background = "var(--surface-3)";
                    el.style.borderColor = "var(--border-hover)";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.background = "var(--surface-2)";
                    el.style.borderColor = "var(--border)";
                  }}
                >
                  <ArtPlaceholder />

                  {/* title + artist – click to play */}
                  <button
                    onClick={() => playTrack(track)}
                    style={{
                      flex: 1,
                      textAlign: "left",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      minWidth: 0,
                    }}
                  >
                    <p
                      style={{
                        fontWeight: 500,
                        fontSize: 13,
                        color: "var(--text-primary)",
                        marginBottom: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {track.title}
                    </p>
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {track.artist}
                    </p>
                  </button>

                  {/* duration */}
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      flexShrink: 0,
                      marginRight: 6,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatDuration(track.duration_ms)}
                  </span>

                  {/* remove button */}
                  <button
                    onClick={() =>
                      removeTrackFromPlaylist(currentPlaylist.id, track.id)
                    }
                    title="Aus Playlist entfernen"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "var(--red-dim)",
                      border: "1px solid var(--red-border)",
                      cursor: "pointer",
                      color: "var(--red)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      transition: "background 0.15s, color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = "var(--red)";
                      el.style.color = "#fff";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = "var(--red-dim)";
                      el.style.color = "var(--red)";
                    }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ══ ADD TRACKS PANEL ══ */}
        {showAddTracks && (
          <div>
            {/* gradient divider */}
            <div
              style={{
                height: 1,
                background:
                  "linear-gradient(to right, transparent, var(--accent-border), transparent)",
                marginBottom: 28,
              }}
            />

            <SectionLabel>Tracks hinzufügen</SectionLabel>

            {/* search */}
            <div
              style={{
                position: "relative",
                marginBottom: 16,
                maxWidth: 340,
              }}
            >
              <Search
                size={14}
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                  pointerEvents: "none",
                }}
              />
              <input
                type="text"
                placeholder="Suchen…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field"
                style={{
                  paddingLeft: 36,
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* states */}
            {availableTracks.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "36px 20px",
                  background: "var(--surface-2)",
                  border: "1px dashed var(--accent-border)",
                  borderRadius: 12,
                  color: "var(--text-muted)",
                  fontSize: 13,
                }}
              >
                Alle Tracks bereits hinzugefügt
              </div>
            ) : filteredAvailable.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "36px 20px",
                  color: "var(--text-muted)",
                  fontSize: 13,
                }}
              >
                Keine Ergebnisse für „{searchQuery}"
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filteredAvailable.map((track) => (
                  <div
                    key={track.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 14px",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      transition: "background 0.15s, border-color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = "var(--surface-3)";
                      el.style.borderColor = "var(--border-hover)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = "var(--surface-2)";
                      el.style.borderColor = "var(--border)";
                    }}
                  >
                    <ArtPlaceholder />

                    {/* info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontWeight: 500,
                          fontSize: 13,
                          color: "var(--text-primary)",
                          marginBottom: 2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {track.title}
                      </p>
                      <p
                        style={{
                          fontSize: 12,
                          color: "var(--text-secondary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {track.artist}
                      </p>
                    </div>

                    {/* duration */}
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                        flexShrink: 0,
                        marginRight: 6,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatDuration(track.duration_ms)}
                    </span>

                    {/* add button */}
                    <button
                      onClick={() =>
                        addTrackToPlaylist(currentPlaylist.id, track.id)
                      }
                      title="Zur Playlist hinzufügen"
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "var(--accent-dim)",
                        border: "1px solid var(--accent-border)",
                        cursor: "pointer",
                        color: "var(--accent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        transition: "background 0.15s, color 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.background = "var(--accent)";
                        el.style.color = "var(--surface-0)";
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.background = "var(--accent-dim)";
                        el.style.color = "var(--accent)";
                      }}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ══════════════ LIST VIEW ══════════════ */
  return (
    <div
      style={{ padding: "40px 48px", flex: 1, overflowY: "auto" }}
      className="custom-scrollbar"
    >
      {/* back */}
      <button
        onClick={onBack}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          color: "var(--text-muted)",
          background: "none",
          border: "none",
          cursor: "pointer",
          marginBottom: 32,
          padding: 0,
          transition: "color 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
        }}
      >
        <ChevronLeft size={16} />
        Zurück
      </button>

      {/* heading + new-playlist button */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 32,
        }}
      >
        <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.03em" }}>
          Playlists
        </h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 16px",
            background: "var(--accent)",
            color: "var(--surface-0)",
            border: "none",
            borderRadius: 10,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
            transition: "filter 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.filter = "brightness(1.08)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.filter = "";
          }}
        >
          <Plus size={16} />
          Neue Playlist
        </button>
      </div>

      {/* create-playlist form */}
      {showForm && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (newPlaylistName.trim()) {
              await createPlaylist(newPlaylistName.trim());
              setNewPlaylistName("");
              setShowForm(false);
            }
          }}
          style={{
            marginBottom: 32,
            padding: "16px",
            background: "var(--surface-2)",
            border: "1px solid var(--accent-border)",
            borderRadius: 12,
            display: "flex",
            gap: 8,
          }}
        >
          <input
            autoFocus
            type="text"
            placeholder="Playlist-Name"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            className="input-field"
            style={{ flex: 1 }}
          />
          <button
            type="submit"
            style={{
              padding: "8px 18px",
              background: "var(--accent)",
              color: "var(--surface-0)",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              flexShrink: 0,
              transition: "filter 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.filter =
                "brightness(1.08)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.filter = "";
            }}
          >
            Erstellen
          </button>
        </form>
      )}

      {/* playlist grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 16,
        }}
      >
        {playlists.map((playlist, index) => (
          <div
            key={playlist.id}
            onClick={() => setSelectedPlaylist(playlist.id)}
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              cursor: "pointer",
              transition: "transform 0.2s, box-shadow 0.2s, border-color 0.2s",
              position: "relative",
              overflow: "hidden",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.transform = "translateY(-3px)";
              el.style.boxShadow =
                "0 10px 28px rgba(0,0,0,0.35), 0 0 0 1px var(--accent-border)";
              el.style.borderColor = "var(--accent-border)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.transform = "translateY(0)";
              el.style.boxShadow = "none";
              el.style.borderColor = "var(--border)";
            }}
          >
            {/* gradient strip */}
            <div
              style={{
                height: 80,
                background: stripGradients[index % stripGradients.length],
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Music size={28} style={{ color: "rgba(255,255,255,0.25)" }} />
            </div>

            {/* card body */}
            <div style={{ padding: "14px 16px 16px" }}>
              <h3
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  marginBottom: 6,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {playlist.name}
              </h3>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  marginBottom: playlist.description ? 4 : 0,
                }}
              >
                {playlist.trackIds.length}{" "}
                {playlist.trackIds.length === 1 ? "Track" : "Tracks"}
              </p>
              {playlist.description && (
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    fontStyle: "italic",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {playlist.description}
                </p>
              )}
            </div>

            {/* delete button – sits on top of gradient strip */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                deletePlaylist(playlist.id);
              }}
              title="Playlist löschen"
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,0.45)",
                backdropFilter: "blur(4px)",
                border: "none",
                borderRadius: 7,
                cursor: "pointer",
                color: "rgba(255,255,255,0.65)",
                transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "var(--red-dim)";
                el.style.color = "var(--red)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "rgba(0,0,0,0.45)";
                el.style.color = "rgba(255,255,255,0.65)";
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
