import type { OrganizePreview } from "../lib/types";

interface ConfirmModalProps {
  preview: OrganizePreview;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}

export function ConfirmModal({ preview, onConfirm, onCancel, busy }: ConfirmModalProps) {
  const movable = preview.items.filter((i) => !i.keepOnDesktop);

  return (
    <div className="modal-overlay" role="presentation" onClick={busy ? undefined : onCancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-modal-title">바탕화면 정리를 실행할까요?</h2>
        <p className="modal-desc">
          아래 내용대로 파일이 이동됩니다. 삭제되는 파일은 없으며, 실행 후 "정리 기록"에서
          언제든지 마지막 작업을 한 번에 되돌릴 수 있습니다.
        </p>

        <div className="modal-summary">
          <div>
            <strong>{movable.length}개</strong> 파일 이동
          </div>
          <div>
            <strong>{preview.foldersToCreate.length}개</strong> 폴더 새로 생성
          </div>
        </div>

        {preview.foldersToCreate.length > 0 && (
          <ul className="modal-folder-list">
            {preview.foldersToCreate.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            취소
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={busy}>
            {busy ? "실행 중..." : "승인하고 정리 실행"}
          </button>
        </div>
      </div>
    </div>
  );
}
