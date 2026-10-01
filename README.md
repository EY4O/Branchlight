# Branchlight

**See how your Ren’Py story branches.**

Branchlight turns `.rpy` scripts into an interactive flowchart, making it easier to follow player choices, trace routes between scenes, and see where branches reconnect.

**[Try Branchlight](https://ey4o.github.io/Branchlight/)**

## Features

- Load one or more `.rpy` files.
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

Open [Branchlight](https://ey4o.github.io/Branchlight/) and drag your `.rpy` files into the window, or use **Open .rpy files**. Load related files together so connections between them can be resolved.

Use **Explore from** to choose a starting label. Drag the map to move around, scroll to zoom, and click any node to view the corresponding code. **Fit map** brings the full diagram into view.

The included example story lets you explore the controls before loading your own project. Use **Appearance** in the top bar to choose **Light**, **Dark**, or **System theme**. Your preference is remembered in that browser when local storage is available.

## Simulating a route

Choose a label under **Explore from**, then open **Simulate a route**. Branchlight fills in the starting variables it can read from `default` and `define` statements. Edit those values and select **Start simulation** to advance to the first choice.

Choose an available option to follow the story. Assignments update the variables, conditions select the matching branch, and the visited route turns green on the map. **Undo** restores the previous simulation action, including its variables and call stack.

You can use **Next step** or **To next choice** when the simulation is ready to continue. To try a different state, edit the variables and select **Apply variable edits**, then continue. **Restart with these values** starts again at the selected label; **Reset** restores the loaded defaults.

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

For games with custom progression rules, **Open project bundle** loads an event map and checkpoints exported from the game. Select a campaign and checkpoint, then click an event to see its status and why it is available or blocked. Filter by chapter or act with **Group**.

Recorded checkpoints and hypothetical scenarios are labeled separately. These are read-only snapshots: re-export after changing the game or its state. The bundle viewer does not run custom game code or recalculate availability.

Select **Explore example project** in the sidebar to try it. For the JSON format and guidance on writing a game-specific exporter, see [Project bundles](docs/project-bundles.md). Exporters and private game data stay with their respective projects; Branchlight has no game-specific rules.

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

Check **Analysis notes** for unresolved references and unsupported constructs. Simulation has step limits to keep loops from running indefinitely. Use Ren’Py’s own tools to validate and playtest your game.

For larger projects, load a smaller group of story files and focus on individual labels. Each selection supports up to 12 MB and 3,000 flow nodes.

## Self-hosting

Branchlight is a static site with no backend or external runtime dependencies. To host your own copy, place these files together on a static web server:

```text
index.html
style.css
theme.js
parser.js
simulator.js
project-bundle.js
project-view.js
app.js
```

A GitHub Pages deployment workflow is also included in `.github/workflows/pages.yml`.

## Development

The interface uses plain HTML, CSS, and JavaScript. The script parser lives in `parser.js`, the expression interpreter and route simulator in `simulator.js`, and the script diagram and browser interactions in `app.js`. Project bundle validation lives in `project-bundle.js`, with its interface in `project-view.js`.

Run the parser, simulator, and project-bundle tests with Node.js 22 or newer:

```sh
node --test tests/*.test.cjs
```

Bug reports and contributions are welcome. For parsing issues, a small `.rpy` example showing the problem is especially helpful.

## License

Branchlight is available under the [MIT License](LICENSE). You’re free to use, modify, and host your own copy.
