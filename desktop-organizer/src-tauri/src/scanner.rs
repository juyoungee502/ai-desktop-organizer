use crate::models::DesktopEntry;
use chrono::{DateTime, Utc};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

/// Resolves the current user's Desktop folder without requiring elevation.
pub fn desktop_path() -> Result<PathBuf, String> {
    dirs::desktop_dir()
        .ok_or_else(|| "바탕화면 경로를 찾을 수 없습니다 (권한 또는 환경 문제일 수 있습니다).".to_string())
}

fn to_iso(time: SystemTime) -> String {
    let dt: DateTime<Utc> = time.into();
    dt.to_rfc3339()
}

#[cfg(windows)]
fn is_hidden_or_system(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
    const FILE_ATTRIBUTE_SYSTEM: u32 = 0x4;
    let attrs = metadata.file_attributes();
    (attrs & FILE_ATTRIBUTE_HIDDEN) != 0 || (attrs & FILE_ATTRIBUTE_SYSTEM) != 0
}

#[cfg(not(windows))]
fn is_hidden_or_system(_metadata: &fs::Metadata) -> bool {
    false
}

/// Scans exactly one directory level (the Desktop root). We deliberately do
/// not recurse into subfolders: files that already live inside an existing
/// folder are left alone, and only the folder itself becomes a candidate.
pub fn scan_entries(dir: &Path) -> Result<Vec<DesktopEntry>, String> {
    let read_dir = fs::read_dir(dir).map_err(|e| {
        let msg = e.to_string();
        if msg.to_lowercase().contains("permission") || msg.to_lowercase().contains("denied") {
            format!("바탕화면 폴더에 접근할 권한이 없습니다: {msg}")
        } else {
            format!("바탕화면 폴더를 읽을 수 없습니다: {msg}")
        }
    })?;

    let mut entries = Vec::new();

    for item in read_dir {
        let item = match item {
            Ok(i) => i,
            Err(_) => continue,
        };
        let file_name = item.file_name().to_string_lossy().to_string();
        if file_name.starts_with('.') {
            continue;
        }

        let metadata = match item.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        if is_hidden_or_system(&metadata) {
            continue;
        }

        let path = item.path();
        let is_directory = metadata.is_dir();
        let extension = if is_directory {
            String::new()
        } else {
            path.extension()
                .map(|e| e.to_string_lossy().to_lowercase())
                .unwrap_or_default()
        };
        let is_shortcut = extension == "lnk";
        let base_name = if is_directory {
            file_name.clone()
        } else {
            match file_name.rfind('.') {
                Some(idx) if idx > 0 => file_name[..idx].to_string(),
                _ => file_name.clone(),
            }
        };
        let size_bytes = if is_directory { 0 } else { metadata.len() };
        let modified_at = metadata
            .modified()
            .map(to_iso)
            .unwrap_or_else(|_| Utc::now().to_rfc3339());

        entries.push(DesktopEntry {
            id: path.to_string_lossy().to_string(),
            name: file_name,
            base_name,
            extension,
            is_directory,
            is_shortcut,
            size_bytes,
            modified_at,
            path: path.to_string_lossy().to_string(),
        });
    }

    entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(entries)
}
