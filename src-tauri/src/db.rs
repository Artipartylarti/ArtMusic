use rusqlite::{Connection, Result};
use std::path::PathBuf;
use std::fs;

pub fn initialize_database(app_data_dir: PathBuf) -> Result<Connection> {
    // Zero-Config: Erstelle das Verzeichnis, falls es nicht existiert
    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir).expect("Konnte App-Verzeichnis nicht erstellen");
    }

    let db_path = app_data_dir.join("artmusic_library.db");
    let conn = Connection::open(db_path)?;

    // 1. Kern-Tabelle für Tracks
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tracks (
            id TEXT PRIMARY KEY,
            server_id TEXT NOT NULL,
            title TEXT NOT NULL,
            artist TEXT NOT NULL,
            album TEXT NOT NULL,
            duration_ms INTEGER NOT NULL,
            codec TEXT NOT NULL,
            is_lossless BOOLEAN NOT NULL,
            source TEXT NOT NULL,
            file_path_or_id TEXT NOT NULL,
            cover_path TEXT
        )",
        [],
    )?;

    // 2. Tabellen für Releases (Alben, Singles, EPs)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS releases (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            artist TEXT NOT NULL,
            type TEXT NOT NULL,
            cover_gradient TEXT NOT NULL,
            cover_path TEXT
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS release_tracks (
            release_id TEXT NOT NULL,
            track_id TEXT NOT NULL,
            PRIMARY KEY (release_id, track_id),
            FOREIGN KEY (release_id) REFERENCES releases (id) ON DELETE CASCADE,
            FOREIGN KEY (track_id) REFERENCES tracks (id) ON DELETE CASCADE
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            display_name TEXT NOT NULL,
            tunnel_slug TEXT UNIQUE NOT NULL,
            created_at INTEGER NOT NULL,
            public_url TEXT
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    // Artists
    conn.execute(
        "CREATE TABLE IF NOT EXISTS artists (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            bio TEXT,
            image_path TEXT,
            created_at INTEGER NOT NULL
        )",
        [],
    )?;

    // Music Videos
    conn.execute(
        "CREATE TABLE IF NOT EXISTS music_videos (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            artist_id TEXT NOT NULL,
            track_id TEXT,
            url TEXT NOT NULL,
            thumbnail_path TEXT,
            duration_ms INTEGER,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (artist_id) REFERENCES artists (id) ON DELETE CASCADE,
            FOREIGN KEY (track_id) REFERENCES tracks (id) ON DELETE SET NULL
        )",
        [],
    )?;

    // Playlists
    conn.execute(
        "CREATE TABLE IF NOT EXISTS playlists (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            is_auto_generated BOOLEAN NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS playlist_tracks (
            playlist_id TEXT NOT NULL,
            track_id TEXT NOT NULL,
            position INTEGER NOT NULL,
            PRIMARY KEY (playlist_id, track_id),
            FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE CASCADE,
            FOREIGN KEY (track_id) REFERENCES tracks (id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Servers
    conn.execute(
        "CREATE TABLE IF NOT EXISTS servers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            url TEXT UNIQUE NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL
        )",
        [],
    )?;

    // Silent migrations
    let _ = conn.execute("ALTER TABLE tracks ADD COLUMN cover_path TEXT", []);
    let _ = conn.execute("ALTER TABLE tracks ADD COLUMN artist_id TEXT", []);
    let _ = conn.execute("ALTER TABLE users ADD COLUMN public_url TEXT", []);
    let _ = conn.execute("ALTER TABLE tracks ADD COLUMN play_count INTEGER NOT NULL DEFAULT 0", []);
    let _ = conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_tracks_file_path ON tracks(file_path_or_id)",
        [],
    );
    let _ = conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist_id)",
        [],
    );
    let _ = conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_music_videos_artist ON music_videos(artist_id)",
        [],
    );


    // 2. FTS5 Virtuelle Tabelle für 'Fast Global Search'
    conn.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts USING fts5(
            title, artist, album, content='tracks', content_rowid='rowid'
        )",
        [],
    )?;

    // 3. Trigger zur automatischen Indexierung (Zero-Maintenance)
    conn.execute_batch(
        "
        CREATE TRIGGER IF NOT EXISTS tracks_ai AFTER INSERT ON tracks BEGIN
            INSERT INTO tracks_fts(rowid, title, artist, album)
            VALUES (new.rowid, new.title, new.artist, new.album);
        END;
        CREATE TRIGGER IF NOT EXISTS tracks_ad AFTER DELETE ON tracks BEGIN
            INSERT INTO tracks_fts(tracks_fts, rowid, title, artist, album)
            VALUES ('delete', old.rowid, old.title, old.artist, old.album);
        END;
        CREATE TRIGGER IF NOT EXISTS tracks_au AFTER UPDATE ON tracks BEGIN
            INSERT INTO tracks_fts(tracks_fts, rowid, title, artist, album)
            VALUES ('delete', old.rowid, old.title, old.artist, old.album);
            INSERT INTO tracks_fts(rowid, title, artist, album)
            VALUES (new.rowid, new.title, new.artist, new.album);
        END;
        "
    )?;

    Ok(conn)
}
