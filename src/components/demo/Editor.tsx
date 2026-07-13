import { useEffect, useState } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { writeFile } from '../../lib/demoClient';

const LANG: Record<string, string> = {
  yaml: 'yaml', yml: 'yaml', py: 'python', xml: 'xml', md: 'markdown',
  json: 'json', sh: 'shell', txt: 'plaintext', cfg: 'ini', toml: 'ini',
};

interface Props { host: string; session: string | null; file: { path: string; content: string } | null; }

export default function Editor({ host, session, file }: Props) {
  const [value, setValue] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => { setValue(file?.content ?? ''); }, [file?.path]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (session && file) {
          writeFile(host, session, file.path, value)
            .then(() => { setToast('saved (ephemeral — gone when the session ends)'); setTimeout(() => setToast(''), 2500); })
            .catch(() => { setToast('save failed'); setTimeout(() => setToast(''), 2500); });
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [host, session, file?.path, value]);

  if (!file) return <div className="tab-hint">Click a file in the tree to open it here. ⌘/Ctrl-S saves to the running container (ephemeral).</div>;
  const ext = file.path.split('.').pop() ?? '';
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '6px 12px', fontSize: 12, color: '#9CA3AF', fontFamily: 'ui-monospace, Menlo, monospace', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {file.path}{toast && <span style={{ color: '#4ADE80', marginLeft: 12 }}>{toast}</span>}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <MonacoEditor
          height="100%"
          theme="vs-dark"
          language={LANG[ext] ?? 'plaintext'}
          value={value}
          onChange={(v) => setValue(v ?? '')}
          options={{ fontSize: 13, minimap: { enabled: false }, scrollBeyondLastLine: false }}
        />
      </div>
    </div>
  );
}
