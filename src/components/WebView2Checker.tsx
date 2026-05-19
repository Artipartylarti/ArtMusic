import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface WebView2CheckerProps {
  onReady: () => void;
  children: React.ReactNode;
}

export function WebView2Checker({ onReady, children }: WebView2CheckerProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [needsInstall, setNeedsInstall] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    checkWebView2();
  }, []);

  async function checkWebView2() {
    try {
      // Check if WebView2 is already installed
      const isInstalled = await invoke<boolean>('check_webview2');
      
      if (isInstalled) {
        onReady();
      } else {
        setNeedsInstall(true);
      }
    } catch (err) {
      console.error('Failed to check WebView2:', err);
      // If check fails, assume it's not installed
      setNeedsInstall(true);
    } finally {
      setIsChecking(false);
    }
  }

  async function handleInstall() {
    setIsInstalling(true);
    try {
      const result = await invoke<string>('install_webview2');
      alert(result);
    } catch (err) {
      console.error('Failed to install WebView2:', err);
    } finally {
      setIsInstalling(false);
    }
  }

  if (isChecking) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-0)',
        color: 'var(--text-primary)',
      }}>
        <p>Prüfe System...</p>
      </div>
    );
  }

  if (needsInstall) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-0)',
        color: 'var(--text-primary)',
        gap: 16,
        padding: 32,
        textAlign: 'center',
      }}>
        <h2 style={{ margin: 0 }}>WebView2 wird benötigt</h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: 400 }}>
          ArtMusic benötigt Microsoft Edge WebView2, um die App-Oberfläche anzuzeigen.
          Dies ist ein kleines Systempaket von Microsoft.
        </p>
        <button
          onClick={handleInstall}
          disabled={isInstalling}
          style={{
            padding: '12px 24px',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: isInstalling ? 'wait' : 'pointer',
            opacity: isInstalling ? 0.7 : 1,
          }}
        >
          {isInstalling ? 'Installiere...' : 'WebView2 installieren'}
        </button>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Oder manuell herunterladen von:<br />
          <a 
            href="https://developer.microsoft.com/de-de/microsoft-edge/webview2/" 
            target="_blank"
            rel="noopener"
            style={{ color: 'var(--accent)' }}
          >
            Microsoft WebView2
          </a>
        </p>
      </div>
    );
  }

  return <>{children}</>;
}