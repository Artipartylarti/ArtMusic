import { useJamStore } from "../store/useJamStore";
import { X, Music, Radio } from "lucide-react";

export function SocialPanel() {
  const { isPanelOpen, togglePanel, friends, activeJam, joinJam, leaveJam } =
    useJamStore();

  if (!isPanelOpen) return null;

  return (
    <div
      style={{
        width: 272,
        height: "100%",
        background: "var(--surface-1)",
        borderLeft: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        animation: "slideIn 0.2s ease-out",
      }}
    >
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          Social
        </span>
        <button
          onClick={togglePanel}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-muted)",
            padding: 4,
            display: "flex",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color =
              "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
          }}
        >
          <X size={14} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {/* Active Jam */}
        {activeJam ? (
          <div
            style={{
              padding: 14,
              borderRadius: 12,
              background: "var(--accent-dim)",
              border: "1px solid var(--accent-border)",
              marginBottom: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--accent)",
                    animation: "pulse-dot 2s infinite",
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--accent)",
                    letterSpacing: "0.08em",
                  }}
                >
                  LIVE JAM
                </span>
              </div>
              <button
                onClick={leaveJam}
                style={{
                  fontSize: 11,
                  color: "#ef4444",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Leave
              </button>
            </div>
            <div style={{ display: "flex", gap: -4, marginBottom: 10 }}>
              {activeJam.participants.map((p, i) => (
                <div
                  key={i}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: `hsl(${i * 90 + 230}, 60%, 55%)`,
                    border: "2px solid var(--surface-1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    marginLeft: i > 0 ? -6 : 0,
                  }}
                >
                  {p.username[0]}
                </div>
              ))}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 8px",
                borderRadius: 6,
                background: "rgba(0,0,0,0.2)",
                fontSize: 11,
                color: "var(--text-secondary)",
              }}
            >
              <Music size={10} color="var(--accent)" />
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {activeJam.sharedQueue[0]?.title}
              </span>
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 20 }}>
            <p
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                marginBottom: 10,
                lineHeight: 1.4,
              }}
            >
              Jam-Sync (WebRTC) ist geplant. Audio wird vom Host per HTTPS
              gestreamt.
            </p>
            <button
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontSize: 12,
                fontWeight: 500,
                color: "var(--text-secondary)",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "var(--accent-border)";
                el.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "var(--border)";
                el.style.color = "var(--text-secondary)";
              }}
            >
              <Radio size={14} color="var(--accent)" />
              Host a Jam Session
            </button>
          </div>
        )}

        {/* Friends */}
        <p
          style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-muted)",
            padding: "0 4px",
            marginBottom: 8,
          }}
        >
          Friends
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {friends.length === 0 ? (
            <p
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                padding: "8px 4px",
              }}
            >
              Noch keine Freunde — Discovery folgt in Phase 1.
            </p>
          ) : (
            friends.map((friend) => (
              <div
                key={friend.id}
                style={{
                  padding: "10px 10px",
                  borderRadius: 8,
                  cursor: "pointer",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--surface-2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ position: "relative" }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: `hsl(${parseInt(friend.id) * 90 + 200}, 50%, 45%)`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {friend.username[0]}
                    </div>
                    {friend.isOnline && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: -1,
                          right: -1,
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: "var(--accent)",
                          border: "2px solid var(--surface-1)",
                          boxShadow: "0 0 6px var(--accent-glow)",
                        }}
                      />
                    )}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: "var(--text-primary)",
                      }}
                    >
                      {friend.username}
                    </p>
                    {friend.currentTrack && (
                      <p
                        style={{
                          fontSize: 10,
                          color: "var(--text-muted)",
                          marginTop: 2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        ♫ {friend.currentTrack}
                      </p>
                    )}
                  </div>
                </div>
                {friend.currentTrack && !activeJam && (
                  <button
                    onClick={() => joinJam(`jam-${friend.id}`)}
                    style={{
                      marginTop: 8,
                      width: "100%",
                      padding: "5px 0",
                      borderRadius: 8,
                      background: "var(--accent-dim)",
                      border: "1px solid var(--accent-border)",
                      color: "var(--accent)",
                      fontSize: 11,
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                  >
                    Join Jam
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
