---
name: Branchlight
description: A pressed-specimen reading of a Ren'Py story, mounted flat on one sheet, labelled and filed.
colors:
  cabinet-ground: "#e6e9e2"
  cabinet-ground-recess: "#dde2d8"
  rag-sheet: "#fbfcf9"
  rag-sheet-shade: "#f1f3ee"
  rag-sheet-deep: "#e8ece5"
  herbarium-ink: "#17251e"
  herbarium-ink-soft: "#46554c"
  herbarium-ink-faint: "#576559"
  hairline: "#d3d9cf"
  hairline-strong: "#b3bdb0"
  specimen-green: "#1f3a2f"
  specimen-ink: "#eef4ee"
  specimen-ink-soft: "#a9c4b2"
  action-green: "#2b7549"
  action-green-deep: "#22623c"
  action-ink: "#ffffff"
  action-wash: "#e1efe4"
  stamp-red: "#a33f27"
  stamp-wash: "#f8e8e1"
  gate-amber: "#8a6210"
  gate-amber-line: "#b8892a"
  gate-amber-wash: "#f7eed8"
  call-violet: "#5b4d8a"
  call-violet-wash: "#ece9f5"
  folder-sage: "#6a8d58"
  folder-manila: "#ad8a37"
  folder-blue: "#4c7596"
  folder-red-brown: "#a1573b"
  folder-violet: "#78649b"
  folder-teal: "#3c827d"
typography:
  headline:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 600
    lineHeight: 1.5
  data:
    fontFamily: "Courier Prime, ui-monospace, Menlo, Consolas, monospace"
    fontSize: "12.5px"
    fontWeight: 500
    lineHeight: 1.4
    fontFeature: "tnum"
  stamp:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "10.5px"
    fontWeight: 650
    lineHeight: "17px"
    letterSpacing: "0.06em"
rounded:
  label: "2px"
  slip: "3px"
  sheet: "4px"
  button: "5px"
  float: "6px"
  menu: "7px"
  tray: "10px"
spacing:
  hair: "6px"
  xs: "8px"
  sm: "10px"
  md: "12px"
  lg: "14px"
  gutter: "18px"
  sheet-x: "22px"
components:
  button:
    backgroundColor: "{colors.rag-sheet}"
    textColor: "{colors.herbarium-ink}"
    rounded: "{rounded.button}"
    padding: "0 12px"
    height: "34px"
  button-hover:
    backgroundColor: "{colors.rag-sheet-shade}"
  button-action:
    backgroundColor: "{colors.action-green}"
    textColor: "{colors.action-ink}"
    rounded: "{rounded.button}"
    padding: "0 12px"
    height: "34px"
  button-action-hover:
    backgroundColor: "{colors.action-green-deep}"
  input-search:
    backgroundColor: "{colors.rag-sheet}"
    textColor: "{colors.herbarium-ink}"
    rounded: "{rounded.sheet}"
    padding: "0 9px"
    height: "32px"
  tag:
    textColor: "{colors.herbarium-ink-soft}"
    rounded: "{rounded.slip}"
    padding: "1px 6px"
  count-alert:
    backgroundColor: "{colors.stamp-wash}"
    textColor: "{colors.stamp-red}"
    rounded: "{rounded.slip}"
    padding: "0 5px"
  sheet:
    backgroundColor: "{colors.rag-sheet}"
    rounded: "{rounded.sheet}"
  specimen-label:
    backgroundColor: "{colors.rag-sheet}"
    textColor: "{colors.herbarium-ink}"
    rounded: "{rounded.label}"
    padding: "11px 13px 12px"
  determination-slip:
    backgroundColor: "{colors.rag-sheet}"
    textColor: "{colors.herbarium-ink}"
    rounded: "{rounded.slip}"
    padding: "10px 12px 11px"
  folder:
    backgroundColor: "{colors.rag-sheet}"
    textColor: "{colors.herbarium-ink}"
    padding: "10px 11px 11px"
  choice-button:
    backgroundColor: "{colors.rag-sheet}"
    textColor: "{colors.herbarium-ink}"
    rounded: "{rounded.sheet}"
    padding: "10px 12px"
  choice-button-hover:
    backgroundColor: "{colors.action-wash}"
---

# Design System: Branchlight

## Overview

**Creative North Star: "The Herbarium Sheet"**

The story is a pressed specimen: the whole branching plant mounted flat on one sheet, labelled and filed so a large collection reads at a glance. Every view sits on bright rag paper laid over a grey-green cabinet ground. Each script file is a genus folder with its own muted colour, carried as a folder tab on every node, row, and reference that belongs to it. Metadata is typed onto hairline-framed specimen labels in monospace; problems arrive as determination slips with a stamped category.

The surface is dense and quiet. Colour is almost entirely structural (folder hues, a deep specimen green for choice points) until something needs attention: stamp red for what is broken, amber for conditions and gates, violet for calls, and one saturated action green that means "do this" or "this is the route you followed". Depth is paper on paper, never glass or glow.

Dark mode is the cabinet at night: a deep green-black ground, sheets one step lighter, the same folder hues lifted for legibility. Motion has one signature, the camera glide that eases the map to an exact node when you drill in, and otherwise stays to short state transitions.

**Key Characteristics:**
- Rag-white sheets on a grey-green ground; ink is near-black green, never pure black.
- Six genus folder colours, one per file, shown as folder tabs.
- Monospace for every piece of script data: label names, file:line references, variable names, values, counts.
- One saturated green reserved for actions and the live simulated route.
- Hairline borders and paper-thin two-layer shadows; no gradients, no blur.
- An eased camera glide is the signature interaction.

## Colors

A cool, muted botanical palette: paper and ink carry the page, folder hues carry identity, and four semantic colours each mean exactly one thing.

### Primary
- **Action Green** (light `action-green`, deep `action-green-deep` on hover): primary buttons (Simulate route), choice buttons in the simulator, the traversed route edge (3px), visited and current node strokes, available checkpoints, focus rings, and changed cells in the state table (on its **Action Wash**). Dark mode lifts it to #63b783 with dark ink (#0a1a10).

### Secondary
- **Specimen Green** (`specimen-green`): the mounted-specimen fill for choice-point (menu) nodes and the brand mark, with **Specimen Ink** text and **Specimen Ink Soft** metadata on top. It is identity, not action.
- **Stamp Red** (`stamp-red` on `stamp-wash`): problems only. Error stamps on slips, problem counts, missing or dynamic destinations (dashed stamp-red node outline on a stamp wash), import errors, missing initial values.

### Tertiary
- **Gate Amber** (`gate-amber` text, `gate-amber-line` strokes, `gate-amber-wash` fills): conditions, gates, warnings, blocked checkpoints, scenario checkpoints, manual overrides (dashed), unsupported code, and the "checked" ticks on barcode strips.
- **Call Violet** (`call-violet`, `call-violet-wash`): calls and returns only. Dashed call edges (6 4), dotted resume edges (2 4), call nodes, unknown-status checkpoints.

### Genus Folders
- **Sage, Manila, Folder Blue, Red-Brown, Violet, Teal** (`folder-sage` through `folder-teal`, CSS `--f0` to `--f5`): assigned per file in load order. They appear only as folder tabs, folder-card tabs, barcode baselines, and hover/selected borders of that file's folder. Dark mode lifts each hue (for example sage #8fb27c, folder blue #7fa6c6).

### Neutral
- **Cabinet Ground** (`cabinet-ground`, recess `cabinet-ground-recess`): the app background, top bar, map canvas, depth gutter; the recess holds segmented controls.
- **Rag Sheet** (`rag-sheet`, shade `rag-sheet-shade`, deep `rag-sheet-deep`): sheets, cards, drawers, inputs; shade for hover, source blocks, and receded nodes; deep for count and kind chips.
- **Herbarium Ink** (`herbarium-ink`, soft, faint): primary text, secondary text, metadata and inactive tabs.
- **Hairline** (`hairline`, strong `hairline-strong`): dividers and sheet borders; strong for control borders and unselected node bodies.

### Named Rules
**The One Green Rule.** Action Green appears only on things the user can act on and on the route they are simulating. Structure that is green for identity uses Specimen Green, which is darker and never interactive by colour alone.

**The One Meaning Rule.** Stamp red is a problem, amber is a condition or gate, violet is a call. None of them is decoration, and none substitutes for another.

**The Folder Tab Rule.** A file's colour travels with its content as a small tab (13 x 6px, top corners rounded), never as a fill behind text.

## Typography

**Display Font:** Archivo (variable, self-hosted in `fonts/`), headings set slightly narrow (`font-stretch: 92–94%`, weight 640–680).
**Body Font:** Archivo, falling back to the system sans (`--sans`).
**Label/Mono Font:** Courier Prime 400/700 (self-hosted, `size-adjust: 110%`) for typed data: names, values, paths, line numbers, counts (`--mono`).
**Code Font:** `ui-monospace, "SF Mono", Menlo, Consolas` for raw source, the variable editor, and code snippets (`--code`).

**Character:** A grotesque with label-room character for prose and controls, set against a typewriter face for anything that came out of the script. The pairing reads as a typed collection label pasted onto a printed herbarium sheet. Raw code stays in the platform code face so long lines remain compact.

**Fonts are files, not links.** Both faces live in `fonts/` with their SIL Open Font License texts and load by relative URL, so Branchlight works offline from `file://`. Never add a hosted font stylesheet.

### Hierarchy
- **Headline** (600, 20px, 1.3, -0.01em): list-view titles (Variables, Problems). Drawer and checkpoint detail titles sit one step below at 18px.
- **Title** (600, 15px, 1.3): sheet and section headings; 13.5px for aside column heads, 13px for h3 and specimen label titles. Brand name 15.5px at 650.
- **Body** (400, 14px, 1.5): base text and tabs; slips and controls 13 to 13.5px.
- **Label** (600, 12.5px): field labels, section titles, fold summaries, table captions. Notes and metadata drop to 12px at 400 in faint ink, 1.6 line-height.
- **Data** (Courier Prime, 400/700, 11 to 13px): file names, label names on nodes (600, 13px), variable names, file:line references, counts, zoom level, depth numbers (11px).
- **Stamp** (650, 10.5px, 0.06em, uppercase, 1px currentColor frame): the category stamp on determination slips only.

### Named Rules
**The Typed Data Rule.** If it was read from the script (a name, a value, a path, a line number, a count), it is set in monospace with tabular numerals. Explanations about it are set in sans.

**The Stamp Only Rule.** Uppercase letter-spaced type exists only inside the framed stamp on a determination slip. It is not a heading device.

## Layout

The app is a fixed-height shell: a 56px top bar on the cabinet ground, then one view filling the rest. Overview is a three-column grid (236px files, flexible mounted sheet, 312px ledger) with an 18px gutter and 18px outer padding; Checkpoints follows the same pattern (250px, flexible, 320px). The Map is a full-bleed canvas with a fixed 34px depth-number gutter on the left, a floating toolbar top-left, a zoom cluster bottom-right, and a 380px drawer on the right that the inspector and the simulator share. List views (Variables, Problems) mount a single sheet up to 1240px wide, with 22px horizontal sheet padding and 46px minimum rows.

Spacing steps are 6, 8, 10, 12, 14, 18, and 22px; 18px is the structural gutter, 6 to 8px separates items inside a group. Density is high and aligned: numbers right-aligned in tabular figures, columns fixed.

Responsive: at 1240px the columns narrow (210 / flexible / 280, 14px gutter) and the project title hides; at 1100px the drawer floats over the map with the high lift; at 900px the overview stacks the sheet above two columns; at 720px the top bar wraps tabs to their own scrolling row (top bar 96px), the overview becomes one column with the sheet first, variable rows reflow to a name / initial / strip grid, and the drawer becomes a bottom tray (72dvh, 10px top corners).

## Elevation & Depth

Paper on paper. Depth comes from tone (rag sheet over cabinet ground) and a hairline border, with a two-layer shadow so thin it reads as the edge of mounted card stock. Floating chrome (menus, the import notice, the drawer when it overlays) uses the higher lift. No blur, no glass, no glow; in dark mode the same two shadows deepen in pure black.

### Shadow Vocabulary
- **Lift** (`box-shadow: 0 1px 1px rgb(23 37 30 / .05), 0 2px 5px -1px rgb(23 37 30 / .10)`): sheets, slips, the variables ledger, the collection label, the map toolbar and zoom cluster.
- **High Lift** (`box-shadow: 0 2px 3px rgb(23 37 30 / .08), 0 8px 14px -4px rgb(23 37 30 / .18)`): the Open menu, the import message, the overlaying drawer.
- **Pressed Segment** (`box-shadow: 0 0 0 1px var(--ink-3), 0 1px 2px rgb(0 0 0 / .12)`): the selected option in segmented controls and the appearance switcher.

### Named Rules
**The Mounted Paper Rule.** A surface is either on the ground or a sheet with Lift. Only things floating over other content get High Lift. Compact slip lists inside a drawer drop the shadow entirely.

## Shapes

Square-shouldered paper with small, graded corners: specimen labels 2px (the most typed, most formal), slips, tags and chips 3px, sheets, inputs and cards 4px, buttons and segmented frames 5px, floating toolbars 6px, menus 7px, and only the mobile bottom tray and the drop overlay at 10px. Borders are 1px hairlines; dashed outlines mean "not real yet" (unreached labels, missing destinations, manual overrides, completed checkpoints, the drop target). The folder tab is the one recurring silhouette: a short bar with rounded top corners sitting above the top-left corner of its card, whose width on file folders grows with the file's share of scenes.

## Components

### Buttons
Quiet paper buttons with one green exception.
- **Shape:** gently squared (5px), 34px tall, 12px side padding, 13.5px at 500, with an 18px line icon and 7px gap.
- **Default:** rag sheet with a strong hairline border and ink text.
- **Action:** Action Green fill and border, Action Ink text at 600; one per context (Simulate route).
- **Hover / Focus:** default shades to Rag Sheet Shade and the border darkens to faint ink; action deepens. Transitions are 0.15s on colour only. Focus is a 2px Action Green outline at 2px offset everywhere.
- **Disabled:** 45% opacity, no hover change.
- **Icon buttons:** 32px, borderless, soft ink, shade on hover.

### Chips
- **Tags:** 3px corners, 1px strong hairline, 11.5px at 500. Scenario tags take the amber trio.
- **Counts:** monospace 11.5px on Rag Sheet Deep; the alert count uses stamp red on stamp wash.
- **Variable chips:** monospace 12px, strong hairline border; a "set" chip borders in faint ink, a "check" chip in amber line.

### Cards / Containers
- **Sheet:** rag sheet, 1px hairline, 4px corners, Lift. Head rows have 14px 18px 12px padding and a hairline rule beneath.
- **Folder:** a file card with a 0 4px 4px 4px corner set (the top-left corner meets its tab), strong hairline border, monospace file name, stamp-red problem count. Selected: border and 1px inset ring in the folder's own colour.

### Inputs / Fields
- **Style:** 32px tall, 1px strong hairline, 4px corners, rag sheet background; search text and select values in monospace, placeholders in sans.
- **Focus:** border goes to faint ink plus the 2px Action Green outline.
- **Segmented control:** recessed ground frame, 2px inset; the selected option becomes a rag-sheet key with the Pressed Segment ring.
- **Switch:** 28 x 16px track; on is Specimen Green in light mode.

### Navigation
View tabs sit in the top bar at 14px/500 in faint ink, with a monospace count. The current tab turns ink and gets a 2px ink underline on the bar's bottom rule. On narrow screens the tabs become their own horizontally scrolling row.

### Specimen Label
The typed collection label: a 1px faint-ink frame at 2px corners on rag sheet, a sans title over a strong hairline, then a two-column grid of faint-ink terms and right-aligned monospace values. Used for the collection counts and inline metadata; the inline variant uses the strong hairline frame and left-aligned values.

### Determination Slip
A problem record: a small sheet (3px corners, Lift) with a framed uppercase stamp in the severity colour (stamp red for errors, amber for warnings, faint ink for notes), the finding in 13px ink, and a monospace file:line reference with its folder tab and a "Show on map" link.

### Barcode Strip
Per variable, a strip across the whole script: one baseline segment per file in that file's folder colour at 45% opacity, ink ticks above the line where the variable is changed and amber ticks below where it is checked. Strokes are non-scaling, so the strip reads the same at 16px in the ledger and 22px in the Variables table.

### Story Map Nodes and Depth Gutter
Nodes are rag-sheet rectangles with a folder tab, a kind line in 600 11px, a title (labels in monospace 600 13px), and a monospace meta line. Choice points are filled Specimen Green; conditions take the amber wash; calls the violet wash; missing or dynamic destinations a dashed stamp outline. The fixed depth gutter on the left (34px, ground-coloured, hairline right edge) numbers each rank in 11px monospace, with hairline rank rules across the canvas.

### Simulator and State Table
The drawer offers only the next decision: choice buttons framed in Action Green with a green bullet and the condition in monospace beneath. The followed route is lit as a 3px green edge; off-route nodes recede by colour (shade fill, faint text), not opacity. The state table is a fixed-column grid, one column per choice, values in right-aligned tabular monospace; cells that changed turn ink, 600, on Action Wash.

### Camera Glide (signature interaction)
Drilling in from Overview, Variables, or Problems eases the map camera to the exact node over 460ms with an exponential ease-out (`1 - 2^(-10t)`), interpolating zoom in log space so it feels even. Under reduced motion it jumps instantly. Drawers enter with a 0.22s `cubic-bezier(.16, 1, .3, 1)` slide of 16px (24px upward as a bottom tray).

## Do's and Don'ts

### Do:
- **Do** set every script-derived value in monospace with tabular numerals.
- **Do** carry a file's identity as a folder tab in its folder colour wherever its content appears.
- **Do** reserve Action Green for actions, focus, and the simulated route; use Specimen Green for structural green.
- **Do** recede off-route or unreached content by colour and dashed outlines, keeping text readable.
- **Do** keep depth to Lift and High Lift on rag sheets over the cabinet ground.
- **Do** make the camera glide instant under `prefers-reduced-motion`.

### Don't:
- **Don't** use stamp red, amber, or violet for anything other than problems, conditions and gates, and calls respectively.
- **Don't** add uppercase letter-spaced kickers or eyebrows over headings; uppercase lives only in slip stamps.
- **Don't** fill text areas with folder colours or use them for status.
- **Don't** add decorative gradients, blur, glow, or a dot-grid canvas; the ground is flat cabinet colour.
- **Don't** use pure black or pure white for ink or ground; both modes stay green-tinted.
