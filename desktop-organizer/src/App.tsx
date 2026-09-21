import { useCallback, useEffect, useMemo, useState } from "react";
import { api, backendMode } from "./lib/api";
import { classifyEntries } from "./lib/classify";
import { buildPreview, type UserOverride } from "./lib/plan";
import { errorMessage, isPermissionError } from "./lib/errors";
import type {
  CategoryId,
  ClassifiedEntry,
  HistoryRun,
  OrganizeRunResult,
  ScanResult,
} from "./lib/types";
import { Sidebar, type MenuKey } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { BottomBar } from "./components/BottomBar";
import { FileList } from "./components/FileList";
import { PreviewTable } from "./components/PreviewTable";
import { DetailPanel } from "./components/DetailPanel";
import { ConfirmModal } from "./components/ConfirmModal";
import { HistoryView } from "./components/HistoryView";
import { SettingsView } from "./components/SettingsView";
import { LoadingState, EmptyState, ErrorState, PermissionState } from "./components/StateViews";

export type SimulatedState = "none" | "loading" | "empty" | "error" | "permission";

export default function App() {
  const [menu, setMenu] = useState<MenuKey>("scan");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [classified, setClassified] = useState<ClassifiedEntry[]>([]);
  const [overrides, setOverrides] = useState<Map<string, UserOverride>>(new Map());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const [executing, setExecuting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastRunResult, setLastRunResult] = useState<OrganizeRunResult | null>(null);

  const [history, setHistory] = useState<HistoryRun[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [undoing, setUndoing] = useState(false);

  const [simulatedState, setSimulatedState] = useState<SimulatedState>("none");

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const runs = await api.getHistory();
      setHistory(runs);
    } catch (err) {
      setHistoryError(errorMessage(err));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const runScan = useCallback(async (preserveOverrides: boolean) => {
    setScanning(true);
    setScanError(null);
    try {
      const result = await api.scanDesktop();
      setScanResult(result);
      setClassified(classifyEntries(result.entries));
      const validIds = new Set(result.entries.map((e) => e.id));
      setOverrides((prev) => {
        if (!preserveOverrides) return new Map();
        const next = new Map<string, UserOverride>();
        for (const [id, value] of prev) {
          if (validIds.has(id)) next.set(id, value);
        }
        return next;
      });
      setSelectedId((prev) => (prev && validIds.has(prev) ? prev : null));
    } catch (err) {
      setScanError(errorMessage(err));
    } finally {
      setScanning(false);
    }
  }, []);

  const handleScan = useCallback(() => {
    void runScan(false);
  }, [runScan]);

  const handleRefresh = useCallback(() => {
    void runScan(true);
  }, [runScan]);

  useEffect(() => {
    if (menu === "history" && history.length === 0 && !historyLoading) {
      void loadHistory();
    }
  }, [menu, history.length, historyLoading, loadHistory]);

  const handleCategoryChange = useCallback((entryId: string, category: CategoryId) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      const existing = next.get(entryId) ?? {};
      next.set(entryId, { ...existing, category });
      return next;
    });
  }, []);

  const handleKeepOnDesktopChange = useCallback((entryId: string, keep: boolean) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      const existing = next.get(entryId) ?? {};
      next.set(entryId, { ...existing, keepOnDesktop: keep });
      return next;
    });
  }, []);

  const handleResetOverrides = useCallback(() => {
    setOverrides(new Map());
  }, []);

  const preview = useMemo(() => {
    if (!scanResult) return null;
    return buildPreview(classified, overrides, scanResult.desktopPath);
  }, [classified, overrides, scanResult]);

  const entriesById = useMemo(() => {
    const map = new Map(classified.map((c) => [c.entry.id, c.entry]));
    return map;
  }, [classified]);

  const selectedClassified = useMemo(
    () => (selectedId ? classified.find((c) => c.entry.id === selectedId) ?? null : null),
    [classified, selectedId]
  );
  const selectedPlanItem = useMemo(
    () => (selectedId ? preview?.items.find((i) => i.entryId === selectedId) : undefined),
    [preview, selectedId]
  );

  const handleExecute = useCallback(async () => {
    if (!preview) return;
    setExecuting(true);
    try {
      const result = await api.executeOrganize(preview);
      setLastRunResult(result);
      setConfirmOpen(false);
      await runScan(false);
      await loadHistory();
      setMenu("history");
    } catch (err) {
      setScanError(errorMessage(err));
      setConfirmOpen(false);
    } finally {
      setExecuting(false);
    }
  }, [preview, runScan, loadHistory]);

  const handleUndo = useCallback(async () => {
    setUndoing(true);
    try {
      await api.undoLast();
      await runScan(false);
      await loadHistory();
    } catch (err) {
      setHistoryError(errorMessage(err));
    } finally {
      setUndoing(false);
    }
  }, [runScan, loadHistory]);

  const canUndo = history.length > 0 && !history[0]?.undone;
  const mode = backendMode();

  return (
    <div className="app-shell">
      <Sidebar active={menu} onSelect={setMenu} backendMode={mode} />
      <div className="app-main">
        <TopBar
          desktopPath={scanResult?.desktopPath ?? null}
          scannedAt={scanResult?.scannedAt ?? null}
          scanning={scanning}
          onScan={handleScan}
          onRefresh={handleRefresh}
          canRefresh={!!scanResult}
        />

        <div className="app-body">
          <main className="app-content">
            {menu === "scan" && (
              <ScanView
                scanning={scanning}
                error={scanError}
                simulatedState={simulatedState}
                classified={classified}
                overrides={overrides}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onCategoryChange={handleCategoryChange}
                onKeepOnDesktopChange={handleKeepOnDesktopChange}
                onScan={handleScan}
                lastRunResult={lastRunResult}
              />
            )}

            {menu === "preview" && (
              <PreviewView
                scanResult={scanResult}
                preview={preview}
                entriesById={entriesById}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onOpenConfirm={() => setConfirmOpen(true)}
                executing={executing}
                onGoToScan={() => setMenu("scan")}
              />
            )}

            {menu === "history" && (
              <HistoryView
                history={history}
                loading={historyLoading}
                error={historyError}
                onRetry={loadHistory}
                onUndo={handleUndo}
                undoing={undoing}
              />
            )}

            {menu === "settings" && (
              <SettingsView
                backendMode={mode}
                onResetOverrides={handleResetOverrides}
                simulatedState={simulatedState}
                onSimulatedStateChange={setSimulatedState}
              />
            )}
          </main>

          {(menu === "scan" || menu === "preview") && (
            <DetailPanel selected={selectedClassified} planItem={selectedPlanItem} />
          )}
        </div>

        <BottomBar
          totalEntries={classified.length}
          moveCount={preview?.moveCount ?? 0}
          keepCount={preview?.keepCount ?? 0}
          foldersToCreate={preview?.foldersToCreate.length ?? 0}
          canUndo={canUndo}
          onUndo={handleUndo}
          undoing={undoing}
        />
      </div>

      {confirmOpen && preview && (
        <ConfirmModal preview={preview} onConfirm={handleExecute} onCancel={() => setConfirmOpen(false)} busy={executing} />
      )}
    </div>
  );
}

interface ScanViewProps {
  scanning: boolean;
  error: string | null;
  simulatedState: SimulatedState;
  classified: ClassifiedEntry[];
  overrides: Map<string, UserOverride>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCategoryChange: (id: string, category: CategoryId) => void;
  onKeepOnDesktopChange: (id: string, keep: boolean) => void;
  onScan: () => void;
  lastRunResult: OrganizeRunResult | null;
}

function ScanView({
  scanning,
  error,
  simulatedState,
  classified,
  overrides,
  selectedId,
  onSelect,
  onCategoryChange,
  onKeepOnDesktopChange,
  onScan,
  lastRunResult,
}: ScanViewProps) {
  if (simulatedState === "loading" || scanning) {
    return <LoadingState label="바탕화면을 스캔하는 중..." />;
  }
  if (simulatedState === "permission") {
    return <PermissionState onRetry={onScan} />;
  }
  if (simulatedState === "error") {
    return <ErrorState message="바탕화면 정보를 불러오는 중 예기치 못한 오류가 발생했습니다." onRetry={onScan} />;
  }
  if (error) {
    if (isPermissionError(error)) return <PermissionState onRetry={onScan} />;
    return <ErrorState message={error} onRetry={onScan} />;
  }
  if (simulatedState === "empty" || classified.length === 0) {
    return (
      <EmptyState
        title="분석된 파일이 없습니다"
        description="상단의 '바탕화면 스캔' 버튼을 눌러 바탕화면 파일과 폴더를 분석해 보세요."
        actionLabel="바탕화면 스캔"
        onAction={onScan}
      />
    );
  }
  return (
    <>
      {lastRunResult && lastRunResult.errors.length > 0 && (
        <div className="run-error-banner" role="alert">
          <strong>지난 정리 작업 중 {lastRunResult.errors.length}개 파일을 건너뛰었습니다.</strong>
          <ul>
            {lastRunResult.errors.map((e) => (
              <li key={e.entryId}>{e.name}: {e.message}</li>
            ))}
          </ul>
        </div>
      )}
      <FileList
        items={classified}
        overrides={overrides}
        onCategoryChange={onCategoryChange}
        onKeepOnDesktopChange={onKeepOnDesktopChange}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </>
  );
}

interface PreviewViewProps {
  scanResult: ScanResult | null;
  preview: ReturnType<typeof buildPreview> | null;
  entriesById: Map<string, ClassifiedEntry["entry"]>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenConfirm: () => void;
  executing: boolean;
  onGoToScan: () => void;
}

function PreviewView({ scanResult, preview, entriesById, selectedId, onSelect, onOpenConfirm, executing, onGoToScan }: PreviewViewProps) {
  if (!scanResult || !preview) {
    return (
      <EmptyState
        title="먼저 바탕화면을 분석해 주세요"
        description="'바탕화면 분석' 메뉴에서 스캔을 실행하면 정리 미리보기를 확인할 수 있습니다."
        actionLabel="바탕화면 분석으로 이동"
        onAction={onGoToScan}
        icon={"\u{1F441}️"}
      />
    );
  }
  if (preview.items.length === 0) {
    return <EmptyState title="정리할 파일이 없습니다" description="바탕화면이 이미 깨끗합니다." icon={"✨"} />;
  }
  return (
    <PreviewTable
      preview={preview}
      entriesById={entriesById}
      selectedId={selectedId}
      onSelect={onSelect}
      onExecute={onOpenConfirm}
      executing={executing}
    />
  );
}
