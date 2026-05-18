import { useState } from "react";
import { usePlaylistStore } from "../store/usePlaylistStore";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";

interface MusicVideoManagerProps {
  onBack: () => void;
}

export function MusicVideoManager({ onBack }: MusicVideoManagerProps) {
  const { musicVideos, addMusicVideo, deleteMusicVideo } = usePlaylistStore();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    artistId: "",
    url: "",
    trackId: "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      formData.title.trim() &&
      formData.artistId.trim() &&
      formData.url.trim()
    ) {
      addMusicVideo(
        formData.title,
        formData.artistId,
        formData.url,
        formData.trackId || undefined,
      );
      setFormData({ title: "", artistId: "", url: "", trackId: "" });
      setShowForm(false);
    }
  }

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
          color: "var(--text-muted)",
          background: "none",
          border: "none",
          cursor: "pointer",
          marginBottom: 32,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
        }}
      >
        <ChevronLeft size={16} /> Zurück
      </button>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 32,
        }}
      >
        <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.03em" }}>
          Musikvideos
        </h1>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            background: "var(--accent)",
            color: "var(--surface-0)",
            border: "none",
            borderRadius: 10,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <Plus size={16} /> Video hinzufügen
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            marginBottom: 32,
            padding: 20,
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <input
            type="text"
            placeholder="Videotitel"
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
            className="input-field"
            required
          />
          <input
            type="text"
            placeholder="Künstler-ID"
            value={formData.artistId}
            onChange={(e) =>
              setFormData({ ...formData, artistId: e.target.value })
            }
            className="input-field"
            required
          />
          <input
            type="url"
            placeholder="Video-URL (YouTube, etc.)"
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            className="input-field"
            required
          />
          <input
            type="text"
            placeholder="Track-ID (optional)"
            value={formData.trackId}
            onChange={(e) =>
              setFormData({ ...formData, trackId: e.target.value })
            }
            className="input-field"
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: "10px 16px",
                background: "var(--accent)",
                color: "var(--surface-0)",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Hinzufügen
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              style={{
                flex: 1,
                padding: "10px 16px",
                background: "var(--surface-0)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
          gap: 16,
        }}
      >
        {musicVideos.map((video) => (
          <div
            key={video.id}
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                aspectRatio: "16 / 9",
                background:
                  "linear-gradient(135deg, var(--surface-3), var(--accent-dim))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                color: "var(--text-secondary)",
                textAlign: "center",
                padding: 12,
              }}
            >
              Video
            </div>
            <div style={{ padding: 12 }}>
              <h3 style={{ fontWeight: 600, marginBottom: 4, fontSize: 13 }}>
                {video.title}
              </h3>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  marginBottom: 12,
                  wordBreak: "break-all",
                }}
              >
                {video.url}
              </p>
              <button
                onClick={() => deleteMusicVideo(video.id)}
                style={{
                  width: "100%",
                  padding: "6px 12px",
                  background: "var(--red-dim)",
                  border: "1px solid transparent",
                  borderRadius: 6,
                  cursor: "pointer",
                  color: "var(--red)",
                  fontSize: 11,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "var(--red-border)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "transparent";
                }}
              >
                <Trash2 size={12} /> Löschen
              </button>
            </div>
          </div>
        ))}
      </div>

      {musicVideos.length === 0 && !showForm && (
        <p
          style={{
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: 13,
            marginTop: 40,
            fontStyle: "italic",
          }}
        >
          Keine Musikvideos vorhanden
        </p>
      )}
    </div>
  );
}
