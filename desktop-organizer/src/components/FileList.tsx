import { useMemo, useState } from "react";
import { CATEGORIES, type CategoryId, type ClassifiedEntry } from "../lib/types";
import { formatBytes, formatRelativeDays } from "../lib/format";
import type { UserOverride } from "../lib/plan";

interface FileListProps {
  items: ClassifiedEntry[];
  overrides: Map<string, UserOverride>;
  onCategoryChange: (entryId: string, category: CategoryId) => void;
  onKeepOnDesktopChange: (entryId: string, keep: boolean) => void;
  selectedId: string | null;
  onSelect: (entryId: string) => void;
}

export function FileList({
  items,
  overrides,
  onCategoryChange,
  onKeepOnDesktopChange,
  selectedId,
  onSelect,
}: FileListProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | "all">("all");
  const [reviewOnly, setReviewOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(({ entry, result }) => {
      const effectiveCategory = overrides.get(entry.id)?.category ?? result.category;
      if (categoryFilter !== "all" && effectiveCategory !== categoryFilter) return false;
      if (reviewOnly && !result.needsReview) return false;
      if (q && !entry.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, overrides, search, categoryFilter, reviewOnly]);

  return (
    <div className="file-list">
      <div className="file-list-toolbar">
        <input
          type="search"
          className="text-input"
          placeholder="파일명 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="파일명 검색"
        />
        <select
          className="select-input"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as CategoryId | "all")}
          aria-label="분류 필터"
        >
          <option value="all">전체 분류</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <label className="checkbox-label">
          <input type="checkbox" checked={reviewOnly} onChange={(e) => setReviewOnly(e.target.checked)} />
          검토 필요만 보기
        </label>
        <span className="file-list-count">{filtered.length} / {items.length}개</span>
      </div>

      <div className="file-table-wrap">
        <table className="file-table">
          <thead>
            <tr>
              <th scope="col">파일명</th>
              <th scope="col">확장자</th>
              <th scope="col">크기</th>
              <th scope="col">수정일</th>
              <th scope="col">현재 위치</th>
              <th scope="col">분류</th>
              <th scope="col">특이사항</th>
              <th scope="col">바탕화면 유지</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ entry, result }) => {
              const override = overrides.get(entry.id);
              const effectiveCategory = override?.category ?? result.category;
              const keepOnDesktop = override?.keepOnDesktop ?? (result.category === "uncategorized" && override?.category === undefined);
              return (
                <tr
                  key={entry.id}
                  className={entry.id === selectedId ? "selected" : undefined}
                  onClick={() => onSelect(entry.id)}
                >
                  <td className="cell-name">
                    <span aria-hidden="true" className="file-icon">
                      {entry.isDirectory ? "\u{1F4C1}" : entry.isShortcut ? "\u{1F517}" : "\u{1F4C4}"}
                    </span>
                    <span>{entry.name}</span>
                  </td>
                  <td>{entry.isDirectory ? "폴더" : entry.extension || "-"}</td>
                  <td>{entry.isDirectory ? "-" : formatBytes(entry.sizeBytes)}</td>
                  <td title={entry.modifiedAt}>{formatRelativeDays(entry.modifiedAt)}</td>
                  <td className="cell-path" title={entry.path}>바탕화면</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <select
                      className="select-input"
                      value={effectiveCategory}
                      onChange={(e) => onCategoryChange(entry.id, e.target.value as CategoryId)}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <div className="confidence-row">
                      <span className={`confidence-badge${result.needsReview ? " low" : ""}`}>
                        확신도 {Math.round(result.confidence * 100)}%
                      </span>
                      {result.needsReview && <span className="badge badge--review">검토 필요</span>}
                    </div>
                  </td>
                  <td>
                    <div className="badge-group">
                      {result.isDuplicateCandidate && <span className="badge badge--dup">중복 후보</span>}
                      {result.isOldFileCandidate && <span className="badge badge--old">오래됨</span>}
                      {!result.isLatestVersion && <span className="badge badge--stale">구버전</span>}
                      {result.projectGroup && <span className="badge badge--project">{result.projectGroup}</span>}
                    </div>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={keepOnDesktop}
                        onChange={(e) => onKeepOnDesktopChange(entry.id, e.target.checked)}
                      />
                      유지
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
