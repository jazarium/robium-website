# nav-trial demo v2 — embedded viewer + session terminal — design

**Date:** 2026-07-13 · **Status:** approved (brainstorming session)
**Surfaces:** robium.org (page rework + self-hosted Lichtblick) + robium-applications/apps/nav-trial (in-container gateway + status node) + Cloud Run (`demo-nav-trial` reconfig)

## Purpose

Upgrade /demos/nav-trial from "instructions + open Foxglove in a new tab" to
a **single-page experience**: the viewer embedded in the page (no login, no
tab, no layout import), a terminal-style live status panel underneath (stack
state, scrolling log, session countdown), and real session controls —
including a button that stops the visitor's Cloud Run instance.

## Decisions (from brainstorming, with verified facts)

1. **Viewer: self-hosted Lichtblick, embedded in an iframe.** Verified live:
   `app.foxglove.dev` sends `x-frame-options: DENY` (cannot be embedded,
   browser-enforced). Foxglove's official embed product
   (`embed.foxglove.dev` + TS SDK) exists but is paid-tier gated (Pro/
   Enterprise badges) AND requires viewers to sign into the embedding org —
   built for internal portals, unusable for anonymous public visitors.
   Lichtblick (MPL-2.0 Foxglove fork) is free, account-less, and we control
   embedding. This supersedes v1's "own login on app.foxglove.dev" decision;
   the login and layout-import steps disappear.
2. **Status + control: in-container gateway (Approach B).** Rejected:
   status-inside-the-viewer only (Approach A — no bottom terminal, no stop
   button, doesn't meet the ask); external broker with Cloud Run Admin API
   (Approach C — new always-on service + admin-credential surface, v3).
3. **Cloud Run reconfig:** `concurrency=1 → 4` + `--session-affinity`, so
   the page's status/shutdown requests land on the same instance as the
   viewer's WebSocket. The gateway guards **one viewer per instance**.

## Architecture

```
robium.org/demos/nav-trial (one page)
├── <iframe src="/viewer/?ds=foxglove-websocket&ds.url=wss://demo…run.app/?session=UUID">
│      Lichtblick web build, served by robium-site nginx under /viewer/
│      (same origin as page → we can seed its layout via localStorage)
└── bottom terminal panel (page JS):
       polls  GET  wss-host/status?session=UUID   (2s)
       button POST wss-host/shutdown?session=UUID (+ pagehide sendBeacon)

demo-nav-trial container (Cloud Run, port 8765):
  nginx gateway :8765
    ├── WebSocket upgrades  → foxglove_bridge (internal :8766)
    │     first ws claims the instance for its session UUID;
    │     second concurrent ws → 503 (that visitor gets a fresh instance)
    ├── GET /status   → session server :8767 (UUID-checked)
    └── POST /shutdown → session server :8767 (UUID-checked → SIGTERM launch
                          → container exits → instance gone)
  demo_status ROS node: /rosout ring buffer (last ~50 lines), node count,
    DEMO READY + rtf, start time → /tmp/demo_status.json every 2 s
  session server (python stdlib): serves the JSON + session claim/validate
    + shutdown; adds uptime + 30-min deadline countdown
```

**Session identity:** the page generates a UUID; it rides on both the
viewer's `ds.url` (query param) and every status/shutdown call. The gateway
binds the instance to the first UUID that opens a WebSocket; mismatched
status calls get 409 (page retries — see risks), mismatched shutdowns 403.

## Page UX (top → bottom)

Header strip: title + status pill (`starting → booting → ready rtf=0.9x →
ended`) + End session button + Restart (new UUID, new iframe) + link to the
how-it-was-built story (moves below the fold; content unchanged from v1).
Viewer iframe (~65vh). Terminal panel (~28vh, Dark/Aurora terminal styling):
sticky status line (uptime · nodes active · RTF · time remaining) above a
scrolling stack log (from /rosout tail). Boot phases rendered honestly in
the terminal while /status is unreachable ("allocating instance / pulling
image — first boot can take ~60–90 s").

End of session (button, 30-min cap, or tab close → sendBeacon): terminal
prints "session ended — instance stopped"; Restart offers a fresh robot.

## Lichtblick specifics

- Built from a **pinned release tag** of `lichtblick-suite/lichtblick` in a
  Docker build stage of the robium-site image; static output served by the
  existing nginx under `/viewer/` (same-origin). Fallback if its build
  can't live under a subpath: a separate tiny Cloud Run static service.
- Connection via its inherited deep-link params
  (`?ds=foxglove-websocket&ds.url=…`). Layout: preloaded without user
  action — mechanism verified at implementation in this order: (a) a
  build-time default-layout hook if Lichtblick provides one, (b) same-origin
  localStorage seeding from the parent page before iframe load, (c) patched
  build constant. The committed `nav-trial-layout.json` is the content.

## nav-trial container changes

- foxglove_bridge port 8765 → 8766 (internal). nginx (apt package) on 8765
  as the gateway with ws proxying (`Upgrade`/`Connection` headers, long
  `proxy_read_timeout`). Session server (python stdlib, no deps) on 8767.
  demo_status node added to demo.launch.py.
- `demo-deploy` gains `--concurrency=4 --session-affinity`.
- Existing `demo-smoke` extended: ws handshake now through the gateway;
  /status returns JSON with `ready:true` + rtf; /shutdown with wrong UUID →
  403, with right UUID → container exits.

## Error handling (stated honestly in the terminal)

- Cold start: status fetch fails → "allocating…" phase, retry loop.
- Instance busy (5 concurrent sessions): ws 503 from all instances → page
  shows "all demo robots busy — try again in a few minutes."
- Affinity miss (status lands on a stranger's instance): 409 → silent
  retry; if persistent, terminal shows "status unavailable (session still
  running)" — the viewer is unaffected.
- Session cap: 30-min Cloud Run timeout closes the ws; terminal explains +
  Restart button.

## Open risks

1. **Lichtblick build/subpath/layout unknowns** — build tooling, subpath
   serving, and the default-layout mechanism are verified at implementation
   (three-step fallback above). Highest-uncertainty item; task-ordered
   first.
2. **Session affinity is best-effort and cookie-based** — cross-site cookie
   partitioning could break status routing in some browsers. Degradation is
   contained (terminal degrades, viewer unaffected); measured during E2E.
3. **Gateway adds boot complexity** — nginx + session server must start
   before Cloud Run's startup probe window closes; nginx starts in ms, so
   the probe surface actually improves (no longer waiting on the bridge).
4. **concurrency=4 sharing** — a stranger's transient GETs may execute on
   your instance (CPU noise, no data exposure — UUID-gated). Accepted.

## Out of scope (v3 candidates)

Warm-pool instant connect, broker/Admin-API orchestration, manip-trial
demo, mobile layout for the viewer, recording/replay of visitor sessions.
