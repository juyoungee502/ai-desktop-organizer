use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopEntry {
    pub id: String,
    pub name: String,
    pub base_name: String,
    pub extension: String,
    pub is_directory: bool,
    pub is_shortcut: bool,
    pub size_bytes: u64,
    pub modified_at: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub desktop_path: String,
    pub entries: Vec<DesktopEntry>,
    pub scanned_at: String,
}

/// What the frontend sends us for one file it wants moved. This intentionally
/// mirrors only the fields the backend needs - the frontend's richer
/// `PlanItem` (category, projectGroup, destinationFolder, ...) is sent along
/// too but ignored here since serde skips unknown fields by default.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanItemInput {
    pub entry_id: String,
    pub destination_path: String,
    pub keep_on_desktop: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizePreviewInput {
    pub items: Vec<PlanItemInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveError {
    pub entry_id: String,
    pub name: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryOperation {
    pub entry_id: String,
    pub name: String,
    pub from: String,
    pub to: String,
    pub status: String, // "moved" | "failed"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryRun {
    pub run_id: String,
    pub timestamp: String,
    pub operations: Vec<HistoryOperation>,
    pub undone: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub undo_errors: Option<Vec<MoveError>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizeRunResult {
    pub run_id: String,
    pub timestamp: String,
    pub moved_count: usize,
    pub errors: Vec<MoveError>,
    pub can_undo: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UndoResult {
    pub run_id: String,
    pub restored_count: usize,
    pub errors: Vec<MoveError>,
    pub success: bool,
}
