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

pub fn sanitize_tunnel_slug(input: &str) -> String {
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
