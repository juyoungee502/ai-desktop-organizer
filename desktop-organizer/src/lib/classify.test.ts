import { describe, expect, it } from "vitest";
import { classifyEntries, REVIEW_CONFIDENCE_THRESHOLD } from "./classify";
import { MOCK_DESKTOP_ENTRIES } from "./mockData";
import type { DesktopEntry } from "./types";

function makeEntry(overrides: Partial<DesktopEntry> & { name: string }): DesktopEntry {
  const dot = overrides.name.lastIndexOf(".");
  const extension = overrides.extension ?? (dot > 0 ? overrides.name.slice(dot + 1).toLowerCase() : "");
  const baseName = dot > 0 && !overrides.isDirectory ? overrides.name.slice(0, dot) : overrides.name;
  return {
    id: overrides.id ?? `id-${overrides.name}`,
    name: overrides.name,
    baseName,
    extension,
    isDirectory: overrides.isDirectory ?? false,
    isShortcut: overrides.isShortcut ?? extension === "lnk",
    sizeBytes: overrides.sizeBytes ?? 1000,
    modifiedAt: overrides.modifiedAt ?? new Date().toISOString(),
    path: overrides.path ?? `C:\\Users\\User\\Desktop\\${overrides.name}`,
  };
}

describe("classifyEntries - extension based rules", () => {
  it("classifies shortcuts with high confidence", () => {
    const [{ result }] = classifyEntries([makeEntry({ name: "Chrome.lnk" })]);
    expect(result.category).toBe("shortcut");
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.needsReview).toBe(false);
  });

  it("classifies images with high confidence", () => {
    const [{ result }] = classifyEntries([makeEntry({ name: "photo.jpg" })]);
    expect(result.category).toBe("image");
    expect(result.needsReview).toBe(false);
  });

  it("classifies archives and installers", () => {
    const [zip, exe] = classifyEntries([
      makeEntry({ name: "backup.zip" }),
      makeEntry({ name: "setup.exe" }),
    ]);
    expect(zip.result.category).toBe("archive");
    expect(exe.result.category).toBe("installer");
  });
});

describe("classifyEntries - ambiguous extensions require signals", () => {
  it("puts a lone unrecognized pdf into review instead of guessing", () => {
    const [{ result }] = classifyEntries([makeEntry({ name: "무제문서.pdf" })]);
    expect(result.category).toBe("uncategorized");
    expect(result.needsReview).toBe(true);
    expect(result.confidence).toBeLessThan(REVIEW_CONFIDENCE_THRESHOLD);
  });

  it("uses school keywords to raise confidence above the review threshold", () => {
    const [{ result }] = classifyEntries([makeEntry({ name: "9장_과제.pdf" })]);
    expect(result.category).toBe("school");
    expect(result.needsReview).toBe(false);
  });

  it("uses work keywords to classify a report", () => {
    const [{ result }] = classifyEntries([makeEntry({ name: "2026_사업기획서.hwpx" })]);
    expect(result.category).toBe("work");
  });
});

describe("classifyEntries - project prefix grouping", () => {
  it("groups files sharing a common non-generic prefix into a project", () => {
    const entries = [
      makeEntry({ name: "TAYO.pptx" }),
      makeEntry({ name: "TAYO_PRD_최종.pptx" }),
      makeEntry({ name: "tayo", isDirectory: true }),
    ];
    const results = classifyEntries(entries);
    for (const r of results) {
      expect(r.result.category).toBe("project");
      expect(r.result.projectGroup?.toLowerCase()).toBe("tayo");
      expect(r.result.needsReview).toBe(false);
    }
  });

  it("does not group generic auto-generated prefixes like KakaoTalk", () => {
    const entries = [
      makeEntry({ name: "KakaoTalk_20260101_a.pdf" }),
      makeEntry({ name: "KakaoTalk_20260102_b.pdf" }),
    ];
    const results = classifyEntries(entries);
    for (const r of results) {
      expect(r.result.category).not.toBe("project");
    }
  });

  it("does not group a single file with no matching prefix partner", () => {
    const [{ result }] = classifyEntries([makeEntry({ name: "혼자있는파일.pdf" })]);
    expect(result.category).not.toBe("project");
  });
});

describe("classifyEntries - duplicate detection", () => {
  it("flags same-name-same-size copies as duplicate candidates", () => {
    const entries = [
      makeEntry({ name: "보고서.pdf", sizeBytes: 5000 }),
      makeEntry({ name: "보고서 - 복사본.pdf", sizeBytes: 5000 }),
    ];
    const results = classifyEntries(entries);
    expect(results.every((r) => r.result.isDuplicateCandidate)).toBe(true);
    expect(results[0].result.duplicateGroupId).toBe(results[1].result.duplicateGroupId);
  });

  it("does not flag files with different sizes as duplicates", () => {
    const entries = [
      makeEntry({ name: "보고서.pdf", sizeBytes: 5000 }),
      makeEntry({ name: "보고서 - 복사본.pdf", sizeBytes: 9999 }),
    ];
    const results = classifyEntries(entries);
    expect(results.every((r) => !r.result.isDuplicateCandidate)).toBe(true);
  });
});

describe("classifyEntries - latest version detection", () => {
  it("prefers the file marked as 최종 over an 초안", () => {
    const entries = [
      makeEntry({ name: "제안서_초안.pdf", modifiedAt: new Date(2026, 0, 1).toISOString() }),
      makeEntry({ name: "제안서_최종.pdf", modifiedAt: new Date(2026, 0, 5).toISOString() }),
    ];
    const results = classifyEntries(entries);
    const draft = results.find((r) => r.entry.name.includes("초안"))!;
    const final = results.find((r) => r.entry.name.includes("최종"))!;
    expect(final.result.isLatestVersion).toBe(true);
    expect(draft.result.isLatestVersion).toBe(false);
  });

  it("falls back to most recently modified when no final marker exists", () => {
    const entries = [
      makeEntry({ name: "메모(1).txt", modifiedAt: new Date(2026, 0, 1).toISOString() }),
      makeEntry({ name: "메모(2).txt", modifiedAt: new Date(2026, 0, 10).toISOString() }),
    ];
    const results = classifyEntries(entries);
    const older = results.find((r) => r.entry.name.includes("(1)"))!;
    const newer = results.find((r) => r.entry.name.includes("(2)"))!;
    expect(newer.result.isLatestVersion).toBe(true);
    expect(older.result.isLatestVersion).toBe(false);
  });
});

describe("classifyEntries - old file detection", () => {
  it("flags files older than the threshold", () => {
    const old = makeEntry({ name: "old.txt", modifiedAt: new Date(2015, 0, 1).toISOString() });
    const recent = makeEntry({ name: "new.txt", modifiedAt: new Date().toISOString() });
    const results = classifyEntries([old, recent]);
    expect(results.find((r) => r.entry.name === "old.txt")!.result.isOldFileCandidate).toBe(true);
    expect(results.find((r) => r.entry.name === "new.txt")!.result.isOldFileCandidate).toBe(false);
  });
});

describe("classifyEntries - mock desktop snapshot sanity", () => {
  it("classifies the full mock snapshot without throwing and covers multiple categories", () => {
    const results = classifyEntries(MOCK_DESKTOP_ENTRIES);
    expect(results).toHaveLength(MOCK_DESKTOP_ENTRIES.length);
    const categories = new Set(results.map((r) => r.result.category));
    expect(categories.size).toBeGreaterThan(3);
    // Every entry must produce at least one human-readable reason.
    expect(results.every((r) => r.result.reasons.length > 0)).toBe(true);
  });
});
