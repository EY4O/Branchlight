# Branchlight

**See how your Ren’Py story branches.**

Branchlight turns `.rpy` scripts into an interactive flowchart, making it easier to follow player choices, trace routes between scenes, and see where branches reconnect.

**[Try Branchlight](https://ey4o.github.io/Branchlight/)**

## Features

- Load one or more `.rpy` files, or a whole game folder (translations are skipped).
- Start from a project overview: every file, the whole label skeleton, your variables, and problems at a glance.
- See every stat, relationship, and flag: where it is declared, changed, and checked, with a strip showing where in the script each happens.
- Find problems quickly: missing labels, labels never reached from `start`, variables checked but never set, assignments without a `default`, and variables nothing reads.
- Follow choices, conditions, loops, jumps, and calls.
- Connect labels across multiple files.
- Simulate a route using editable variables and conditional choices.
- Watch assignments change your state, then undo choices to explore another path.
- Focus on a particular scene or explore the whole map.
- Show dialogue and actions alongside branching points.
- Click a node to inspect its source.
- Identify missing labels and destinations that require runtime information.
- Import project bundles with campaign maps, saved checkpoints, and event availability explanations.

Your scripts stay in your browser. Branchlight does not upload or modify them. Route simulation interprets a limited set of statements locally; it never runs Python or custom game code.

## Getting started

Open [Branchlight](https://ey4o.github.io/Branchlight/) and drag your `.rpy` files into the window, or use **Open** in the top bar to choose script files or your whole game folder. Load related files together so connections between them can be resolved.

Branchlight opens on the **Overview**: your files (each with its own colour), the story skeleton with one box per label, a summary of the collection, your most-used variables, and the top problems. Click a label to open it in the **Map**, a variable to open it in **Variables**, or a problem to jump to the line on the map.

In the **Map**, use **From** to choose a starting label. Drag to move around, scroll to zoom, and click any node to view its code and the variables it changes or checks. The numbers down the left edge show how deep each row sits in the story.

The included example story lets you explore before loading your own project. The three buttons at the top right switch between **System**, **Light**, and **Dark** appearance. Your preference is remembered in that browser when local storage is available.

## Requirements to reach a scene

Click any label or node to see **To reach this** in the side panel. It lists what every route from `start` needs: the conditions that must be true and the choices that must be made. Each condition shows the choices and scenes that change its variables, so you can see how to meet it. For labels, **Ways in** lists each entrance and what it adds.

This is a static reading: conditions are compared as written, not evaluated. Branchlight can tell that a scene needs `mira_trust >= 3` and which choices raise it, but not whether one playthrough can make all of them. Use route simulation to check a particular path. A scene that needs both a condition and its opposite on every route is listed on the **Problems** tab.

## Simulating a route

Choose a label under **From** in the map toolbar, then select **Simulate route**. Branchlight fills in the starting variables it can read from `default` and `define` statements. Edit those values and select **Start simulation** to advance to the first choice.

Choose an available option to follow the story. Assignments update the variables, conditions select the matching branch, and the visited route turns green on the map. **What this route changed** lists each variable your choices changed, one column per choice. **Undo** restores the previous simulation action, including its variables and call stack.

You can use **Step** or **To next choice** when the simulation is ready to continue. To try a different state, open **Current variables**, edit them, and select **Apply edits**. **Restart** starts again at the selected label; **Reset** restores the loaded defaults.

For example:

```python
has_lantern = True
affection = 5
inventory = ["key", "letter"]
```

The simulator supports numbers, strings, booleans, `None`, lists, and dictionaries with string keys. It handles simple assignments, arithmetic, comparisons, membership checks, `and` / `or` / `not`, conditional menus, and loops. Calls and returns use a simulated call stack, including `_return` values. Calculated destinations can resolve when a supported expression produces a loaded label name.

If a value is missing or a statement is unsupported, simulation pauses. You can supply values and retry, or use the offered manual override after reviewing the code. Unresolved initialization also needs a manual starting state. Overrides are recorded in the route history, so you can see where a route depends on your assumptions.

This follows one route at a time; it does not automatically enumerate every combination of choices and variables.

## Project maps and checkpoints

For games with custom progression rules, **Open → Project bundle** loads an event map and checkpoints exported from the game. Select a campaign and checkpoint, then click an event to see its status and why it is available or blocked. Filter by chapter or act with **Group**.

Recorded checkpoints and hypothetical scenarios are labeled separately. These are read-only snapshots: re-export after changing the game or its state. The bundle viewer does not run custom game code or recalculate availability.

Choose **Open → Example project bundle** to try it. The bundle appears on its own **Checkpoints** tab. For the JSON format and guidance on writing a game-specific exporter, see [Project bundles](docs/project-bundles.md). Exporters and private game data stay with their respective projects; Branchlight has no game-specific rules.

## Running locally

Download or clone this repository, then open `index.html` in your browser. On macOS, you can also double-click `Open Branchlight.command`.

No installation or build step is required. Once downloaded, Branchlight works offline. The `.command` launcher opens the local files in your default browser; it does not need a local server.

Branchlight is a web app, not a packaged native Mac application. On macOS Sonoma 14 or later, open the [published site](https://ey4o.github.io/Branchlight/) in Safari, choose **File → Add to Dock**, and name it Branchlight. It opens in its own window from the Dock. See [Apple’s instructions](https://support.apple.com/en-us/104996).

The Dock web app loads the hosted site and needs a connection to load it; it is not an offline installation. Use the downloaded folder for offline use. Avoid adding a temporary localhost preview to the Dock unless you intend to keep its server running.

## Understanding the map

The map shows the structure of your scripts without running the game. Conditions appear as possible paths. Route simulation follows those paths using the current variables, but it is a simplified interpreter rather than the Ren’Py engine.

A few things to keep in mind:

- **Calculated destinations:** The static map cannot resolve `jump expression` or `call expression`. Simulation resolves supported expressions and pauses for others.
- **Python and screens:** Function calls, Python blocks, screen actions, object attributes, named stores, and custom statements are not simulated. Calls with arguments and labels with parameters also pause. These features may introduce routes the map cannot show.
- **Presentation:** Dialogue, images, and audio are not played. Their callbacks, text interpolation, and other runtime effects are not simulated.
- **Calls and returns:** The static map shows a call’s destination and an **After return** connection. Simulation follows the actual caller’s continuation when the called label returns.
- **File boundaries:** The end of a loaded file is not necessarily the end of the story.
- **Source files:** Compiled `.rpyc` files are not supported.

Check the **Problems** tab for unresolved references and unsupported constructs. Simulation has step limits to keep loops from running indefinitely. Use Ren’Py’s own tools to validate and playtest your game.

For larger projects, load a smaller group of story files and focus on individual labels. Each selection supports up to 12 MB and 3,000 flow nodes.

## Self-hosting

Branchlight is a static site with no backend or external runtime dependencies. To host your own copy, place these files together on a static web server:

```text
index.html
style.css
fonts/
theme.js
parser.js
simulator.js
story-index.js
project-bundle.js
pan-zoom.js
project-view.js
views.js
app.js
```

A GitHub Pages deployment workflow is also included in `.github/workflows/pages.yml`.

## Development

The interface uses plain HTML, CSS, and JavaScript. The script parser lives in `parser.js`, the expression interpreter and route simulator in `simulator.js`, the project-wide index of files, labels, variables, and problems in `story-index.js`, the Overview, Variables, and Problems views in `views.js`, and the map, simulator panel, and loading in `app.js`. Visual design decisions are recorded in `DESIGN.md`. The Archivo and Courier Prime fonts in `fonts/` are included under the SIL Open Font License (see the `OFL-*.txt` files). Project bundle validation lives in `project-bundle.js`, with its interface in `project-view.js`.

Run the parser, simulator, and project-bundle tests with Node.js 22 or newer:

```sh
node --test tests/*.test.cjs
```

Bug reports and contributions are welcome. For parsing issues, a small `.rpy` example showing the problem is especially helpful.

## License

Branchlight is available under the [MIT License](LICENSE). You’re free to use, modify, and host your own copy.
