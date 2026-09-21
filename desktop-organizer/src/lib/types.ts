// Shared types between the mock backend and the real Tauri/Rust backend.
// Keeping these in one place means the UI never needs to know which
// backend it is talking to.

export type CategoryId =
  | "project"
  | "school"
  | "work"
  | "document"
  | "image"
  | "archive"
  | "installer"
  | "shortcut"
  | "temp"
  | "uncategorized";

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  folderName: string;
  description: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { id: "project", label: "프로젝트", folderName: "01_프로젝트", description: "공통 접두사로 묶이는 프로젝트 파일 묶음" },
  { id: "school", label: "학교/과제", folderName: "02_학교_과제", description: "강의자료, 과제, 학기 폴더" },
  { id: "work", label: "업무", folderName: "03_업무", description: "업무용 문서/보고서" },
  { id: "document", label: "문서", folderName: "04_문서", description: "그 외 일반 문서" },
  { id: "image", label: "이미지", folderName: "05_이미지", description: "사진, 스크린샷 등 이미지 파일" },
  { id: "archive", label: "압축파일", folderName: "06_압축파일", description: "zip, rar 등 압축 파일" },
  { id: "installer", label: "설치파일", folderName: "07_설치파일", description: "exe, msi 등 설치 파일" },
  { id: "shortcut", label: "바로가기", folderName: "08_바로가기", description: "앱/파일 바로가기 (.lnk)" },
  { id: "temp", label: "임시파일", folderName: "09_임시파일", description: "임시 파일, 캐시성 파일" },
  { id: "uncategorized", label: "분류 보류", folderName: "10_분류_보류", description: "확신도가 낮아 검토가 필요한 파일" },
];

export function categoryMeta(id: CategoryId): CategoryMeta {
  const found = CATEGORIES.find((c) => c.id === id);
  if (!found) throw new Error(`unknown category: ${id}`);
  return found;
}

export interface DesktopEntry {
  id: string;
  name: string;
  baseName: string;
  extension: string; // lowercase, no leading dot; "" for folders
  isDirectory: boolean;
  isShortcut: boolean;
  sizeBytes: number;
  modifiedAt: string; // ISO 8601
  path: string;
}

export interface ClassificationResult {
  entryId: string;
  category: CategoryId;
  confidence: number; // 0..1
  needsReview: boolean;
  projectGroup?: string;
  reasons: string[];
  isLatestVersion: boolean;
  isDuplicateCandidate: boolean;
  duplicateGroupId?: string;
  isOldFileCandidate: boolean;
}

export interface ClassifiedEntry {
  entry: DesktopEntry;
  result: ClassificationResult;
}

export interface PlanItem {
  entryId: string;
  category: CategoryId;
  projectGroup?: string;
  destinationFolder: string; // relative to Desktop
  destinationPath: string; // absolute path
  // true = stays on the desktop this run (either the user chose to keep it,
  // or it needs review and was never auto-included).
  keepOnDesktop: boolean;
}

export interface OrganizePreview {
  items: PlanItem[];
  foldersToCreate: string[];
  moveCount: number;
  keepCount: number;
}

export interface MoveError {
  entryId: string;
  name: string;
  message: string;
}

export interface HistoryOperation {
  entryId: string;
  name: string;
  from: string;
  to: string;
  status: "moved" | "failed";
  errorMessage?: string;
}

export interface HistoryRun {
  runId: string;
  timestamp: string;
  operations: HistoryOperation[];
  undone: boolean;
  undoErrors?: MoveError[];
}

export interface OrganizeRunResult {
  runId: string;
  timestamp: string;
  movedCount: number;
  errors: MoveError[];
  canUndo: boolean;
}

export interface UndoResult {
  runId: string;
  restoredCount: number;
  errors: MoveError[];
  success: boolean;
}

export interface ScanResult {
  desktopPath: string;
  entries: DesktopEntry[];
  scannedAt: string;
}

export type BackendMode = "tauri" | "mock";
