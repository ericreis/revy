import type { DiffFile } from './diff';

interface TreeNode {
  name: string;
  path: string;
  kind: 'dir' | 'file';
  children: TreeNode[];
  file?: DiffFile;
}

function buildTree(files: DiffFile[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', kind: 'dir', children: [] };
  for (const f of files) {
    const parts = f.path.split('/');
    let node = root;
    parts.forEach((name, i) => {
      const isFile = i === parts.length - 1;
      let child = node.children.find((c) => c.name === name && c.kind === (isFile ? 'file' : 'dir'));
      if (!child) {
        child = {
          name,
          path: parts.slice(0, i + 1).join('/'),
          kind: isFile ? 'file' : 'dir',
          children: [],
          file: isFile ? f : undefined,
        };
        node.children.push(child);
      }
      node = child;
    });
  }
  sort(root);
  compress(root);
  return root.children;
}

function sort(node: TreeNode): void {
  node.children.sort((a, b) =>
    a.kind !== b.kind ? (a.kind === 'dir' ? -1 : 1) : a.name.localeCompare(b.name),
  );
  node.children.forEach(sort);
}

// Collapse single-child directory chains (GitHub-style: "src/cmd").
function compress(node: TreeNode): void {
  node.children.forEach(compress);
  node.children = node.children.map((child) => {
    let cur = child;
    while (cur.kind === 'dir' && cur.children.length === 1 && cur.children[0].kind === 'dir') {
      const only = cur.children[0];
      cur = { ...only, name: `${cur.name}/${only.name}` };
    }
    return cur;
  });
}

function NodeView({
  node,
  depth,
  activeId,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  activeId?: string;
  onSelect: (f: DiffFile) => void;
}) {
  if (node.kind === 'dir') {
    return (
      <details className="tree-dir" open>
        <summary style={{ paddingLeft: `${depth * 12 + 8}px` }}>{node.name}</summary>
        {node.children.map((c) => (
          <NodeView key={c.path} node={c} depth={depth + 1} activeId={activeId} onSelect={onSelect} />
        ))}
      </details>
    );
  }
  const f = node.file!;
  return (
    <button
      type="button"
      className={`tree-file${activeId === f.id ? ' active' : ''}`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      title={f.path}
      onClick={() => onSelect(f)}
    >
      <span className={`tree-dot dot-${f.type}`} aria-hidden />
      <span className="tree-name">{node.name}</span>
      <span className="tree-counts">
        <span className="add">+{f.additions}</span> <span className="del">−{f.deletions}</span>
      </span>
    </button>
  );
}

export default function FileTree({
  files,
  activeId,
  onSelect,
}: {
  files: DiffFile[];
  activeId?: string;
  onSelect: (f: DiffFile) => void;
}) {
  const tree = buildTree(files);
  return (
    <nav className="tree">
      {tree.map((node) => (
        <NodeView key={node.path} node={node} depth={0} activeId={activeId} onSelect={onSelect} />
      ))}
    </nav>
  );
}
