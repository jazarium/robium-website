# nav-trial live demo — design

**Date:** 2026-07-12 · **Status:** approved (brainstorming session)
**Surfaces:** robium.org (`/demos/nav-trial` page) + robium-applications (`apps/nav-trial` demo scenario) + GCP robium-prod (Cloud Run service)

## Purpose

Turn the homepage's proof section into *try-it-live*: a visitor opens
robium.org/demos/nav-trial, reads what the demo is and how it was produced
(the actual agent prompt — the motivation is "one sentence + robium built
this repo"), clicks through to a **private, live nav-trial simulation** and
drives the robot by clicking navigation goals in Foxglove. Zero cost when
nobody is using it.

## Decisions (from brainstorming)

1. **Instancing: per-visitor via Cloud Run.** Service `demo-nav-trial` in
   robium-prod with `concurrency=1` — each visitor's WebSocket connection
   gets a private sim instance; the connection is the session. `min-instances=0`
   (hard requirement: nothing runs when idle), `max-instances=5` (cost cap),
   `timeout=1800s` (30-minute sessions), 4 CPU / 4 GiB, startup CPU boost,
   request-based billing. Rejected: always-on shared sim (violates idle-cost
   rule; visitors would fight over one robot), warm pool/broker (v2).
2. **Viewer: app.foxglove.dev with the visitor's own login.** Deep link
   `https://app.foxglove.dev/~/view?ds=foxglove-websocket&ds.url=wss://<service-url>`
   auto-connects after login; the page provides the layout file + a one-time
   import instruction. Accepted friction: login wall, manual layout import.
   Rejected for v1: self-hosted Lichtblick embed (user deferred; the viewer
   is a swappable front door, so this upgrades cleanly later), shared demo
   account (ToS violation + shared account state; auto-sign-in impossible).

## Architecture

```
robium.org/demos/nav-trial (static page, Astro)
   ├── "Download layout" → /demos/nav-trial-layout.json (static copy)
   └── "Open in Foxglove" → app.foxglove.dev deep link
                               │  (visitor logs in; Foxglove connects)
                               ▼
        wss://demo-nav-trial-<hash>.us-central1.run.app  (port 8765)
                               │  concurrency=1 → private instance
                               ▼
        Cloud Run instance: nav-trial demo container
        foxglove_bridge (listens :8765 in ~2s, satisfies startup probe)
        + gz sim headless (turtlebot3_world) + Nav2 on saved map
        + demo_init (auto /initialpose once Nav2 is active)
```

The WebSocket connection lifecycle IS the session lifecycle: connect →
instance cold-boots (~30–60 s, masked by Foxglove's connecting state +
topics appearing progressively) → drive via /goal_pose → close tab →
request ends → instance scales to zero. No orchestration service.

## nav-trial changes (robium-applications)

- New `demo` scenario alongside sim/slam/nav/test: one launch that starts
  foxglove_bridge FIRST, then gz sim (headless) + robot spawn + Nav2 servers
  on the saved map + AMCL, then `demo_init` — a small script/node that waits
  for Nav2 activation and publishes `/initialpose` (map frame, the known
  spawn pose), avoiding the documented uninitialized-bringup abort.
- Container port for the demo image is 8765 (the bridge). `$PORT` from
  Cloud Run is honored by launching the bridge on it (default 8765).
- amd64 image: built by Cloud Build (`apps/nav-trial/cloudbuild.yaml`),
  pushed to `us-central1-docker.pkg.dev/robium-prod/robium/demo-nav-trial`.
- `make demo` (local run), `make demo-smoke` (local container + WebSocket
  probe asserting the foxglove-websocket handshake + serverInfo), `make
  demo-image` / `make demo-deploy` (Cloud Build + Cloud Run, dervish
  pattern).
- Registry card + README updated with the demo surface. Two-hats rule
  applies: learnings captured during this build as usual.

## robium.org changes

- New page `/demos/nav-trial`: intro (what you're seeing), reproduction
  story (the real kickoff prompt + link to the repo + "how to reproduce"
  steps with the plugin), expectations (private robot, ~30–60 s boot,
  30-min session, max 5 concurrent — "try again later" if full), the
  3-step launch flow (download layout → open in Foxglove → import layout,
  click Nav goal). Dark/Aurora theme throughout.
- Homepage Apps section: nav-trial card gains a primary "Try live demo →"
  link to the page; section copy shifts to invite trying.
- `public/demos/nav-trial-layout.json` — copy of the committed layout.
- Site smoke extended: demo page present, layout JSON served, deep-link
  href contains the service URL.

## Error handling / limits (stated on the page, honestly)

- Cold start ~30–60 s: expected; Foxglove shows "connecting", panels fill
  progressively as the stack boots.
- Session cap 30 min: Foxglove shows disconnect; page says sessions are
  capped, reconnect starts a fresh robot.
- All 5 instances busy: Cloud Run queues briefly then errors the
  connection; page copy sets the "busy — try again in a few minutes"
  expectation.
- Abuse surface: the bridge allows arbitrary topic publishing — contained
  by design (private, sandboxed, no secrets, dies with the session).

## Open risks

1. **Sim performance on Cloud Run CPUs is unverified** (software-rendered
   gpu_lidar; nav-trial measured RTF≈1.0 on a 12-vCPU dev machine). Plan:
   measure RTF on the deployed service; 4 CPU → 8 CPU escalation; if still
   inadequate, revisit (e.g. GCE spot VM fallback) rather than ship a bad
   demo.
2. **Foxglove deep-link parameter format** (`ds`, `ds.url`) verified
   against current docs at implementation time, not assumed.
3. **Cloud Run WebSocket idle timeout**: long-lived ws with sparse traffic
   should survive (bridge sends periodic data); verify a 10+ minute idle
   session stays connected.
4. **Startup-probe ordering**: bridge must listen before Cloud Run's
   startup window closes even if gz/Nav2 are slow; bridge-first launch
   makes this near-certain but the cloud cold-boot is measured in smoke.

## Out of scope (v2 candidates)

Self-hosted Lichtblick embed (no-login flow), manip-trial demo, warm-pool
instant connect, custom minimal viewer, per-demo subdomain mapping
(wss uses the run.app URL inside the deep link — invisible to visitors).
