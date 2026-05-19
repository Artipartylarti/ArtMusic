import { useState, useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import { Server, Wifi, WifiOff, Link, Copy, Check, RefreshCw, ExternalLink, Globe } from "lucide-react";

export function HostingPanel() {
  const {
    isHosting,
    hostingPort,
    hostingIP,
    isTunneling,
    tunnelURL,
    stablePublicUrl,
    startHosting,
    stopHosting,
    startTunnel,
    stopTunnel,
    refreshHostingStatus,
  } = useAppStore();

  const [showPanel, setShowPanel] = useState(false);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [tunnelStarting, setTunnelStarting] = useState(false);

  // Auto-refresh status every 10 seconds when hosting
  useEffect(() => {
    if (!isHosting && !isTunneling) return;
    
    const interval = setInterval(() => {
      refreshHostingStatus();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [isHosting, isTunneling, refreshHostingStatus]);

  // Initial status check
  useEffect(() => {
    refreshHostingStatus();
  }, []);

  async function handleStartServer() {
    try {
      setStarting(true);
      await startHosting(hostingPort);
    } catch (e) {
      console.error("Failed to start server:", e);
    } finally {
      setStarting(false);
    }
  }

  async function handleStopServer() {
    try {
      await stopHosting();
      if (isTunneling) {
        await stopTunnel();
      }
    } catch (e) {
      console.error("Failed to stop server:", e);
    }
  }

  async function handleStartTunnel() {
    try {
      setTunnelStarting(true);
      await startTunnel();
    } catch (e) {
      console.error("Failed to start tunnel:", e);
    } finally {
      setTunnelStarting(false);
    }
  }

  async function handleStopTunnel() {
    try {
      await stopTunnel();
    } catch (e) {
      console.error("Failed to stop tunnel:", e);
    }
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const displayUrl = isTunneling ? tunnelURL : stablePublicUrl;

  return (
    <div style={{ position: "relative" }}>
      {/* Toggle button */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 12px",
          background: isHosting ? "var(--accent-dim)" : "var(--surface-1)",
          border: `1px solid ${isHosting ? "var(--accent-border)" : "var(--border)"}`,
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 500,
          color: isHosting ? "var(--accent)" : "var(--text-secondary)",
          cursor: "pointer",
          transition: "all 0.2s",
        }}
      >
        <Wifi size={14} style={{ color: isHosting ? "var(--accent)" : undefined }} />
        {isHosting ? `Hosted on :${hostingPort}` : "Selbst hosten"}
      </button>

      {/* Panel */}
      {showPanel && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 8,
            width: 320,
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
            zIndex: 1000,
            padding: 16,
          }}
        >
          {/* Status header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: isHosting ? "#22c55e" : "#ef4444",
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {isHosting ? "Server aktiv" : "Server inaktiv"}
              </span>
            </div>
            <button
              onClick={() => refreshHostingStatus()}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: 4,
              }}
              title="Status aktualisieren"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {/* Server info when running */}
          {isHosting && (
            <div
              style={{
                background: "var(--surface-3)",
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
              }}
            >
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                LAN Adresse
              </p>
              <p
                style={{
                  fontSize: 13,
                  fontFamily: "monospace",
                  color: "var(--text-primary)",
                }}
              >
                http://{hostingIP}:{hostingPort}
              </p>
            </div>
          )}

          {/* Public URL when tunneling */}
          {displayUrl && (
            <div
              style={{
                background: "var(--accent-dim)",
                border: "1px solid var(--accent-border)",
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
              }}
            >
              <p style={{ fontSize: 11, color: "var(--accent)", marginBottom: 4 }}>
                Öffentlicher Link
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <a
                  href={displayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 12,
                    fontFamily: "monospace",
                    color: "var(--accent)",
                    textDecoration: "none",
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {displayUrl}
                </a>
                <button
                  onClick={() => copyUrl(displayUrl)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--accent)",
                    cursor: "pointer",
                    padding: 4,
                  }}
                  title="Link kopieren"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
                <a
                  href={displayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--accent)",
                    cursor: "pointer",
                    padding: 4,
                  }}
                  title="Im Browser öffnen"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          )}

          {/* Control buttons */}
          {!isHosting ? (
            <button
              onClick={handleStartServer}
              disabled={starting}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "12px 16px",
                background: "var(--accent)",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: "var(--surface-0)",
                cursor: starting ? "not-allowed" : "pointer",
                opacity: starting ? 0.7 : 1,
                transition: "all 0.2s",
              }}
            >
              <Server size={16} />
              {starting ? "Starte Server..." : "Server starten"}
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Open in Browser - Public URL */}
              {displayUrl && (
                <a
                  href={displayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "10px 16px",
                    background: "var(--accent)",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--surface-0)",
                    textDecoration: "none",
                    cursor: "pointer",
                  }}
                >
                  <Globe size={14} />
                  Im Browser öffnen
                </a>
              )}

              {/* Open in Browser - LAN URL (always shown when hosting) */}
              <a
                href={`http://${hostingIP}:${hostingPort}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "10px 16px",
                  background: "var(--surface-3)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  textDecoration: "none",
                  cursor: "pointer",
                }}
              >
                <Globe size={14} />
                Im LAN öffnen
              </a>
              {/* Public tunnel button */}
              {!isTunneling ? (
                <button
                  onClick={handleStartTunnel}
                  disabled={tunnelStarting}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "10px 16px",
                    background: "var(--accent-dim)",
                    border: "1px solid var(--accent-border)",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--accent)",
                    cursor: tunnelStarting ? "not-allowed" : "pointer",
                    opacity: tunnelStarting ? 0.7 : 1,
                  }}
                >
                  <Link size={14} />
                  {tunnelStarting ? "Verbinde..." : "Öffentlichen Link erstellen"}
                </button>
              ) : (
                <button
                  onClick={handleStopTunnel}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "10px 16px",
                    background: "var(--red-dim)",
                    border: "1px solid var(--red-border)",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--red)",
                    cursor: "pointer",
                  }}
                >
                  <Link size={14} />
                  Öffentlichen Link beenden
                </button>
              )}

              {/* Stop server button */}
              <button
                onClick={handleStopServer}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "10px 16px",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                <WifiOff size={14} />
                Server stoppen
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}