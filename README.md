# ArtMusic

Dezentrale Musik-App für audiophile Nutzer: Spotify-ähnliche UX, self-hosted Bibliothek, LAN/HTTPS-Sharing ohne zentrale Streaming-Server.

## Dokumentation

Die **technische Spezifikation** (Phase 0, Budget-Entscheidungsgrundlage) liegt unter:

**[docs/TECHNISCHE_SPEZIFIKATION.md](docs/TECHNISCHE_SPEZIFIKATION.md)**

Enthält: Architektur, SQLite-Schema, HTTP-API, WebRTC-Jam-Protokoll (JSON-Payloads), Roadmap und ehrliche PoC-Abgrenzung.

## PoC-Status

| Feature | Status |
|---------|--------|
| Lokale Bibliothek (SQLite + FTS5) | ✅ |
| Desktop-Player (Tauri + HTML5 Audio) | ✅ |
| LAN HTTPS-Hosting + Web-Player | ✅ |
| Optional: SSH-Tunnel (localhost.run) | ✅ |
| Jam-Sync (WebRTC) | ⚠️ Modul vorhanden, nicht E2E |
| Signal-Server | ❌ geplant |

## Alternative: Qt (kein WebView2)

Falls Microsoft WebView2 nicht verfügbar ist, gibt es eine Alternative mit Qt:

```bash,python
# Python Abhängigkeiten installieren
pip install PyQt6 PyQt6-WebEngine

# Oder mit requirements
pip install -r requirements-qt.txt

# Qt Client starten
python artmusic_qt.py
```

**Qt Version verwendet:**
- PyQt6 6.11.0 mit WebEngine (Chromium-basiert)
- Kein WebView2 nötig
- Läuft auf Windows, Mac, Linux

## Entwicklung

```bash,bash
npm install
npm run tauri dev
```

Build:

```bash,bash
npm run tauri build
```

## Stack

- **Frontend:** React 19, TypeScript, Vite, Zustand
- **Desktop:** Tauri 2
- **Backend:** Rust (rusqlite, lofty, tiny_http, rcgen)
