---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

# Branchlight app shell (index.html)

Scope: the whole single-page tool: Overview (default after load), Map, Variables, Problems, Checkpoints (bundle). Mode: Operate.

Audience and job: our team, writing a large Ren'Py VN (50+ labels). Used both beside the editor for quick checks and full-screen for structure reviews. They need to see the whole story, track every stat/relationship/flag and what it gates, spot problems, then drill into a scene or simulate a route.

Constraints: keep the Branchlight name and the forest-green identity; nothing cold or IDE-like; nothing playful, gamified, or VN-themed. Plain HTML/CSS/JS, works offline from file://. Every existing capability in PRODUCT.md survives.

## Direction contract

THESIS: The story is a pressed specimen: the whole branching plant mounted flat on one sheet, labelled and filed so a large collection reads at a glance. Refuses the default node-editor workspace (three equal panels of chrome around a dot-grid canvas, eyebrows over every heading).

OWN-WORLD: Bright cool rag-white sheets on a grey-green cabinet ground; ink near-black green. Each .rpy file is a genus folder with its own muted folder color (sage, manila, folder-blue, red-brown, violet, teal), shown as a folder tab on its nodes and rows. Typed collection-label blocks (hairline frame, monospace data rows) for metadata. Problems are determination slips with a stamp-red tag. One saturated green is reserved for actions and the live simulated route. Dark mode is the cabinet at night: deep green-black ground, same folder hues lifted.

STORY: Writers open their scripts and immediately see the files, the whole label skeleton, the variables and where they bite, and what is broken; one click drills into the exact scene or line.

FIRST VIEWPORT: Slim top bar (mark, project title, view tabs, Open, appearance). Overview: left column of genus folders sized by scenes; center the mounted sheet with the full label-level story skeleton, fitted; right column a collection label (counts), a variables ledger with barcode strips, and the top problem slips. Primary action: click any label, folder, variable, or slip to drill in.

FORM: Herbarium sheet, candidate 7 of 7 on my ordered list (assigned by roll). Seed key d6a71ad3. Raises: Ikeda barcode strips per variable; Crouwel numbered depth rows on the map; folio fixed-scale state strip in simulation; warm-app single action green; airport next-decision-only simulator with followed route lit. Signature interaction: drilling from overview/variable/slip glides the map camera to the exact node with its folder tab and line.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Cited adaptations

- Folio state strip: rendered as a fixed-column table (one column per choice, same scale and alignment every step, changed cells marked in action green) rather than a pictorial strip. Reason: simulator variables are mixed numbers, flags, and strings; aligned values compare all three exactly, where a drawn strip could only show numbers.
- Collection label: lives at the head of the right column (not floating over the sheet) so a fitted 50+ label skeleton never collides with it.
- Typography: the user approved self-hosted faces. Archivo carries the interface and Courier Prime the typed-label data, both in fonts/ (finish review fix 8 resolved).
