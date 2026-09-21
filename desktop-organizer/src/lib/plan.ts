import { categoryMeta } from "./types";
import type { ClassifiedEntry, OrganizePreview, PlanItem } from "./types";

// Root folder created on the Desktop to hold every organized category.
export const ORGANIZED_ROOT_FOLDER = "정리됨";

const INVALID_FOLDER_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

export function sanitizeFolderName(name: string): string {
  const cleaned = name.replace(INVALID_FOLDER_CHARS, "_").trim();
  return cleaned.length > 0 ? cleaned : "기타";
}

export interface UserOverride {
  category?: ClassifiedEntry["result"]["category"];
  keepOnDesktop?: boolean;
}

function joinPath(desktopPath: string, ...segments: string[]): string {
  const sep = desktopPath.includes("\\") ? "\\" : "/";
  return [desktopPath, ...segments].join(sep);
}

/**
 * Builds the exact, user-reviewable move plan. This is the single source of
 * truth for where every file will land - the same paths shown in the
 * preview are the paths sent to the backend for execution.
 */
export function buildPreview(
  classified: ClassifiedEntry[],
  overrides: Map<string, UserOverride>,
  desktopPath: string
): OrganizePreview {
  const usedDestinationPaths = new Set<string>();
  const items: PlanItem[] = [];
  const foldersToCreate = new Set<string>();

  for (const { entry, result } of classified) {
    const override = overrides.get(entry.id);
    const category = override?.category ?? result.category;
    const defaultKeep = result.category === "uncategorized" && override?.category === undefined;
    const keepOnDesktop = override?.keepOnDesktop ?? defaultKeep;

    const meta = categoryMeta(category);
    const sep = desktopPath.includes("\\") ? "\\" : "/";
    // All project files land directly in one "01_프로젝트" folder rather than
    // a separate subfolder per project name - fewer folders on the desktop.
    const segments = [ORGANIZED_ROOT_FOLDER, meta.folderName];
    const destinationFolder = segments.join(sep);

    let candidateName = entry.name;
    let destinationPath = joinPath(desktopPath, destinationFolder, candidateName);
    if (!keepOnDesktop) {
      let suffix = 1;
      while (usedDestinationPaths.has(destinationPath.toLowerCase())) {
        const dot = entry.isDirectory ? -1 : entry.name.lastIndexOf(".");
        candidateName =
          dot > 0
            ? `${entry.name.slice(0, dot)} (${suffix})${entry.name.slice(dot)}`
            : `${entry.name} (${suffix})`;
        destinationPath = joinPath(desktopPath, destinationFolder, candidateName);
        suffix += 1;
      }
      usedDestinationPaths.add(destinationPath.toLowerCase());
      foldersToCreate.add(destinationFolder);
    }

    items.push({
      entryId: entry.id,
      category,
      projectGroup: category === "project" ? result.projectGroup : undefined,
      destinationFolder,
      destinationPath,
      keepOnDesktop,
    });
  }

  const moveCount = items.filter((i) => !i.keepOnDesktop).length;
  const keepCount = items.length - moveCount;

  return {
    items,
    foldersToCreate: Array.from(foldersToCreate).sort(),
    moveCount,
    keepCount,
  };
}
