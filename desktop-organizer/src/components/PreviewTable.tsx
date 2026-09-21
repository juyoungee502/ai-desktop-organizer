import { categoryMeta, type DesktopEntry, type OrganizePreview } from "../lib/types";

interface PreviewTableProps {
  preview: OrganizePreview;
  entriesById: Map<string, DesktopEntry>;
  selectedId: string | null;
  onSelect: (entryId: string) => void;
  onExecute: () => void;
  executing: boolean;
}

export function PreviewTable({ preview, entriesById, selectedId, onSelect, onExecute, executing }: PreviewTableProps) {
  const movable = preview.items.filter((i) => !i.keepOnDesktop);
  const kept = preview.items.filter((i) => i.keepOnDesktop);

  return (
    <div className="preview-panel">
      <div className="preview-summary">
        <div>
          <strong>{movable.length}개</strong> 파일이 <strong>{preview.foldersToCreate.length}개</strong> 폴더로 이동됩니다.
          <span className="preview-summary-sub"> ({kept.length}개는 바탕화면에 유지됩니다)</span>
        </div>
        <button type="button" className="btn btn-primary" onClick={onExecute} disabled={movable.length === 0 || executing}>
          <span aria-hidden="true">{"✅"}</span> {executing ? "정리 실행 중..." : "정리 실행"}
        </button>
      </div>

      {preview.foldersToCreate.length > 0 && (
        <div className="folder-preview">
          <span className="folder-preview-title">새로 생성될 폴더</span>
          <ul>
            {preview.foldersToCreate.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="file-table-wrap">
        <table className="file-table">
          <thead>
            <tr>
              <th scope="col">파일명</th>
              <th scope="col">분류</th>
              <th scope="col">이동 예정 경로</th>
              <th scope="col">상태</th>
            </tr>
          </thead>
          <tbody>
            {preview.items.map((item) => {
              const entry = entriesById.get(item.entryId);
              if (!entry) return null;
              return (
                <tr
                  key={item.entryId}
                  className={item.entryId === selectedId ? "selected" : undefined}
                  onClick={() => onSelect(item.entryId)}
                >
                  <td className="cell-name">
                    <span aria-hidden="true" className="file-icon">
                      {entry.isDirectory ? "\u{1F4C1}" : entry.isShortcut ? "\u{1F517}" : "\u{1F4C4}"}
                    </span>
                    <span>{entry.name}</span>
                  </td>
                  <td>{categoryMeta(item.category).label}</td>
                  <td className="cell-path">{item.keepOnDesktop ? "바탕화면 (이동 안 함)" : item.destinationPath}</td>
                  <td>
                    <span className={`badge ${item.keepOnDesktop ? "badge--keep" : "badge--move"}`}>
                      {item.keepOnDesktop ? "유지" : "이동"}
                    </span>
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
