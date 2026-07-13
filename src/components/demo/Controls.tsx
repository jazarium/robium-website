import type { Status } from '../../lib/demoClient';
import { foxgloveUrl, layoutUrl } from '../../lib/demoClient';

interface Props {
  host: string;
  session: string | null;
  st: Status | null;
  onStart: () => void;
  onStop: () => void;
}

export default function Controls({ host, session, st, onStart, onStop }: Props) {
  const running = !!session;
  const ready = !!st?.ready;
  const pill = !running ? 'idle' : ready ? `ready · rtf ${st?.rtf}` : (st?.claimed ? 'booting…' : 'starting…');
  const mm = st ? String(Math.floor(st.remaining_s / 60)).padStart(2, '0') : '30';
  const ss = st ? String(st.remaining_s % 60).padStart(2, '0') : '00';

  return (
    <div className="ws-pane">
      <div className="pane-head">Controls</div>
      <div className="controls">
        <span className="pill">{pill}</span>
        {!running ? (
          <button className="btn primary" onClick={onStart}>Start instance</button>
        ) : (
          <button className="btn" onClick={onStop}>Stop instance</button>
        )}
        <a
          className={`btn ${ready && session ? '' : 'off'}`}
          href={ready && session ? foxgloveUrl(host, session) : undefined}
          target="_blank"
          rel="noopener"
        >
          Open in Foxglove →
        </a>
        {running && (
          <>
            <span className="metric">uptime {st?.uptime_s ?? 0}s · {st?.nodes ?? 0} nodes</span>
            <span className="metric">session ends in {mm}:{ss}</span>
          </>
        )}
        <span className="metric">
          {st?.fleet?.running != null
            ? `robots running: ${st.fleet.running} of ${st.fleet.budget}`
            : `budget: ${st?.fleet?.budget ?? 5} concurrent`}
        </span>
        <a className="dl" href={layoutUrl} download>↓ Foxglove layout file (one-time import)</a>
      </div>
    </div>
  );
}
