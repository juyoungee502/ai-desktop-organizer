import { useState } from "react";
import type { HistoryRun } from "../lib/types";
import { formatDate } from "../lib/format";
import { LoadingState, ErrorState, EmptyState } from "./StateViews";

interface HistoryViewProps {
  history: HistoryRun[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onUndo: () => void;
  undoing: boolean;
}

export function HistoryView({ history, loading, error, onRetry, onUndo, undoing }: HistoryViewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (loading) return <LoadingState label="정리 기록을 불러오는 중..." />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (history.length === 0) {
    return (
      <EmptyState
        title="아직 정리 기록이 없습니다"
        description="바탕화면 정리를 실행하면 이곳에서 이동 내역을 확인하고 되돌릴 수 있습니다."
        icon={"\u{1F553}"}
      />
    );
  }

  const latestUndoable = history.find((r) => !r.undone);

  const toggle = (runId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  };

  return (
    <div className="history-view">
      {history.map((run) => {
        const isLatestUndoable = latestUndoable?.runId === run.runId;
        const isOpen = expanded.has(run.runId);
        const failedOps = run.operations.filter((o) => o.status === "failed");
        return (
          <div key={run.runId} className="history-card">
            <button type="button" className="history-card-header" onClick={() => toggle(run.runId)}>
              <div>
                <strong>{formatDate(run.timestamp)}</strong>
                <span className="history-card-sub">
                  이동 {run.operations.length}건
                  {failedOps.length > 0 ? ` · 오류 ${failedOps.length}건` : ""}
                  {run.undone ? " · 실행 취소됨" : ""}
                </span>
              </div>
              <span aria-hidden="true">{isOpen ? "▲" : "▼"}</span>
            </button>

            {isOpen && (
              <table className="file-table history-op-table">
                <thead>
                  <tr>
                    <th scope="col">파일명</th>
                    <th scope="col">원래 위치</th>
                    <th scope="col">이동 위치</th>
                    <th scope="col">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {run.operations.map((op) => (
                    <tr key={op.entryId}>
                      <td>{op.name}</td>
                      <td className="cell-path">{op.from}</td>
                      <td className="cell-path">{op.to}</td>
                      <td>
                        <span className={`badge ${op.status === "moved" ? "badge--move" : "badge--error"}`}>
                          {op.status === "moved" ? "이동됨" : "실패"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {run.undoErrors && run.undoErrors.length > 0 && (
              <div className="history-undo-errors">
                <strong>되돌리기 중 오류가 발생한 파일:</strong>
                <ul>
                  {run.undoErrors.map((e) => (
                    <li key={e.entryId}>
                      {e.name}: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {isLatestUndoable && (
              <div className="history-card-actions">
                <button type="button" className="btn btn-secondary" onClick={onUndo} disabled={undoing}>
                  <span aria-hidden="true">{"↩️"}</span> {undoing ? "되돌리는 중..." : "이 작업 실행 취소"}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
