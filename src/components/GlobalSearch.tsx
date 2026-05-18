import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../store/useAppStore";

interface TrackResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  file_path: string;
}

export function GlobalSearch() {
  const { playTrack } = useAppStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TrackResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await invoke<TrackResult[]>("search_tracks", { query });
        setResults(res);
      } catch {
        /* empty */
      } finally {
        setIsSearching(false);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--surface-2)",
          border: `1px solid ${focused ? "var(--accent-border)" : "var(--border)"}`,
          borderRadius: 99,
          padding: "6px 14px",
          width: 240,
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
      >
        <Search size={13} color="var(--text-muted)" />
        <input
          type="text"
          placeholder="Search..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setFocused(true);
          }}
          onBlur={() => setFocused(false)}
          style={{
            background: "none",
            border: "none",
            outline: "none",
            color: "var(--text-primary)",
            fontSize: 12,
            width: "100%",
          }}
        />
      </div>

      {isOpen && query.trim().length >= 2 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            marginTop: 6,
            right: 0,
            width: 300,
            background: "var(--surface-2)",
            border: "1px solid var(--border-hover)",
            borderRadius: 14,
            overflow: "hidden",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            zIndex: 100,
          }}
        >
          <div style={{ padding: 8 }}>
            {isSearching ? (
              <p
                style={{
                  padding: "12px",
                  fontSize: 12,
                  color: "var(--text-muted)",
                  textAlign: "center",
                  fontStyle: "italic",
                }}
              >
                Searching...
              </p>
            ) : results.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  maxHeight: 240,
                  overflowY: "auto",
                }}
              >
                {results.map((track) => (
                  <button
                    key={track.id}
                    onClick={() => {
                      playTrack({
                        id: track.id,
                        title: track.title,
                        artist: track.artist,
                        album: track.album,
                        file_path: track.file_path,
                      });
                      setIsOpen(false);
                      setQuery("");
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 10px",
                      borderRadius: 6,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                      width: "100%",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--surface-3)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "none";
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: "var(--surface-3)",
                        border: "1px solid var(--border)",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: "var(--text-primary)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {track.title}
                      </p>
                      <p
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          marginTop: 1,
                        }}
                      >
                        {track.artist}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p
                style={{
                  padding: "12px",
                  fontSize: 12,
                  color: "var(--text-muted)",
                  textAlign: "center",
                  fontStyle: "italic",
                }}
              >
                No results
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
