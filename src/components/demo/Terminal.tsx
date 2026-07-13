import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

/** xterm over a WebSocket. interactive=true wires stdin → ws (the Console);
 *  false is a read-only stream (the Logs). Reconnects when wsUrl changes. */
export default function Terminal({ wsUrl, interactive }: { wsUrl: string | null; interactive: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wsUrl || !hostRef.current) return;
    const term = new XTerm({
      convertEol: !interactive,
      cursorBlink: interactive,
      fontFamily: 'ui-monospace, Menlo, monospace',
      fontSize: 13,
      theme: { background: '#0b0d14', foreground: '#c8cdd6', cursor: '#7C5CFF' },
      disableStdin: !interactive,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    try { fit.fit(); } catch {}
    const onResize = () => { try { fit.fit(); } catch {} };
    window.addEventListener('resize', onResize);

    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    ws.onmessage = (e) => {
      const data = typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data);
      term.write(data);
    };
    ws.onopen = () => { if (!interactive) term.write('\x1b[90m— connected —\x1b[0m\r\n'); };
    ws.onclose = () => term.write('\r\n\x1b[90m— disconnected —\x1b[0m\r\n');
    if (interactive) term.onData((d) => { if (ws.readyState === 1) ws.send(d); });

    return () => {
      window.removeEventListener('resize', onResize);
      try { ws.close(); } catch {}
      term.dispose();
    };
  }, [wsUrl, interactive]);

  return <div className="xterm-host" ref={hostRef} />;
}
