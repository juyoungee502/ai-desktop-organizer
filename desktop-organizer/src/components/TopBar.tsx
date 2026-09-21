interface TopBarProps {
  desktopPath: string | null;
  scannedAt: string | null;
  scanning: boolean;
  onScan: () => void;
  onRefresh: () => void;
  canRefresh: boolean;
}

export function TopBar({ desktopPath, scannedAt, scanning, onScan, onRefresh, canRefresh }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-info">
        <span className="topbar-title">Windows 바탕화면 정리 도우미</span>
        <span className="topbar-subtitle">
          {desktopPath ? `대상 경로: ${desktopPath}` : "아직 바탕화면을 분석하지 않았습니다."}
          {scannedAt ? ` · 마지막 스캔: ${new Date(scannedAt).toLocaleTimeString("ko-KR")}` : ""}
        </span>
      </div>
      <div className="topbar-actions">
        <button type="button" className="btn btn-secondary" onClick={onRefresh} disabled={!canRefresh || scanning}>
          <span aria-hidden="true">{"\u{1F504}"}</span> 새로고침
        </button>
        <button type="button" className="btn btn-primary" onClick={onScan} disabled={scanning}>
          <span aria-hidden="true">{"\u{1F50D}"}</span> {scanning ? "스캔 중..." : "바탕화면 스캔"}
        </button>
      </div>
    </header>
  );
}
