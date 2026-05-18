import { useState, useEffect, useRef } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { audioEngine } from "../lib/AudioEngine";

export function Player() {
  const { isPlaying, togglePlay, currentTrack, volume, setVolume } =
    useAppStore();
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Load track when it changes
  useEffect(() => {
    if (!currentTrack?.file_path) return;
    audioEngine.loadTrack(currentTrack.file_path);
    if (isPlaying)
      audioEngine.play().catch((e) => console.error("Play error:", e));
  }, [currentTrack]);

  // Sync play/pause
  useEffect(() => {
    if (!currentTrack) return;
    if (isPlaying) {
      audioEngine.play().catch((e) => console.error("Play error:", e));
    } else {
      audioEngine.pause();
    }
  }, [isPlaying]);

  // Sync volume
  useEffect(() => {
    audioEngine.setVolume(volume);
  }, [volume]);

  // Wire up audio element events
  useEffect(() => {
    const el = audioEngine.getAudioElement();
    const onTime = () => setCurrentTime(el.currentTime);
    const onDur = () => setDuration(el.duration || 0);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("durationchange", onDur);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("durationchange", onDur);
    };
  }, []);

  function handleProgressBarClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!progressBarRef.current || duration === 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const t = ((e.clientX - rect.left) / rect.width) * duration;
    audioEngine.seek(t);
    setCurrentTime(t);
  }

  function fmt(s: number) {
    if (!s || isNaN(s)) return "0:00";
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  }

  function skipBack() {
    if (!currentTrack) return;
    const t = Math.max(0, audioEngine.getAudioElement().currentTime - 10);
    audioEngine.seek(t);
    setCurrentTime(t);
  }

  function skipForward() {
    if (!currentTrack) return;
    const el = audioEngine.getAudioElement();
    const t = Math.min(el.duration || 0, el.currentTime + 10);
    audioEngine.seek(t);
    setCurrentTime(t);
  }

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      style={{
        height: "var(--player-height)",
        background: "var(--surface-1)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        gap: 20,
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {/* ── Track info (left) ──────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: 240,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 10,
            flexShrink: 0,
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow:
              currentTrack && isPlaying
                ? "0 0 22px var(--accent-glow)"
                : "none",
            transition: "box-shadow 0.5s ease",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke={currentTrack ? "var(--accent)" : "var(--surface-3)"}
            strokeWidth="1.5"
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>

        {currentTrack ? (
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text-primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {currentTrack.title}
            </p>
            <p
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                marginTop: 2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {currentTrack.artist}
            </p>
          </div>
        ) : (
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Kein Track ausgewählt
          </p>
        )}
      </div>

      {/* ── Controls + seek bar (center) ──────── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
        }}
      >
        {/* Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <CtrlBtn
            icon={SkipBack}
            size={16}
            onClick={skipBack}
            disabled={!currentTrack}
          />

          <button
            onClick={togglePlay}
            disabled={!currentTrack}
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: "none",
              flexShrink: 0,
              background: currentTrack ? "var(--accent)" : "var(--surface-3)",
              color: currentTrack ? "var(--surface-0)" : "var(--text-muted)",
              cursor: currentTrack ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "transform 0.15s ease, box-shadow 0.2s ease",
              boxShadow: isPlaying ? "0 0 18px var(--accent-glow)" : "none",
            }}
            onMouseEnter={(e) => {
              if (!currentTrack) return;
              const el = e.currentTarget as HTMLElement;
              el.style.transform = "scale(1.08)";
              el.style.boxShadow = "0 0 24px var(--accent-glow)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.transform = "scale(1)";
              el.style.boxShadow = isPlaying
                ? "0 0 18px var(--accent-glow)"
                : "none";
            }}
          >
            {isPlaying ? (
              <Pause size={15} strokeWidth={0} fill="currentColor" />
            ) : (
              <Play
                size={15}
                strokeWidth={0}
                fill="currentColor"
                style={{ marginLeft: 2 }}
              />
            )}
          </button>

          <CtrlBtn
            icon={SkipForward}
            size={16}
            onClick={skipForward}
            disabled={!currentTrack}
          />
        </div>

        {/* Seek bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            maxWidth: 480,
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              fontVariantNumeric: "tabular-nums",
              width: 32,
              textAlign: "right",
              flexShrink: 0,
            }}
          >
            {fmt(currentTime)}
          </span>

          <div
            ref={progressBarRef}
            onClick={handleProgressBarClick}
            className="seek-bar"
          >
            <div className="seek-bar__fill" style={{ width: `${pct}%` }} />
            <div className="seek-bar__thumb" style={{ left: `${pct}%` }} />
          </div>

          <span
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              fontVariantNumeric: "tabular-nums",
              width: 32,
              flexShrink: 0,
            }}
          >
            {fmt(duration)}
          </span>
        </div>
      </div>

      {/* ── Volume (right) ────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: 148,
          flexShrink: 0,
        }}
      >
        <Volume2
          size={14}
          color="var(--text-muted)"
          style={{ flexShrink: 0 }}
        />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="vol-slider"
        />
      </div>
    </div>
  );
}

function CtrlBtn({
  icon: Icon,
  size,
  onClick,
  disabled,
}: {
  icon: any;
  size: number;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "none",
        border: "none",
        cursor: disabled ? "default" : "pointer",
        color: disabled ? "var(--surface-3)" : "var(--text-muted)",
        padding: 5,
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "color 0.12s, transform 0.12s",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        const el = e.currentTarget as HTMLElement;
        el.style.color = "var(--text-primary)";
        el.style.transform = "scale(1.12)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.color = disabled ? "var(--surface-3)" : "var(--text-muted)";
        el.style.transform = "scale(1)";
      }}
    >
      <Icon size={size} strokeWidth={1.8} />
    </button>
  );
}
