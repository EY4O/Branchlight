# Branchlight

**See how your Ren’Py story branches.**

Branchlight turns `.rpy` scripts into an interactive flowchart, making it easier to follow player choices, trace routes between scenes, and see where branches reconnect.

**[Try Branchlight](https://ey4o.github.io/Branchlight/)**

## Features

- Load one or more `.rpy` files.
- Follow choices, conditions, loops, jumps, and calls.
- Connect labels across multiple files.
- Focus on a particular scene or explore the whole map.
- Show dialogue and actions alongside branching points.
- Click a node to inspect its source.
- Identify missing labels and destinations that require runtime information.

Your scripts stay in your browser. Branchlight does not upload, execute, or modify them.

## Getting started

Open [Branchlight](https://ey4o.github.io/Branchlight/) and drag your `.rpy` files into the window, or use **Open .rpy files**. Load related files together so connections between them can be resolved.

Use **Explore from** to choose a starting label. Drag the map to move around, scroll to zoom, and click any node to view the corresponding code. **Fit map** brings the full diagram into view.

The included example story lets you explore the controls before loading your own project.

## Running locally

Download or clone this repository, then open `index.html` in your browser. On macOS, you can also double-click `Open Branchlight.command`.

No installation or build step is required. Once downloaded, Branchlight works offline.

## Understanding the map

Branchlight reads the structure of your scripts without running the game. Conditions appear as possible paths; the map does not determine whether a particular combination of choices or variables can reach an ending.

A few things to keep in mind:

- **Calculated destinations:** `jump expression` and `call expression` cannot be resolved automatically.
- **Python and screens:** Navigation controlled by Python, screen actions, or custom statements may introduce paths the map cannot show.
- **Calls and returns:** Calls show their destination and an **After return** connection. Branchlight does not simulate the call stack.
- **File boundaries:** The end of a loaded file is not necessarily the end of the story.
- **Source files:** Compiled `.rpyc` files are not supported.

Check **Analysis notes** for unresolved references and unsupported constructs. Use Ren’Py’s own tools to validate and playtest your game.

For larger projects, load a smaller group of story files and focus on individual labels. Each selection supports up to 12 MB and 3,000 flow nodes.

## Self-hosting

Branchlight is a static site with no backend or external runtime dependencies. To host your own copy, place these files together on a static web server:

```text
index.html
style.css
parser.js
app.js
```

A GitHub Pages deployment workflow is also included in `.github/workflows/pages.yml`.

## Development

The interface uses plain HTML, CSS, and JavaScript. The script parser lives in `parser.js`, and the diagram and browser interactions live in `app.js`.

Run the parser tests with Node.js 22 or newer:

```sh
node --test tests/parser.test.cjs
```

Bug reports and contributions are welcome. For parsing issues, a small `.rpy` example showing the problem is especially helpful.

## License

Branchlight is available under the [MIT License](LICENSE). You’re free to use, modify, and host your own copy.
