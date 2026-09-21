import type { DesktopEntry, OrganizePreview } from "../lib/types";

interface TreeNode {
  name: string;
  children: Map<string, TreeNode>;
  fileNames: string[];
}

function createNode(name: string): TreeNode {
  return { name, children: new Map(), fileNames: [] };
}

function buildTree(preview: OrganizePreview, entriesById: Map<string, DesktopEntry>): TreeNode {
  const root = createNode("root");
  for (const item of preview.items) {
    if (item.keepOnDesktop) continue;
    const entry = entriesById.get(item.entryId);
    if (!entry) continue;
    const sep = item.destinationFolder.includes("\\") ? "\\" : "/";
    const segments = item.destinationFolder.split(sep).filter(Boolean);
    let node = root;
    for (const segment of segments) {
      let child = node.children.get(segment);
      if (!child) {
        child = createNode(segment);
        node.children.set(segment, child);
      }
      node = child;
    }
    node.fileNames.push(entry.name);
  }
  return root;
}

function countFiles(node: TreeNode): number {
  let total = node.fileNames.length;
  for (const child of node.children.values()) total += countFiles(child);
  return total;
}

function FolderNode({ node, depth }: { node: TreeNode; depth: number }) {
  const total = countFiles(node);
  const childNodes = Array.from(node.children.values());
  return (
    <details className="tree-node" open={depth < 1}>
      <summary className="tree-summary">
        <span aria-hidden="true">📁</span>
        <span className="tree-name">{node.name}</span>
        <span className="tree-count">{total}개</span>
      </summary>
      <div className="tree-children">
        {childNodes.map((child) => (
          <FolderNode key={child.name} node={child} depth={depth + 1} />
        ))}
        {node.fileNames.map((name) => (
          <div className="tree-file" key={name}>
            <span aria-hidden="true">📄</span>
            <span>{name}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

interface FolderTreeProps {
  preview: OrganizePreview;
  entriesById: Map<string, DesktopEntry>;
}

export function FolderTree({ preview, entriesById }: FolderTreeProps) {
  const tree = buildTree(preview, entriesById);
  const rootChildren = Array.from(tree.children.values());
  const kept = preview.items.filter((i) => i.keepOnDesktop);

  if (rootChildren.length === 0 && kept.length === 0) {
    return null;
  }

  return (
    <div className="folder-tree">
      {rootChildren.map((child) => (
        <FolderNode key={child.name} node={child} depth={0} />
      ))}
      {kept.length > 0 && (
        <details className="tree-node tree-node--kept">
          <summary className="tree-summary">
            <span aria-hidden="true">🖥️</span>
            <span className="tree-name">바탕화면 (이동 안 함)</span>
            <span className="tree-count">{kept.length}개</span>
          </summary>
          <div className="tree-children">
            {kept.map((item) => {
              const entry = entriesById.get(item.entryId);
              if (!entry) return null;
              return (
                <div className="tree-file" key={item.entryId}>
                  <span aria-hidden="true">📄</span>
                  <span>{entry.name}</span>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
