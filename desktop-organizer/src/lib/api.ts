import type {
  BackendMode,
  DesktopEntry,
  HistoryRun,
  MoveError,
  OrganizeRunResult,
  OrganizePreview,
  ScanResult,
  UndoResult,
} from "./types";
import { MOCK_DESKTOP_ENTRIES } from "./mockData";

// ---------------------------------------------------------------------------
// Backend detection
// ---------------------------------------------------------------------------

export function backendMode(): BackendMode {
  const hasTauri = typeof window !== "undefined" && Boolean((window as unknown as { __TAURI__?: unknown }).__TAURI__);
  return hasTauri ? "tauri" : "mock";
}

// ---------------------------------------------------------------------------
// Real Tauri backend - thin wrapper around `invoke`
// ---------------------------------------------------------------------------

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const mod = await import("@tauri-apps/api/tauri");
  return mod.invoke<T>(cmd, args);
}

const tauriBackend = {
  scanDesktop: () => tauriInvoke<ScanResult>("scan_desktop"),
  executeOrganize: (preview: OrganizePreview) =>
    tauriInvoke<OrganizeRunResult>("execute_organize", { preview }),
  undoLast: () => tauriInvoke<UndoResult>("undo_last"),
  getHistory: () => tauriInvoke<HistoryRun[]>("get_history"),
};

// ---------------------------------------------------------------------------
// Mock backend - in-memory simulation so the whole UI works in a plain
// browser (`npm run dev`) before/without the native Tauri shell.
// ---------------------------------------------------------------------------

const MOCK_DESKTOP_PATH = "C:\\Users\\User\\Desktop";

class MockBackend {
  private onDesktop: Map<string, DesktopEntry>;
  private movedAway: Map<string, { entry: DesktopEntry; currentPath: string }>;
  private restoredEntryIds: Set<string> = new Set();
  private history: HistoryRun[] = [];
  private runCounter = 0;

  constructor() {
    this.onDesktop = new Map(MOCK_DESKTOP_ENTRIES.map((e) => [e.id, { ...e }]));
    this.movedAway = new Map();
  }

  async scanDesktop(): Promise<ScanResult> {
    await delay(350);
    return {
      desktopPath: MOCK_DESKTOP_PATH,
      entries: Array.from(this.onDesktop.values()).map((e) => ({ ...e })),
      scannedAt: new Date().toISOString(),
    };
  }

  async executeOrganize(preview: OrganizePreview): Promise<OrganizeRunResult> {
    await delay(500);
    const runId = `run-${Date.now()}-${this.runCounter++}`;
    const errors: MoveError[] = [];
    const operations: HistoryRun["operations"] = [];

    for (const item of preview.items) {
      if (item.keepOnDesktop) continue;
      const entry = this.onDesktop.get(item.entryId);
      if (!entry) {
        const message = "원본 파일을 바탕화면에서 찾을 수 없습니다.";
        errors.push({ entryId: item.entryId, name: item.entryId, message });
        operations.push({
          entryId: item.entryId,
          name: item.entryId,
          from: item.destinationPath,
          to: item.destinationPath,
          status: "failed",
          errorMessage: message,
        });
        continue;
      }
      this.onDesktop.delete(item.entryId);
      this.movedAway.set(item.entryId, { entry, currentPath: item.destinationPath });
      operations.push({
        entryId: item.entryId,
        name: entry.name,
        from: entry.path,
        to: item.destinationPath,
        status: "moved",
      });
    }

    const run: HistoryRun = {
      runId,
      timestamp: new Date().toISOString(),
      operations,
      undone: false,
    };
    this.history.unshift(run);

    return {
      runId,
      timestamp: run.timestamp,
      movedCount: operations.length,
      errors,
      canUndo: operations.length > 0,
    };
  }

  async undoLast(): Promise<UndoResult> {
    await delay(400);
    const run = this.history.find((r) => !r.undone);
    if (!run) {
      return { runId: "", restoredCount: 0, errors: [], success: false };
    }
    const errors: MoveError[] = [];
    let restored = 0;
    for (const op of run.operations) {
      if (op.status === "failed") continue; // never actually moved, nothing to undo
      const moved = this.movedAway.get(op.entryId);
      if (!moved) {
        if (this.restoredEntryIds.has(op.entryId)) continue; // already restored in a previous attempt
        errors.push({ entryId: op.entryId, name: op.name, message: "되돌릴 위치 정보를 찾을 수 없습니다." });
        continue;
      }
      this.movedAway.delete(op.entryId);
      this.onDesktop.set(op.entryId, { ...moved.entry });
      this.restoredEntryIds.add(op.entryId);
      restored += 1;
    }
    run.undone = errors.length === 0;
    run.undoErrors = errors.length > 0 ? errors : undefined;
    return { runId: run.runId, restoredCount: restored, errors, success: errors.length === 0 };
  }

  async getHistory(): Promise<HistoryRun[]> {
    await delay(150);
    return this.history.map((r) => ({ ...r, operations: [...r.operations] }));
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let mockInstance: MockBackend | null = null;
function getMockBackend(): MockBackend {
  if (!mockInstance) mockInstance = new MockBackend();
  return mockInstance;
}

// ---------------------------------------------------------------------------
// Public API - always goes through this module, never `invoke` directly
// ---------------------------------------------------------------------------

export const api = {
  mode: backendMode,
  scanDesktop(): Promise<ScanResult> {
    return backendMode() === "tauri" ? tauriBackend.scanDesktop() : getMockBackend().scanDesktop();
  },
  executeOrganize(preview: OrganizePreview): Promise<OrganizeRunResult> {
    return backendMode() === "tauri"
      ? tauriBackend.executeOrganize(preview)
      : getMockBackend().executeOrganize(preview);
  },
  undoLast(): Promise<UndoResult> {
    return backendMode() === "tauri" ? tauriBackend.undoLast() : getMockBackend().undoLast();
  },
  getHistory(): Promise<HistoryRun[]> {
    return backendMode() === "tauri" ? tauriBackend.getHistory() : getMockBackend().getHistory();
  },
};
