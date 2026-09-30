(function () {
  'use strict';
  const $ = id => document.getElementById(id), NS = 'http://www.w3.org/2000/svg';
  const sample = `# A small story with choices, conditions, and a shared ending.
default has_lantern = False

label start:
    "The last light is fading. Beyond the gate, two paths wait."
    menu:
        "Which way will you go?"
        "Follow the river":
            jump river
        "Enter the forest":
            jump forest

label river:
    "A lantern rocks gently beside an empty boat."
    menu:
        "Take the lantern":
            $ has_lantern = True
        "Leave it behind":
            pass
    jump clearing

label forest:
    "You follow the sound of an owl through the trees."
    jump clearing

label clearing:
    if has_lantern:
        "In the lantern light, a hidden door appears."
        jump hidden_door
    else:
        "The stars guide you safely home."
        jump home

label hidden_door:
    "Someone has been waiting for you."
    return

label home:
    "Tomorrow, perhaps, you will take the other path."
    return
`;
  const kinds = { label: 'LABEL', menu: 'CHOICE POINT', choice: 'PLAYER CHOICE', condition: 'CONDITION', passage: 'STORY BEAT', call: 'CALL', jump: 'CALCULATED JUMP', return: 'RETURN', external: 'NOT LOADED', boundary: 'FILE BOUNDARY' };
  let graph, view, selected, tx = 0, ty = 0, scale = 1, drag, moved = false, dragDepth = 0;
  let messageTimer, loadVersion = 0;
  function el(tag, attrs = {}, text) { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text !== undefined) e.textContent = text; return e; }
  function notice(message) { $('message').textContent = message; $('message').hidden = false; clearTimeout(messageTimer); messageTimer = setTimeout(() => $('message').hidden = true, 14000); }
  function transform() { $('viewport').setAttribute('transform', `translate(${tx},${ty}) scale(${scale})`); $('zoom').textContent = Math.round(scale * 100) + '%'; }
  function zoom(factor, x = $('canvas').clientWidth / 2, y = $('canvas').clientHeight / 2) { const old = scale; scale = Math.max(.08, Math.min(2.2, scale * factor)); tx = x - (x - tx) * scale / old; ty = y - (y - ty) * scale / old; transform(); }
  function fit(readable = false) {
    if (!view?.nodes.length) return;
    const w = $('canvas').clientWidth, h = $('canvas').clientHeight;
    const widthScale = Math.max(.08, (w - 70) / view.width);
    scale = Math.min(1, widthScale, Math.max(readable ? .78 : .08, (h - 65) / view.height));
    tx = (w - view.width * scale) / 2; ty = Math.max(20, (h - view.height * scale) / 2); transform();
  }
  function makeView() {
    const outgoing = new Map();
    for (const e of graph.edges) { if (!outgoing.has(e.from)) outgoing.set(e.from, []); outgoing.get(e.from).push(e); }
    const reachable = new Set(), queue = $('entry').value ? [$('entry').value] : graph.nodes.map(n => n.id);
    while (queue.length) { const id = queue.pop(); if (reachable.has(id)) continue; reachable.add(id); for (const e of outgoing.get(id) || []) queue.push(e.to); }
    const show = n => reachable.has(n.id) && (n.type !== 'passage' || $('dialogue').checked) && (n.type !== 'jump' || n.dynamic);
    const nodes = graph.nodes.filter(show).map(n => ({ ...n })), kept = new Set(nodes.map(n => n.id)), edges = [], dedupe = new Set();
    for (const n of nodes) {
      for (const first of outgoing.get(n.id) || []) {
        const q = [{ ...first }], seen = new Set();
        while (q.length) {
          const e = q.shift();
          if (kept.has(e.to)) {
            const key = [n.id, e.to, e.label, e.kind].join('|');
            if (!dedupe.has(key)) { edges.push({ ...e, from: n.id }); dedupe.add(key); }
          } else if (!seen.has(e.to)) {
            seen.add(e.to); for (const after of outgoing.get(e.to) || []) q.push({ ...after, label: [e.label, after.label].filter(Boolean).join(' · '), kind: e.kind === 'flow' ? after.kind : e.kind });
          }
        }
      }
    }
    return layout(nodes, edges);
  }
  function layout(nodes, edges) {
    // Ignore DFS back edges for rank assignment; route them around the outside.
    const byId = new Map(nodes.map(n => [n.id, n])), outgoing = new Map(nodes.map(n => [n.id, []]));
    for (const e of edges) outgoing.get(e.from)?.push(e);
    const color = new Map(), order = [];
    function visit(id) {
      color.set(id, 1);
      for (const e of outgoing.get(id) || []) { if (color.get(e.to) === 1) e.back = true; else if (!color.has(e.to)) visit(e.to); }
      color.set(id, 2); order.push(id);
    }
    const sorted = [...nodes].sort((a, b) => (a.type !== 'label') - (b.type !== 'label') || a.file.localeCompare(b.file) || a.line - b.line);
    for (const n of sorted) if (!color.has(n.id)) visit(n.id);
    const ranks = new Map(nodes.map(n => [n.id, 0]));
    for (const id of order.reverse()) for (const e of outgoing.get(id) || []) if (!e.back) ranks.set(e.to, Math.max(ranks.get(e.to), ranks.get(id) + 1));
    const layers = [];
    for (const n of sorted) { n.rank = ranks.get(n.id); (layers[n.rank] ||= []).push(n); }
    const pos = new Map();
    for (const layer of layers) layer?.forEach((n, i) => pos.set(n.id, i));
    // Barycentric sweeps keep siblings near their parents and reduce crossings.
    for (let sweep = 0; sweep < 4; sweep++) {
      for (let r = 1; r < layers.length; r++) {
        const layer = layers[r] || [];
        const score = n => { const es = edges.filter(e => e.to === n.id && !e.back); return es.length ? es.reduce((sum, e) => sum + (pos.get(e.from) || 0), 0) / es.length : pos.get(n.id); };
        layer.sort((a, b) => score(a) - score(b)); layer.forEach((n, i) => pos.set(n.id, i));
      }
    }
    const widest = Math.max(1, ...layers.map(l => l?.length || 0));
    for (const layer of layers) for (let i = 0; i < (layer?.length || 0); i++) {
      const n = layer[i]; n.x = 40 + ((widest - layer.length) / 2 + i) * 258; n.y = n.rank * 166 + 30; n.w = 226; n.h = 106;
    }
    return { nodes, edges, byId, width: widest * 258 + 48, height: layers.length * 166 + 25 };
  }
  function wrap(text, max = 27, count = 2) {
    const words = text.replace(/\s+/g, ' ').trim().split(' '), lines = []; let line = '';
    for (const word of words) {
      if ((line + ' ' + word).trim().length > max && line) { lines.push(line); line = word; } else line = (line + ' ' + word).trim();
    }
    if (line) lines.push(line);
    return lines.slice(0, count).map((s, i) => (s.length > max ? s.slice(0, max - 1) + '…' : s) + (i === count - 1 && lines.length > count && s.length <= max ? '…' : ''));
  }
  function render(doFit = true) {
    if (!graph) return;
    view = makeView(); $('viewport').replaceChildren();
    const byId = new Map(view.nodes.map(n => [n.id, n]));
    const edgeLayer = el('g'), nodeLayer = el('g'); $('viewport').append(edgeLayer, nodeLayer);
    view.edges.forEach((e, i) => {
      const a = byId.get(e.from), b = byId.get(e.to); if (!a || !b) return;
      const sx = a.x + a.w / 2, sy = a.y + a.h, ex = b.x + b.w / 2, ey = b.y, mid = (sy + ey) / 2;
      let d = `M${sx},${sy} C${sx},${mid} ${ex},${mid} ${ex},${ey}`;
      if (e.back || ey <= sy) {
        const side = Math.max(a.x + a.w, b.x + b.w) + 18 + (i % 3) * 8;
        d = `M${a.x + a.w},${a.y + a.h / 2} C${side},${a.y + a.h / 2} ${side},${b.y + b.h / 2} ${b.x + b.w},${b.y + b.h / 2}`;
      }
      const path = el('path', { d, class: `edge ${e.kind}` }); path.append(el('title', {}, e.label || 'Continue')); edgeLayer.append(path);
      if (e.label) edgeLayer.append(el('text', { x: (sx + ex) / 2 + 8, y: mid - 5, class: 'edge-label', 'text-anchor': 'middle' }, e.label.length > 34 ? e.label.slice(0, 32) + '…' : e.label));
    });
    for (const n of view.nodes) {
      const g = el('g', { transform: `translate(${n.x},${n.y})`, class: `node ${n.type}${selected === n.id ? ' selected' : ''}`, tabindex: '0', role: 'button', 'aria-label': `${kinds[n.type]}: ${n.title}, line ${n.line}`, 'data-id': n.id });
      g.append(el('rect', { width: n.w, height: n.h, rx: n.type === 'return' ? 22 : 9 }));
      g.append(el('text', { x: 16, y: 23, class: 'node-kind' }, n.loop ? 'WHILE LOOP' : kinds[n.type]));
      wrap(n.title).forEach((line, i) => g.append(el('text', { x: 16, y: 46 + i * 18, class: 'node-title' }, line)));
      g.append(el('text', { x: 16, y: 91, class: 'node-meta' }, n.type === 'external' ? 'Load the file containing this label' : `Line ${n.line}${n.condition ? ' · conditional choice' : ''}`));
      g.append(el('title', {}, n.title + (n.condition ? '\nif ' + n.condition : '')));
      g.addEventListener('click', () => { if (!moved) inspect(n.id); });
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); inspect(n.id); } });
      nodeLayer.append(g);
    }
    $('empty').hidden = !!Object.keys(graph.labels).length;
    $('visible-count').textContent = `${view.nodes.length} nodes · ${view.edges.length} connections`;
    $('map-title').textContent = $('entry').value ? Object.keys(graph.labels).find(k => graph.labels[k] === $('entry').value) : 'All branches';
    if (doFit) requestAnimationFrame(() => fit(true)); else transform();
  }
  function inspect(id) {
    const n = graph.nodes.find(n => n.id === id); if (!n) return;
    selected = id; $('inspector').hidden = false;
    $('detail-type').textContent = kinds[n.type]; $('detail-title').textContent = n.title;
    $('detail-location').textContent = `${n.file} · line ${n.line}${n.end > n.line ? '–' + n.end : ''}`;
    const notes = { return: 'Returns to the caller, or to the main menu when there is no caller.', call: 'The dashed connection enters the called label. “After return” shows where execution resumes if the call returns.', boundary: 'The loaded file ends here. Ren’Py may continue into another script file; no destination is inferred.', external: 'This label was referenced but not defined in your selection. Open all related story files together to connect it.', condition: 'Both possible paths are shown. This tool does not evaluate game variables.', menu: 'Each branch represents an available choice. Conditional options are marked on their connection.' };
    $('detail-note').textContent = n.dynamic ? 'This destination is calculated at runtime and cannot be resolved statically.' : n.condition ? `Available when: ${n.condition}` : notes[n.type] || '';
    $('source').replaceChildren();
    const file = graph.files.find(f => f.name === n.file);
    if (file) {
      const from = Math.max(0, n.line - 4), end = Math.min(file.lines.length, Math.max(n.end, n.line + 8) + 3);
      for (let i = from; i < Math.min(end, from + 100); i++) {
        const line = document.createElement('span'); line.className = 'source-line' + (i + 1 >= n.line && i + 1 <= n.end ? ' highlight' : '');
        const number = document.createElement('span'); number.className = 'line-number'; number.textContent = i + 1;
        line.append(number, document.createTextNode(file.lines[i])); $('source').append(line);
      }
    }
    $('connections').replaceChildren();
    const outgoing = view.edges.filter(e => e.from === id);
    for (const e of outgoing) {
      const target = graph.nodes.find(v => v.id === e.to), button = document.createElement('button');
      button.textContent = `${e.label ? e.label + ' → ' : '→ '}${target.title}`;
      button.onclick = () => { inspect(e.to); center(e.to); }; $('connections').append(button);
    }
    for (const g of $('viewport').querySelectorAll('.node')) g.classList.toggle('selected', g.dataset.id === id);
    requestAnimationFrame(() => center(id));
  }
  function center(id) { const n = view.nodes.find(n => n.id === id); if (!n) return; scale = Math.max(scale, .75); tx = $('canvas').clientWidth / 2 - (n.x + n.w / 2) * scale; ty = $('canvas').clientHeight / 2 - (n.y + n.h / 2) * scale; transform(); }
  function closeDetail() { $('inspector').hidden = true; selected = null; render(); }
  function load(files, example = false) {
    const parsed = RpyParser.parse(files); graph = parsed;
    $('inspector').hidden = true; selected = null;
    $('mode').textContent = example ? 'Example' : 'Loaded';
    $('project').textContent = example ? 'The lantern path' : files.length === 1 ? files[0].name.replace(/\.rpy$/i, '') : `${files.length} story files`;
    $('file-summary').textContent = example ? 'A small story to explore.' : files.map(f => f.name).join(', ');
    $('label-count').textContent = Object.keys(graph.labels).length;
    $('choice-count').textContent = graph.nodes.filter(n => n.type === 'choice').length; $('file-count').textContent = files.length;
    $('entry').replaceChildren(new Option('All labels', ''));
    for (const [name, id] of Object.entries(graph.labels)) $('entry').add(new Option(name, id));
    const firstLabel = graph.labels.start || Object.values(graph.labels)[0];
    if (firstLabel) $('entry').value = firstLabel;
    $('warning-count').textContent = graph.warnings.length;
    $('warnings').replaceChildren();
    const notes = graph.warnings.length ? graph.warnings : [{ message: 'No unresolved destinations or unsupported navigation found. This is a static map, not a Ren’Py lint check.' }];
    for (const warning of notes.slice(0, 100)) { const p = document.createElement('p'); p.textContent = (warning.file ? `${warning.file}:${warning.line} — ` : '') + warning.message; $('warnings').append(p); }
    if (notes.length > 100) { const p = document.createElement('p'); p.textContent = `${notes.length - 100} more notes. Load fewer files to narrow the analysis.`; $('warnings').append(p); }
    $('message').hidden = true; render();
  }
  async function readFiles(list) {
    const files = Array.from(list), version = ++loadVersion;
    if (!files.length) return;
    if (files.some(f => !/\.rpy$/i.test(f.name))) { notice('Please choose .rpy source files. Compiled .rpyc files cannot be read.'); return; }
    if (files.reduce((sum, f) => sum + f.size, 0) > 12 * 1024 * 1024) { notice('Please load fewer files at once (up to 12 MB).'); return; }
    try {
      const content = await Promise.all(files.map(async f => ({ name: f.webkitRelativePath || f.name, text: await f.text() })));
      const names = new Set(); for (const f of content) { const base = f.name; let i = 2; while (names.has(f.name)) f.name = `${base} (${i++})`; names.add(f.name); }
      if (version !== loadVersion) return;
      load(content);
    } catch (error) { notice(`Could not build this map: ${error.message} The previous map is still available.`); }
  }
  $('open').onclick = () => $('files').click();
  $('files').onchange = e => { readFiles(e.target.files); e.target.value = ''; };
  $('example').onclick = () => { loadVersion++; load([{ name: 'lantern_path.rpy', text: sample }], true); };
  $('entry').onchange = () => { $('inspector').hidden = true; selected = null; render(); };
  $('dialogue').onchange = () => { $('inspector').hidden = true; selected = null; render(); };
  $('close-detail').onclick = closeDetail;
  $('zoom-in').onclick = () => zoom(1.2); $('zoom-out').onclick = () => zoom(1 / 1.2); $('fit').onclick = () => fit();
  $('canvas').addEventListener('wheel', e => { e.preventDefault(); const rect = $('canvas').getBoundingClientRect(); zoom(Math.exp(-e.deltaY * .002), e.clientX - rect.left, e.clientY - rect.top); }, { passive: false });
  $('canvas').addEventListener('pointerdown', e => { if (e.button !== 0) return; drag = { x: e.clientX, y: e.clientY, tx, ty }; moved = false; });
  window.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 5) moved = true; if (moved) { $('canvas').classList.add('dragging'); tx = drag.tx + dx; ty = drag.ty + dy; transform(); } });
  window.addEventListener('pointerup', () => { drag = null; $('canvas').classList.remove('dragging'); });
  window.addEventListener('pointercancel', () => { drag = null; });
  $('canvas').addEventListener('keydown', e => {
    if (e.key === '+' || e.key === '=') zoom(1.2); else if (e.key === '-') zoom(1 / 1.2); else if (e.key === '0') fit();
    else if (e.key.startsWith('Arrow')) { e.preventDefault(); tx += e.key === 'ArrowLeft' ? 50 : e.key === 'ArrowRight' ? -50 : 0; ty += e.key === 'ArrowUp' ? 50 : e.key === 'ArrowDown' ? -50 : 0; transform(); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDetail(); });
  document.addEventListener('dragenter', e => { if (!Array.from(e.dataTransfer?.types || []).includes('Files')) return; e.preventDefault(); dragDepth++; $('drop-overlay').hidden = false; });
  document.addEventListener('dragover', e => { e.preventDefault(); });
  document.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('drop-overlay').hidden = true; } });
  document.addEventListener('drop', e => { e.preventDefault(); dragDepth = 0; $('drop-overlay').hidden = true; readFiles(e.dataTransfer.files); });
  new ResizeObserver(() => { if (!selected) fit(true); }).observe($('canvas'));
  load([{ name: 'lantern_path.rpy', text: sample }], true);
  // Optional browser agent access uses the same state as the visible controls.
  if (document.modelContext?.registerTool) {
    for (const tool of [{ name: 'read_branch_map', description: 'Read the currently loaded static RenPy branch map and analysis notes.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute: () => ({ labels: graph.labels, nodes: graph.nodes, edges: graph.edges, warnings: graph.warnings }) },
      { name: 'focus_story_label', description: 'Focus the visible diagram on a label in the currently loaded files.', inputSchema: { type: 'object', properties: { label: { type: 'string' } }, required: ['label'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: true }, execute: ({ label }) => { if (!Object.hasOwn(graph.labels, label)) throw new Error('Label is not loaded.'); $('entry').value = graph.labels[label]; $('entry').onchange(); return { focused: label, visibleNodes: view.nodes.length }; } }]) {
      try { Promise.resolve(document.modelContext.registerTool(tool)).catch(() => {}); } catch (_) { /* Optional API. */ }
    }
  }
})();
