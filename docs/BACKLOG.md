# robium.org backlog

Deferred-but-tracked items. Newest on top.

## Demo v4 (IDE workspace)

- **[security] Verify the demo egress lockdown end-to-end.** The protections
  ARE deployed (demo-nav-trial runs as zero-IAM-role SA `demo-nav-trial-sa`,
  and `--network=demo-net --vpc-egress=all-traffic` with a deny-all egress
  firewall). What's NOT yet proven is that a shell inside the container
  genuinely cannot reach the internet. Gate: `tests/pty_probe.py
  demo.robium.org <session> --expect-egress-blocked` must print
  `PTY OK + EGRESS BLOCKED`. Blocked on the gz-discovery boot race making a
  clean ready-state slow to reach for the probe. **Do before publicizing the
  demo widely** — a public interactive shell WITH internet egress is abusable
  (crypto-mining, DDoS relay). Until verified, treat the shell as
  "protections deployed, unproven."
- **[reliability] gz-transport discovery boot race on Cloud Run** — ~50% of
  boots lose the unicast-relay race; the watchdog restarts the instance, but
  it adds visible boot latency (up to a few minutes with retries). Warm-pool
  or a deterministic-discovery fix would make demos snappy. See
  learnings/2026-07-12.md.
- **[feature] Live fleet count** — disabled in v4 (zero-perm SA can't query
  Monitoring). Restore via a small separately-permissioned endpoint; the
  frontend contract (`fleet.running`) already tolerates the live number.
- **[feature] Embedded viewer in the Viewer tab** — slot reserved; self-hosted
  Lichtblick (built, at /viewer/) can fill it later for a no-new-tab flow.
