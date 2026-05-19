mod auth;
mod db;
mod scanner;
mod server;

use auth::sanitize_tunnel_slug;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;
use serde::Serialize;
use rusqlite::{Connection, OptionalExtension};

#[derive(Serialize)]
pub struct TrackSearchResult {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub file_path: String,
}

#[tauri::command]
fn search_tracks(query: &str, db: tauri::State<'_, Mutex<Connection>>) -> Result<Vec<TrackSearchResult>, String> {
    let conn = db.lock().map_err(|_| "Failed to lock database".to_string())?;

    // FTS5 search — join with the tracks table so we get the real UUID (id),
    // not the integer rowid that the FTS index exposes internally.
    let mut stmt = conn.prepare(
        "SELECT t.id, t.title, t.artist, t.album, t.file_path_or_id
         FROM tracks_fts
         JOIN tracks t ON tracks_fts.rowid = t.rowid
         WHERE tracks_fts MATCH ?1
         ORDER BY rank
         LIMIT 20"
    ).map_err(|e| e.to_string())?;

    // FTS5 search with proper escaping - wrap query in quotes for exact phrase matching
    // First sanitize: remove quotes and escape special FTS5 operators
    let mut fts_query = query.replace("\"", "").replace("*", "").replace("-", " ").replace("+", " ");
    // Add prefix wildcard for partial matching
    fts_query = format!("{}*", fts_query);

    let track_iter = stmt.query_map([&fts_query], |row| {
        Ok(TrackSearchResult {
            id: row.get(0)?,
            title: row.get(1)?,
            artist: row.get(2)?,
            album: row.get(3)?,
            file_path: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for track in track_iter {
        if let Ok(t) = track {
            results.push(t);
        }
    }

    Ok(results)
}

#[tauri::command]
fn get_default_music_dir() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        let profile = std::env::var("USERPROFILE").ok()?;
        let music = std::path::Path::new(&profile).join("Music");
        if music.is_dir() {
            return Some(music.to_string_lossy().into_owned());
        }
    }
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").ok()?;
        let music = std::path::Path::new(&home).join("Music");
        if music.is_dir() {
            return Some(music.to_string_lossy().into_owned());
        }
    }
    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").ok()?;
        let music = std::path::Path::new(&home).join("Music");
        if music.is_dir() {
            return Some(music.to_string_lossy().into_owned());
        }
    }
    None
}

#[tauri::command]
fn scan_directory(path: &str, db: tauri::State<'_, Mutex<Connection>>) -> Result<usize, String> {
    let conn = db.lock().map_err(|_| "Failed to lock database".to_string())?;
    scanner::scan_and_index(path, &conn)
}

#[derive(Serialize)]
pub struct TrackInfo {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_ms: i64,
    pub file_path: String,
    pub cover_path: Option<String>,
    pub play_count: i64,
}

#[derive(Serialize)]
pub struct ArtistRow {
    pub id: String,
    pub name: String,
    pub bio: Option<String>,
    pub image_path: Option<String>,
}

#[tauri::command]
fn add_track_to_db(
    title: &str,
    artist: &str,
    album: &str,
    file_path: &str,
    cover_path: Option<&str>,
    db: tauri::State<'_, Mutex<Connection>>
) -> Result<String, String> {
    let conn = db.lock().map_err(|_| "Failed to lock database".to_string())?;
    let id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO tracks (id, server_id, title, artist, album, duration_ms, codec, is_lossless, source, file_path_or_id, cover_path)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![
            id,
            "local",
            title,
            artist,
            album,
            0,
            "mp3",
            false,
            "local",
            file_path,
            cover_path
        ]
    ).map_err(|e| e.to_string())?;

    Ok(id)
}

#[tauri::command]
fn get_all_tracks(db: tauri::State<'_, Mutex<Connection>>) -> Result<Vec<TrackInfo>, String> {
    let conn = db.lock().map_err(|_| "Failed to lock database".to_string())?;
    let mut stmt = conn.prepare("SELECT id, title, artist, album, duration_ms, file_path_or_id, cover_path, play_count FROM tracks")
        .map_err(|e| e.to_string())?;

    let track_iter = stmt.query_map([], |row| {
        Ok(TrackInfo {
            id: row.get(0)?,
            title: row.get(1)?,
            artist: row.get(2)?,
            album: row.get(3)?,
            duration_ms: row.get(4)?,
            file_path: row.get(5)?,
            cover_path: row.get(6)?,
            play_count: row.get(7).unwrap_or(0),
        })
    }).map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for track in track_iter {
        if let Ok(t) = track {
            results.push(t);
        }
    }
    Ok(results)
}

#[derive(Serialize)]
pub struct ReleaseInfo {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub release_type: String,
    pub cover_gradient: String,
    pub cover_path: Option<String>,
    pub tracks: Vec<TrackInfo>,
}

#[tauri::command]
fn add_release_to_db(
    title: &str,
    artist: &str,
    release_type: &str,
    cover_gradient: &str,
    cover_path: Option<&str>,
    track_ids: Vec<String>,
    db: tauri::State<'_, Mutex<Connection>>
) -> Result<String, String> {
    let mut conn = db.lock().map_err(|_| "Failed to lock database".to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let id = format!("release-{}", uuid::Uuid::new_v4());

    tx.execute(
        "INSERT INTO releases (id, title, artist, type, cover_gradient, cover_path)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![id, title, artist, release_type, cover_gradient, cover_path]
    ).map_err(|e| e.to_string())?;

    for track_id in track_ids {
        tx.execute(
            "INSERT INTO release_tracks (release_id, track_id)
             VALUES (?1, ?2)",
            rusqlite::params![id, track_id]
        ).map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn get_all_releases(db: tauri::State<'_, Mutex<Connection>>) -> Result<Vec<ReleaseInfo>, String> {
    let conn = db.lock().map_err(|_| "Failed to lock database".to_string())?;

    let mut stmt = conn.prepare("SELECT id, title, artist, type, cover_gradient, cover_path FROM releases")
        .map_err(|e| e.to_string())?;

    let release_iter = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, Option<String>>(5)?,
        ))
    }).map_err(|e| e.to_string())?;

    let mut releases = Vec::new();
    for release in release_iter {
        if let Ok((id, title, artist, release_type, cover_gradient, cover_path)) = release {
            let mut track_stmt = conn.prepare(
                "SELECT t.id, t.title, t.artist, t.album, t.duration_ms, t.file_path_or_id, t.cover_path, t.play_count
                 FROM tracks t
                 INNER JOIN release_tracks rt ON t.id = rt.track_id
                 WHERE rt.release_id = ?1"
            ).map_err(|e| e.to_string())?;

            let track_iter = track_stmt.query_map(rusqlite::params![id], |row| {
                Ok(TrackInfo {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    artist: row.get(2)?,
                    album: row.get(3)?,
                    duration_ms: row.get(4)?,
                    file_path: row.get(5)?,
                    cover_path: row.get(6)?,
                    play_count: row.get(7).unwrap_or(0),
                })
            }).map_err(|e| e.to_string())?;

            let mut tracks = Vec::new();
            for track in track_iter {
                if let Ok(t) = track {
                    tracks.push(t);
                }
            }

            releases.push(ReleaseInfo {
                id,
                title,
                artist,
                release_type,
                cover_gradient,
                cover_path,
                tracks,
            });
        }
    }

    Ok(releases)
}


// ── Platform info ─────────────────────────────────────────────────────────────

/// Returns the current OS: "windows", "macos", or "linux".
#[tauri::command]
fn get_platform() -> &'static str {
    std::env::consts::OS
}

// ── Play count ──────────────────────────────────────────────────────────────

#[tauri::command]
fn increment_play_count(track_id: &str, db: tauri::State<'_, Mutex<Connection>>) -> Result<(), String> {
    let conn = db.lock().map_err(|_| "DB lock failed".to_string())?;
    conn.execute(
        "UPDATE tracks SET play_count = play_count + 1 WHERE id = ?1",
        rusqlite::params![track_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

/// Import a single audio file and add it to the library
#[tauri::command]
async fn import_track_file(
    file_path: String,
    db: tauri::State<'_, Mutex<Connection>>,
) -> Result<String, String> {
    use lofty::file::TaggedFileExt;
    use lofty::file::AudioFile;
    use lofty::probe::Probe;
    use lofty::tag::Accessor;
    
    let path = std::path::Path::new(&file_path);
    let ext = path.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    
    // Validate it's an audio file
    if !matches!(ext.as_str(), "mp3" | "flac" | "wav" | "m4a" | "ogg" | "aac") {
        return Err("Unsupported audio format".to_string());
    }
    
    // Parse metadata
    let mut title = path.file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let mut artist = "Unknown Artist".to_string();
    let mut album = "Unknown Album".to_string();
    let mut duration_ms: i64 = 0;
    
    if let Ok(tagged_file) = Probe::open(path).and_then(|p| p.read()) {
        let tag = tagged_file.primary_tag().or_else(|| tagged_file.first_tag());
        if let Some(tag) = tag {
            if let Some(t) = tag.title() { title = t.into_owned(); }
            if let Some(a) = tag.artist() { artist = a.into_owned(); }
            if let Some(a) = tag.album() { album = a.into_owned(); }
        }
        duration_ms = tagged_file.properties().duration().as_millis() as i64;
    }
    
    // Add to database
    let conn = db.lock().map_err(|_| "DB lock failed".to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    
    conn.execute(
        "INSERT INTO tracks (id, server_id, title, artist, album, duration_ms, codec, is_lossless, source, file_path_or_id, cover_path)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![
            id,
            "local",
            title,
            artist,
            album,
            duration_ms,
            ext,
            ext == "flac" || ext == "wav",
            "local",
            file_path,
            None::<String>
        ]
    ).map_err(|e| e.to_string())?;
    
    Ok(id)
}

// Auto-register artist accounts after scan
#[tauri::command]
fn register_artist_accounts(db: tauri::State<'_, Mutex<Connection>>) -> Result<usize, String> {
    let conn = db.lock().map_err(|_| "DB lock failed".to_string())?;
    
    // Get unique artists from tracks
    let mut stmt = conn.prepare(
        "SELECT DISTINCT artist FROM tracks WHERE artist != 'Unknown Artist'"
    ).map_err(|e| e.to_string())?;
    
    let artists: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    
    let mut registered = 0;
    
    for artist in artists {
        // Check if user already exists
        let exists: bool = conn.query_row(
            "SELECT COUNT(*) > 0 FROM users WHERE username = ?1",
            [&artist],
            |row| row.get(0),
        ).unwrap_or(false);
        
        if !exists {
            // Create artist account (no password = verified by default via artist status)
            let id = uuid::Uuid::new_v4().to_string();
            let slug = sanitize_tunnel_slug(&artist);
            
            conn.execute(
                "INSERT INTO users (id, username, display_name, tunnel_slug, password_hash, is_artist, created_at)
                 VALUES (?1, ?2, ?3, ?4, 'NO_PASSWORD', 1, ?5)",
                rusqlite::params![
                    id,
                    artist.clone(),
                    artist.clone(),
                    slug,
                    chrono::Utc::now().timestamp(),
                ],
            ).map_err(|e| e.to_string())?;
            
            registered += 1;
        }
    }
    
    Ok(registered)
}

#[tauri::command]
fn get_top_tracks(limit: i64, db: tauri::State<'_, Mutex<Connection>>) -> Result<Vec<TrackInfo>, String> {
    let conn = db.lock().map_err(|_| "DB lock failed".to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, title, artist, album, duration_ms, file_path_or_id, cover_path, play_count
         FROM tracks WHERE play_count > 0 ORDER BY play_count DESC LIMIT ?1"
    ).map_err(|e| e.to_string())?;

    let iter = stmt.query_map(rusqlite::params![limit], |row| {
        Ok(TrackInfo {
            id:          row.get(0)?,
            title:       row.get(1)?,
            artist:      row.get(2)?,
            album:       row.get(3)?,
            duration_ms: row.get(4)?,
            file_path:   row.get(5)?,
            cover_path:  row.get(6)?,
            play_count:  row.get(7).unwrap_or(0),
        })
    }).map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    for t in iter { if let Ok(t) = t { out.push(t); } }
    Ok(out)
}

// ── Artist management ───────────────────────────────────────────────────────

#[tauri::command]
fn upsert_artist(name: &str, db: tauri::State<'_, Mutex<Connection>>) -> Result<String, String> {
    let conn = db.lock().map_err(|_| "DB lock failed".to_string())?;

    // Return existing id if artist already exists
    if let Some(id) = conn.query_row(
        "SELECT id FROM artists WHERE name = ?1 COLLATE NOCASE",
        rusqlite::params![name],
        |row| row.get::<_, String>(0),
    ).optional().map_err(|e| e.to_string())? {
        return Ok(id);
    }

    let id = uuid::Uuid::new_v4().to_string();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64;
    conn.execute(
        "INSERT INTO artists (id, name, created_at) VALUES (?1, ?2, ?3)",
        rusqlite::params![id, name, now],
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn get_artist_by_name(name: &str, db: tauri::State<'_, Mutex<Connection>>) -> Result<Option<ArtistRow>, String> {
    let conn = db.lock().map_err(|_| "DB lock failed".to_string())?;
    conn.query_row(
        "SELECT id, name, bio, image_path FROM artists WHERE name = ?1 COLLATE NOCASE",
        rusqlite::params![name],
        |row| Ok(ArtistRow { id: row.get(0)?, name: row.get(1)?, bio: row.get(2)?, image_path: row.get(3)? }),
    ).optional().map_err(|e| e.to_string())
}

#[tauri::command]
fn update_artist_image(artist_id: &str, image_path: &str, db: tauri::State<'_, Mutex<Connection>>) -> Result<(), String> {
    let conn = db.lock().map_err(|_| "DB lock failed".to_string())?;
    conn.execute(
        "UPDATE artists SET image_path = ?1 WHERE id = ?2",
        rusqlite::params![image_path, artist_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

/// Save raw image bytes (base64-encoded) to the app data directory and return the file path.
#[tauri::command]
async fn save_image_to_app_dir(
    data_base64: String,
    extension: String,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&data_base64)
        .map_err(|e| format!("Base64 decode error: {}", e))?;

    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let images_dir = app_data_dir.join("images");
    std::fs::create_dir_all(&images_dir).map_err(|e| e.to_string())?;

    let ext = extension.trim_start_matches('.');
    let filename = format!("{}.{}", uuid::Uuid::new_v4(), ext);
    let path = images_dir.join(&filename);
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

// ── Release editing ─────────────────────────────────────────────────────────

#[tauri::command]
fn add_track_to_release(release_id: &str, track_id: &str, db: tauri::State<'_, Mutex<Connection>>) -> Result<(), String> {
    let conn = db.lock().map_err(|_| "DB lock failed".to_string())?;
    conn.execute(
        "INSERT OR IGNORE INTO release_tracks (release_id, track_id) VALUES (?1, ?2)",
        rusqlite::params![release_id, track_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn remove_track_from_release(release_id: &str, track_id: &str, db: tauri::State<'_, Mutex<Connection>>) -> Result<(), String> {
    let conn = db.lock().map_err(|_| "DB lock failed".to_string())?;
    conn.execute(
        "DELETE FROM release_tracks WHERE release_id = ?1 AND track_id = ?2",
        rusqlite::params![release_id, track_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_release(release_id: &str, db: tauri::State<'_, Mutex<Connection>>) -> Result<(), String> {
    let conn = db.lock().map_err(|_| "DB lock failed".to_string())?;
    conn.execute("DELETE FROM releases WHERE id = ?1", rusqlite::params![release_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// Check if WebView2 is installed
#[tauri::command]
fn check_webview2() -> Result<bool, String> {
    // Check if WebView2 runtime is installed
    let webview2_path = std::env::var("LOCALAPPDATA")
        .map(|p| PathBuf::from(p).join("Microsoft\\Edge\\WebView2\\Application"))
        .ok();

    if let Some(path) = webview2_path {
        if path.exists() {
            return Ok(true);
        }
    }

    // Also check in Program Files
    let program_paths = [
        PathBuf::from("C:\\Program Files (x86)\\Microsoft\\EdgeWebView\\Application"),
        PathBuf::from("C:\\Program Files\\Microsoft\\EdgeWebView\\Application"),
    ];

    for path in &program_paths {
        if path.exists() {
            return Ok(true);
        }
    }

    Ok(false)
}

// Try to install WebView2 using PowerShell (available on Windows)
#[tauri::command]
fn install_webview2() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        
        let bootstrapper_url = "https://msedge.sf.dl.delivery.mp.microsoft.com/filestreamingservice/files/0bbb66e3-8f09-497b-a082-aedbdee906e2/MicrosoftEdgeWebview2Setup.exe";
        
        // Download to temp folder using PowerShell
        let temp_dir = std::env::temp_dir();
        let installer_path = temp_dir.join("WebView2Setup.exe");
        
        println!("Downloading WebView2 installer...");
        
        // Use PowerShell to download (available on all Windows)
        let ps_script = format!(
            "Invoke-WebRequest -Uri '{}' -OutFile '{}'",
            bootstrapper_url,
            installer_path.to_string_lossy()
        );
        
        let output = Command::new("powershell")
            .args(["-Command", &ps_script])
            .output();
            
        match output {
            Ok(_) if installer_path.exists() => {
                // Run the installer silently
                println!("Running WebView2 installer...");
                let _ = Command::new(&installer_path)
                    .args(["/silent", "/install"])
                    .spawn();
                    
                Ok("WebView2 wird installiert! Bitte diese App nach Abschluss neu starten.".to_string())
            }
            err => {
                println!("Download failed: {:?}", err);
                Ok(format!(
                    "Automatische Installation fehlgeschlagen.\n\
                    Bitte manuell herunterladen:\n\
                    {}\n\
                    Nach der Installation App neu starten.",
                    bootstrapper_url
                ))
            }
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Ok("WebView2 ist nur für Windows verfügbar".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Hole den AppData Pfad des OS via Tauri
            let app_data_dir = app.path().app_data_dir().expect("Failed to resolve AppData directory");

            // Initialisiere die Datenbank und speichere die Connection im App-State
            let conn = db::initialize_database(app_data_dir).expect("Failed to initialize database");
            app.manage(Mutex::new(conn));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_webview2,
            install_webview2,
            search_tracks,
            get_default_music_dir,
            scan_directory,
            add_track_to_db,
            get_all_tracks,
            add_release_to_db,
            get_all_releases,
            get_platform,
            // play count
            increment_play_count,
            import_track_file,
            get_top_tracks,
            // artists
            upsert_artist,
            get_artist_by_name,
            update_artist_image,
            save_image_to_app_dir,
            // release editing
            add_track_to_release,
            remove_track_from_release,
            delete_release,
            // auth
            auth::register_user,
            auth::login_user,
            auth::logout_user,
            auth::get_auth_session,
            auth::get_tunnel_slug,
            register_artist_accounts,
            // server
            server::get_local_ip,
            server::get_hosting_status,
            server::start_hosting_server,
            server::stop_hosting_server,
            server::start_public_tunnel,
            server::stop_public_tunnel
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
