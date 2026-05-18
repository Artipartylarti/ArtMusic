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

## Entwicklung

```bash
npm install
npm run tauri dev
```

Build:

```bash
npm run tauri build
```

## Stack

- **Frontend:** React 19, TypeScript, Vite, Zustand
- **Desktop:** Tauri 2
- **Backend:** Rust (rusqlite, lofty, tiny_http, rcgen)
