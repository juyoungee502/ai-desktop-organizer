interface LoadingStateProps {
  label: string;
}

export function LoadingState({ label }: LoadingStateProps) {
  return (
    <div className="state-panel state-panel--loading" role="status">
      <div className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: string;
}

export function EmptyState({ title, description, actionLabel, onAction, icon = "\u{1F5C2}" }: EmptyStateProps) {
  return (
    <div className="state-panel state-panel--empty">
      <div className="state-icon" aria-hidden="true">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {actionLabel && onAction && (
        <button type="button" className="btn btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="state-panel state-panel--error" role="alert">
      <div className="state-icon" aria-hidden="true">{"⚠️"}</div>
      <h3>오류가 발생했습니다</h3>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}

interface PermissionStateProps {
  onRetry?: () => void;
}

export function PermissionState({ onRetry }: PermissionStateProps) {
  return (
    <div className="state-panel state-panel--permission" role="alert">
      <div className="state-icon" aria-hidden="true">{"\u{1F512}"}</div>
      <h3>바탕화면 접근 권한이 부족합니다</h3>
      <p>
        바탕화면 폴더를 읽거나 쓸 수 있는 권한이 없습니다. Windows 계정 권한을 확인한 뒤
        다시 시도해 주세요. 이 앱은 관리자 권한을 요청하지 않습니다.
      </p>
      {onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}
