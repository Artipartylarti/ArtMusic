use std::thread;
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::net::UdpSocket;
use std::path::Path;
use tiny_http::{Server, Response, Header, SslConfig};
use rusqlite::{Connection, params};
use serde::Serialize;
use tauri::{Manager, State};

// global state for the hosting server
lazy_static::lazy_static! {
    static ref SERVER_RUNNING: Arc<AtomicBool> = Arc::new(AtomicBool::new(false));
    static ref SERVER_PORT: Mutex<Option<u16>> = Mutex::new(None);
    static ref SSH_TUNNEL_CHILD: Mutex<Option<std::process::Child>> = Mutex::new(None);
    static ref SSH_TUNNEL_URL: Mutex<Option<String>> = Mutex::new(None);
}

#[derive(Serialize)]
pub struct HostTrack {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_ms: i64,
    pub cover_path: Option<String>,
}

#[derive(Serialize)]
pub struct HostRelease {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub release_type: String,
    pub cover_gradient: String,
    pub cover_path: Option<String>,
    pub tracks: Vec<HostTrack>,
}

#[derive(Serialize)]
pub struct HostingInfo {
    pub is_running: bool,
    pub port: Option<u16>,
    pub local_ip: Option<String>,
    pub tunnel_url: Option<String>,
    pub tunnel_slug: Option<String>,
    pub stable_public_url: Option<String>,
}

const WEB_PLAYER_HTML: &str = include_str!("web_player.html");

struct ByteRange {
    start: u64,
    end: u64,
}

fn mime_for_path(path: &str) -> &'static str {
    match Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .as_deref()
    {
        Some("mp3") => "audio/mpeg",
        Some("flac") => "audio/flac",
        Some("wav") => "audio/wav",
        Some("m4a") => "audio/mp4",
        Some("aac") => "audio/aac",
        Some("ogg") => "audio/ogg",
        Some("opus") => "audio/opus",
        Some("png") => "image/png",
        Some("webp") => "image/webp",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("svg") => "image/svg+xml",
        Some("css") => "text/css",
        Some("js") => "application/javascript",
        Some("json") => "application/json",
        Some("html") => "text/html",
        Some("txt") => "text/plain",
        // Default to octet-stream for unknown types (safer than incorrectly claiming JPEG)
        _ => "application/octet-stream",
    }
}

fn parse_range_header(request: &tiny_http::Request, file_size: u64) -> Option<ByteRange> {
    let range_value = request
        .headers()
        .iter()
        .find(|h| h.field.equiv("Range"))
        .map(|h| h.value.as_str())?;

    let spec = range_value.strip_prefix("bytes=")?;
    let (start_str, end_str) = spec.split_once('-')?;
    let start: u64 = start_str.parse().ok()?;
    let end = if end_str.is_empty() {
        file_size.saturating_sub(1)
    } else {
        end_str.parse().ok()?
    };

    if start > end || end >= file_size {
        return None;
    }

    Some(ByteRange { start, end })
}

fn respond_stream_file(
    request: tiny_http::Request,
    path: &str,
    cors_header: Header,
) -> Result<(), std::io::Error> {
    let mut file = File::open(path)?;
    let file_size = file.metadata()?.len();
    let mime = mime_for_path(path);
    let content_type =
        Header::from_bytes(&b"Content-Type"[..], mime.as_bytes()).unwrap();
    let accept_ranges = Header::from_bytes(&b"Accept-Ranges"[..], &b"bytes"[..]).unwrap();

    if let Some(range) = parse_range_header(&request, file_size) {
        let length = range.end - range.start + 1;
        file.seek(SeekFrom::Start(range.start))?;
        let body = file.take(length);

        let content_range = Header::from_bytes(
            &b"Content-Range"[..],
            format!("bytes {}-{}/{}", range.start, range.end, file_size).as_bytes(),
        )
        .unwrap();
        let content_length =
            Header::from_bytes(&b"Content-Length"[..], length.to_string().as_bytes()).unwrap();

        let response = Response::new(
            tiny_http::StatusCode(206),
            vec![
                content_type,
                content_range,
                content_length,
                accept_ranges,
                cors_header,
            ],
            body,
            Some(length as usize),
            None,
        );
        let _ = request.respond(response);
    } else {
        let mut response = Response::from_file(file);
        response.add_header(content_type);
        response.add_header(accept_ranges);
        response.add_header(cors_header);
        let _ = request.respond(response);
    }

    Ok(())
}

#[tauri::command]
pub fn get_local_ip() -> Option<String> {
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    let local_addr = socket.local_addr().ok()?;
    Some(local_addr.ip().to_string())
}

#[tauri::command]
pub fn get_hosting_status(
    db: State<'_, Mutex<Connection>>,
) -> Result<HostingInfo, String> {
    let conn = db.lock().map_err(|_| "DB lock failed".to_string())?;

    // Read the stable public url from the users table
    let stable_public_url: Option<String> = conn.query_row(
        "SELECT public_url FROM users WHERE id = (SELECT value FROM app_settings WHERE key = 'current_user_id')",
        [],
        |row| row.get(0)
    ).ok().flatten();

    let tunnel_slug = crate::auth::get_current_user_slug(&conn)?;

    let active_tunnel = SSH_TUNNEL_URL.lock().unwrap().clone();
    let tunnel_url = active_tunnel.or_else(|| stable_public_url.clone());

    Ok(HostingInfo {
        is_running: SERVER_RUNNING.load(Ordering::Relaxed),
        port: *SERVER_PORT.lock().unwrap(),
        local_ip: get_local_ip(),
        tunnel_url,
        tunnel_slug,
        stable_public_url,
    })
}

fn handle_client_request(request: tiny_http::Request, db_path: std::path::PathBuf, ca_cert_path: std::path::PathBuf) {
    let url = request.url().to_string();
    let method = request.method().as_str();

    println!("Received {} request for {}", method, url);

    // CORS headers
    let cors_header = Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap();
    let cors_headers_header = Header::from_bytes(&b"Access-Control-Allow-Headers"[..], &b"Content-Type, Authorization"[..]).unwrap();
    let cors_methods_header = Header::from_bytes(&b"Access-Control-Allow-Methods"[..], &b"GET, POST, OPTIONS"[..]).unwrap();

    if method == "OPTIONS" {
        let mut response = Response::empty(200);
        response.add_header(cors_header);
        response.add_header(cors_headers_header);
        response.add_header(cors_methods_header);
        let _ = request.respond(response);
        return;
    }

    if url == "/" || url == "/index.html" {
        let mut response = Response::from_string(WEB_PLAYER_HTML);
        response.add_header(Header::from_bytes(&b"Content-Type"[..], &b"text/html; charset=utf-8"[..]).unwrap());
        response.add_header(cors_header);
        let _ = request.respond(response);
    } else if url == "/ca.crt" {
        match std::fs::read(&ca_cert_path) {
            Ok(content) => {
                let mut response = Response::from_data(content);
                response.add_header(Header::from_bytes(&b"Content-Type"[..], &b"application/x-x509-ca-cert"[..]).unwrap());
                response.add_header(Header::from_bytes(&b"Content-Disposition"[..], &b"attachment; filename=\"ca.crt\""[..]).unwrap());
                response.add_header(cors_header);
                let _ = request.respond(response);
            }
            Err(e) => {
                let mut r = Response::from_string(format!("CA certificate read error: {}", e));
                r.add_header(cors_header);
                let _ = request.respond(r.with_status_code(500));
            }
        }
    } else if url == "/api/health" {
        let mut response = Response::from_string(r#"{"status":"ok"}"#);
        response.add_header(Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap());
        // Cache health for 5 seconds
        response.add_header(Header::from_bytes(&b"Cache-Control"[..], &b"max-age=5, public"[..]).unwrap());
        response.add_header(cors_header);
        let _ = request.respond(response);
    
    } else if url == "/api/tracks" {
        match Connection::open(&db_path) {
            Ok(conn) => {
                let mut stmt = match conn.prepare("SELECT id, title, artist, album, duration_ms, cover_path FROM tracks") {
                    Ok(st) => st,
                    Err(e) => {
                        let mut r = Response::from_string(format!("Database error: {}", e));
                        r.add_header(cors_header);
                        let _ = request.respond(r.with_status_code(500));
                        return;
                    }
                };

                let track_iter = stmt.query_map([], |row| {
                    Ok(HostTrack {
                        id: row.get(0)?,
                        title: row.get(1)?,
                        artist: row.get(2)?,
                        album: row.get(3)?,
                        duration_ms: row.get(4)?,
                        cover_path: row.get(5)?,
                    })
                });

                if let Ok(iter) = track_iter {
                    let mut tracks = Vec::new();
                    for track in iter {
                        if let Ok(t) = track {
                            tracks.push(t);
                        }
                    }

                    let json = serde_json::to_string(&tracks).unwrap();
                    let mut response = Response::from_string(json);
                    response.add_header(Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap());
                    // Cache tracks for 30 seconds - they don't change often
                    response.add_header(Header::from_bytes(&b"Cache-Control"[..], &b"max-age=30, public"[..]).unwrap());
                    response.add_header(cors_header);
                    let _ = request.respond(response);
                } else {
                    let mut r = Response::from_string("Failed to map tracks");
                    r.add_header(cors_header);
                    let _ = request.respond(r.with_status_code(500));
                }
            }
            Err(e) => {
                let mut r = Response::from_string(format!("Failed to open DB: {}", e));
                r.add_header(cors_header);
                let _ = request.respond(r.with_status_code(500));
            }
        }
    } else if url == "/api/releases" {
        match Connection::open(&db_path) {
            Ok(conn) => {
                let mut stmt = match conn.prepare("SELECT id, title, artist, type, cover_gradient, cover_path FROM releases") {
                    Ok(st) => st,
                    Err(e) => {
                        let mut r = Response::from_string(format!("Database error: {}", e));
                        r.add_header(cors_header);
                        let _ = request.respond(r.with_status_code(500));
                        return;
                    }
                };

                let release_iter = stmt.query_map([], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                        row.get::<_, String>(4)?,
                        row.get::<_, Option<String>>(5)?,
                    ))
                });

                if let Ok(iter) = release_iter {
                    let mut releases = Vec::new();
                    for r in iter {
                        if let Ok((id, title, artist, release_type, cover_gradient, cover_path)) = r {
                            let mut track_stmt = match conn.prepare(
                                "SELECT t.id, t.title, t.artist, t.album, t.duration_ms, t.cover_path
                                 FROM tracks t
                                 INNER JOIN release_tracks rt ON t.id = rt.track_id
                                 WHERE rt.release_id = ?1"
                            ) {
                                Ok(st) => st,
                                Err(_) => continue,
                            };

                            let track_iter = track_stmt.query_map(rusqlite::params![id], |row| {
                                Ok(HostTrack {
                                    id: row.get(0)?,
                                    title: row.get(1)?,
                                    artist: row.get(2)?,
                                    album: row.get(3)?,
                                    duration_ms: row.get(4)?,
                                    cover_path: row.get(5)?,
                                })
                            });

                            let mut tracks = Vec::new();
                            if let Ok(ti) = track_iter {
                                for t in ti {
                                    if let Ok(track_obj) = t {
                                        tracks.push(track_obj);
                                    }
                                }
                            }

                            releases.push(HostRelease {
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

                    let json = serde_json::to_string(&releases).unwrap();
                    let mut response = Response::from_string(json);
                    response.add_header(Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap());
                    // Cache releases for 30 seconds
                    response.add_header(Header::from_bytes(&b"Cache-Control"[..], &b"max-age=30, public"[..]).unwrap());
                    response.add_header(cors_header);
                    let _ = request.respond(response);
                } else {
                    let mut r = Response::from_string("Failed to map releases");
                    r.add_header(cors_header);
                    let _ = request.respond(r.with_status_code(500));
                }
            }
            Err(e) => {
                let mut r = Response::from_string(format!("Failed to open DB: {}", e));
                r.add_header(cors_header);
                let _ = request.respond(r.with_status_code(500));
            }
        }
    } else if url.starts_with("/stream/") {
        let track_id = url.trim_start_matches("/stream/");
        match Connection::open(&db_path) {
            Ok(conn) => {
                let mut stmt = match conn.prepare("SELECT file_path_or_id FROM tracks WHERE id = ?1") {
                    Ok(st) => st,
                    Err(e) => {
                        let mut r = Response::from_string(format!("Database error: {}", e));
                        r.add_header(cors_header);
                        let _ = request.respond(r.with_status_code(500));
                        return;
                    }
                };

                let mut file_path: Option<String> = None;
                if let Ok(mut rows) = stmt.query(params![track_id]) {
                    if let Ok(Some(row)) = rows.next() {
                        if let Ok(path) = row.get::<_, String>(0) {
                            file_path = Some(path);
                        }
                    }
                }

                if let Some(path) = file_path {
                    if let Err(e) = respond_stream_file(request, &path, cors_header) {
                        eprintln!("Stream error for {}: {}", path, e);
                    }
                    return;
                } else {
                    let mut r = Response::from_string("Track not found");
                    r.add_header(cors_header);
                    let _ = request.respond(r.with_status_code(404));
                }
            }
            Err(e) => {
                let mut r = Response::from_string(format!("Database open failed: {}", e));
                r.add_header(cors_header);
                let _ = request.respond(r.with_status_code(500));
            }
        }
    } else if url.starts_with("/cover/release/") {
        let release_id = url.trim_start_matches("/cover/release/");
        match Connection::open(&db_path) {
            Ok(conn) => {
                let mut stmt = match conn.prepare("SELECT cover_path FROM releases WHERE id = ?1") {
                    Ok(st) => st,
                    Err(e) => {
                        let mut r = Response::from_string(format!("Database error: {}", e));
                        r.add_header(cors_header);
                        let _ = request.respond(r.with_status_code(500));
                        return;
                    }
                };

                let mut cover_path: Option<String> = None;
                if let Ok(mut rows) = stmt.query(params![release_id]) {
                    if let Ok(Some(row)) = rows.next() {
                        if let Ok(Some(path)) = row.get::<_, Option<String>>(0) {
                            cover_path = Some(path);
                        }
                    }
                }

                if let Some(path) = cover_path {
                    match File::open(&path) {
                        Ok(file) => {
                            let mut response = Response::from_file(file);
                            response.add_header(Header::from_bytes(&b"Content-Type"[..], mime_for_path(&path).as_bytes()).unwrap());
                            response.add_header(cors_header);
                            let _ = request.respond(response);
                        }
                        Err(e) => {
                            let mut r = Response::from_string(format!("File read error: {}", e));
                            r.add_header(cors_header);
                            let _ = request.respond(r.with_status_code(404));
                        }
                    }
                } else {
                    let mut r = Response::from_string("Cover art not found");
                    r.add_header(cors_header);
                    let _ = request.respond(r.with_status_code(404));
                }
            }
            Err(e) => {
                let mut r = Response::from_string(format!("Database open failed: {}", e));
                r.add_header(cors_header);
                let _ = request.respond(r.with_status_code(500));
            }
        }
    } else if url.starts_with("/cover/") {
        let track_id = url.trim_start_matches("/cover/");
        match Connection::open(&db_path) {
            Ok(conn) => {
                let mut stmt = match conn.prepare("SELECT cover_path FROM tracks WHERE id = ?1") {
                    Ok(st) => st,
                    Err(e) => {
                        let mut r = Response::from_string(format!("Database error: {}", e));
                        r.add_header(cors_header);
                        let _ = request.respond(r.with_status_code(500));
                        return;
                    }
                };

                let mut cover_path: Option<String> = None;
                if let Ok(mut rows) = stmt.query(params![track_id]) {
                    if let Ok(Some(row)) = rows.next() {
                        if let Ok(Some(path)) = row.get::<_, Option<String>>(0) {
                            cover_path = Some(path);
                        }
                    }
                }

                if let Some(path) = cover_path {
                    match File::open(&path) {
                        Ok(file) => {
                            let mut response = Response::from_file(file);
                            response.add_header(Header::from_bytes(&b"Content-Type"[..], mime_for_path(&path).as_bytes()).unwrap());
                            response.add_header(cors_header);
                            let _ = request.respond(response);
                        }
                        Err(e) => {
                            let mut r = Response::from_string(format!("File read error: {}", e));
                            r.add_header(cors_header);
                            let _ = request.respond(r.with_status_code(404));
                        }
                    }
                } else {
                    let mut r = Response::from_string("Cover art not found");
                    r.add_header(cors_header);
                    let _ = request.respond(r.with_status_code(404));
                }
            }
            Err(e) => {
                let mut r = Response::from_string(format!("Database open failed: {}", e));
                r.add_header(cors_header);
                let _ = request.respond(r.with_status_code(500));
            }
        }
    } else {
        let mut r = Response::from_string("Not Found");
        r.add_header(cors_header);
        let _ = request.respond(r.with_status_code(404));
    }
}

#[tauri::command]
pub fn start_hosting_server(port: u16, app_handle: tauri::AppHandle) -> Result<String, String> {
    if SERVER_RUNNING.load(Ordering::Relaxed) {
        return Err("Hosting server is already running".to_string());
    }

    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("artmusic_library.db");

    // Try to open a read-only test connection to verify DB is initialized
    let _conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open library database: {}", e))?;

    SERVER_RUNNING.store(true, Ordering::Relaxed);
    *SERVER_PORT.lock().unwrap() = Some(port);

    let running = SERVER_RUNNING.clone();
    let ca_cert_path = app_data_dir.join("ca.crt");
    let ca_key_path = app_data_dir.join("ca.key");

    // Generate Root CA if it doesn't exist
    if !ca_cert_path.exists() || !ca_key_path.exists() {
        let mut ca_params = rcgen::CertificateParams::default();
        ca_params.distinguished_name.push(rcgen::DnType::CommonName, "ArtMusic Local Root CA");
        ca_params.is_ca = rcgen::IsCa::Ca(rcgen::BasicConstraints::Unconstrained);
        ca_params.key_usages = vec![
            rcgen::KeyUsagePurpose::KeyCertSign,
            rcgen::KeyUsagePurpose::DigitalSignature,
            rcgen::KeyUsagePurpose::CrlSign,
        ];

        let ca_key_pair = rcgen::KeyPair::generate().unwrap();
        let ca_cert = ca_params.self_signed(&ca_key_pair).unwrap();

        std::fs::write(&ca_cert_path, ca_cert.pem()).unwrap();
        std::fs::write(&ca_key_path, ca_key_pair.serialize_pem()).unwrap();
    }

    let ca_cert_path_clone = ca_cert_path.clone();

    thread::spawn(move || {
        let local_ip = get_local_ip().unwrap_or_else(|| "127.0.0.1".to_string());
        let subject_alt_names = vec!["localhost".to_string(), local_ip.clone()];

        // Load CA and sign server certificate
        let ca_key_pem = match std::fs::read_to_string(&ca_key_path) {
            Ok(pem) => pem,
            Err(e) => {
                println!("Failed to read CA private key: {}", e);
                running.store(false, Ordering::Relaxed);
                return;
            }
        };

        let ca_key_pair = match rcgen::KeyPair::from_pem(&ca_key_pem) {
            Ok(kp) => kp,
            Err(e) => {
                println!("Failed to parse CA key pair: {}", e);
                running.store(false, Ordering::Relaxed);
                return;
            }
        };

        let ca_cert_pem = match std::fs::read_to_string(&ca_cert_path_clone) {
            Ok(pem) => pem,
            Err(e) => {
                println!("Failed to read CA certificate: {}", e);
                running.store(false, Ordering::Relaxed);
                return;
            }
        };

        let ca_issuer = match rcgen::Issuer::from_ca_cert_pem(&ca_cert_pem, ca_key_pair) {
            Ok(i) => i,
            Err(e) => {
                println!("Failed to parse CA certificate: {}", e);
                running.store(false, Ordering::Relaxed);
                return;
            }
        };

        let mut server_params = rcgen::CertificateParams::new(subject_alt_names).unwrap();
        server_params.distinguished_name.push(rcgen::DnType::CommonName, local_ip.clone());
        server_params.key_usages = vec![
            rcgen::KeyUsagePurpose::DigitalSignature,
            rcgen::KeyUsagePurpose::KeyEncipherment,
        ];

        let server_key_pair = rcgen::KeyPair::generate().unwrap();
        let server_cert = match server_params.signed_by(&server_key_pair, &ca_issuer) {
            Ok(c) => c,
            Err(e) => {
                println!("Failed to sign server certificate: {}", e);
                running.store(false, Ordering::Relaxed);
                return;
            }
        };

        let ssl_config = SslConfig {
            certificate: server_cert.pem().into_bytes(),
            private_key: server_key_pair.serialize_pem().into_bytes(),
        };

        // Spawn Server 1: HTTPS LAN Server (binds specifically to LAN IP)
        let running_clone1 = running.clone();
        let db_path_clone1 = db_path.clone();
        let ca_cert_path_clone1 = ca_cert_path_clone.clone();
        let local_ip_clone = local_ip.clone();
        let ssl_config_clone = ssl_config.clone();

        if local_ip != "127.0.0.1" {
            thread::spawn(move || {
                let server_addr = format!("{}:{}", local_ip_clone, port);
                let server = match Server::https(&server_addr, ssl_config_clone) {
                    Ok(s) => s,
                    Err(e) => {
                        println!("Failed to start tiny_http HTTPS server on {}: {}", server_addr, e);
                        return;
                    }
                };
                println!("Self-Hosting HTTPS LAN Server active on {}", server_addr);

                while running_clone1.load(Ordering::Relaxed) {
                    if let Ok(Some(request)) = server.recv_timeout(std::time::Duration::from_millis(100)) {
                        let db = db_path_clone1.clone();
                        let ca = ca_cert_path_clone1.clone();
                        thread::spawn(move || {
                            handle_client_request(request, db, ca);
                        });
                    }
                }
                println!("HTTPS LAN Server stopped.");
            });
        }

        // Spawn Server 2: HTTP Local Server (binds specifically to 127.0.0.1 loopback for secure tunnel)
        let running_clone2 = running.clone();
        let db_path_clone2 = db_path.clone();
        let ca_cert_path_clone2 = ca_cert_path_clone.clone();
        thread::spawn(move || {
            let server_addr = format!("127.0.0.1:{}", port);
            let server = match Server::http(&server_addr) {
                Ok(s) => s,
                Err(e) => {
                    println!("Failed to start tiny_http HTTP server on {}: {}", server_addr, e);
                    running_clone2.store(false, Ordering::Relaxed);
                    return;
                }
            };
            println!("Self-Hosting HTTP Local Server active on {}", server_addr);

            while running_clone2.load(Ordering::Relaxed) {
                if let Ok(Some(request)) = server.recv_timeout(std::time::Duration::from_millis(100)) {
                    let db = db_path_clone2.clone();
                    let ca = ca_cert_path_clone2.clone();
                    thread::spawn(move || {
                        handle_client_request(request, db, ca);
                    });
                }
            }
            println!("HTTP Local Server stopped.");
        });
    });

    Ok(format!("Server successfully started on port {}", port))
}

#[tauri::command]
pub fn stop_hosting_server() -> Result<String, String> {
    if !SERVER_RUNNING.load(Ordering::Relaxed) {
        return Err("Hosting server is not running".to_string());
    }

    SERVER_RUNNING.store(false, Ordering::Relaxed);
    *SERVER_PORT.lock().unwrap() = None;

    // Also stop SSH tunnel if running
    let mut current_child = SSH_TUNNEL_CHILD.lock().unwrap();
    if let Some(mut child) = current_child.take() {
        let _ = child.kill();
    }
    *SSH_TUNNEL_URL.lock().unwrap() = None;

    Ok("Server shutdown initiated".to_string())
}

#[tauri::command]
pub fn start_public_tunnel(
    port: u16,
    db: State<'_, Mutex<Connection>>,
) -> Result<String, String> {
    let mut current_child = SSH_TUNNEL_CHILD.lock().unwrap();
    if current_child.is_some() {
        return Err("Tunnel is already running".to_string());
    }

    let conn = db.lock().map_err(|_| "DB lock failed".to_string())?;
    // We still require login, but the URL is generated by localhost.run based on SSH key
    let _slug = crate::auth::get_current_user_slug(&conn)?
        .ok_or("Bitte zuerst anmelden, um einen festen öffentlichen Link zu erhalten.".to_string())?;

    use std::process::{Command, Stdio};
    use std::io::{BufRead, BufReader, Read};

    // Cross-platform home directory: USERPROFILE on Windows, HOME on macOS/Linux
    let home_dir = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| {
            if cfg!(target_os = "windows") { "C:\\Users\\Default".to_string() }
            else { "/tmp".to_string() }
        });
    let ssh_dir = std::path::Path::new(&home_dir).join(".ssh");
    let ssh_key_path = ssh_dir.join("id_ed25519");

    if !ssh_key_path.exists() {
        let _ = std::fs::create_dir_all(&ssh_dir);
        let _ = Command::new("ssh-keygen")
            .args(["-t", "ed25519", "-N", "", "-f", ssh_key_path.to_str().unwrap()])
            .output();
    }

    // Use localhost.run for stable URL based on SSH key
    let remote_forward = format!("80:127.0.0.1:{}", port);

    // /dev/null on macOS/Linux, NUL on Windows
    #[cfg(target_os = "windows")]
    let null_device = "NUL";
    #[cfg(not(target_os = "windows"))]
    let null_device = "/dev/null";

    let mut child = Command::new("ssh")
        .args([
            "-o",
            "StrictHostKeyChecking=no",
            "-o",
            &format!("UserKnownHostsFile={}", null_device),
            "-o",
            "ServerAliveInterval=15",
            "-o",
            "ServerAliveCountMax=3",
            "-o",
            "ExitOnForwardFailure=yes",
            "-R",
            &remote_forward,
            "localhost.run",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            format!(
                "SSH konnte nicht gestartet werden. Ist OpenSSH installiert? {}",
                e
            )
        })?;

    let stdout = child.stdout.take().ok_or("Failed to capture SSH stdout")?;
    let mut reader = BufReader::new(stdout);
    let mut ssh_reported_url = String::new();

    for _ in 0..100 {
        let mut line = String::new();
        match reader.read_line(&mut line) {
            Ok(0) => break,
            Ok(_) => {
                println!("SSH stdout: {}", line);
                if line.contains("https://") {
                    if let Some(start) = line.find("https://") {
                        let part = &line[start..];
                        ssh_reported_url = part
                            .split_whitespace()
                            .next()
                            .unwrap_or(part)
                            .trim()
                            .to_string();
                        break;
                    }
                }
            }
            Err(_) => break,
        }
    }

    if ssh_reported_url.is_empty() {
        let mut stderr_content = String::new();
        if let Some(mut stderr) = child.stderr.take() {
            let _ = stderr.read_to_string(&mut stderr_content);
        }
        let _ = child.kill();
        return Err(format!(
            "Tunnel konnte nicht aufgebaut werden.\n{}",
            stderr_content.trim()
        ));
    }

    // Save the new public URL to the database for this user
    let _ = conn.execute(
        "UPDATE users SET public_url = ?1 WHERE id = (SELECT value FROM app_settings WHERE key = 'current_user_id')",
        params![ssh_reported_url],
    );

    *SSH_TUNNEL_URL.lock().unwrap() = Some(ssh_reported_url.clone());
    *current_child = Some(child);

    // Auto-Reconnect Thread
    let remote_forward_clone = remote_forward.clone();
    thread::spawn(move || {
        loop {
            if SSH_TUNNEL_URL.lock().unwrap().is_none() {
                break;
            }

            // Poll the child process every 2 seconds until it exits or the
            // tunnel is intentionally stopped.
            let child_exited = loop {
                thread::sleep(std::time::Duration::from_secs(2));

                if SSH_TUNNEL_URL.lock().unwrap().is_none() {
                    let mut guard = SSH_TUNNEL_CHILD.lock().unwrap();
                    if let Some(mut c) = guard.take() {
                        let _ = c.kill();
                    }
                    return;
                }

                let mut guard = SSH_TUNNEL_CHILD.lock().unwrap();
                if let Some(c) = guard.as_mut() {
                    match c.try_wait() {
                        Ok(Some(_)) => break true,
                        Ok(None) => {} // still running
                        Err(_) => break true,
                    }
                } else {
                    break true;
                }
            };

            if SSH_TUNNEL_URL.lock().unwrap().is_none() {
                break;
            }

            if child_exited {
                println!("SSH tunnel disconnected. Reconnecting in 3s...");
                thread::sleep(std::time::Duration::from_secs(3));

                if SSH_TUNNEL_URL.lock().unwrap().is_none() {
                    break;
                }

                let new_child = Command::new("ssh")
                    .args([
                        "-o", "StrictHostKeyChecking=no",
                        "-o", &format!("UserKnownHostsFile={}", null_device),
                        "-o", "ServerAliveInterval=15",
                        "-o", "ServerAliveCountMax=3",
                        "-o", "ExitOnForwardFailure=yes",
                        "-R", &remote_forward_clone,
                        "localhost.run",
                    ])
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .spawn();

                if let Ok(c) = new_child {
                    let mut guard = SSH_TUNNEL_CHILD.lock().unwrap();
                    *guard = Some(c);
                    println!("SSH tunnel reconnected.");
                }
            }
        }
    });

    Ok(ssh_reported_url)
}

#[tauri::command]
pub fn stop_public_tunnel() -> Result<String, String> {
    let mut current_child = SSH_TUNNEL_CHILD.lock().unwrap();
    if let Some(mut child) = current_child.take() {
        let _ = child.kill();
    }
    *SSH_TUNNEL_URL.lock().unwrap() = None;
    Ok("Tunnel successfully stopped".to_string())
}
