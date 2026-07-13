import { useState } from 'react';
import type { Status } from '../../lib/demoClient';
import { logsUrl, ptyUrl, foxgloveUrl } from '../../lib/demoClient';
import Terminal from './Terminal';
import Editor from './Editor';
import About from './About';

type Tab = 'logs' | 'console' | 'editor' | 'viewer' | 'about';

interface Props {
  host: string;
  session: string | null;
  st: Status | null;
  file: { path: string; content: string } | null;
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;
}

export default function WorkTabs({ host, session, st, file, activeTab, setActiveTab }: Props) {
  const live = !!session && !!st?.claimed;
  const ready = !!st?.ready;

  return (
    <div className="ws-pane">
      <div className="tabs">
        <div className="tabbar">
          {(['logs', 'console', 'editor', 'viewer', 'about'] as Tab[]).map((t) => (
            <button
              key={t}
              className={activeTab === t ? 'active' : ''}
              disabled={t !== 'about' && !live}
              onClick={() => setActiveTab(t)}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className="tabbody">
          {activeTab === 'logs' && (live
            ? <Terminal wsUrl={logsUrl(host, session!)} interactive={false} />
            : <div className="tab-hint">Start an instance to stream the stack log.</div>)}
          {activeTab === 'console' && (live
            ? <Terminal wsUrl={ptyUrl(host, session!)} interactive />
            : <div className="tab-hint">Start an instance for a shell.</div>)}
          {activeTab === 'editor' && <Editor host={host} session={session} file={file} />}
          {activeTab === 'viewer' && (
            <div className="viewer-cta">
              <a className={ready && session ? '' : 'off'} href={ready && session ? foxgloveUrl(host, session) : undefined} target="_blank" rel="noopener">
                Open the robot in Foxglove ↗
              </a>
              <span>Embedded viewer coming soon — opens in a new tab for now.</span>
            </div>
          )}
          {activeTab === 'about' && <About />}
        </div>
      </div>
    </div>
  );
}

export type { Tab };
