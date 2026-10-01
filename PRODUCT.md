# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Plain HTML, CSS, and JavaScript. No build step, no package manager, no external runtime dependencies. Must open directly from `index.html` (file://) and work offline; also deployed as a static site to GitHub Pages. Tests run with `node --test tests/*.test.cjs`.

## Users

Primary: our own team, writing a large Ren'Py visual novel (50+ labels across many `.rpy` files, dozens of stats, relationship values, and flags). Branchlight is built for our game first. The public, game-agnostic release on GitHub Pages is secondary and must keep working, but it does not drive priorities.

Situation: a writer or developer sitting with the game's script, trying to understand how the story fits together, where a branch goes, and why a scene is or isn't reachable for a given state.

## Jobs

- See the whole story's structure at a glance (chapters, labels, routes, and how they connect), then drill into a single scene.
- Track every stat, relationship value, and flag: where it is defined, changed, and checked, and which branches it gates.
- Understand unique branch requirements: what state a choice or scene needs.
- Spot problems: missing labels, dead ends, unreachable scenes, unsupported or runtime-only code.
- Follow one route with chosen variable values (route simulation) and undo to try another.
- Inspect exported project bundles: campaigns, checkpoints, and why each event is available or blocked.

## Capabilities (existing, must be preserved)

- Static parse of `.rpy` files: labels, menus, choices, conditions, loops, jumps, calls/returns, dynamic destinations, file boundaries.
- Script flowchart with pan/zoom, keyboard navigation, "explore from" label focus, optional dialogue and actions.
- Node source inspector with line-highlighted code and outgoing connections.
- Route simulator: editable variables from `default`/`define`, conditional choices, call stack, step/run/undo, manual overrides recorded in history.
- Analysis notes for unresolved references and unsupported constructs.
- Project bundle viewer (data-only JSON v1): campaigns, checkpoints (recorded vs. scenario), event status map, availability reasons, prerequisites.
- Light, dark, and system appearance, persisted per browser.
- Optional `document.modelContext` agent tools (`read_branch_map`, `focus_story_label`).

## Constraints

- Scripts stay in the browser. Nothing is uploaded; no game code or Python is executed.
- The map is static analysis, not the Ren'Py engine; the UI must keep that honest (possible vs. simulated paths, recorded vs. hypothetical checkpoints).
- Limits: 12 MB per selection, 3,000 flow nodes; bundles up to 500 events.
- Accessibility: keyboard-operable graph and controls, visible focus, labelled regions.

## Terminology

Label, choice point (menu), player choice, condition, call / after return, unresolved destination, file boundary, analysis notes, route simulation, manual override, project bundle, campaign, checkpoint (recorded / scenario), event, availability reason.

## Open decisions

- How stats/relationships are distinguished from plain flags is not defined by the scripts; any classification must be inferred from usage (numeric vs. boolean, naming) or left to the user.
