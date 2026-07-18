# Demo v4 — IDE Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn /demos/nav-trial into a full-bleed IDE workspace — real sandboxed shell, file browser + editor, live logs, Foxglove handoff — hardened so a public root shell is safe.

**Architecture:** Two phases. Phase 1 (Tasks 1–5) hardens the demo Cloud Run service (zero-permission SA + VPC egress lockdown) and grows the gateway with PTY / logs / filesystem endpoints — provably safe and smoke-gated BEFORE any shell is reachable. Phase 2 (Tasks 6–10) builds the React IDE island (xterm.js Console+Logs, Monaco editor, file tree, resizable panes) mounted on the otherwise-static Astro page.

**Tech Stack:** python3 stdlib asyncio+pty (gateway), gcloud (Cloud Run, VPC, IAM), Astro 6 + React 19 island, @xterm/xterm 6, @monaco-editor/react 4.7, react-resizable-panels 4.12.

## Global Constraints

- Repos: gateway/backend + deploy in `/Users/robium-ai/repos/robium-applications/apps/nav-trial` (capture learnings per that repo's rules); frontend in `/Users/robium-ai/repos/robium.org`.
- **Phase 1 before Phase 2, always** — no interactive shell endpoint may be deployed to a reachable URL until the zero-perm SA (Task 1) and egress lockdown (Task 2) are live. Tasks 3–5 add the shell only after 1–2 land.
- Demo host: `demo.robium.org` (same-site; affinity cookie + `credentials:'include'` + exact-origin CORS `https://robium.org`, as shipped).
- Gateway endpoints are all session-UUID guarded; a mismatched session → 403 (control) / 409 (status) / 503 (claim).
- Cloud Run unchanged values: region us-central1, project robium-prod, port 8765, concurrency=4, session-affinity, min=0, max=5, timeout=1800, cpu=8, mem=8Gi, cpu-boost, no-cpu-throttling, gen2, env GZ_RELAY/GZ_IP/FASTDDS_BUILTIN_TRANSPORTS.
- Frontend is a `client:only="react"` island; the rest of robium.org stays static/zero-JS. Monaco/xterm bundles code-split to this route only.
- Commits end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

## PHASE 1 — Hardening + backend

### Task 1: Zero-permission service account + relocate the fleet counter

**Files:**
- Modify: `apps/nav-trial/Makefile` (demo-deploy: `--service-account`, drop the monitoring reliance), `apps/nav-trial/scripts/demo_gateway.py` (fleet source)

**Interfaces:**
- Produces: demo container runs as `demo-nav-trial-sa@robium-prod.iam.gserviceaccount.com` with **zero IAM roles**; `/status`'s `fleet.running` now comes from the robium-site backend, not the demo container.

- [ ] **Step 1: Create the zero-permission SA**

```bash
gcloud iam service-accounts create demo-nav-trial-sa \
  --project=robium-prod --display-name="nav-trial demo (no permissions)"
```
Grant it NOTHING. Verify it has no roles:
```bash
gcloud projects get-iam-policy robium-prod --format=json | \
  python3 -c "import json,sys; p=json.load(sys.stdin); print([b['role'] for b in p['bindings'] if 'serviceAccount:demo-nav-trial-sa@robium-prod.iam.gserviceaccount.com' in b.get('members',[])])"
```
Expected: `[]`

- [ ] **Step 2: Disable the in-container fleet query (spec deviation — see note)**

A zero-permission demo SA and an in-container Monitoring query are mutually exclusive, and the security requirement wins. The site (static nginx, no runtime) has nowhere cheap to host the query, and a dedicated Cloud Function/service is out of scope for v4. **Decision: drop the live fleet number in v4**; the page shows the static budget ("up to 5 concurrent"). The JSON contract is kept stable (`fleet.running: null`) so a future separately-permissioned endpoint can restore the live count with no frontend change. This is a deviation from the spec's "relocate the fleet counter" — recorded here and surfaced to the user at plan approval.

In `demo_gateway.py`, change `fleet_running()` to return `None` unconditionally (keep the function + JSON shape so the frontend contract is stable):
```python
def fleet_running():
    # Live count disabled in v4: the demo SA holds zero IAM roles (security),
    # so it cannot query Monitoring. Page shows the static budget. A future
    # separately-permissioned endpoint can restore the live number.
    return None
```

- [ ] **Step 3: Point demo-deploy at the new SA**

In `apps/nav-trial/Makefile` `demo-deploy`, add to the flag list:
```
	  --service-account=demo-nav-trial-sa@robium-prod.iam.gserviceaccount.com \
```

- [ ] **Step 4: Deploy and verify the token is powerless**

```bash
cd /Users/robium-ai/repos/robium-applications/apps/nav-trial && make demo-image && make demo-deploy
```
After deploy, exec the running instance is not possible on Cloud Run; instead verify via a scratch check in Task 3's PTY once available. For now confirm the service came up:
```bash
curl -s --max-time 60 "https://demo.robium.org/status?session=t1" | python3 -c "import json,sys; d=json.load(sys.stdin); print('fleet:', d['fleet'])"
```
Expected: `fleet: {'running': None, 'budget': 5}`

- [ ] **Step 5: Commit**

```bash
cd /Users/robium-ai/repos/robium-applications
git add apps/nav-trial && git commit -m "security(nav-trial): demo runs as zero-permission SA; live fleet disabled (was monitoring.viewer)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Egress lockdown (VPC deny-all)

**Files:**
- Modify: `apps/nav-trial/Makefile` (demo-deploy: VPC egress flags)

**Interfaces:**
- Produces: the demo container has NO outbound internet; inbound visitor WebSocket unaffected. Later tasks' egress test asserts this.

- [ ] **Step 1: Create a VPC network + subnet + deny-all egress firewall**

```bash
gcloud compute networks create demo-net --project=robium-prod --subnet-mode=custom
gcloud compute networks subnets create demo-subnet --project=robium-prod \
  --network=demo-net --region=us-central1 --range=10.8.0.0/28
gcloud compute firewall-rules create demo-deny-egress --project=robium-prod \
  --network=demo-net --direction=EGRESS --action=DENY --rules=all \
  --destination-ranges=0.0.0.0/0 --priority=1000
```
(Inbound to Cloud Run does not traverse this firewall — the visitor's request arrives via the Google front end, not the VPC.)

- [ ] **Step 2: Route ALL demo egress through the VPC**

In `demo-deploy`, add:
```
	  --network=demo-net --subnet=demo-subnet --vpc-egress=all-traffic \
```

- [ ] **Step 3: Deploy and confirm the demo still boots**

```bash
cd /Users/robium-ai/repos/robium-applications/apps/nav-trial && make demo-deploy
```
Hold a ws + poll to ready (reuse the verified pattern):
```bash
S=egress$RANDOM; ( curl -s --http1.1 -N --max-time 400 -o /dev/null -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: $(openssl rand -base64 16)" -H "Sec-WebSocket-Protocol: foxglove.sdk.v1" "https://demo.robium.org/?session=$S" & ) ; curl -s -X POST "https://demo.robium.org/start?session=$S" >/dev/null; n=0; until curl -s "https://demo.robium.org/status?session=$S" | grep -q '"ready": true'; do n=$((n+1)); [ $n -ge 40 ] && echo TIMEOUT && break; sleep 12; done; curl -s "https://demo.robium.org/status?session=$S" | head -c 120; curl -s -X POST "https://demo.robium.org/shutdown?session=$S" >/dev/null
```
Expected: `"ready": true` (the sim needs no egress — Gazebo runs offline, verified in nav-trial). If it hangs on a Fuel asset fetch, add a narrow allow-rule for `fuel.gazebosim.org` only and note it. **This is spec open-risk 1 — resolve here.**

- [ ] **Step 4: Commit**

```bash
cd /Users/robium-ai/repos/robium-applications
git add apps/nav-trial && git commit -m "security(nav-trial): VPC deny-all egress on the demo container

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Gateway PTY (interactive shell) + logs stream

**Files:**
- Modify: `apps/nav-trial/scripts/demo_gateway.py`
- Modify: `apps/nav-trial/Makefile` (demo-smoke: pty + egress checks)

**Interfaces:**
- Produces: `WS /pty?session=U` (bash PTY ↔ ws bytes) and `WS /logs?session=U` (read-only status-log stream). Both session-guarded, one live each per instance.

- [ ] **Step 1: Add PTY + logs handlers to the gateway**

Add near the top: `import fcntl, pty, struct, termios`. Add a helper and route (insert the routes before the final catch-all in `handle`):

```python
async def pty_bridge(reader, writer, raw_head):
    """Bridge a browser WebSocket (already handshook by the bridge? no —
    here we terminate the ws ourselves) to a bash PTY. Minimal RFC6455
    server framing: we do our own accept + frame codec because there's no
    ws lib. Text frames only, binary passthrough."""
    import base64, hashlib
    key = ''
    for line in raw_head.split('\r\n'):
        if line.lower().startswith('sec-websocket-key:'):
            key = line.split(':', 1)[1].strip()
    accept = base64.b64encode(hashlib.sha1(
        (key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').encode()).digest()).decode()
    writer.write((f'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\n'
                  f'Connection: Upgrade\r\nSec-WebSocket-Accept: {accept}\r\n\r\n').encode())
    await writer.drain()

    pid, fd = pty.fork()
    if pid == 0:
        os.environ['TERM'] = 'xterm-256color'
        os.execvp('bash', ['bash'])
    loop = asyncio.get_event_loop()

    async def pty_to_ws():
        while True:
            try:
                data = await loop.run_in_executor(None, os.read, fd, 4096)
            except OSError:
                break
            if not data:
                break
            writer.write(ws_frame(data))
            await writer.drain()

    async def ws_to_pty():
        buf = b''
        while True:
            chunk = await reader.read(4096)
            if not chunk:
                break
            buf += chunk
            while True:
                payload, buf, closed = ws_unframe(buf)
                if closed:
                    return
                if payload is None:
                    break
                os.write(fd, payload)

    try:
        await asyncio.gather(pty_to_ws(), ws_to_pty())
    finally:
        try:
            os.kill(pid, signal.SIGKILL)
        except OSError:
            pass
        try:
            writer.close()
        except Exception:
            pass
```

Add the minimal frame codec (module level):

```python
def ws_frame(data: bytes) -> bytes:
    n = len(data)
    if n < 126:
        header = bytes([0x82, n])
    elif n < 65536:
        header = bytes([0x82, 126]) + n.to_bytes(2, 'big')
    else:
        header = bytes([0x82, 127]) + n.to_bytes(8, 'big')
    return header + data


def ws_unframe(buf: bytes):
    """Return (payload|None, remaining_buf, closed). None payload = need more."""
    if len(buf) < 2:
        return None, buf, False
    b1 = buf[1]
    masked = b1 & 0x80
    ln = b1 & 0x7f
    idx = 2
    if ln == 126:
        if len(buf) < 4:
            return None, buf, False
        ln = int.from_bytes(buf[2:4], 'big'); idx = 4
    elif ln == 127:
        if len(buf) < 10:
            return None, buf, False
        ln = int.from_bytes(buf[2:10], 'big'); idx = 10
    opcode = buf[0] & 0x0f
    need = idx + (4 if masked else 0) + ln
    if len(buf) < need:
        return None, buf, False
    if masked:
        mask = buf[idx:idx + 4]; idx += 4
        payload = bytes(b ^ mask[i % 4] for i, b in enumerate(buf[idx:idx + ln]))
    else:
        payload = buf[idx:idx + ln]
    rest = buf[need:]
    if opcode == 0x8:  # close
        return None, rest, True
    return payload, rest, False
```

In `handle`, after the existing `is_upgrade` (Foxglove tunnel) block, branch by path BEFORE tunneling: if `url.path == '/pty'` and it's an upgrade and session matches (or claims), call `await pty_bridge(reader, writer, head)` and return; if `url.path == '/logs'` and upgrade, stream the status-file log lines as text frames (poll `/tmp/demo_status.json` every 1 s, send new `log[]` entries). Guard both with the same session-claim logic as the Foxglove tunnel. (The Foxglove viewer ws keeps the default path.)

- [ ] **Step 2: Extend demo-smoke with a PTY echo + egress-closed test**

Add to `make demo-smoke` after the readiness check, a python ws client that opens `/pty`, sends `echo hello-pty\n`, and asserts `hello-pty` comes back; and sends `curl -sS --max-time 5 https://example.com; echo EGRESS_$?\n` asserting a NON-zero exit (egress blocked). Put the client in `tests/pty_probe.py`:

```python
import asyncio, sys, base64, os, hashlib
async def main(host, session):
    reader, writer = await asyncio.open_connection(host, 8765)
    key = base64.b64encode(os.urandom(16)).decode()
    writer.write((f'GET /pty?session={session} HTTP/1.1\r\nHost: {host}\r\n'
                  f'Upgrade: websocket\r\nConnection: Upgrade\r\n'
                  f'Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
    await writer.drain()
    await reader.readuntil(b'\r\n\r\n')
    def frame(s):
        d = s.encode(); n = len(d); mask = os.urandom(4)
        return bytes([0x81, 0x80 | n]) + mask + bytes(b ^ mask[i%4] for i,b in enumerate(d))
    writer.write(frame('echo hello-pty\n')); await writer.drain()
    writer.write(frame('curl -sS --max-time 5 https://example.com >/dev/null 2>&1; echo EGRESS_$?\n')); await writer.drain()
    got = b''
    try:
        for _ in range(200):
            got += await asyncio.wait_for(reader.read(4096), timeout=15)
            if b'hello-pty' in got and b'EGRESS_' in got:
                break
    except asyncio.TimeoutError:
        pass
    text = got.decode('latin1')
    assert 'hello-pty' in text, 'PTY did not echo'
    assert 'EGRESS_0' not in text, 'EGRESS WAS OPEN — hardening failed'
    print('PTY OK + EGRESS BLOCKED')
asyncio.run(main(sys.argv[1], sys.argv[2]))
```
Makefile addition (local: egress isn't blocked locally, so gate the egress assertion on a flag; locally just assert the PTY echo):
```makefile
	python3 tests/pty_probe.py localhost smoke || (echo "PTY SMOKE FAIL"; exit 1)
```

- [ ] **Step 3: Run local smoke**

`cd /Users/robium-ai/repos/robium-applications/apps/nav-trial && make demo-smoke`
Expected: `PTY OK` line (local egress test is informational locally), then `DEMO SMOKE PASS`.

- [ ] **Step 4: Commit**

```bash
git add apps/nav-trial && git commit -m "feat(nav-trial): gateway PTY shell + read-only logs stream

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Gateway filesystem API

**Files:**
- Modify: `apps/nav-trial/scripts/demo_gateway.py`, `apps/nav-trial/Makefile` (smoke)

**Interfaces:**
- Produces: `GET /fs/list?path=` → `{"path","entries":[{"name","dir":bool}]}`; `GET /fs/read?path=` → `{"path","content"}`; `POST /fs/write?path=` (body=content) → `{"ok":true}`. Root-jailed to `WORKSPACE_ROOT=/ws`.

- [ ] **Step 1: Add the fs routes** (path-traversal guarded)

```python
WORKSPACE_ROOT = '/ws'

def safe_path(p):
    full = os.path.realpath(os.path.join(WORKSPACE_ROOT, (p or '').lstrip('/')))
    if full != WORKSPACE_ROOT and not full.startswith(WORKSPACE_ROOT + '/'):
        return None
    return full
```
Routes in `handle` (session-guarded like /status):
- `/fs/list`: `entries=[{'name':e,'dir':os.path.isdir(os.path.join(full,e))} for e in sorted(os.listdir(full))]`
- `/fs/read`: return file text (cap at ~512 KB; refuse binary by trying utf-8 decode)
- `/fs/write` POST: read the body by Content-Length, write within the jail, return ok.
Return 400 on `safe_path()` None; 404 on missing.

- [ ] **Step 2: Smoke additions**

Add to `make demo-smoke`:
```makefile
	curl -sf "http://localhost:8765/fs/list?session=smoke&path=src" | grep -q nav_trial_bringup
	curl -sf "http://localhost:8765/fs/write?session=smoke&path=/tmp/robium_demo_t.txt" --data "hello-fs"
	curl -sf "http://localhost:8765/fs/read?session=smoke&path=/tmp/robium_demo_t.txt" | grep -q hello-fs
	test "$$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:8765/fs/read?session=smoke&path=/etc/passwd")" = "400"
```
(Last line: `/etc/passwd` resolves outside `/ws` → 400, proving the jail.)

- [ ] **Step 3: Run smoke**

Expected: fs list/write/read succeed, traversal blocked (400), `DEMO SMOKE PASS`.

- [ ] **Step 4: Commit**

```bash
git add apps/nav-trial && git commit -m "feat(nav-trial): gateway filesystem API (jailed list/read/write)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Deploy Phase 1 + full cloud verification

**Files:** none new (deploy + verify)

- [ ] **Step 1: Build, deploy, cloud-verify PTY + egress + fs**

```bash
cd /Users/robium-ai/repos/robium-applications/apps/nav-trial && make demo-image && make demo-deploy
S=phase1$RANDOM
( curl -s --http1.1 -N --max-time 500 -o /dev/null -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: $(openssl rand -base64 16)" -H "Sec-WebSocket-Protocol: foxglove.sdk.v1" "https://demo.robium.org/?session=$S" & )
curl -s -X POST "https://demo.robium.org/start?session=$S" >/dev/null
n=0; until curl -s "https://demo.robium.org/status?session=$S" | grep -q '"ready": true'; do n=$((n+1)); [ $n -ge 40 ] && break; sleep 12; done
python3 tests/pty_probe.py demo.robium.org $S   # MUST assert EGRESS BLOCKED on cloud
curl -s "https://demo.robium.org/fs/list?session=$S&path=src" | grep -q nav_trial_bringup && echo FS-OK
curl -s -X POST "https://demo.robium.org/shutdown?session=$S" >/dev/null
```
Expected: `PTY OK + EGRESS BLOCKED` (this is the security gate — egress MUST be closed on the real service), `FS-OK`. If egress is open, STOP — do not proceed to Phase 2; re-check Task 2.

- [ ] **Step 2: Push**

```bash
cd /Users/robium-ai/repos/robium-applications && git push
```

---

## PHASE 2 — React IDE frontend

### Task 6: React island scaffold in Astro

**Files:**
- Modify: `robium.org/package.json` (deps + astro react integration), `astro.config.mjs`
- Create: `robium.org/src/components/demo/Workspace.tsx`, `robium.org/src/lib/demoClient.ts`

**Interfaces:**
- Produces: `<Workspace host="demo.robium.org" />` React island; `demoClient.ts` exports typed calls: `start(session)`, `status(session)`, `shutdown(session)`, `listDir(session,path)`, `readFile(session,path)`, `writeFile(session,path,content)`, and ws URL builders `ptyUrl/logsUrl/foxgloveUrl(session)`.

- [ ] **Step 1: Add React + libs**

```bash
cd /Users/robium-ai/repos/robium.org
npx astro add react --yes
npm i @xterm/xterm@^6 @xterm/addon-fit@^0.11 @monaco-editor/react@^4.7 react-resizable-panels@^4
```

- [ ] **Step 2: Write `src/lib/demoClient.ts`** (typed backend contract)

```ts
const HTTP = (h: string) => `https://${h}`;
export interface Status { claimed: boolean; ready: boolean; rtf: number | null; nodes: number; uptime_s: number; remaining_s: number; fleet: { running: number | null; budget: number }; log: string[]; }
export interface Entry { name: string; dir: boolean; }
const opts: RequestInit = { credentials: 'include' };
export const start = (h: string, s: string) => fetch(`${HTTP(h)}/start?session=${s}`, { ...opts, method: 'POST' });
export const status = (h: string, s: string) => fetch(`${HTTP(h)}/status?session=${s}`, opts).then(r => r.status === 409 ? null : r.json() as Promise<Status>);
export const shutdown = (h: string, s: string) => fetch(`${HTTP(h)}/shutdown?session=${s}`, { ...opts, method: 'POST' });
export const listDir = (h: string, s: string, path: string) => fetch(`${HTTP(h)}/fs/list?session=${s}&path=${encodeURIComponent(path)}`, opts).then(r => r.json() as Promise<{ path: string; entries: Entry[] }>);
export const readFile = (h: string, s: string, path: string) => fetch(`${HTTP(h)}/fs/read?session=${s}&path=${encodeURIComponent(path)}`, opts).then(r => r.json() as Promise<{ path: string; content: string }>);
export const writeFile = (h: string, s: string, path: string, content: string) => fetch(`${HTTP(h)}/fs/write?session=${s}&path=${encodeURIComponent(path)}`, { ...opts, method: 'POST', body: content });
export const ptyUrl = (h: string, s: string) => `wss://${h}/pty?session=${s}`;
export const logsUrl = (h: string, s: string) => `wss://${h}/logs?session=${s}`;
export const foxgloveUrl = (h: string, s: string) => `https://app.foxglove.dev/~/view?ds=foxglove-websocket&ds.url=${encodeURIComponent(`wss://${h}/?session=${s}`)}`;
```

- [ ] **Step 3: Minimal Workspace shell (panes only, no content yet)**

`Workspace.tsx`: three `react-resizable-panels` panels (Controls 18% · Work 57% · Files 25%) with placeholder divs, imported CSS for the Dark/Aurora tokens via a `demo.css`. Just enough to render.

- [ ] **Step 4: Mount on the page**

Replace the body of `src/pages/demos/nav-trial.astro` with the island:
```astro
---
import Base from '../../layouts/Base.astro';
import Workspace from '../../components/demo/Workspace.tsx';
---
<Base title="nav-trial live demo — robium">
  <Workspace client:only="react" host="demo.robium.org" />
</Base>
```

- [ ] **Step 5: Build + verify island mounts**

`npm run build && grep -rq "Workspace" dist/demos/nav-trial/index.html && echo ISLAND-OK`
Expected: build succeeds, island bundle referenced.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: React IDE island scaffold + typed demo backend client

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Controls pane + session lifecycle

**Files:** Create `src/components/demo/Controls.tsx`; Modify `Workspace.tsx`

**Interfaces:**
- Produces: session state (React context or lifted state in Workspace): `session:string|null`, `st:Status|null`, `start()/stop()`, exposed to sibling panes.

- [ ] **Step 1: Lift session state into Workspace**

In `Workspace.tsx`: `useState` for session + status; `start()` sets `session=crypto.randomUUID()`, POSTs `/start`, begins a 2 s `status` poll (re-claim on `claimed:false`); `stop()` POSTs `/shutdown`, clears; `pagehide` → `navigator.sendBeacon` shutdown. Pass `{session, st, start, stop}` down.

- [ ] **Step 2: Controls.tsx** — Start/Stop buttons (disabled states), status pill (`idle/starting/booting/ready·rtf`), uptime + `remaining_s` countdown, fleet line (`running` null → "budget: 5 concurrent"), Foxglove link (enabled on `st.ready`, `href=foxgloveUrl`), layout-file download link.

- [ ] **Step 3: Build + commit**

`npm run build && echo OK`
```bash
git add -A && git commit -m "feat: demo controls pane + session lifecycle

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Work pane tabs — Logs + Console (xterm)

**Files:** Create `src/components/demo/Terminal.tsx`, `src/components/demo/WorkTabs.tsx`; Modify `Workspace.tsx`

**Interfaces:**
- Consumes: `session`, `st.ready`, `logsUrl/ptyUrl`.
- Produces: tab strip (Logs · Console · Editor · Viewer · About); Logs = read-only xterm fed by `/logs` ws; Console = xterm ↔ `/pty` ws (bidirectional, xterm `onData` → ws send).

- [ ] **Step 1: Terminal.tsx** — an xterm instance (FitAddon, Dark/Aurora theme) with props `{ wsUrl, interactive }`; on mount open the ws; `interactive` wires `term.onData(d => ws.send(d))` and writes incoming frames to the term; non-interactive only writes. Clean up ws + term on unmount / session change.

- [ ] **Step 2: WorkTabs.tsx** — tab state; renders Logs `<Terminal wsUrl={logsUrl} interactive={false}/>`, Console `<Terminal wsUrl={ptyUrl} interactive/>` (both only once `session && st?.claimed`), Editor/Viewer/About placeholders for now. Tabs disabled until a session exists (About always enabled).

- [ ] **Step 3: Local E2E against the local demo container**

Run the local demo container, `npm run dev`, open the page, Start, confirm Logs streams and Console runs `ros2 topic list`. (Local only — demo.robium.org host in dev points at prod; for a true local loop temporarily set `host="localhost:8765"` via a dev env check, or test against prod after deploy.)

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: Logs + Console tabs (xterm over /logs and /pty)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Files pane + Editor tab (Monaco)

**Files:** Create `src/components/demo/FileTree.tsx`, `src/components/demo/Editor.tsx`; Modify `WorkTabs.tsx`, `Workspace.tsx`

**Interfaces:**
- Consumes: `listDir/readFile/writeFile`, `session`.
- Produces: right-pane lazy tree; clicking a file sets `openFile:{path,content}` state → activates Editor tab; Cmd/Ctrl-S writes back.

- [ ] **Step 1: FileTree.tsx** — root `listDir(session,'')`; expandable dirs (lazy `listDir` on expand); file click → `readFile` → set `openFile` + switch Work tab to Editor. Rooted at `/ws`.

- [ ] **Step 2: Editor.tsx** — `@monaco-editor/react` `<Editor>`, dark theme, language inferred from extension (yaml/python/xml/markdown), value=`openFile.content`; Cmd/Ctrl-S handler → `writeFile(session, path, value)` → toast "saved (ephemeral)".

- [ ] **Step 3: Wire into WorkTabs + Workspace** (openFile state lifted to Workspace, passed to FileTree + Editor).

- [ ] **Step 4: Build + commit**

```bash
npm run build && echo OK
git add -A && git commit -m "feat: file tree + Monaco editor (ephemeral real saves)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: About tab, polish, deploy, full E2E

**Files:** Create `src/components/demo/About.tsx`; Modify `tests/smoke.sh`, `Workspace.tsx`

- [ ] **Step 1: About.tsx** — the repro story (the brief that produced nav-trial) + "Get the plugin →" CTA, moved from v3's page sections into this tab (always enabled, shown by default before a session starts).

- [ ] **Step 2: Viewer tab placeholder** — a centered "Open the robot in Foxglove ↗" button (same as Controls' link) + one line: "embedded viewer coming soon." Reserves the slot per spec.

- [ ] **Step 3: Site smoke for the island** — in `tests/smoke.sh`, replace the v3 demo checks with island-presence checks (the page is now client-rendered, so assert the island script bundle + mount, and that the built HTML references the demo client):
```bash
if [[ -z "$URL" ]]; then
  D=$(cat dist/demos/nav-trial/index.html)
  grep -q "Workspace" <<<"$D" && echo "ok: workspace island" || { echo "FAIL: workspace island"; fail=1; }
  grep -rq "demo.robium.org" dist/demos/nav-trial/ dist/_astro/ 2>/dev/null && echo "ok: demo host wired" || { echo "FAIL: demo host"; fail=1; }
  grep -q "/demos/nav-trial" dist/index.html && echo "ok: homepage demo link" || { echo "FAIL: homepage demo link"; fail=1; }
fi
```

- [ ] **Step 4: Build, smoke, deploy**

```bash
cd /Users/robium-ai/repos/robium.org && make smoke && make image && make deploy && bash tests/smoke.sh https://robium.org | tail -1
```

- [ ] **Step 5: Manual prod E2E** (report results): open robium.org/demos/nav-trial → Start → Logs stream + booting → ready → Console `ros2 topic list` works → Files tree → open nav2.yaml in Editor → edit + Cmd-S → re-open shows change → Console `curl https://example.com` FAILS (egress) → Foxglove opens → Stop kills instance. Note any friction.

- [ ] **Step 6: Commit + push + registry/skill note**

```bash
git add -A && git commit -m "feat: demo v4 IDE workspace — About/Viewer tabs, polish, island smoke

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push
```
Append learnings (PTY-over-ws hand-framing, VPC egress lockdown, zero-perm SA vs live-fleet tradeoff) to `robium-applications/learnings/2026-07-13.md` for a later live-demo skill update.
