# Brand logos for the skill catalog — design

Date: 2026-07-20
Status: approved (user, in-session)

## Problem

`public/logos/` has 5 SVGs; `src/data/integrations.json` references 11 files
(6 missing: nav2, gazebo, lerobot, foxglove, rerun, rviz2); no component
actually renders a logo image today (PluginAnatomy uses only the names). The
user wants a well-kept brand-asset folder and logo + name shown wherever
skills are displayed (skills table now, any future bento for free).

## Design (approved)

1. **Keep `public/logos/`** as the folder (established, specific). Add
   `public/logos/README.md` with per-file provenance: source URL, license
   note, fetch date — same provenance discipline as the rest of robium.
2. **Complete the set** from official sources: gazebo, nav2, lerobot,
   foxglove, rerun (+ mujoco while at it, for where the catalog is heading).
   RViz2 has no official mark — its integrations.json entry points at the
   ROS logo, noted in the README. SVG preferred; PNG fallback acceptable and
   recorded. Unitree: skipped unless a clean, clearly-licensed mark is found.
3. **`integrations.json` stays the brand registry** ({ name, file }); new
   `src/data/skill-brands.json` maps skill name → integration name (tool
   skills only; umbrellas have no brand mark).
4. **Render logo + name** in SkillsTable's name cell (small img before the
   skill name, `loading="lazy"`, alt = brand name). Data + mapping make any
   future bento layout a pure rendering change.

## Acceptance

- All files referenced by integrations.json exist in public/logos/.
- README.md provenance covers every file.
- Skills table shows logo + skill name for every tool skill; umbrellas
  unchanged.
- `make smoke` passes (the done bar).
