use crate::models::{
    HistoryOperation, HistoryRun, MoveError, OrganizePreviewInput, OrganizeRunResult, UndoResult,
};
use crate::scanner;
use chrono::Utc;
use std::fs;
use std::path::{Path, PathBuf};

const HISTORY_FILE: &str = "history.json";

fn history_file_path(storage_dir: &Path) -> PathBuf {
    storage_dir.join(HISTORY_FILE)
}

pub fn load_history(storage_dir: &Path) -> Vec<HistoryRun> {
    let path = history_file_path(storage_dir);
    let Ok(raw) = fs::read_to_string(&path) else {
        return Vec::new();
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

fn save_history(storage_dir: &Path, runs: &[HistoryRun]) -> Result<(), String> {
    fs::create_dir_all(storage_dir).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(runs).map_err(|e| e.to_string())?;
    fs::write(history_file_path(storage_dir), json).map_err(|e| e.to_string())
}

fn write_snapshot(storage_dir: &Path, run_id: &str, suffix: &str, desktop_dir: &Path) {
    // Best-effort: a snapshot failure should never block the actual move.
    let Ok(entries) = scanner::scan_entries(desktop_dir) else {
        return;
    };
    let dir = storage_dir.join("snapshots");
    if fs::create_dir_all(&dir).is_err() {
        return;
    }
    if let Ok(json) = serde_json::to_string_pretty(&entries) {
        let _ = fs::write(dir.join(format!("{run_id}_{suffix}.json")), json);
    }
}

fn generate_run_id() -> String {
    format!("run-{}", Utc::now().timestamp_millis())
}

/// Moves `from` to `to`, creating destination parent folders as needed.
/// Tries a fast rename first (same-volume, the common case since everything
/// stays under the Desktop), then falls back to copy+remove for files.
/// Never overwrites an existing destination.
fn move_path(from: &Path, to: &Path) -> Result<(), String> {
    if let Some(parent) = to.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("폴더 생성 실패: {e}"))?;
    }
    if to.exists() {
        return Err("대상 위치에 이미 같은 이름의 항목이 있습니다.".to_string());
    }
    match fs::rename(from, to) {
        Ok(_) => Ok(()),
        Err(_) if from.is_file() => {
            fs::copy(from, to).map_err(|e| format!("복사 실패: {e}"))?;
            fs::remove_file(from).map_err(|e| format!("원본 삭제 실패: {e}"))?;
            Ok(())
        }
        Err(e) => Err(format!("이동 실패: {e}")),
    }
}

fn within_desktop(path: &Path, desktop_dir: &Path) -> bool {
    path.starts_with(desktop_dir)
}

pub fn execute_organize(
    desktop_dir: &Path,
    storage_dir: &Path,
    input: OrganizePreviewInput,
) -> Result<OrganizeRunResult, String> {
    let run_id = generate_run_id();
    let timestamp = Utc::now().to_rfc3339();

    write_snapshot(storage_dir, &run_id, "before", desktop_dir);

    let mut operations: Vec<HistoryOperation> = Vec::new();
    let mut errors: Vec<MoveError> = Vec::new();

    for item in input.items {
        if item.keep_on_desktop {
            continue;
        }
        let from = PathBuf::from(&item.entry_id);
        let to = PathBuf::from(&item.destination_path);
        let name = from
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| item.entry_id.clone());

        if !within_desktop(&from, desktop_dir) || !within_desktop(&to, desktop_dir) {
            let message = "바탕화면 범위를 벗어난 경로는 이동하지 않습니다.".to_string();
            errors.push(MoveError { entry_id: item.entry_id.clone(), name: name.clone(), message: message.clone() });
            operations.push(HistoryOperation {
                entry_id: item.entry_id,
                name,
                from: from.to_string_lossy().to_string(),
                to: to.to_string_lossy().to_string(),
                status: "failed".to_string(),
                error_message: Some(message),
            });
            continue;
        }

        match move_path(&from, &to) {
            Ok(()) => operations.push(HistoryOperation {
                entry_id: item.entry_id,
                name,
                from: from.to_string_lossy().to_string(),
                to: to.to_string_lossy().to_string(),
                status: "moved".to_string(),
                error_message: None,
            }),
            Err(message) => {
                errors.push(MoveError { entry_id: item.entry_id.clone(), name: name.clone(), message: message.clone() });
                operations.push(HistoryOperation {
                    entry_id: item.entry_id,
                    name,
                    from: from.to_string_lossy().to_string(),
                    to: to.to_string_lossy().to_string(),
                    status: "failed".to_string(),
                    error_message: Some(message),
                });
            }
        }
    }

    write_snapshot(storage_dir, &run_id, "after", desktop_dir);

    let moved_count = operations.iter().filter(|o| o.status == "moved").count();
    let run = HistoryRun {
        run_id: run_id.clone(),
        timestamp: timestamp.clone(),
        operations,
        undone: false,
        undo_errors: None,
    };

    let mut history = load_history(storage_dir);
    history.insert(0, run);
    save_history(storage_dir, &history)?;

    Ok(OrganizeRunResult {
        run_id,
        timestamp,
        moved_count,
        errors,
        can_undo: moved_count > 0,
    })
}

pub fn undo_last(desktop_dir: &Path, storage_dir: &Path) -> Result<UndoResult, String> {
    let mut history = load_history(storage_dir);
    let Some(run_index) = history.iter().position(|r| !r.undone) else {
        return Ok(UndoResult { run_id: String::new(), restored_count: 0, errors: Vec::new(), success: false });
    };

    let mut errors: Vec<MoveError> = Vec::new();
    let mut restored = 0usize;
    let mut restored_parents: Vec<PathBuf> = Vec::new();

    {
        let run = &history[run_index];
        for op in &run.operations {
            if op.status != "moved" {
                continue;
            }
            let from = PathBuf::from(&op.to); // current location
            let to = PathBuf::from(&op.from); // original desktop location

            if !from.exists() {
                errors.push(MoveError {
                    entry_id: op.entry_id.clone(),
                    name: op.name.clone(),
                    message: "되돌릴 파일을 찾을 수 없습니다 (이미 이동되었거나 삭제됨).".to_string(),
                });
                continue;
            }
            if to.exists() {
                errors.push(MoveError {
                    entry_id: op.entry_id.clone(),
                    name: op.name.clone(),
                    message: "원래 위치에 이미 다른 파일이 있어 되돌릴 수 없습니다.".to_string(),
                });
                continue;
            }
            match move_path(&from, &to) {
                Ok(()) => {
                    restored += 1;
                    if let Some(parent) = from.parent() {
                        restored_parents.push(parent.to_path_buf());
                    }
                }
                Err(message) => errors.push(MoveError { entry_id: op.entry_id.clone(), name: op.name.clone(), message }),
            }
        }
    }

    let success = errors.is_empty();
    history[run_index].undone = success;
    history[run_index].undo_errors = if errors.is_empty() { None } else { Some(errors.clone()) };
    let run_id = history[run_index].run_id.clone();
    save_history(storage_dir, &history)?;

    // Best-effort cleanup of now-empty organized folders we created.
    for dir in restored_parents {
        let mut current = dir;
        while current.starts_with(desktop_dir) && current != *desktop_dir {
            if fs::remove_dir(&current).is_err() {
                break; // not empty (or already gone) - stop climbing
            }
            match current.parent() {
                Some(p) => current = p.to_path_buf(),
                None => break,
            }
        }
    }

    Ok(UndoResult { run_id, restored_count: restored, errors, success })
}

pub fn get_history(storage_dir: &Path) -> Vec<HistoryRun> {
    load_history(storage_dir)
}
