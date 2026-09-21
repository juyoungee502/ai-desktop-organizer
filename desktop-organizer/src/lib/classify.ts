import type { CategoryId, ClassificationResult, ClassifiedEntry, DesktopEntry } from "./types";

// ---------------------------------------------------------------------------
// Tunable constants
// ---------------------------------------------------------------------------

export const REVIEW_CONFIDENCE_THRESHOLD = 0.6;
export const OLD_FILE_THRESHOLD_DAYS = 365;

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "heic"]);
const ARCHIVE_EXTS = new Set(["zip", "rar", "7z", "tar", "gz"]);
const INSTALLER_EXTS = new Set(["exe", "msi"]);
const AMBIGUOUS_DOC_EXTS = new Set([
  "pdf", "hwp", "hwpx", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "csv", "md",
]);
const CODE_EXTS = new Set(["py", "js", "ts", "tsx", "jsx", "java", "c", "cpp", "cs", "go", "rs"]);

// Auto-generated / generic prefixes that should never form a "project" group
// on their own (KakaoTalk screenshots, ChatGPT exports, etc).
const GENERIC_PREFIX_DENYLIST = new Set([
  "kakaotalk", "chatgpt", "screenshot", "스크린샷", "img", "image", "photo",
  "document", "새", "google", "visual", "microsoft", "제어판", "휴지통", "내",
]);

const SCHOOL_KEYWORDS = [
  "과제", "강의", "학기", "기말", "중간고사", "족보", "시험", "워크샵",
  "참가신청서", "참가확인서", "교통비", "exam", "chapter", "자료구조",
  "스택", "큐", "벡터", "알고리즘",
];
const WORK_KEYWORDS = [
  "사업기획서", "기획서", "보고서", "증빙", "계약서", "제안서", "업무",
  "prd", "기획", "매뉴얼", "회의록",
];
const CHAPTER_PATTERN = /^\d{1,2}\s*장/; // e.g. "9장", "12장"

const VERSION_FILLER_TOKENS = [
  "최종", "final", "수정", "초안", "완료", "복사본", "사본", "copy", "새",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function splitTokens(baseName: string): string[] {
  return baseName
    .split(/[ _\-.()\[\]]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function firstToken(baseName: string): string | null {
  const tokens = splitTokens(baseName);
  if (tokens.length === 0) return null;
  const token = tokens[0].toLowerCase();
  if (token.length < 2) return null;
  return token;
}

function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  const now = Date.now();
  return (now - then) / (1000 * 60 * 60 * 24);
}

function containsKeyword(haystack: string, keywords: string[]): string | null {
  const lower = haystack.toLowerCase();
  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase())) return kw;
  }
  return null;
}

function stripVersionFillers(baseName: string): string {
  let normalized = baseName.toLowerCase();
  // Windows-style auto-numbered duplicates, e.g. "메모(1)", "메모 (2)".
  normalized = normalized.replace(/\(\s*\d+\s*\)/g, "");
  for (const token of VERSION_FILLER_TOKENS) {
    normalized = normalized.split(token.toLowerCase()).join("");
  }
  return normalized.replace(/[^a-z0-9가-힣]/gi, "");
}

function normalizeForDuplicate(baseName: string): string {
  return stripVersionFillers(baseName);
}

// ---------------------------------------------------------------------------
// Project prefix grouping
// ---------------------------------------------------------------------------

interface PrefixGroup {
  token: string;
  displayName: string;
  entryIds: string[];
}

function buildPrefixGroups(entries: DesktopEntry[]): Map<string, PrefixGroup> {
  const groups = new Map<string, PrefixGroup>();
  for (const e of entries) {
    const token = firstToken(e.baseName);
    if (!token || GENERIC_PREFIX_DENYLIST.has(token)) continue;
    const existing = groups.get(token);
    if (existing) {
      existing.entryIds.push(e.id);
    } else {
      groups.set(token, { token, displayName: splitTokens(e.baseName)[0] ?? token, entryIds: [e.id] });
    }
  }
  // Only keep groups with 2+ members - a single file is not a "project group".
  for (const [key, group] of groups) {
    if (group.entryIds.length < 2) groups.delete(key);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

interface DuplicateGroup {
  id: string;
  entryIds: string[];
}

function buildDuplicateGroups(entries: DesktopEntry[]): Map<string, DuplicateGroup> {
  const byKey = new Map<string, string[]>();
  for (const e of entries) {
    if (e.isDirectory) continue;
    const key = `${normalizeForDuplicate(e.baseName)}.${e.extension}.${e.sizeBytes}`;
    const list = byKey.get(key) ?? [];
    list.push(e.id);
    byKey.set(key, list);
  }
  const groups = new Map<string, DuplicateGroup>();
  let i = 0;
  for (const [, ids] of byKey) {
    if (ids.length < 2) continue;
    const id = `dup-${i++}`;
    groups.set(id, { id, entryIds: ids });
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Version clustering (latest/final detection)
// ---------------------------------------------------------------------------

function buildLatestVersionMap(entries: DesktopEntry[]): Map<string, boolean> {
  const clusters = new Map<string, DesktopEntry[]>();
  for (const e of entries) {
    if (e.isDirectory) continue;
    const key = `${stripVersionFillers(e.baseName)}.${e.extension}`;
    const list = clusters.get(key) ?? [];
    list.push(e);
    clusters.set(key, list);
  }

  const result = new Map<string, boolean>();
  for (const [, members] of clusters) {
    if (members.length === 1) {
      result.set(members[0].id, true);
      continue;
    }
    const withFinalMarker = members.filter((m) =>
      /최종|final/iu.test(m.baseName)
    );
    let winner: DesktopEntry;
    if (withFinalMarker.length === 1) {
      winner = withFinalMarker[0];
    } else {
      const pool = withFinalMarker.length > 1 ? withFinalMarker : members;
      winner = pool.reduce((latest, cur) =>
        new Date(cur.modifiedAt).getTime() > new Date(latest.modifiedAt).getTime() ? cur : latest
      );
    }
    for (const m of members) {
      result.set(m.id, m.id === winner.id);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Base (extension + keyword) classification, before grouping override
// ---------------------------------------------------------------------------

interface BaseGuess {
  category: CategoryId;
  confidence: number;
  reasons: string[];
}

function classifyBase(entry: DesktopEntry): BaseGuess {
  const reasons: string[] = [];

  if (entry.isShortcut || entry.extension === "lnk") {
    return { category: "shortcut", confidence: 0.95, reasons: ["바로가기 파일(.lnk)입니다."] };
  }
  if (!entry.isDirectory && IMAGE_EXTS.has(entry.extension)) {
    return { category: "image", confidence: 0.9, reasons: [`이미지 확장자(.${entry.extension})입니다.`] };
  }
  if (!entry.isDirectory && ARCHIVE_EXTS.has(entry.extension)) {
    return { category: "archive", confidence: 0.9, reasons: [`압축 파일 확장자(.${entry.extension})입니다.`] };
  }
  if (!entry.isDirectory && INSTALLER_EXTS.has(entry.extension)) {
    return { category: "installer", confidence: 0.9, reasons: [`설치 파일 확장자(.${entry.extension})입니다.`] };
  }

  const chapterMatch = CHAPTER_PATTERN.test(entry.baseName);
  const schoolKw = containsKeyword(entry.baseName, SCHOOL_KEYWORDS);
  const workKw = containsKeyword(entry.baseName, WORK_KEYWORDS);

  if (chapterMatch || schoolKw) {
    reasons.push(
      chapterMatch
        ? "파일명이 챕터/강의 번호 패턴(예: 9장)과 일치합니다."
        : `키워드 '${schoolKw}'가 포함되어 학교/과제 자료로 추정됩니다.`
    );
    return { category: "school", confidence: 0.7, reasons };
  }
  if (workKw) {
    reasons.push(`키워드 '${workKw}'가 포함되어 업무 문서로 추정됩니다.`);
    return { category: "work", confidence: 0.7, reasons };
  }

  if (!entry.isDirectory && CODE_EXTS.has(entry.extension)) {
    reasons.push(`코드 파일 확장자(.${entry.extension})로 추정됩니다.`);
    return { category: "work", confidence: 0.5, reasons };
  }

  if (!entry.isDirectory && AMBIGUOUS_DOC_EXTS.has(entry.extension)) {
    reasons.push("문서 확장자이지만 이름만으로는 프로젝트/학교/업무를 확신할 수 없습니다.");
    return { category: "document", confidence: 0.5, reasons };
  }

  if (entry.isDirectory) {
    reasons.push("폴더 이름만으로는 용도를 확신할 수 없습니다.");
    return { category: "uncategorized", confidence: 0.35, reasons };
  }

  reasons.push("알려진 규칙과 일치하지 않는 확장자입니다.");
  return { category: "uncategorized", confidence: 0.3, reasons };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function classifyEntries(entries: DesktopEntry[]): ClassifiedEntry[] {
  const prefixGroups = buildPrefixGroups(entries);
  const entryToGroup = new Map<string, PrefixGroup>();
  for (const group of prefixGroups.values()) {
    for (const id of group.entryIds) entryToGroup.set(id, group);
  }

  const duplicateGroups = buildDuplicateGroups(entries);
  const entryToDuplicateGroup = new Map<string, string>();
  for (const group of duplicateGroups.values()) {
    for (const id of group.entryIds) entryToDuplicateGroup.set(id, group.id);
  }

  const latestVersionMap = buildLatestVersionMap(entries);

  return entries.map((entry) => {
    const base = classifyBase(entry);
    let category = base.category;
    let confidence = base.confidence;
    const reasons = [...base.reasons];
    let projectGroup: string | undefined;

    const group = entryToGroup.get(entry.id);
    if (group) {
      projectGroup = group.displayName;
      // Project grouping is a strong signal and overrides a weak base guess,
      // but never downgrades a category we are already confident about
      // (e.g. an image/archive extension keeps its own category).
      const groupConfidence = Math.min(0.9, 0.55 + group.entryIds.length * 0.08);
      if (base.confidence < groupConfidence || base.category === "uncategorized" || base.category === "document") {
        category = "project";
        confidence = groupConfidence;
      }
      reasons.push(
        `공통 접두사 '${group.displayName}'를 가진 파일 ${group.entryIds.length}개와 함께 묶였습니다.`
      );
    }

    const isDuplicateCandidate = entryToDuplicateGroup.has(entry.id);
    const duplicateGroupId = entryToDuplicateGroup.get(entry.id);
    if (isDuplicateCandidate) {
      reasons.push("동일한 이름/크기를 가진 중복 파일 후보입니다.");
    }

    const isOldFileCandidate = !entry.isDirectory && daysSince(entry.modifiedAt) > OLD_FILE_THRESHOLD_DAYS;
    if (isOldFileCandidate) {
      reasons.push(`${OLD_FILE_THRESHOLD_DAYS}일 이상 수정되지 않은 오래된 파일입니다.`);
    }

    const isLatestVersion = latestVersionMap.get(entry.id) ?? true;
    if (!isLatestVersion) {
      reasons.push("같은 파일의 더 최신/최종 버전이 존재합니다.");
    }

    let needsReview = confidence < REVIEW_CONFIDENCE_THRESHOLD;
    if (needsReview && category !== "uncategorized") {
      reasons.push("분류 확신도가 낮아 자동 이동 대상에서 제외하고 검토 필요로 표시합니다.");
      category = "uncategorized";
    }
    needsReview = category === "uncategorized" || needsReview;

    const result: ClassificationResult = {
      entryId: entry.id,
      category,
      confidence: Math.round(confidence * 100) / 100,
      needsReview,
      projectGroup,
      reasons,
      isLatestVersion,
      isDuplicateCandidate,
      duplicateGroupId,
      isOldFileCandidate,
    };
    return { entry, result };
  });
}
