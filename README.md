# Branchlight

A small, private Ren’Py branch viewer. Open one or more `.rpy` files and explore their choices, conditions, label connections, and source lines.

**No installation, build step, account, backend, or network connection is needed.** The app is plain HTML, CSS, and JavaScript with no third-party runtime dependencies. Scripts are read into browser memory; they are never executed, uploaded, or saved by the app. Reloading clears them. A web host will still receive ordinary requests for the app's four public assets.

## Run locally

Open `index.html` in a modern browser. On macOS, you can also double-click `Open Branchlight.command`.

For a local HTTP preview, run this from the project directory:

```sh
python3 -m http.server 8766 --bind 127.0.0.1
```

Then visit <http://127.0.0.1:8766>. Stop the server with Control-C.

## Explore a story

1. Click **Open .rpy files** or drag files into the window. Select related story files together to resolve jumps between them. Each load replaces the previous selection.
2. Choose a label under **Explore from** to focus on routes reachable from it. **All labels** also includes disconnected sections. This is possible static reachability, not a guarantee that a path can occur for a particular set of variables.
3. Drag the canvas to pan, scroll to zoom, or use the zoom buttons. **Fit map** shows the full graph; the initial view favors readable text. Arrow keys pan the focused canvas; `+`/`-` zoom and `0` fits.
4. Click or keyboard-activate a node to see its source and outgoing connections. Escape closes the source panel. Long source excerpts show at most 100 lines.
5. Turn on **Show dialogue & actions** for the intermediate story beats. Static jumps are displayed as direct connections in both views.

The bundled example is fictional and contains no user project files.

## What the map understands

- Global and local labels, including labels nested in a block and named menus.
- Menus, nested choices, menu arguments, conditional options, and choice branches that rejoin.
- Ordered `if` / `elif` / `else` branches and `while` loops.
- Static `jump` and `call` destinations across the files selected together.
- `call ... from ...` return-site labels.
- `return`, multiline strings, multiline bracketed expressions, comments, and escaped quotes.
- Missing label definitions and calculated destinations, with analysis notes.

Calls have a dashed edge to the target and a separate **After return** edge to the continuation. Return nodes are not connected to individual call sites: the viewer does not simulate Ren’Py's call stack. The continuation assumes the called label eventually returns.

## Limits

This is a **static source reader, not the Ren’Py parser, runtime, or lint tool**. It does not evaluate variables, execute Python, inspect `.rpyc` files, simulate game state, determine which endings are attainable, or analyze custom statement implementations.

Python blocks, translated script blocks, and screen-driven navigation are not expanded into their runtime paths. Calculated `jump expression` / `call expression` targets remain unresolved. Initialization, screen, image, ATL, transform, style, and test definitions are excluded from story flow. Custom blocks are noted but not expanded. A script can therefore contain additional runtime routes that are absent from the diagram. All ordinary conditions are shown as possible branches, even constant conditions.

At the end of an individual loaded file, the viewer does not infer the next file in Ren’Py's script order. A **File boundary** node is not necessarily a game ending. Duplicate label definitions are noted; links use the first definition. Source is displayed as plain text, never interpreted as HTML.

Selections are limited to 12 MB and 3,000 flow nodes. For large projects, load the story files you need and focus on a single label. Game code is not modified.

Control-flow reference: [Ren’Py labels and control flow](https://www.renpy.org/doc/html/label.html), [menus](https://www.renpy.org/doc/html/menus.html), and [conditionals](https://www.renpy.org/doc/html/conditional.html).

## GitHub Pages

This directory is ready to become its own repository. Use the **contents of this directory** as the repository root.

1. Create a GitHub repository, then push these files to its `main` branch.
2. In the repository's **Settings → Pages**, choose **GitHub Actions** as the source.
3. Run the included **Deploy Branchlight to Pages** workflow, or push a new commit to `main`.
4. Open the URL shown by the completed deployment. For a project repository it normally has the form `https://OWNER.github.io/REPOSITORY/`.

The workflow tests the parser and stages only `index.html`, `style.css`, `parser.js`, and `app.js` for deployment. It does not publish story files, tests, or local screenshots. Relative asset paths support GitHub Pages project subdirectories.

See [GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). The workflow is provided but has not been run on GitHub for this local copy.

## Other static hosts

Copy these four files into the same directory on any static web host:

```text
index.html
style.css
parser.js
app.js
```

No routing rewrites, environment variables, API keys, or database are needed. Others can download or fork the repository and host their own copy under the included MIT license.

## Development and checks

With Node.js 22 or newer:

```sh
node --test tests/parser.test.cjs
node --check parser.js
node --check app.js
```

`parser.js` exports `RpyParser.parse([{ name, text }])` in the browser and via CommonJS in Node. It returns nodes, edges, labels, warnings, and source files. Tests cover branch merges, terminal jumps/returns, nested conditionals, multi-file references, local labels, calls, loops, strings, and unresolved destinations.

The interface optionally exposes `read_branch_map` and `focus_story_label` through a browser's supported WebMCP API. This is progressive enhancement; ordinary browsers do not need that API.
