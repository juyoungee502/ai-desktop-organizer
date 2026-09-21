import { categoryMeta, type ClassifiedEntry, type PlanItem } from "../lib/types";
import { formatBytes, formatDate } from "../lib/format";

interface DetailPanelProps {
  selected: ClassifiedEntry | null;
  planItem?: PlanItem;
}

export function DetailPanel({ selected, planItem }: DetailPanelProps) {
  if (!selected) {
    return (
      <aside className="detail-panel" aria-label="상세 정보">
        <div className="detail-empty">
          <p>목록에서 파일을 선택하면 상세 정보가 여기에 표시됩니다.</p>
        </div>
      </aside>
    );
  }

  const { entry, result } = selected;

  return (
    <aside className="detail-panel" aria-label="상세 정보">
      <div className="detail-header">
        <span className="file-icon large" aria-hidden="true">
          {entry.isDirectory ? "\u{1F4C1}" : entry.isShortcut ? "\u{1F517}" : "\u{1F4C4}"}
        </span>
        <h3 title={entry.name}>{entry.name}</h3>
      </div>

      <dl className="detail-list">
        <DetailRow label="종류" value={entry.isDirectory ? "폴더" : entry.isShortcut ? "바로가기" : entry.extension ? `.${entry.extension} 파일` : "파일"} />
        <DetailRow label="크기" value={entry.isDirectory ? "-" : formatBytes(entry.sizeBytes)} />
        <DetailRow label="수정 날짜" value={formatDate(entry.modifiedAt)} />
        <DetailRow label="현재 위치" value={entry.path} mono />
      </dl>

      <div className="detail-section">
        <h4>분류 결과</h4>
        <dl className="detail-list">
          <DetailRow label="분류" value={categoryMeta(result.category).label} />
          <DetailRow label="확신도" value={`${Math.round(result.confidence * 100)}%`} />
          <DetailRow label="검토 필요" value={result.needsReview ? "예" : "아니오"} />
          {result.projectGroup && <DetailRow label="프로젝트 그룹" value={result.projectGroup} />}
        </dl>
        <ul className="reason-list">
          {result.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>

      {(result.isDuplicateCandidate || result.isOldFileCandidate || !result.isLatestVersion) && (
        <div className="detail-section">
          <h4>주의 사항</h4>
          <ul className="reason-list">
            {result.isDuplicateCandidate && <li>다른 파일과 이름/크기가 같은 중복 후보입니다.</li>}
            {result.isOldFileCandidate && <li>오랫동안 수정되지 않은 오래된 파일입니다.</li>}
            {!result.isLatestVersion && <li>더 최신/최종 버전의 파일이 따로 존재합니다.</li>}
          </ul>
        </div>
      )}

      <div className="detail-section">
        <h4>이동 예정 경로</h4>
        {planItem ? (
          planItem.keepOnDesktop ? (
            <p className="detail-dest">바탕화면에 그대로 유지됩니다.</p>
          ) : (
            <p className="detail-dest mono">{planItem.destinationPath}</p>
          )
        ) : (
          <p className="detail-empty-inline">"정리 미리보기" 메뉴에서 확인할 수 있습니다.</p>
        )}
      </div>
    </aside>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd className={mono ? "mono" : undefined}>{value}</dd>
    </div>
  );
}
