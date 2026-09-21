import type { BackendMode } from "../lib/types";
import type { OrganizerSettings } from "../lib/settings";
import type { SimulatedState } from "../App";

interface SettingsViewProps {
  backendMode: BackendMode;
  onResetOverrides: () => void;
  simulatedState: SimulatedState;
  onSimulatedStateChange: (state: SimulatedState) => void;
  settings: OrganizerSettings;
  onSettingsChange: (partial: Partial<OrganizerSettings>) => void;
}

const SIMULATION_OPTIONS: { value: SimulatedState; label: string }[] = [
  { value: "none", label: "사용 안 함 (정상 동작)" },
  { value: "loading", label: "로딩 상태" },
  { value: "empty", label: "빈 상태 (바탕화면에 파일 없음)" },
  { value: "error", label: "오류 상태" },
  { value: "permission", label: "권한 부족 상태" },
];

export function SettingsView({
  backendMode,
  onResetOverrides,
  simulatedState,
  onSimulatedStateChange,
  settings,
  onSettingsChange,
}: SettingsViewProps) {
  return (
    <div className="settings-view">
      <section className="settings-section">
        <h3>실행 환경</h3>
        <p>
          현재 백엔드: <strong>{backendMode === "tauri" ? "실제 Windows 파일 시스템 (Tauri)" : "브라우저 Mock 데모 모드"}</strong>
        </p>
        <p className="settings-note">
          Mock 모드에서는 실제 파일이 이동하지 않으며, 메모리 상에서만 이동/되돌리기를 시뮬레이션합니다.
        </p>
      </section>

      <section className="settings-section">
        <h3>정리 방식</h3>
        <label className="checkbox-label settings-row">
          <input
            type="checkbox"
            checked={settings.groupProjectsIntoSubfolders}
            onChange={(e) => onSettingsChange({ groupProjectsIntoSubfolders: e.target.checked })}
          />
          프로젝트 파일을 이름별로 세부 폴더로 나누기 (ALT, tayo, dream ...)
        </label>
        <p className="settings-note">
          체크 해제 시 "프로젝트"로 분류된 파일이 모두 <code>01_프로젝트</code> 폴더 하나에 모입니다.
          체크하면 이전처럼 프로젝트 이름별로 하위 폴더가 따로 생깁니다. 변경하면 "정리 미리보기"에
          바로 반영됩니다.
        </p>
      </section>

      <section className="settings-section">
        <h3>분류 규칙 기준값</h3>
        <label className="settings-row">
          검토 필요 기준 확신도:
          <input
            type="number"
            min={0}
            max={100}
            className="text-input settings-number"
            value={settings.reviewConfidencePercent}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (!Number.isNaN(value)) onSettingsChange({ reviewConfidencePercent: Math.min(100, Math.max(0, value)) });
            }}
          />
          % 미만이면 "분류 보류"로 표시
        </label>
        <label className="settings-row">
          오래된 파일 기준:
          <input
            type="number"
            min={1}
            className="text-input settings-number"
            value={settings.oldFileThresholdDays}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (!Number.isNaN(value) && value > 0) onSettingsChange({ oldFileThresholdDays: value });
            }}
          />
          일 이상 수정 안 되면 "오래됨"으로 표시
        </label>
      </section>

      <section className="settings-section">
        <h3>안전 규칙</h3>
        <ul className="settings-list">
          <li>파일을 영구 삭제하지 않습니다.</li>
          <li>승인 전에는 어떤 파일도 이동하지 않습니다.</li>
          <li>관리자 권한을 요청하지 않습니다.</li>
          <li>바탕화면 외부 경로는 건드리지 않습니다.</li>
          <li>숨김/시스템 파일은 스캔에서 제외됩니다.</li>
        </ul>
      </section>

      <section className="settings-section">
        <h3>분류 수정 초기화</h3>
        <p>사용자가 직접 변경한 분류/유지 설정을 모두 되돌리고 자동 분류 결과로 초기화합니다.</p>
        <button type="button" className="btn btn-secondary" onClick={onResetOverrides}>
          분류 수정 내역 초기화
        </button>
      </section>

      <section className="settings-section">
        <h3>화면 상태 미리보기 (QA용)</h3>
        <p className="settings-note">
          로딩/빈/오류/권한 부족 상태 UI를 직접 확인해볼 수 있습니다. "바탕화면 분석" 화면에 적용됩니다.
        </p>
        <select
          className="select-input"
          value={simulatedState}
          onChange={(e) => onSimulatedStateChange(e.target.value as SimulatedState)}
        >
          {SIMULATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </section>
    </div>
  );
}
