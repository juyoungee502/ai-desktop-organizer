use crate::models::{HistoryRun, OrganizePreviewInput, OrganizeRunResult, ScanResult, UndoResult};
use crate::organizer;
use crate::scanner;
use chrono::Utc;
use std::path::PathBuf;
use tauri::AppHandle;

fn storage_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let dir = app_handle
        .path_resolver()
        .app_data_dir()
        .ok_or_else(|| "앱 데이터 폴더를 찾을 수 없습니다.".to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("앱 데이터 폴더 생성 실패: {e}"))?;
    Ok(dir)
}

#[tauri::command]
pub fn scan_desktop() -> Result<ScanResult, String> {
    let desktop_dir = scanner::desktop_path()?;
    let entries = scanner::scan_entries(&desktop_dir)?;
    Ok(ScanResult {
        desktop_path: desktop_dir.to_string_lossy().to_string(),
        entries,
        scanned_at: Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
pub fn execute_organize(
    app_handle: AppHandle,
    preview: OrganizePreviewInput,
) -> Result<OrganizeRunResult, String> {
    let desktop_dir = scanner::desktop_path()?;
    let storage = storage_dir(&app_handle)?;
    organizer::execute_organize(&desktop_dir, &storage, preview)
}

#[tauri::command]
pub fn undo_last(app_handle: AppHandle) -> Result<UndoResult, String> {
    let desktop_dir = scanner::desktop_path()?;
    let storage = storage_dir(&app_handle)?;
    organizer::undo_last(&desktop_dir, &storage)
}

#[tauri::command]
pub fn get_history(app_handle: AppHandle) -> Result<Vec<HistoryRun>, String> {
    let storage = storage_dir(&app_handle)?;
    Ok(organizer::get_history(&storage))
}
