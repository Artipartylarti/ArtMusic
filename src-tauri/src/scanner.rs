use rusqlite::{params, Connection};
use std::path::Path;
use uuid::Uuid;
use walkdir::WalkDir;
// Lofty für das Extrahieren von ID3, FLAC und MP4 Tags
use lofty::file::TaggedFileExt;
use lofty::file::AudioFile;
use lofty::probe::Probe;
use lofty::tag::Accessor;

pub fn scan_and_index(directory: &str, conn: &Connection) -> Result<usize, String> {
    let mut added_tracks = 0;

    for entry in WalkDir::new(directory).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();

        if path.is_file() {
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();

            if matches!(ext.as_str(), "mp3" | "flac" | "wav" | "m4a") {
                if let Ok(track_data) = parse_metadata(path, &ext) {

                    let id = Uuid::new_v4().to_string();
                    let server_id = "local"; // Wird später dynamisch

                    // Insert oder Ignore in die Datenbank
                    let result = conn.execute(
                        "INSERT OR IGNORE INTO tracks (id, server_id, title, artist, album, duration_ms, codec, is_lossless, source, file_path_or_id, cover_path)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                        params![
                            id,
                            server_id,
                            track_data.title,
                            track_data.artist,
                            track_data.album,
                            track_data.duration_ms,
                            ext,
                            ext == "flac" || ext == "wav", // Simple Lossless Check
                            "local",
                            path.to_string_lossy().to_string(),
                            None::<String>
                        ],
                    );

                    // Only count rows that were actually inserted.
                    // INSERT OR IGNORE returns Ok(0) for duplicates, so
                    // result.is_ok() alone would over-count.
                    if result.map(|n| n > 0).unwrap_or(false) {
                        added_tracks += 1;
                    }
                }
            }
        }
    }

    Ok(added_tracks)
}

struct ParsedTrack {
    title: String,
    artist: String,
    album: String,
    duration_ms: i64,
}

fn parse_metadata(path: &Path, _ext: &str) -> Result<ParsedTrack, ()> {
    // Standard-Fallback-Werte, falls keine Tags existieren
    let fallback_title = path.file_name().unwrap_or_default().to_string_lossy().to_string();

    let mut parsed = ParsedTrack {
        title: fallback_title,
        artist: "Unknown Artist".to_string(),
        album: "Unknown Album".to_string(),
        duration_ms: 0,
    };

    if let Ok(tagged_file) = Probe::open(path).and_then(|p| p.read()) {
        let tag = tagged_file.primary_tag().or_else(|| tagged_file.first_tag());

        if let Some(tag) = tag {
            if let Some(title) = tag.title() { parsed.title = title.into_owned(); }
            if let Some(artist) = tag.artist() { parsed.artist = artist.into_owned(); }
            if let Some(album) = tag.album() { parsed.album = album.into_owned(); }
        }

        parsed.duration_ms = tagged_file.properties().duration().as_millis() as i64;
    }

    Ok(parsed)
}
