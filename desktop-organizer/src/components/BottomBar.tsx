interface BottomBarProps {
  totalEntries: number;
  moveCount: number;
  keepCount: number;
  foldersToCreate: number;
  canUndo: boolean;
  onUndo: () => void;
  undoing: boolean;
}

export function BottomBar({
  totalEntries,
  moveCount,
  keepCount,
  foldersToCreate,
  canUndo,
  onUndo,
  undoing,
}: BottomBarProps) {
  return (
    <footer className="bottombar">
      <div className="bottombar-stats">
        <Stat label="전체 항목" value={totalEntries} />
        <Stat label="이동 예정 파일" value={moveCount} accent="move" />
        <Stat label="바탕화면 유지" value={keepCount} />
        <Stat label="생성될 폴더" value={foldersToCreate} accent="folder" />
      </div>
      <div className="bottombar-actions">
        <span className={`undo-indicator${canUndo ? " available" : ""}`}>
          {canUndo ? "마지막 작업을 실행 취소할 수 있습니다" : "실행 취소할 작업이 없습니다"}
        </span>
        <button type="button" className="btn btn-secondary" onClick={onUndo} disabled={!canUndo || undoing}>
          <span aria-hidden="true">{"↩️"}</span> {undoing ? "되돌리는 중..." : "마지막 작업 실행 취소"}
        </button>
      </div>
    </footer>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className={`stat${accent ? ` stat--${accent}` : ""}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
