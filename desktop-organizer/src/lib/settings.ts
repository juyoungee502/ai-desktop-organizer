import { OLD_FILE_THRESHOLD_DAYS, REVIEW_CONFIDENCE_THRESHOLD } from "./classify";

export interface OrganizerSettings {
  // false = every "project" file lands directly in one 01_프로젝트 folder.
  // true = each project group gets its own subfolder (ALT, tayo, dream, ...).
  groupProjectsIntoSubfolders: boolean;
  oldFileThresholdDays: number;
  reviewConfidencePercent: number; // 0-100, stored as a whole percent for the UI
}

export const DEFAULT_SETTINGS: OrganizerSettings = {
  groupProjectsIntoSubfolders: false,
  oldFileThresholdDays: OLD_FILE_THRESHOLD_DAYS,
  reviewConfidencePercent: Math.round(REVIEW_CONFIDENCE_THRESHOLD * 100),
};

const STORAGE_KEY = "desktop-organizer-settings";

export function loadSettings(): OrganizerSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: OrganizerSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Best-effort only - losing saved settings is not worth surfacing an error for.
  }
}
