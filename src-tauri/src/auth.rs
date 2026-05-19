use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use rusqlite::{params, Connection};
use serde::Serialize;
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

#[derive(Serialize, Clone)]
pub struct AuthUser {
    pub id: String,
    pub username: String,
    pub display_name: String,
    pub tunnel_slug: String,
    pub public_url: String,
}

fn sanitize_tunnel_slug(input: &str) -> String {
    let mut s: String = input
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-')
        .take(32)
        .collect::<String>()
        .to_lowercase();
    while s.starts_with('-') {
        s.remove(0);
    }
    while s.ends_with('-') {
        s.pop();
    }
    if s.len() < 3 {
        format!("art-{}", &Uuid::new_v4().to_string()[..8])
    } else {
        s
    }
}

fn unique_tunnel_slug(conn: &Connection, base: &str) -> Result<String, String> {
    let base = sanitize_tunnel_slug(base);
    let mut candidate = base.clone();
    let mut suffix = 0u32;
    loop {
        let exists: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM users WHERE tunnel_slug = ?1",
                params![candidate],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        if !exists {
            return Ok(candidate);
        }
        suffix += 1;
        candidate = format!("{}-{}", base, suffix);
        if candidate.len() > 32 {
            candidate = format!("art-{}", &Uuid::new_v4().to_string()[..8]);
        }
    }
}

fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut rand::thread_rng());
    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| e.to_string())?
        .to_string();
    Ok(hash)
}

fn verify_password(password: &str, hash: &str) -> Result<bool, String> {
    let parsed = PasswordHash::new(hash).map_err(|e| e.to_string())?;
    Ok(
        Argon2::default()
            .verify_password(password.as_bytes(), &parsed)
            .is_ok(),
    )
}

fn set_current_user(conn: &Connection, user_id: Option<&str>) -> Result<(), String> {
    if let Some(id) = user_id {
        conn.execute(
            "INSERT INTO app_settings (key, value) VALUES ('current_user_id', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![id],
        )
        .map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "DELETE FROM app_settings WHERE key = 'current_user_id'",
            [],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn user_from_row(
    id: String,
    username: String,
    display_name: String,
    tunnel_slug: String,
    public_url: Option<String>,
) -> AuthUser {
    AuthUser {
        public_url: public_url.unwrap_or_else(|| "Starte den Server für deinen Link!".to_string()),
        id,
        username,
        display_name,
        tunnel_slug,
    }
}

#[tauri::command]
pub fn register_user(
    username: &str,
    password: &str,
    display_name: Option<&str>,
    db: State<'_, Mutex<Connection>>,
) -> Result<AuthUser, String> {
    let username = username.trim();
    if username.len() < 3 {
        return Err("Benutzername muss mindestens 3 Zeichen haben.".to_string());
    }
    if password.len() < 8 {
        return Err("Passwort muss mindestens 8 Zeichen haben.".to_string());
    }

    let conn = db.lock().map_err(|_| "DB lock failed".to_string())?;
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM users WHERE username = ?1",
            params![username],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if exists {
        return Err("Benutzername ist bereits vergeben.".to_string());
    }

    let id = Uuid::new_v4().to_string();
    let tunnel_slug = unique_tunnel_slug(&conn, username)?;
    let password_hash = hash_password(password)?;
    let display = display_name
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| username.to_string());
    let created_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    conn.execute(
        "INSERT INTO users (id, username, password_hash, display_name, tunnel_slug, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, username, password_hash, display, tunnel_slug, created_at],
    )
    .map_err(|e| e.to_string())?;

    set_current_user(&conn, Some(&id))?;

    let user = conn
        .query_row(
            "SELECT id, username, display_name, tunnel_slug, COALESCE(public_url, NULL) FROM users WHERE id = ?1",
            params![id],
            |row| {
                Ok(user_from_row(
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4).ok(),
                ))
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(user)
}

#[tauri::command]
pub fn login_user(
    username: &str,
    password: &str,
    db: State<'_, Mutex<Connection>>,
) -> Result<AuthUser, String> {
    let conn = db.lock().map_err(|_| "DB lock failed".to_string())?;

    let row = conn
        .query_row(
            "SELECT id, username, display_name, tunnel_slug, password_hash, COALESCE(public_url, NULL)
             FROM users WHERE username = ?1",
            params![username.trim()],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, Option<String>>(5)?,
                ))
            },
        )
        .map_err(|_| "Benutzername oder Passwort falsch.".to_string())?;

    if !verify_password(password, &row.4)? {
        return Err("Benutzername oder Passwort falsch.".to_string());
    }

    set_current_user(&conn, Some(&row.0))?;

    Ok(user_from_row(row.0, row.1, row.2, row.3, row.5))
}

#[tauri::command]
pub fn logout_user(db: State<'_, Mutex<Connection>>) -> Result<(), String> {
    let conn = db.lock().map_err(|_| "DB lock failed".to_string())?;
    set_current_user(&conn, None)
}

#[tauri::command]
pub fn get_auth_session(db: State<'_, Mutex<Connection>>) -> Result<Option<AuthUser>, String> {
    let conn = db.lock().map_err(|_| "DB lock failed".to_string())?;

    let user_id: Option<String> = conn
        .query_row(
            "SELECT value FROM app_settings WHERE key = 'current_user_id'",
            [],
            |row| row.get(0),
        )
        .ok();

    let Some(user_id) = user_id else {
        return Ok(None);
    };

    let user = conn
        .query_row(
            "SELECT id, username, display_name, tunnel_slug, COALESCE(public_url, NULL) FROM users WHERE id = ?1",
            params![user_id],
            |row| {
                Ok(user_from_row(
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4).ok(),
                ))
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(Some(user))
}

#[tauri::command]
pub fn get_tunnel_slug(db: State<'_, Mutex<Connection>>) -> Result<Option<String>, String> {
    let conn = db.lock().map_err(|_| "DB lock failed".to_string())?;
    get_current_user_slug(&conn)
}

pub fn get_current_user_slug(conn: &Connection) -> Result<Option<String>, String> {
    let user_id: Option<String> = conn
        .query_row(
            "SELECT value FROM app_settings WHERE key = 'current_user_id'",
            [],
            |row| row.get(0),
        )
        .ok();

    let Some(user_id) = user_id else {
        return Ok(None);
    };

    conn.query_row(
        "SELECT tunnel_slug FROM users WHERE id = ?1",
        params![user_id],
        |row| row.get(0),
    )
    .map_err(|e| e.to_string())
    .map(Some)
}

// ── Friends ───────────────────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct Friend {
    pub id: String,
    pub username: String,
    pub display_name: String,
    pub status: String, // "online" | "offline" | "in_jam"
    pub last_seen: i64,
}

#[tauri::command]
fn add_friend(
    friend_username: &str,
    db: State<'_, Mutex<Connection>>,
) -> Result<Friend, String> {
    let conn = db.lock().map_err(|_| "DB lock failed")?;
    
    // Find the user to add as friend
    let friend: Friend = conn
        .query_row(
            "SELECT id, username, display_name, COALESCE(last_seen, 0) FROM users WHERE username = ?1",
            [friend_username],
            |row| Ok(Friend {
                id: row.get(0)?,
                username: row.get(1)?,
                display_name: row.get(2)?,
                status: "offline".to_string(),
                last_seen: row.get(3)?,
            }),
        )
        .map_err(|_| "User not found")?;
    
    // Add to friends table (create if not exists)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS friends (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            friend_id TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )",
        [],
    ).map_err(|e| e.to_string())?;
    
    // Get current user
    let user_id: Option<String> = conn.query_row(
        "SELECT value FROM app_settings WHERE key = 'current_user_id'",
        [],
        |row| row.get(0),
    ).ok();
    
    if let Some(uid) = user_id {
        conn.execute(
            "INSERT OR IGNORE INTO friends (user_id, friend_id, status) VALUES (?1, ?2, 'pending')",
            rusqlite::params![uid, friend.id],
        ).map_err(|e| e.to_string())?;
    }
    
    Ok(friend)
}

#[tauri::command]
fn get_friends(
    db: State<'_, Mutex<Connection>>,
) -> Result<Vec<Friend>, String> {
    let conn = db.lock().map_err(|_| "DB lock failed")?;
    
    let user_id: Option<String> = conn.query_row(
        "SELECT value FROM app_settings WHERE key = 'current_user_id'",
        [],
        |row| row.get(0),
    ).ok();
    
    let Some(uid) = user_id else {
        return Ok(vec![]);
    };
    
    let mut stmt = conn.prepare(
        "SELECT u.id, u.username, u.display_name, 
                COALESCE(f.status, 'offline'), COALESCE(u.last_seen, 0)
         FROM users u
         LEFT JOIN friends f ON f.friend_id = u.id
         WHERE f.user_id = ?1
         ORDER BY u.display_name"
    ).map_err(|e| e.to_string())?;
    
    let friends = stmt.query_map([&uid], |row| {
        Ok(Friend {
            id: row.get(0)?,
            username: row.get(1)?,
            display_name: row.get(2)?,
            status: row.get(3)?,
            last_seen: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut result = Vec::new();
    for friend in friends {
        if let Ok(f) = friend {
            result.push(f);
        }
    }
    Ok(result)
}

#[tauri::command]
fn remove_friend(
    friend_id: &str,
    db: State<'_, Mutex<Connection>>,
) -> Result<(), String> {
    let conn = db.lock().map_err(|_| "DB lock failed")?;
    
    let user_id: Option<String> = conn.query_row(
        "SELECT value FROM app_settings WHERE key = 'current_user_id'",
        [],
        |row| row.get(0),
    ).ok();
    
    if let Some(uid) = user_id {
        conn.execute(
            "DELETE FROM friends WHERE user_id = ?1 AND friend_id = ?2",
            rusqlite::params![uid, friend_id],
        ).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

// ── Jams ─────────────────────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct Jam {
    pub id: String,
    pub name: String,
    pub host: String,
    pub participants: Vec<String>,
    pub current_track: Option<String>,
    pub is_playing: bool,
    pub position_ms: i64,
    pub created_at: i64,
}

#[tauri::command]
fn create_jam(
    name: &str,
    db: State<'_, Mutex<Connection>>,
) -> Result<Jam, String> {
    let conn = db.lock().map_err(|_| "DB lock failed")?;
    
    // Create jams table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS jams (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            host TEXT NOT NULL,
            current_track TEXT,
            is_playing INTEGER DEFAULT 0,
            position_ms INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL
        )",
        [],
    ).map_err(|e| e.to_string())?;
    
    // Create jam_participants table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS jam_participants (
            jam_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            joined_at INTEGER DEFAULT (strftime('%s', 'now')),
            PRIMARY KEY (jam_id, user_id)
        )",
        [],
    ).map_err(|e| e.to_string())?;
    
    let jam_id = Uuid::new_v4().to_string();
    let host = "Gast".to_string(); // Current user
    
    conn.execute(
        "INSERT INTO jams (id, name, host, created_at) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![jam_id, name, host, chrono::Utc::now().timestamp()],
    ).map_err(|e| e.to_string())?;
    
    // Add host as participant
    let user_id: Option<String> = conn.query_row(
        "SELECT id FROM users WHERE username = 'Gast' LIMIT 1",
        [],
        |row| row.get(0),
    ).ok();
    
    if let Some(uid) = user_id {
        conn.execute(
            "INSERT OR IGNORE INTO jam_participants (jam_id, user_id) VALUES (?1, ?2)",
            rusqlite::params![jam_id, uid],
        ).map_err(|e| e.to_string())?;
    }
    
    Ok(Jam {
        id: jam_id,
        name: name.to_string(),
        host,
        participants: vec!["Gast".to_string()],
        current_track: None,
        is_playing: false,
        position_ms: 0,
        created_at: chrono::Utc::now().timestamp(),
    })
}

#[tauri::command]
fn get_jams(
    db: State<'_, Mutex<Connection>>,
) -> Result<Vec<Jam>, String> {
    let conn = db.lock().map_err(|_| "DB lock failed")?;
    
    let mut stmt = conn.prepare(
        "SELECT id, name, host, created_at FROM jams ORDER BY created_at DESC LIMIT 10"
    ).map_err(|e| e.to_string())?;
    
    let jams = stmt.query_map([], |row| {
        Ok(Jam {
            id: row.get(0)?,
            name: row.get(1)?,
            host: row.get(2)?,
            participants: vec![],
            current_track: None,
            is_playing: false,
            position_ms: 0,
            created_at: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut result = Vec::new();
    for jam in jams {
        if let Ok(j) = jam {
            result.push(j);
        }
    }
    Ok(result)
}

#[tauri::command]
fn join_jam(
    jam_id: &str,
    db: State<'_, Mutex<Connection>>,
) -> Result<Jam, String> {
    let conn = db.lock().map_err(|_| "DB lock failed")?;
    
    let jam: Jam = conn.query_row(
        "SELECT id, name, host, created_at FROM jams WHERE id = ?1",
        [jam_id],
        |row| Ok(Jam {
            id: row.get(0)?,
            name: row.get(1)?,
            host: row.get(2)?,
            participants: vec![],
            current_track: None,
            is_playing: false,
            position_ms: 0,
            created_at: row.get(3)?,
        }),
    ).map_err(|_| "Jam not found")?;
    
    // Add user to jam participants
    let user_id: Option<String> = conn.query_row(
        "SELECT id FROM users WHERE username = 'Gast' LIMIT 1",
        [],
        |row| row.get(0),
    ).ok();
    
    if let Some(uid) = user_id {
        conn.execute(
            "INSERT OR IGNORE INTO jam_participants (jam_id, user_id) VALUES (?1, ?2)",
            rusqlite::params![jam_id, uid],
        ).map_err(|e| e.to_string())?;
    }
    
    Ok(jam)
}

#[tauri::command]
fn leave_jam(
    jam_id: &str,
    db: State<'_, Mutex<Connection>>,
) -> Result<(), String> {
    let conn = db.lock().map_err(|_| "DB lock failed")?;
    
    let user_id: Option<String> = conn.query_row(
        "SELECT id FROM users WHERE username = 'Gast' LIMIT 1",
        [],
        |row| row.get(0),
    ).ok();
    
    if let Some(uid) = user_id {
        conn.execute(
            "DELETE FROM jam_participants WHERE jam_id = ?1 AND user_id = ?2",
            rusqlite::params![jam_id, uid],
        ).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
fn sync_jam(
    jam_id: &str,
    track_id: Option<&str>,
    is_playing: bool,
    position_ms: i64,
    db: State<'_, Mutex<Connection>>,
) -> Result<Jam, String> {
    let conn = db.lock().map_err(|_| "DB lock failed")?;
    
    // Update jam state
    conn.execute(
        "UPDATE jams SET current_track = ?1, is_playing = ?2, position_ms = ?3 WHERE id = ?4",
        rusqlite::params![track_id, is_playing as i32, position_ms, jam_id],
    ).map_err(|e| e.to_string())?;
    
    // Return updated jam
    let jam: Jam = conn.query_row(
        "SELECT id, name, host, current_track, is_playing, position_ms, created_at 
         FROM jams WHERE id = ?1",
        [jam_id],
        |row| Ok(Jam {
            id: row.get(0)?,
            name: row.get(1)?,
            host: row.get(2)?,
            participants: vec![],
            current_track: row.get(3)?,
            is_playing: row.get(4)?,
            position_ms: row.get(5)?,
            created_at: row.get(6)?,
        }),
    ).map_err(|_| "Jam not found")?;
    
    Ok(jam)
}
