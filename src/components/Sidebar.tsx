import {
  Home,
  Disc3,
  Users,
  Radio,
  FolderOpen,
  Search,
  List,
  Film,
  User,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../store/useAppStore";
import { useState } from "react";

const navItems = [
  { icon: Home, label: "Home", id: "home" },
  { icon: Search, label: "Suche", id: "search" },
  { icon: List, label: "Playlists", id: "playlists" },
  { icon: User, label: "Künstler", id: "artists" },
  { icon: Disc3, label: "Releases", id: "releases" },
  { icon: Film, label: "Musikvideos", id: "musicvideos" },
];

const socialItems = [
  { icon: Users, label: "Freunde", id: "friends" },
  { icon: Radio, label: "Jams", id: "jams" },
];

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  onToggleSocial: () => void;
}

export function Sidebar({
  activeView,
  onViewChange,
  onToggleSocial,
}: SidebarProps) {
  const { activeServer, loadTracksFromDb } = useAppStore();
  const [scanCount, setScanCount] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);

  async function handleScanFolder() {
    try {
      setScanning(true);
      setScanCount(null);
      const defaultDir = await invoke<string | null>("get_default_music_dir");
      if (!defaultDir) {
        console.error("No default music dir");
        return;
      }
      const count = await invoke<number>("scan_directory", {
        path: defaultDir,
      });
      setScanCount(count);
      await loadTracksFromDb();
    } catch (e) {
      console.error("Scan failed:", e);
    } finally {
      setScanning(false);
    }
  }

  return (
    <div
      style={{
        width: "var(--sidebar-width)",
        height: "100%",
        background: "var(--surface-1)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        padding: "20px 0 16px",
        flexShrink: 0,
      }}
    >
      {/* ── Library nav ─────────────────────── */}
      <div style={{ padding: "0 12px", marginBottom: 24 }}>
        <p
          style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.09em",
            color: "var(--text-muted)",
            padding: "0 10px",
            marginBottom: 8,
          }}
        >
          Bibliothek
        </p>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {navItems.map((item) => {
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: active ? "9px 10px 9px 8px" : "9px 10px",
                  paddingLeft: active ? 8 : 10,
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: active ? 500 : 400,
                  color: active
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
                  background: active
                    ? "linear-gradient(90deg, var(--accent-dim) 0%, transparent 100%)"
                    : "transparent",
                  borderLeft: active
                    ? "2px solid var(--accent)"
                    : "2px solid transparent",
                  cursor: "pointer",
                  transition: "background 0.15s, color 0.15s",
                  textAlign: "left",
                  width: "100%",
                }}
                onMouseEnter={(e) => {
                  if (!active)
                    (e.currentTarget as HTMLElement).style.background =
                      "var(--surface-2)";
                }}
                onMouseLeave={(e) => {
                  if (!active)
                    (e.currentTarget as HTMLElement).style.background =
                      "transparent";
                }}
              >
                <item.icon
                  size={15}
                  strokeWidth={active ? 2 : 1.5}
                  color={active ? "var(--accent)" : "var(--text-muted)"}
                />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Social nav ──────────────────────── */}
      <div style={{ padding: "0 12px", marginBottom: 24 }}>
        <p
          style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.09em",
            color: "var(--text-muted)",
            padding: "0 10px",
            marginBottom: 8,
          }}
        >
          Social
        </p>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {socialItems.map((item) => (
            <button
              key={item.id}
              onClick={onToggleSocial}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 10px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 400,
                color: "var(--text-secondary)",
                background: "transparent",
                border: "none",
                borderLeft: "2px solid transparent",
                cursor: "pointer",
                transition: "background 0.15s, color 0.15s",
                textAlign: "left",
                width: "100%",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "var(--surface-2)";
                el.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "transparent";
                el.style.color = "var(--text-secondary)";
              }}
            >
              <item.icon
                size={15}
                strokeWidth={1.5}
                color="var(--text-muted)"
              />
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* ── Server status ───────────────────── */}
      <div style={{ padding: "0 12px", marginBottom: 12 }}>
        <div
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              flexShrink: 0,
              background:
                activeServer?.status === "online"
                  ? "var(--accent)"
                  : "var(--red)",
              boxShadow:
                activeServer?.status === "online"
                  ? "0 0 6px var(--accent-glow)"
                  : "none",
              animation:
                activeServer?.status === "online"
                  ? "pulse-dot 2.5s ease infinite"
                  : "none",
            }}
          />
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "var(--text-primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {activeServer?.name ?? "Kein Server"}
            </p>
            <p
              style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}
            >
              {activeServer?.status === "online" ? "Online" : "Offline"}
            </p>
          </div>
        </div>
      </div>

      {/* ── Scan button ─────────────────────── */}
      <div style={{ padding: "0 12px" }}>
        <button
          onClick={handleScanFolder}
          disabled={scanning}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            padding: "10px 12px",
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 500,
            color: scanning ? "var(--text-muted)" : "var(--accent)",
            background: scanning ? "var(--surface-2)" : "var(--accent-dim)",
            border: `1px solid ${scanning ? "var(--border)" : "var(--accent-border)"}`,
            cursor: scanning ? "not-allowed" : "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            if (!scanning)
              (e.currentTarget as HTMLElement).style.background =
                "rgba(110,231,183,0.15)";
          }}
          onMouseLeave={(e) => {
            if (!scanning)
              (e.currentTarget as HTMLElement).style.background =
                "var(--accent-dim)";
          }}
        >
          <FolderOpen size={13} strokeWidth={1.5} />
          {scanning ? "Wird gescannt…" : "Musik-Ordner scannen"}
        </button>
        {scanCount !== null && (
          <p
            style={{
              fontSize: 11,
              color: "var(--accent)",
              textAlign: "center",
              marginTop: 7,
            }}
          >
            +{scanCount} Tracks hinzugefügt
          </p>
        )}
      </div>
    </div>
  );
}
