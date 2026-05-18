import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { initPlatform, isMac } from "../lib/platform";

const appWindow = getCurrentWindow();

export function TitleBar() {
  // Initialise platform detection once; re-render when resolved.
  const [mac, setMac] = useState(false);

  useEffect(() => {
    initPlatform().then(() => setMac(isMac()));
  }, []);

  // macOS convention: Close · Minimize · Maximize — on the LEFT
  // Windows/Linux:    Minimize · Maximize · Close  — on the RIGHT
  const macButtons = [
    {
      icon: X,
      action: () => appWindow.close(),
      title: "Schließen",
      danger: true,
    },
    {
      icon: Minus,
      action: () => appWindow.minimize(),
      title: "Minimieren",
      danger: false,
    },
    {
      icon: Square,
      action: () => appWindow.toggleMaximize(),
      title: "Maximieren",
      danger: false,
    },
  ] as const;

  const winButtons = [
    {
      icon: Minus,
      action: () => appWindow.minimize(),
      title: "Minimieren",
      danger: false,
    },
    {
      icon: Square,
      action: () => appWindow.toggleMaximize(),
      title: "Maximieren",
      danger: false,
    },
    {
      icon: X,
      action: () => appWindow.close(),
      title: "Schließen",
      danger: true,
    },
  ] as const;

  const buttons = mac ? macButtons : winButtons;

  const ButtonGroup = () => (
    <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
      {buttons.map(({ icon: Icon, action, title, danger }) => (
        <button
          key={title}
          onClick={action}
          title={title}
          style={{
            width: 46,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-muted)",
            transition: "background 0.12s, color 0.12s",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = danger
              ? "rgba(248,113,113,0.14)"
              : "var(--surface-3)";
            el.style.color = danger ? "#f87171" : "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = "none";
            el.style.color = "var(--text-muted)";
          }}
        >
          <Icon size={11} strokeWidth={1.8} />
        </button>
      ))}
    </div>
  );

  return (
    // The outer container is NOT a drag region so buttons can receive clicks.
    <div
      style={{
        height: 40,
        display: "flex",
        alignItems: "stretch",
        background: "var(--surface-1)",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {/* macOS: buttons on the LEFT */}
      {mac && <ButtonGroup />}

      {/* Drag region — logo + app name */}
      <div
        data-tauri-drag-region
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 9,
          // On macOS the logo/title is centred; on Windows it's left-aligned
          justifyContent: mac ? "center" : "flex-start",
          padding: mac ? "0" : "0 16px",
          cursor: "default",
        }}
      >
        <img
          src="/logo.png"
          alt=""
          style={{
            width: 20,
            height: 20,
            objectFit: "contain",
            opacity: 0.9,
            pointerEvents: "none",
          }}
        />
        <span
          style={{
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: "-0.015em",
            color: "var(--accent)",
            pointerEvents: "none",
          }}
        >
          ArtMusic
        </span>
      </div>

      {/* Windows/Linux: buttons on the RIGHT */}
      {!mac && <ButtonGroup />}
    </div>
  );
}
