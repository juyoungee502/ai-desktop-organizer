# Desktop Organizer

Windows 바탕화면을 안전하게 분석하고, 사용자가 직접 확인/수정한 뒤 승인한 계획대로만
파일을 정리해주는 Tauri + React + TypeScript 데스크톱 앱입니다.

- 바탕화면을 스캔해서 파일/폴더를 자동 분류(프로젝트, 학교/과제, 업무, 문서, 이미지,
  압축파일, 설치파일, 바로가기, 임시파일, 분류 보류)합니다.
- 분류 결과와 이동 예정 경로를 **미리보기**로 먼저 보여주고, 사용자가 승인해야만
  실제로 파일을 이동합니다.
- 마지막 정리 작업은 **한 번에 되돌리기(Undo)** 할 수 있습니다.
- 파일을 영구 삭제하지 않고, 관리자 권한을 요구하지 않으며, 바탕화면 외부 경로는
  건드리지 않습니다.

## 폴더 구조

```
desktop-organizer/
  src/                 React + TypeScript 프론트엔드
    App.tsx             화면 상태 관리, 4개 메뉴(분석/미리보기/기록/설정) 라우팅
    components/         Sidebar, TopBar, BottomBar, FileList, PreviewTable,
                         DetailPanel, ConfirmModal, HistoryView, SettingsView,
                         StateViews(로딩/빈/오류/권한 부족)
    lib/
      types.ts           프론트/백엔드 공용 타입, 분류 카테고리 정의
      classify.ts         자동 분류 엔진 (+ classify.test.ts 단위 테스트)
      plan.ts             분류 결과 -> 실제 이동 계획(미리보기) 생성
      api.ts               Tauri invoke <-> Mock 백엔드 자동 분기
      mockData.ts          브라우저 Mock 모드용 가상 바탕화면 데이터
      format.ts / errors.ts  포맷/에러 유틸리티
  src-tauri/            Rust 백엔드 (Tauri)
    src/
      scanner.rs          바탕화면 1단계 스캔 (숨김/시스템 파일 제외)
      organizer.rs         파일 이동 실행 / Undo / 이동 기록(JSON) 저장
      commands.rs          Tauri 커맨드 (scan_desktop, execute_organize,
                            undo_last, get_history)
      models.rs            Rust <-> 프론트 공용 DTO (serde camelCase)
    tauri.conf.json
  README.md (이 파일)
```

## 두 가지 실행 모드

이 앱은 **동일한 UI 코드**가 두 백엔드 중 하나에 자동으로 연결됩니다
(`src/lib/api.ts`가 `window.__TAURI__` 존재 여부로 자동 판단):

| 모드 | 실행 방법 | 동작 |
| --- | --- | --- |
| Mock 데모 모드 | 브라우저에서 `npm run dev` | 실제 파일을 전혀 건드리지 않고, 메모리 안에서 스캔/이동/Undo를 시뮬레이션합니다. UI/분류 로직을 빠르게 확인할 때 사용합니다. |
| 실제 모드 | `npm run tauri dev` 또는 빌드된 실행 파일 | Rust 백엔드가 실제 Windows 바탕화면을 스캔하고 파일을 이동합니다. |

사이드바 하단에 현재 모드가 표시됩니다.

## Windows에서 개발 환경 준비

1. **Node.js 18 이상** 설치: https://nodejs.org
2. **Rust** 설치: https://rustup.rs (설치 후 새 터미널을 열어야 `cargo`, `rustc`가
   인식됩니다.)
3. **Tauri 사전 요구사항 (Windows)**:
   - Microsoft Visual C++ Build Tools ("Desktop development with C++" 워크로드)
   - WebView2 런타임 (Windows 10/11에는 대부분 기본 설치되어 있습니다. 없다면
     https://developer.microsoft.com/microsoft-edge/webview2 에서 설치)
   - 자세한 내용: https://tauri.app/v1/guides/getting-started/prerequisites
4. 저장소를 받은 뒤 `desktop-organizer` 폴더에서 의존성을 설치합니다.

```powershell
cd desktop-organizer
npm install
```

## 개발 서버 실행

### 1) 브라우저 Mock 모드로 UI만 빠르게 확인

```powershell
npm run dev
```

`http://localhost:5173` 를 브라우저로 열면 됩니다. 실제 파일은 전혀 이동하지
않습니다.

### 2) 실제 Windows 바탕화면과 연결된 개발 모드

```powershell
npm run tauri dev
```

Rust 백엔드가 컴파일된 뒤 데스크톱 창이 뜨고, 실제 바탕화면을 스캔합니다.
(최초 실행 시 Rust 의존성 컴파일에 몇 분 정도 걸릴 수 있습니다.)

## 프로덕션 빌드 (Windows 설치 파일 생성)

```powershell
npm run tauri build
```

빌드가 끝나면 `src-tauri/target/release/bundle/` 아래에 `msi`, `nsis` 설치
파일이 생성됩니다. 이 과정은 관리자 권한이 필요하지 않습니다.

## 테스트 / 검증 명령

```powershell
npm run build       # TypeScript 타입체크(tsc --noEmit) + Vite 프로덕션 빌드
npm test            # 분류 엔진(classify.ts) 단위 테스트 (Vitest)
cd src-tauri
cargo check          # Rust 타입/컴파일 검증
cargo clippy --no-deps
```

> 이 프로젝트는 Linux 샌드박스에서 프론트엔드 전체(타입체크/빌드/테스트/
> Playwright로 스캔→미리보기→정리 실행→Undo 전체 플로우)와 Rust 백엔드
> (`cargo check`, `cargo build`, 실제 실행 스모크 테스트)까지 검증했습니다.
> 다만 실제 Windows 바탕화면 파일 이동은 Windows 환경에서 최종 확인해
> 주세요.

## 안전 규칙 (구현 기준)

- 파일을 영구 삭제하지 않습니다 (`rm` 계열 API를 전혀 사용하지 않습니다).
- "정리 실행" 확인 모달에서 승인하기 전에는 어떤 파일도 이동하지 않습니다.
- 관리자 권한을 요청하지 않습니다 (`dirs::desktop_dir()`로 사용자 권한만으로
  바탕화면 경로를 얻습니다).
- 이동 대상 경로가 바탕화면(및 그 하위 `정리됨` 폴더) 범위를 벗어나면 이동을
  거부하고 오류로 기록합니다.
- 스캔 시 숨김/시스템 파일(Windows 숨김/시스템 속성)을 제외합니다.
- 정리 실행 전/후 바탕화면 스냅샷을 JSON으로 앱 데이터 폴더에 기록합니다
  (`organizer.rs`의 `write_snapshot`).
- 이동 기록(`history.json`)에는 모든 이동/실패 내역이 남고, "정리 기록" 화면에서
  마지막 미완료 작업만 되돌릴 수 있습니다. Undo가 일부 파일에서 실패해도 어떤
  파일이 실패했는지 화면과 기록에 남습니다.
- 분류 확신도가 기준(기본 60%) 미만이면 자동으로 "분류 보류"로 표시되고, 사용자가
  직접 분류를 지정하기 전까지는 이동 대상에서 제외됩니다.

## 분류 로직 요약 (`src/lib/classify.ts`)

- 확장자가 이미지/압축/설치파일/바로가기(.lnk)면 이름과 무관하게 높은 확신도로
  분류합니다.
- pdf/hwp(x)/doc(x)/ppt(x)/xls(x)/txt 같은 애매한 문서 확장자는 이름만으로는
  자동 이동하지 않고, 아래 신호가 있어야 확신도가 올라갑니다.
  - 학교/업무 키워드 (`과제`, `보고서`, `사업기획서`, `워크샵` 등)
  - 같은 접두사를 공유하는 파일이 2개 이상이면 "프로젝트" 후보로 묶임
    (`KakaoTalk_`, `ChatGPT` 같은 자동 생성 접두사는 제외)
- `최종`/`final`/`(1)`/`(2)` 등 버전 표기를 제거한 뒤 이름이 같으면 하나의 "버전
  묶음"으로 보고 최신/최종 파일만 `isLatestVersion = true`로 표시합니다.
- 이름·확장자·크기가 같은 파일은 중복 후보로 표시합니다.
- 365일 이상 수정되지 않은 파일은 "오래된 파일"로 표시합니다.

## 알려진 제한 사항 (MVP 범위)

- 폴더는 내부까지 재귀적으로 다시 스캔/분류하지 않고, 폴더 자체를 하나의
  항목으로 이동합니다 (요구사항에 따라 기존 폴더 내부 파일은 건드리지 않음).
- Undo는 "가장 최근에 실행 취소되지 않은 작업" 1건만 대상으로 합니다(요구사항
  범위인 "마지막 작업 되돌리기").
- 아이콘은 자리표시자(placeholder)이며, 실제 배포 시 원하는 아이콘으로
  교체해서 사용하시면 됩니다 (`src-tauri/icons/`).
