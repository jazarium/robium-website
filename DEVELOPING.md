# Developing the demo — the fast loop

**Don't redeploy to iterate.** Cloud Build + deploy is ~8 min; use it only to
ship or to test cloud-only behavior (egress, session affinity, cold start).
Day-to-day, use one of these:

## Frontend only (most changes) — instant HMR, no backend rebuild

Edit anything under `src/components/demo/` or `src/lib/demoClient.ts` and see
it live in milliseconds:

```bash
cd ~/repos/robium.org
npm run dev
# open: http://localhost:4321/demos/nav-trial?host=demo.robium.org
```

The `?host=` query param points the whole workspace at a backend of your
choice. `demo.robium.org` uses the already-deployed prod gateway — zero
backend work. (The prod gateway's CORS allows `http://localhost:*`, so
credentialed fetches from the dev server work.)

## Full local (backend + frontend) — no cloud at all

Run the demo container locally and point the dev frontend at it:

```bash
# terminal 1 — local demo backend (bind-mounts scripts/, so gateway edits
# are a restart, not an image rebuild):
cd ~/repos/robium-applications/apps/nav-trial
make demo                     # first run builds the image once (~7 min)

# terminal 2 — frontend:
cd ~/repos/robium.org
npm run dev
# open: http://localhost:4321/demos/nav-trial?host=localhost:8765
```

Edit `apps/nav-trial/scripts/demo_gateway.py`, then in another terminal:

```bash
cd ~/repos/robium-applications/apps/nav-trial
docker compose -f docker/compose.yaml restart demo   # seconds
```

The gateway change is live — no image rebuild (the ROS image only needs
rebuilding when apt deps or the ROS package build change).

Note: locally the demo boots reliably (gz discovery race is a Cloud-Run
multicast quirk, not a local one), so `localhost:8765` is the quickest way
to iterate on backend + frontend together.

## When you DO need to deploy

- Backend/gateway change to ship: `make demo-image && make demo-deploy`
  (from `apps/nav-trial`).
- Frontend change to ship: `make image && make deploy` (from `robium.org`).
- Test cloud-only behavior (egress lockdown, affinity, cold start): deploy,
  then use `?host=demo.robium.org` against the real service.
