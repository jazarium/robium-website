const HTTP = (h: string) => `https://${h}`;

export interface Status {
  claimed: boolean;
  ready: boolean;
  rtf: number | null;
  nodes: number;
  uptime_s: number;
  remaining_s: number;
  fleet: { running: number | null; budget: number };
  log: string[];
}

export interface Entry { name: string; dir: boolean; }

const opts: RequestInit = { credentials: 'include' };

export const start = (h: string, s: string) =>
  fetch(`${HTTP(h)}/start?session=${s}`, { ...opts, method: 'POST' });

export const status = (h: string, s: string): Promise<Status | null> =>
  fetch(`${HTTP(h)}/status?session=${s}`, opts).then((r) =>
    r.status === 409 ? null : (r.json() as Promise<Status>),
  );

export const shutdown = (h: string, s: string) =>
  fetch(`${HTTP(h)}/shutdown?session=${s}`, { ...opts, method: 'POST' });

export const listDir = (h: string, s: string, path: string) =>
  fetch(`${HTTP(h)}/fs/list?session=${s}&path=${encodeURIComponent(path)}`, opts).then(
    (r) => r.json() as Promise<{ path: string; entries: Entry[] }>,
  );

export const readFile = (h: string, s: string, path: string) =>
  fetch(`${HTTP(h)}/fs/read?session=${s}&path=${encodeURIComponent(path)}`, opts).then(
    (r) => r.json() as Promise<{ path: string; content: string }>,
  );

export const writeFile = (h: string, s: string, path: string, content: string) =>
  fetch(`${HTTP(h)}/fs/write?session=${s}&path=${encodeURIComponent(path)}`, {
    ...opts,
    method: 'POST',
    body: content,
  });

export const ptyUrl = (h: string, s: string) => `wss://${h}/pty?session=${s}`;
export const logsUrl = (h: string, s: string) => `wss://${h}/logs?session=${s}`;
export const foxgloveUrl = (h: string, s: string) =>
  `https://app.foxglove.dev/~/view?ds=foxglove-websocket&ds.url=${encodeURIComponent(
    `wss://${h}/?session=${s}`,
  )}`;
export const layoutUrl = '/demos/nav-trial-layout.json';
