import { useEffect, useState } from 'react';
import { listDir, readFile, type Entry } from '../../lib/demoClient';

interface Props {
  host: string;
  session: string | null;
  onOpen: (path: string, content: string) => void;
}

interface Node { entry: Entry; path: string; depth: number; open?: boolean; children?: Node[]; }

export default function FileTree({ host, session, onOpen }: Props) {
  const [nodes, setNodes] = useState<Node[]>([]);

  useEffect(() => {
    setNodes([]);
    if (!session) return;
    listDir(host, session, '')
      .then((r) => setNodes(r.entries.map((e) => ({ entry: e, path: e.name, depth: 0 }))))
      .catch(() => {});
  }, [host, session]);

  async function toggle(idx: number) {
    const n = nodes[idx];
    if (!session) return;
    if (n.entry.dir) {
      if (n.open) {
        // collapse: drop deeper rows that belong to this path
        setNodes((cur) => cur.filter((m, i) => i <= idx || !m.path.startsWith(n.path + '/') || m.depth <= n.depth));
        setNodes((cur) => cur.map((m, i) => (i === idx ? { ...m, open: false } : m)));
        return;
      }
      const r = await listDir(host, session, n.path).catch(() => null);
      if (!r) return;
      const kids: Node[] = r.entries.map((e) => ({ entry: e, path: `${n.path}/${e.name}`, depth: n.depth + 1 }));
      setNodes((cur) => {
        const next = [...cur];
        next[idx] = { ...n, open: true };
        next.splice(idx + 1, 0, ...kids);
        return next;
      });
    } else {
      const r = await readFile(host, session, n.path).catch(() => null);
      if (r) onOpen(n.path, r.content);
    }
  }

  return (
    <div className="ws-pane">
      <div className="pane-head">Files</div>
      <div className="tree">
        {!session && <div className="tab-hint">Start an instance to browse the source.</div>}
        {nodes.map((n, i) => (
          <div
            key={n.path}
            className={`row ${n.entry.dir ? 'dir' : ''}`}
            style={{ paddingLeft: 12 + n.depth * 14 }}
            onClick={() => toggle(i)}
          >
            {n.entry.dir ? (n.open ? '▾ ' : '▸ ') : '  '}
            {n.entry.name}
          </div>
        ))}
      </div>
    </div>
  );
}
