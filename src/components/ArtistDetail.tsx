import { useEffect, useState, useRef } from "react";
import { useAppStore, ArtistInfo } from "../store/useAppStore";
import { ChevronLeft, Camera, Music, TrendingUp } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";

interface ArtistDetailProps {
  artistName: string;
  onBack: () => void;
}

function formatDuration(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function ArtistDetail({ artistName, onBack }: ArtistDetailProps) {
  const {
    customTracks,
    playTrack,
    upsertArtist,
    getArtistByName,
    updateArtistImage,
  } = useAppStore();

  const [releases, setReleases] = useState<{ album: string; tracks: any[] }[]>(
    [],
  );
  const [artistInfo, setArtistInfo] = useState<ArtistInfo | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [bannerHovered, setBannerHovered] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load artist info ────────────────────────────────────────────────────────
  useEffect(() => {
    getArtistByName(artistName).then(setArtistInfo);
  }, [artistName]);

  // ── Build album groups ──────────────────────────────────────────────────────
  useEffect(() => {
    const artistTracks = customTracks.filter(
      (t) => t.artist.toLowerCase() === artistName.toLowerCase(),
    );
    const groupedByAlbum = artistTracks.reduce(
      (acc: Record<string, any[]>, track) => {
        if (!acc[track.album]) acc[track.album] = [];
        acc[track.album].push(track);
        return acc;
      },
      {},
    );
    setReleases(
      Object.entries(groupedByAlbum).map(([album, tracks]) => ({
        album,
        tracks,
      })),
    );
  }, [artistName, customTracks]);

  // ── Photo upload ────────────────────────────────────────────────────────────
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const ext = file.name.split(".").pop() || "jpg";
      const savedPath = await invoke<string>("save_image_to_app_dir", {
        dataBase64: base64,
        extension: ext,
      });
      const artistId = await upsertArtist(artistName);
      if (artistId) {
        await updateArtistImage(artistId, savedPath);
        const updated = await getArtistByName(artistName);
        setArtistInfo(updated);
      }
    } catch (err) {
      console.error("Photo upload failed:", err);
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ── Top songs ───────────────────────────────────────────────────────────────
  const topSongs = customTracks
    .filter(
      (t) =>
        t.artist.toLowerCase() === artistName.toLowerCase() &&
        (t.play_count ?? 0) > 0,
    )
    .sort((a, b) => (b.play_count ?? 0) - (a.play_count ?? 0))
    .slice(0, 5);

  const totalTracks = customTracks.filter(
    (t) => t.artist.toLowerCase() === artistName.toLowerCase(),
  ).length;

  const bannerSrc = artistInfo?.image_path
    ? convertFileSrc(artistInfo.image_path)
    : null;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
      }}
      className="custom-scrollbar"
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handlePhotoUpload}
      />

      {/* ── Banner ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: 200,
          flexShrink: 0,
          overflow: "hidden",
          background: bannerSrc
            ? "var(--surface-3)"
            : "linear-gradient(135deg, var(--surface-3), var(--accent-dim))",
        }}
        onMouseEnter={() => setBannerHovered(true)}
        onMouseLeave={() => setBannerHovered(false)}
      >
        {/* Photo or gradient */}
        {bannerSrc && (
          <img
            src={bannerSrc}
            alt={artistName}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        )}

        {/* Gradient overlay — always present so text stays readable */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.18) 55%, rgba(0,0,0,0.08) 100%)",
          }}
        />

        {/* Artist name — bottom-left */}
        <div
          style={{
            position: "absolute",
            bottom: 20,
            left: 28,
            pointerEvents: "none",
          }}
        >
          <h1
            style={{
              fontSize: 36,
              fontWeight: 800,
              color: "#fff",
              margin: 0,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              textShadow: "0 2px 12px rgba(0,0,0,0.6)",
            }}
          >
            {artistName}
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.65)",
              margin: "4px 0 0",
            }}
          >
            {totalTracks} {totalTracks === 1 ? "Lied" : "Lieder"}
          </p>
        </div>

        {/* "Foto ändern" button — top-right */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingPhoto}
          style={{
            position: "absolute",
            top: 14,
            right: 16,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 13px",
            background: "rgba(0,0,0,0.50)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 8,
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            cursor: uploadingPhoto ? "wait" : "pointer",
            opacity: bannerHovered || uploadingPhoto ? 1 : 0,
            transition: "opacity 0.18s, background 0.15s",
            backdropFilter: "blur(4px)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              "rgba(0,0,0,0.72)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              "rgba(0,0,0,0.50)";
          }}
        >
          <Camera size={13} />
          {uploadingPhoto ? "Wird hochgeladen…" : "Foto ändern"}
        </button>

        {/* Back button — top-left */}
        <button
          onClick={onBack}
          style={{
            position: "absolute",
            top: 14,
            left: 16,
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "7px 12px",
            background: "rgba(0,0,0,0.50)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 8,
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            backdropFilter: "blur(4px)",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              "rgba(0,0,0,0.72)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              "rgba(0,0,0,0.50)";
          }}
        >
          <ChevronLeft size={13} />
          Zurück
        </button>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div style={{ padding: "32px 48px 48px", flex: 1 }}>
        {/* ── Top Songs section ────────────────────────────────────────────── */}
        {topSongs.length > 0 && (
          <section style={{ marginBottom: 44 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 14,
              }}
            >
              <TrendingUp size={15} style={{ color: "var(--accent)" }} />
              <h2
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.09em",
                  color: "var(--text-secondary)",
                  margin: 0,
                }}
              >
                Top Songs
              </h2>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                background: "var(--surface-1)",
                borderRadius: 12,
                border: "1px solid var(--accent-border)",
                overflow: "hidden",
              }}
            >
              {topSongs.map((track, idx) => (
                <TopSongRow
                  key={track.id}
                  rank={idx + 1}
                  track={track}
                  onPlay={() => playTrack(track)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Albums ───────────────────────────────────────────────────────── */}
        {releases.length > 0 && (
          <section>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 18,
              }}
            >
              <Music size={15} style={{ color: "var(--accent)" }} />
              <h2
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.09em",
                  color: "var(--text-secondary)",
                  margin: 0,
                }}
              >
                Alben & Singles
              </h2>
            </div>

            {releases.map(({ album, tracks }) => (
              <div key={album} style={{ marginBottom: 32 }}>
                <h3
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--text-secondary)",
                    margin: "0 0 8px",
                  }}
                >
                  {album}
                </h3>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    background: "var(--surface-1)",
                    borderRadius: 10,
                    border: "1px solid rgba(147,197,253,0.10)",
                    overflow: "hidden",
                  }}
                >
                  {tracks.map((track: any, idx: number) => (
                    <AlbumTrackRow
                      key={track.id}
                      index={idx + 1}
                      track={track}
                      onPlay={() => playTrack(track)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {releases.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "64px 0",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            Keine Lieder gefunden für{" "}
            <strong style={{ color: "var(--text-secondary)" }}>
              {artistName}
            </strong>
            .
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface TopSongRowProps {
  rank: number;
  track: any;
  onPlay: () => void;
}

function TopSongRow({ rank, track, onPlay }: TopSongRowProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onPlay}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "32px 36px 1fr auto auto",
        alignItems: "center",
        gap: 12,
        padding: "9px 16px",
        cursor: "pointer",
        background: hovered ? "var(--accent-dim)" : "transparent",
        transition: "background 0.13s",
      }}
    >
      {/* Rank */}
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--accent)",
          fontFamily: "monospace",
          textAlign: "center",
        }}
      >
        {rank}
      </span>

      {/* Album art placeholder */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 6,
          background: track.cover_path
            ? "transparent"
            : "linear-gradient(135deg, var(--surface-3), var(--accent-dim))",
          overflow: "hidden",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {track.cover_path ? (
          <img
            src={convertFileSrc(track.cover_path)}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Music size={14} style={{ color: "var(--accent)", opacity: 0.6 }} />
        )}
      </div>

      {/* Title + artist */}
      <div style={{ overflow: "hidden" }}>
        <p
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: 0,
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
            margin: "1px 0 0",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {track.artist}
        </p>
      </div>

      {/* Play count badge */}
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--accent-deep)",
          background: "var(--accent-dim)",
          padding: "3px 9px",
          borderRadius: 20,
          whiteSpace: "nowrap",
          border: "1px solid var(--accent-border)",
        }}
      >
        {track.play_count} {track.play_count === 1 ? "Play" : "Plays"}
      </span>

      {/* Duration */}
      <span
        style={{
          fontSize: 12,
          color: "var(--text-muted)",
          fontVariantNumeric: "tabular-nums",
          minWidth: 36,
          textAlign: "right",
        }}
      >
        {formatDuration(track.duration_ms ?? 0)}
      </span>
    </div>
  );
}

interface AlbumTrackRowProps {
  index: number;
  track: any;
  onPlay: () => void;
}

function AlbumTrackRow({ index, track, onPlay }: AlbumTrackRowProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onPlay}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "28px 1fr auto",
        alignItems: "center",
        gap: 10,
        padding: "8px 14px",
        cursor: "pointer",
        background: hovered ? "var(--accent-dim)" : "transparent",
        transition: "background 0.13s",
      }}
    >
      {/* Track number */}
      <span
        style={{
          fontSize: 12,
          color: "var(--text-muted)",
          fontVariantNumeric: "tabular-nums",
          textAlign: "center",
        }}
      >
        {index}
      </span>

      {/* Title */}
      <p
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: hovered ? "var(--text-primary)" : "var(--text-primary)",
          margin: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {track.title}
      </p>

      {/* Duration */}
      <span
        style={{
          fontSize: 12,
          color: "var(--text-muted)",
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
        }}
      >
        {formatDuration(track.duration_ms ?? 0)}
      </span>
    </div>
  );
}
