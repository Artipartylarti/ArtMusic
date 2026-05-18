import { useState, useMemo } from "react";
import { useAppStore } from "../store/useAppStore";
import { Search, ChevronLeft } from "lucide-react";

interface SearchViewProps {
  onBack: () => void;
  onSelectArtist: (artistName: string) => void;
}

export function SearchView({ onBack, onSelectArtist }: SearchViewProps) {
  const { customTracks, playTrack } = useAppStore();
  const [query, setQuery] = useState("");
  const [inputFocused, setInputFocused] = useState(false);

  const results = useMemo(() => {
    if (!query.trim()) return { tracks: [], artists: [], albums: [] };

    const lowerQuery = query.toLowerCase();
    const tracks = customTracks.filter(
      (t) =>
        t.title.toLowerCase().includes(lowerQuery) ||
        t.artist.toLowerCase().includes(lowerQuery) ||
        t.album.toLowerCase().includes(lowerQuery),
    );

    // Unique Artists
    const artists = [...new Set(tracks.map((t) => t.artist))];

    // Unique Albums
    const albums = [
      ...new Set(
        tracks
          .filter((t) => t.album !== "Unknown")
          .map((t) => `${t.album} - ${t.artist}`),
      ),
    ];

    return { tracks, artists, albums };
  }, [query, customTracks]);

  return (
    <div
      style={{ padding: "40px 48px", flex: 1, overflowY: "auto" }}
      className="custom-scrollbar"
    >
      <button
        onClick={onBack}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          color: "var(--text-secondary)",
          background: "none",
          border: "none",
          cursor: "pointer",
          marginBottom: 32,
        }}
      >
        <ChevronLeft size={16} /> Zurück
      </button>

      <h1
        style={{
          fontSize: 36,
          fontWeight: 700,
          marginBottom: 32,
          letterSpacing: "-0.02em",
        }}
      >
        Suche
      </h1>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "var(--surface-2)",
          border: `1px solid ${inputFocused ? "var(--accent-border)" : "var(--border)"}`,
          borderRadius: 12,
          paddingLeft: 16,
          marginBottom: 32,
          transition: "border-color 0.15s",
        }}
      >
        <Search size={18} style={{ color: "var(--text-secondary)" }} />
        <input
          type="text"
          placeholder="Lieder, Künstler, Alben..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          style={{
            flex: 1,
            background: "none",
            border: "none",
            padding: "12px 0",
            fontSize: 14,
            color: "var(--text-primary)",
            outline: "none",
          }}
        />
      </div>

      {query.trim() && (
        <div>
          {results.artists.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  marginBottom: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--text-muted)",
                }}
              >
                Künstler
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {results.artists.map((artist) => (
                  <button
                    key={artist}
                    onClick={() => onSelectArtist(artist)}
                    style={{
                      textAlign: "left",
                      padding: "10px 16px",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 99,
                      cursor: "pointer",
                      fontSize: 13,
                      color: "var(--text-primary)",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "var(--surface-3)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "var(--surface-2)";
                    }}
                  >
                    {artist}
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.albums.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  marginBottom: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--text-muted)",
                }}
              >
                Alben
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                  gap: 12,
                }}
              >
                {results.albums.map((album) => (
                  <div
                    key={album}
                    style={{
                      padding: 12,
                      background: "var(--surface-1)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  >
                    {album}
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.tracks.length > 0 && (
            <div>
              <h2
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  marginBottom: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--text-muted)",
                }}
              >
                Lieder
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {results.tracks.slice(0, 20).map((track) => (
                  <button
                    key={track.id}
                    onClick={() => playTrack(track)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      textAlign: "left",
                      padding: 10,
                      background: "var(--surface-1)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      cursor: "pointer",
                      fontSize: 13,
                      color: "var(--text-primary)",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "var(--surface-2)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "var(--surface-1)";
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: "var(--surface-3)",
                        border: "1px solid var(--border)",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontWeight: 500, marginBottom: 4 }}>
                        {track.title}
                      </p>
                      <p
                        style={{ fontSize: 12, color: "var(--text-secondary)" }}
                      >
                        {track.artist} • {track.album}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.tracks.length === 0 && results.artists.length === 0 && (
            <p
              style={{
                textAlign: "center",
                color: "var(--text-secondary)",
                fontSize: 13,
              }}
            >
              Keine Ergebnisse gefunden
            </p>
          )}
        </div>
      )}
    </div>
  );
}
