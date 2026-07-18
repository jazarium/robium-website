# robium.org landing v2 — design

**Date:** 2026-07-13 · **Status:** approved

## Decision record

The landing page pitched the **delivery channel**, not the product. The badge
said "Claude Code plugin", the H1 made the agent the protagonist ("*Your AI
agent*, robotics-ready"), and the differentiator — proof — was the last clause
of a five-line paragraph.

v2 repositions. **The noun is expertise.** robium is the Physical AI expertise
layer that AI agents lack; the Claude Code plugin is one door into it, and the
roadmap (robium's own backlog: AGENTS.md fallback, Cursor/Gemini manifests, a
robium CLI) makes that explicit. The page is rebuilt around that claim.

Seeded from the "UI improvements (notes)" list in `robium/docs/BACKLOG.md`
(brainstormed 2026-07-12). Five of the seven items survive; see **Cut** below.

## Content rules (both are hard, and they differ)

1. **No hardcoded numbers.** No skill counts, no star counts. The catalog is
   still growing and any number goes stale — the site already proves this:
   `GetStarted.astro` says "20 robotics skills loaded" and the catalog is at 21.
2. **Aspirational positioning is allowed; fabricated evidence is not.** Copy may
   pitch the finished vision of robium. But anything a visitor can *run* or
   *check* — a command in a copy-box, a transcript line, a metric — must be real.
   This is the line that governs the Cursor/Gemini tabs below.

## Page order

Was:

    Hero → HowItWorks → SkillsGrid → Apps → Marquee → GetStarted → Footer

Now:

    Hero → SkillsGrid → HowItWorks → Apps → Marquee → Footer

Two changes. `GetStarted` is **deleted** (its install content moves into the
hero). `SkillsGrid` and `HowItWorks` **swap**: the subtitle claims four domains,
so the very next thing the visitor scrolls into is a grid organised by those
exact four domains. Promise and evidence become adjacent.

## 1. Hero (`Hero.astro`)

**Badge:** removed. Nothing above the H1 competes with it.

**H1:**

> The Physical AI expertise AI agents need.

**Subtitle:**

> robium gives AI agents the expertise to architect, build, and validate
> Physical AI applications across simulation, data, visualization, and robotics
> integration. Grounded in battle-tested reference applications and continuously
> evolving skills.

**CTAs:** `[Drive a live robot →]` → `/demos/nav-trial/` (primary — the live sim
is the moat) and `[Reference apps]` → `#apps`. The existing GitHub CTA is
**removed**: `github.com/robium-ai/robium-docs` is private and 404s for every visitor.

**Right panel — agent install tabs (replaces the terminal transcript).**

Three tabs: **Claude Code · Cursor · Gemini**. Each shows how to add robium to
that agent, followed by the same example ask:

    > build a mobile robot that navigates in sim

The three tabs *are* the argument for the H1 — they demonstrate the
agent-agnostic claim rather than asserting it.

- **Zero-JS constraint holds.** Tabs are CSS-only: hidden radio inputs plus
  `:checked ~` sibling selectors. No React island, no client-side JS on the
  landing page.
- **Claude Code** shows the real commands (`/plugin marketplace add
  robium-ai/robium-docs`, `/plugin install robium@robium`).
- **Cursor and Gemini** show the intended shape with a small state marker on the
  tab. Their manifests **do not exist** — robium ships `skills/` and `agents/`
  and nothing else; AGENTS.md and the Cursor/Gemini manifests sit under "Later"
  in robium's backlog. Per content rule 2, we do not ship a copy-box command
  that fails when run. When robium adds the manifests, the markers come off and
  nothing else changes.

**Consequence:** the hero no longer shows proof. That is accepted — proof moves
to How-it-works step 04 (below) and to the live-demo CTA.

## 2. Skill catalog (`SkillsGrid.astro`)

**Curated showcase, not an exhaustive catalog.** This is a UI surface; listing
all 21 skills clutters it. We show a handful per group.

Five groups, in order:

| Group | Skills (indicative) |
|---|---|
| Architecture & proof | `architect`, `testing` |
| Simulation | `simulation`, `gazebo`, `isaac-sim`, `isaac-lab` |
| Data | `data`, `lerobot`, `huggingface` |
| Visualization | `visualization`, `foxglove`, `rerun`, `rviz2` |
| Robotics integration | `ros2`, `nav2`, `integration`, `environments` |

"Architecture & proof" leads because `architect` and `testing` are the spine —
they are steps 03 and 05 of how-it-works, not one domain among four. The four
that follow are the subtitle's own pillars, verbatim.

**Excluded:** `skill-author`, `skill-refiner`, `skill-updater`, `live-demo` —
robium's tooling for authoring and evolving itself, not Physical AI
capabilities. A visitor building a robot app does not use them.

**Where the grouping lives.** A new `src/data/pillars.json` maps group → skill
names. Card **copy is not hand-written**: `name` and `description` still come
from the build-generated `src/data/skills.json`, so descriptions stay real and
auto-generated.

> **Deliberate, narrow departure from CLAUDE.md.** The rule "the site never
> hand-maintains the skill list" is relaxed: the *list* becomes curated, the
> *copy* does not. A skill absent from `pillars.json` simply does not render.
> This is a UI judgment (uncluttered > exhaustive), accepted knowingly.

**Card changes:**

- Drop the 3-line description clamp (`SkillsGrid.astro:35`,
  `-webkit-line-clamp: 3`) — show full descriptions.
- Brand logos on tool skills; neutral glyph otherwise. `public/logos/` already
  has `ros`, `nvidia`, `huggingface`, `docker`, `uv`; `Marquee.astro` already
  inlines SVGs with an `existsSync` fallback — reuse that pattern. Missing
  logos fall back to the glyph.
- Each card deep-links to its `skills/<name>` directory on GitHub. These 404
  until the repo is public; that is accepted (repo goes public soon).
- **No star count.** It is a number — content rule 1.

## 3. How it works (`HowItWorks.astro`)

Four steps become five, retargeted from "robot app" to Physical AI:

    01  Add robium to your agent          (new)
    02  Describe the application
    03  The architect routes the stack
    04  Build and watch it run
    05  Verified, twice                   (new)

Step 05 is the proof beat: smoke-tested with sample data, **and** cross-checked
against the closest reference app in the registry.

Step 04 keeps its existing terminal art — `$ make smoke` → `PASS: all goals
reached` → `exit 0`. This is real: `PASS: all goals reached` is the literal
string printed at `send_goals.py:63` in `robium-applications/apps/nav-trial`.
With the hero transcript gone, **this is now where show-don't-tell happens.**

## 4. Reference apps (`Apps.astro`)

Keep the existing lead (regression suite + registry bootstrap — already
accurate). Add:

- The **minimal-intervention** framing: the apps are built *by* the plugin.
- A CTA: *use one as your starter, or build something entirely new.*

## 5. Propagation

The hero claims a category. If the next scroll says "robotics", the claim reads
as a coat of paint. So **"robotics" → "Physical AI"** across the nav, section
copy, and the page `<title>` / meta description, wherever it refers to the
category (not where it names the domain, e.g. "robotics integration").

The stale "20 robotics skills loaded" line dies with `GetStarted`.

## 6. Tests (`tests/smoke.sh`)

The smoke test pins literal strings from the page. Three assertions are now
false and must be updated **in the same commit**:

| Assertion | Why it breaks | Becomes |
|---|---|---|
| hero headline | H1 rewritten | new H1 literal |
| hero real transcript | hero transcript replaced by install tabs | assert on the install command in its new home (hero) |
| `21 skill tiles` | grid is curated, and counts are banned | assert tiles > 0 and that each group renders — no specific number |

The "install command" assertion still passes (the command moved into the hero,
but remains in `dist/index.html`); repoint it rather than delete it.

## Cut (from the original 7-item notes)

- **"No robot? No problem."** and **"No data? We've got you."** (items 6, 7) —
  answers to objections the new hero does not raise. Dropped.
- **Live star count** (part of item 4) — a number.
- **The plugin-install beat in the hero terminal** (part of item 2) — it
  re-centred the plugin and required a skill count. Install lives in the hero
  tabs instead.

## Out of scope (later)

Making the Cursor/Gemini tabs live (needs AGENTS.md + manifests in the `robium`
repo — anchor there, not here). Turning the GitHub deep-links and card links
green (needs the repo public). Logos for the six brands that lack an SVG (Nav2,
Gazebo, LeRobot, Foxglove, Rerun, RViz2).
