import { LogOut } from "lucide-react";
import { GlobalSearch } from "./GlobalSearch";
import { useAuthStore } from "../store/useAuthStore";

export function TopBar() {
  const { user, logout } = useAuthStore();

  return (
    <div
      data-tauri-drag-region
      style={{
        height: 52,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        background: "transparent",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
        gap: 16,
      }}
    >
      {/* Left: mode label */}
      <div style={{ width: "25%", display: "flex", alignItems: "center" }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          Studio
        </span>
      </div>

      {/* Center: global search */}
      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        <GlobalSearch />
      </div>

      {/* Right: user */}
      <div
        style={{
          width: "25%",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 10,
        }}
      >
        {user && (
          <>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background:
                  "linear-gradient(135deg, var(--accent-deep), var(--surface-3))",
                border: "1.5px solid var(--accent-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--surface-0)",
                }}
              >
                {(user.display_name?.[0] ?? user.username[0]).toUpperCase()}
              </span>
            </div>
            <div style={{ textAlign: "right", minWidth: 0 }}>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  whiteSpace: "nowrap",
                }}
              >
                {user.display_name}
              </p>
              <p
                style={{
                  fontSize: 10,
                  color: "var(--accent)",
                  whiteSpace: "nowrap",
                }}
              >
                @{user.username}
              </p>
            </div>
            <button
              onClick={() => logout()}
              title="Abmelden"
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                cursor: "pointer",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.15s, color 0.15s, border-color 0.15s",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "var(--red-dim)";
                el.style.borderColor = "var(--red-border)";
                el.style.color = "var(--red)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "var(--surface-2)";
                el.style.borderColor = "var(--border)";
                el.style.color = "var(--text-muted)";
              }}
            >
              <LogOut size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
