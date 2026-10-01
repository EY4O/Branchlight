(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const { layout, edgePath, svg: el, h, icon, plural, clip } = BranchlightViews;
  const sample = [{ name: 'script.rpy', text: `# The lantern path: a small example with stats, a relationship, and two routes.
define m = Character("Mira")

default has_lantern = False
default courage = 0
default mira_trust = 0
default mira_met = False
default route = "none"

label start:
    "The last light is fading. Beyond the gate, two paths wait."
    menu:
        "Which way will you go?"
        "Follow the river":
            $ route = "river"
            jump river
        "Enter the forest":
            $ route = "forest"
            $ courage += 1
            jump forest

label river:
    "A lantern rocks gently beside an empty boat."
    menu:
        "Take the lantern":
            $ has_lantern = True
        "Leave it behind":
            pass
    call ferryman
    jump clearing

label forest:
    "You follow the sound of an owl through the trees."
    menu:
        "Call out to the owl" if courage >= 1:
            $ courage += 1
            "It answers, and the dark feels smaller."
        "Keep walking quietly":
            pass
    jump clearing
` }, { name: 'mira.rpy', text: `# Mira's thread. Trust opens her story and the shared ending.
label ferryman:
    "A woman ties the boat to a post."
    m "I'm Mira. Careful, the bank is soft here."
    $ mira_met = True
    menu:
        "Help her with the rope":
            $ mira_trust += 2
        "Ask about the lantern" if has_lantern:
            $ mira_trust += 1
            m "Keep it lit. You'll want it later."
        "Say nothing":
            $ mira_trust -= 1
    return

label mira_camp:
    if mira_trust >= 2:
        "Mira waves you over to her fire."
        jump mira_story
    "The camp is quiet. Mira keeps to herself."
    jump home

label mira_story:
    m "My grandmother built the hidden door."
    $ mira_trust += 1
    jump hidden_door
` }, { name: 'endings.rpy', text: `# Where the routes meet again.
label clearing:
    if has_lantern:
        "In the lantern light, a hidden door appears."
        jump hidden_door
    elif mira_met:
        jump mira_camp
    elif courage >= 2:
        "You climb the ridge and see the village lights."
        jump ridge
    else:
        "The stars guide you safely home."
        jump home

label hidden_door:
    if mira_trust >= 3:
        "Mira is waiting on the other side."
        jump ending_together
    "Someone has been waiting for you."
    return

label ending_together:
    "You walk on together."
    return

label home:
    "Tomorrow, perhaps, you will take the other path."
    return

label epilogue:
    "Years later, the lantern still hangs by the door."
    jump credits
` }];
  const kinds = { label: 'Label', menu: 'Choice point', choice: 'Player choice', condition: 'Condition', passage: 'Story beat', call: 'Call', jump: 'Jump', return: 'Return', external: 'Missing label', boundary: 'End of file', unsupported: 'Unsupported code' };
  const viewNames = ['overview', 'map', 'variables', 'problems', 'checkpoints'];
  let graph, index, view, selected = null, currentView = 'overview', mapDirty = true, meta = { title: '', example: true };
  let messageTimer, loadVersion = 0, dragDepth = 0;
  let simulation = null, initialState = { variables: {}, issues: [] }, stateLog = [];

  const pz = new PanZoom($('canvas'), $('viewport'), { onChange: p => { $('zoom').textContent = Math.round(p.k * 100) + '%'; drawGutter(); } });
  const views = new BranchlightViews.Views({ openLabel, showNode, showUse: u => showNode(u.node || u.labelId), showVariable });
  const fileColor = name => index?.files.find(f => f.name === name)?.color ?? 0;
  function notice(message) { $('import-message').textContent = message; $('import-message').hidden = false; clearTimeout(messageTimer); messageTimer = setTimeout(() => { $('import-message').hidden = true; }, 14000); }

  // Views and routing. Tabs are links, so back and forward move between views.
  function showView(name) {
    if (!viewNames.includes(name)) name = 'overview';
    if (name === 'checkpoints' && !BranchlightProject.loaded()) name = 'overview';
    currentView = name;
    for (const v of viewNames) $('view-' + v).hidden = v !== name;
    for (const a of document.querySelectorAll('.tabs a')) { if (a.dataset.view === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
    if (name === 'map' && graph && mapDirty) render(true);
    if (name === 'map') requestAnimationFrame(drawGutter);
    if (name === 'overview') requestAnimationFrame(() => views.checkOverflow());
    if (name === 'checkpoints') requestAnimationFrame(() => BranchlightProject.fit());
  }
  function go(name) {
    if (location.hash.slice(1) !== name) { try { history[location.hash ? 'pushState' : 'replaceState'](null, '', '#' + name); } catch (_) { /* Some file:// contexts refuse history changes; the view still switches. */ } }
    showView(name);
  }
  window.addEventListener('hashchange', () => showView(location.hash.slice(1)));
  window.addEventListener('popstate', () => showView(location.hash.slice(1)));
  window.Branchlight = { showView: go };

  // Map
  function makeView() {
    const outgoing = new Map(), mapEdges = [...graph.edges], existing = new Set(mapEdges.map(e => e.from + '>' + e.to));
    for (const [from, to] of simulation?.traversed || []) { const key = from + '>' + to; if (!existing.has(key)) { mapEdges.push({ from, to, label: 'Simulated route', kind: 'flow' }); existing.add(key); } }
    for (const e of mapEdges) { if (!outgoing.has(e.from)) outgoing.set(e.from, []); outgoing.get(e.from).push(e); }
    const reachable = new Set(), queue = $('entry').value ? [$('entry').value] : graph.nodes.map(n => n.id);
    if (simulation) queue.push(...simulation.trace.map(item => item.id), ...(simulation.pc ? [simulation.pc] : []));
    while (queue.length) { const id = queue.pop(); if (reachable.has(id)) continue; reachable.add(id); for (const e of outgoing.get(id) || []) queue.push(e.to); }
    const show = n => reachable.has(n.id) && (n.type !== 'passage' || $('dialogue').checked || simulation) && (n.type !== 'jump' || n.dynamic || simulation);
    const nodes = graph.nodes.filter(show).map(n => ({ ...n })), kept = new Set(nodes.map(n => n.id)), edges = [], dedupe = new Set();
    // Hidden nodes are bridged so their labels and kinds still appear on the visible connection.
    for (const n of nodes) for (const first of outgoing.get(n.id) || []) {
      const q = [{ ...first, path: [[first.from, first.to]] }], seen = new Set();
      while (q.length) {
        const e = q.shift();
        if (kept.has(e.to)) { const key = [n.id, e.to, e.label, e.kind].join('|'); if (!dedupe.has(key)) { edges.push({ ...e, from: n.id }); dedupe.add(key); } }
        else if (!seen.has(e.to)) { seen.add(e.to); for (const after of outgoing.get(e.to) || []) q.push({ ...after, path: [...e.path, [after.from, after.to]], label: [e.label, after.label].filter(Boolean).join(' · '), kind: e.kind === 'flow' ? after.kind : e.kind }); }
      }
    }
    return layout(nodes, edges, { w: 228, h: 80, gapX: 30, gapY: 74, pad: 30 });
  }
  function wrap(text, max = 28, count = 2) {
    const words = text.replace(/\s+/g, ' ').trim().split(' '), lines = []; let line = '';
    for (const word of words) { if ((line + ' ' + word).trim().length > max && line) { lines.push(line); line = word; } else line = (line + ' ' + word).trim(); }
    if (line) lines.push(line);
    return lines.slice(0, count).map((s, i) => (s.length > max ? s.slice(0, max - 1) + '…' : s) + (i === count - 1 && lines.length > count && s.length <= max ? '…' : ''));
  }
  function render(doFit = true) {
    if (!graph) return;
    mapDirty = false; view = makeView();
    const visited = new Set(simulation?.trace.map(t => t.id) || []), traversed = new Set(simulation?.traversed.map(pair => pair.join('>')) || []);
    const rules = el('g'), edgeLayer = el('g'), nodeLayer = el('g');
    // Ruled depth rows; their numbers live in a fixed gutter so depth stays readable at any pan or zoom.
    for (let r = 1; r < view.layers; r++) { const y = 30 + r * view.stepY - 37; rules.append(el('line', { class: 'rank-rule', x1: -20, x2: view.width + 10, y1: y, y2: y })); }
    view.edges.forEach((e, i) => {
      const a = view.byId.get(e.from), b = view.byId.get(e.to); if (!a || !b) return;
      const p = edgePath(a, b, i, e.back), walked = e.path?.every(pair => traversed.has(pair.join('>')));
      const path = el('path', { d: p.d, class: `edge ${e.kind}${walked ? ' traversed' : ''}` }); path.append(el('title', {}, e.label || 'Continue')); edgeLayer.append(path);
      if (e.label) edgeLayer.append(el('text', { x: p.lx, y: p.ly, class: 'edge-label', 'text-anchor': 'middle' }, clip(e.label, 34)));
    });
    for (const n of view.nodes) {
      const current = simulation?.pc === n.id;
      const g = el('g', { transform: `translate(${n.x},${n.y})`, class: `node ${n.type}${n.dynamic ? ' dynamic' : ''}${selected === n.id ? ' selected' : ''}${visited.has(n.id) ? ' visited' : ''}${current ? ' current' : ''}${simulation && !visited.has(n.id) && !current ? ' sim-unvisited' : ''}`, 'data-f': fileColor(n.file), tabindex: '0', role: 'button', 'aria-label': `${kindOf(n)}: ${n.title}, ${n.file} line ${n.line}`, 'data-id': n.id });
      const round = n.type === 'return' || n.type === 'boundary';
      g.append(el('rect', { class: 'halo', x: -4, y: -4, width: n.w + 8, height: n.h + 8, rx: round ? 24 : 6 }));
      if (n.type === 'label') g.append(el('rect', { class: 'tab', x: 0, y: -5, width: 34, height: 6, rx: 1.5, style: 'fill:var(--f)' }));
      g.append(el('rect', { class: 'body', width: n.w, height: n.h, rx: round ? 20 : 3 }));
      wrap(n.title, n.type === 'label' ? 24 : 28).forEach((line, i) => g.append(el('text', { x: 14, y: 27 + i * 18, class: 'node-title' }, line)));
      const meta = el('text', { x: 14, y: 67, class: 'node-meta' });
      meta.append(el('tspan', { class: 'node-kind' }, kindOf(n)), el('tspan', {}, n.type === 'external' ? ' · not loaded' : ` · ${clip(n.file, 14)}:${n.line}`));
      g.append(meta);
      g.append(el('title', {}, n.title + (n.condition ? '\nif ' + n.condition : '')));
      g.addEventListener('click', () => { if (!pz.moved) inspect(n.id); });
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); inspect(n.id); } });
      nodeLayer.append(g);
    }
    $('viewport').replaceChildren(rules, edgeLayer, nodeLayer);
    pz.content = { x: -40, y: 0, width: view.width + 50, height: view.height };
    $('empty').hidden = !!Object.keys(graph.labels).length;
    $('visible-count').textContent = `${plural(view.nodes.length, 'node')} · ${plural(view.edges.length, 'connection')}`;
    if (doFit) requestAnimationFrame(() => fitMap()); else pz.apply();
  }
  function drawGutter() {
    const gutter = $('rank-gutter'); if (!view || currentView !== 'map') return;
    const marks = [];
    for (let r = 0; r < view.layers; r++) {
      const y = pz.y + (30 + r * view.stepY + 40) * pz.k;
      if (y > 0 && y < $('canvas').clientHeight) marks.push(el('text', { x: 17, y: y + 4, 'text-anchor': 'middle' }, String(r + 1)));
    }
    gutter.replaceChildren(...marks);
  }
  const toolbarBottom = () => { const t = document.querySelector('.map-toolbar'); return t.offsetTop + t.offsetHeight + 14; };
  function kindOf(n) { return n.loop ? 'While loop' : n.type === 'choice' && n.condition ? 'Gated choice' : n.type === 'jump' && n.dynamic ? 'Calculated jump' : kinds[n.type]; }
  function drawerInset() {
    const d = !$('simulation').hidden ? $('simulation') : !$('inspector').hidden ? $('inspector') : null;
    return d && getComputedStyle(d).position === 'absolute' ? d.offsetWidth : 0;
  }
  function fitMap(readable = true) {
    if (!view?.nodes.length || currentView !== 'map') return;
    pz.inset = drawerInset();
    const top = toolbarBottom(), c = pz.content, pad = 36, wk = (pz.width - pad * 2) / c.width, hk = (pz.height - top - pad) / c.height;
    // Phones keep nodes readable and start at the top of the story instead of shrinking everything to fit.
    const phone = pz.width < 720, k = Math.max(phone ? .6 : .08, Math.min(1, wk, readable ? Math.max(.7, hk) : hk));
    pz.stop(); pz.k = k; pz.x = (pz.width - c.width * k) / 2 - c.x * k; pz.y = Math.max(top, (pz.height - c.height * k) / 2) - c.y * k;
    if (phone && c.width * k > pz.width) { const first = view.nodes.find(n => n.rank === 0) || view.nodes[0]; pz.x = pz.width / 2 - (first.x + first.w / 2) * k; pz.y = top - c.y * k; }
    pz.apply();
  }
  function center(id) {
    const n = view?.byId.get(id); if (!n) return;
    pz.inset = drawerInset();
    const target = pz.centerTarget(n.x + n.w / 2, n.y + n.h / 2, Math.max(pz.k, .85));
    const sheet = [$('simulation'), $('inspector')].find(d => !d.hidden && getComputedStyle(d).position === 'fixed');
    target.y += toolbarBottom() / 2; // keep the node clear of the toolbar
    if (sheet) target.y -= sheet.offsetHeight / 2; // and above a bottom sheet on phones
    pz.glide(target);
  }

  // Inspector
  function inspect(id) {
    const n = graph.nodes.find(x => x.id === id); if (!n) return;
    selected = id; $('inspector').hidden = false; $('simulation').hidden = true;
    $('detail-title').textContent = n.title;
    const label = n.type === 'label' ? null : index.labelAt(n.file, n.line);
    const rows = [['Kind', kindOf(n)], ['File', n.file], n.end > n.line ? ['Lines', `${n.line}–${n.end}`] : ['Line', String(n.line)], label && ['In label', label.title], n.condition && ['Requires', n.condition]].filter(Boolean);
    $('detail-label').replaceChildren(...rows.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]));
    const notes = { return: 'Returns to the caller, or ends the route when nothing called this label.', call: 'The dashed line enters the called label. “After return” shows where the story resumes.', boundary: 'The file ends here. Ren’Py may continue into another file; no destination is guessed.', external: 'This label is referenced but not defined in the loaded files. Open every story file together to connect it.', condition: 'Both paths are drawn. Simulate a route to evaluate the condition with your variables.', menu: 'Each branch is a choice. Gated choices show their condition on the connection.', unsupported: 'Simulation pauses here. Review this code before making a manual override.' };
    $('detail-note').textContent = n.dynamic ? 'This destination is calculated at runtime and cannot be followed by the static map.' : notes[n.type] || '';
    $('detail-note').hidden = !$('detail-note').textContent;
    // Variables changed or read inside this node's lines.
    const here = [];
    for (const v of index.variables) {
      const set = v.sets.some(u => u.file === n.file && u.line >= n.line && u.line <= n.end), check = v.checks.some(u => u.file === n.file && u.line >= n.line && u.line <= n.end);
      if (set || check) here.push(h('button', { class: `var-chip ${set ? 'set' : 'check'}`, title: `${set ? 'Changed' : 'Checked'} here. Open in Variables.`, onclick: () => showVariable(v.name) }, v.name));
    }
    $('detail-vars').replaceChildren(...(here.length ? [h('p', { class: 'section-title' }, 'Variables here'), h('div', { class: 'var-chips' }, here)] : []));
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
    $('source').hidden = !file;
    const outgoing = view?.edges.filter(e => e.from === id) || [];
    $('connections').replaceChildren(...outgoing.map(e => { const target = graph.nodes.find(v => v.id === e.to); return h('button', { onclick: () => { inspect(e.to); } }, icon('arrow'), h('span', {}, e.label ? h('span', { class: 'via' }, e.label + ' → ') : null, target.title)); }));
    for (const g of $('viewport').querySelectorAll('.node')) g.classList.toggle('selected', g.dataset.id === id);
    requestAnimationFrame(() => center(id));
  }
  function closePanels() { $('inspector').hidden = true; $('simulation').hidden = true; selected = null; for (const g of $('viewport').querySelectorAll('.node.selected')) g.classList.remove('selected'); }

  // Drilling in from the overview, variables, and problems: the camera glides to the exact node.
  function showNode(id) {
    const n = graph?.nodes.find(x => x.id === id); if (!n) return;
    go('map');
    if (n.type === 'passage' && !$('dialogue').checked) { $('dialogue').checked = true; mapDirty = true; }
    if (mapDirty || !view?.byId.has(id)) render(false);
    if (!view.byId.has(id) && !simulation) {
      const label = n.type === 'label' ? n : index.labelAt(n.file, n.line);
      $('entry').value = label ? label.id : ''; resetSimulation(false); render(false);
      if (!view.byId.has(id)) { $('entry').value = ''; render(false); }
      if (!view.byId.has(id)) return;
    }
    inspect(id);
  }
  function openLabel(id) {
    const n = graph.nodes.find(x => x.id === id); if (!n) return;
    if (n.type === 'external') { const e = graph.edges.find(x => x.to === id); if (e) showNode(e.from); return; }
    if (!simulation && $('entry').value !== id && Object.values(graph.labels).includes(id)) { $('entry').value = id; closePanels(); resetSimulation(false); go('map'); render(false); fitMap(); }
    showNode(id);
  }
  function showVariable(name) { go('variables'); views.revealVariable(name); }

  // Route simulation
  function variableText(variables) { return Object.entries(variables).map(([key, val]) => `${key} = ${RpySimulator.literal(val)}`).join('\n'); }
  function resetSimulation(draw = true) {
    simulation = null; stateLog = []; $('variables').value = variableText(initialState.variables); $('simulation-error').hidden = true; $('variables-panel').open = true;
    refreshSimulation(false); if (draw) render(false);
  }
  function startLabel() { return Object.keys(graph.labels).find(k => graph.labels[k] === $('entry').value); }
  function refreshSimulation(updateEditor = true) {
    const label = startLabel();
    $('simulation-label').textContent = label ? `Route from ${label}` : 'Route simulation';
    $('start-simulation').disabled = !label;
    $('start-simulation').replaceChildren(icon('play', 'icon'), initialState.issues.length ? 'Start with manual values' : simulation ? 'Restart' : 'Start');
    $('initialization-notes').hidden = !initialState.issues.length;
    $('initialization-list').replaceChildren(...initialState.issues.slice(0, 30).map(issue => h('p', {}, `${issue.file}:${issue.line} — ${issue.message}`)), ...(initialState.issues.length ? [h('p', {}, 'Fill in the values you need. Starting accepts them as a manual starting state; it does not run these initializers.')] : []));
    $('simulation-progress').hidden = !simulation; $('apply-variables').hidden = !simulation;
    $('variables-label').textContent = simulation ? 'Current variables' : 'Starting variables';
    if (!label && !simulation) { $('simulation-error').textContent = 'Choose a label under From in the map toolbar to simulate a route from it.'; $('simulation-error').hidden = false; }
    if (!simulation) return;
    if (updateEditor) $('variables').value = variableText(simulation.variables);
    const n = simulation.nodes.get(simulation.pc);
    const status = { ready: 'Ready for the next step', choice: 'Choose a path', blocked: 'Needs your input', ended: `Route finished in ${simulation.lastLabel}`, boundary: 'Reached the end of a file', limit: 'Step limit reached' }[simulation.status];
    $('simulation-status').textContent = status + (simulation.problem ? '. ' + simulation.problem : '');
    $('simulation-status').classList.toggle('blocked', ['blocked', 'limit', 'boundary'].includes(simulation.status));
    const overrides = simulation.trace.filter(t => t.assumption).length;
    $('simulation-location').textContent = n ? `${n.file}:${n.statements?.[simulation.offset]?.line || n.line} · ${n.title}` : `${plural(simulation.steps, 'step')} · ${plural(overrides, 'manual override')}`;
    $('back-simulation').disabled = !simulation.history.length;
    const stopped = ['ended', 'boundary'].includes(simulation.status) || simulation.steps >= 5000;
    $('step-simulation').disabled = stopped || simulation.status === 'choice';
    $('run-simulation').disabled = stopped || simulation.status === 'choice';
    const choices = [], overrideButtons = [];
    const button = (title, action, record, disabled = false, detail = '') => h('button', { disabled, onclick: () => performSimulation(action, record) }, h('span', {}, title), detail ? h('small', {}, detail) : null);
    const customMenu = n?.menuSet || /\b(?:screen|nvl)\s*=/.test(n?.statement || '');
    for (const c of simulation.menu()) {
      choices.push(button(c.title, () => simulation.choose(c.id), c.title, !c.enabled || !!customMenu, c.unknown ? c.reason : c.condition ? `if ${c.condition}${c.enabled ? '' : ' · not met'}` : ''));
      if (c.unknown || customMenu) overrideButtons.push(button('Assume available: ' + c.title, () => simulation.choose(c.id, true), c.title + ' (assumed)'));
    }
    if (simulation.status === 'blocked' && n?.type === 'condition') {
      overrideButtons.push(button('Assume the condition is True', () => simulation.resolveCondition(true)), button('Assume the condition is False', () => simulation.resolveCondition(false)));
    }
    if (simulation.status === 'blocked' && ['passage', 'unsupported', 'call'].includes(n?.type)) overrideButtons.push(button('Skip this unsupported step (manual override)', () => simulation.skip()));
    $('simulation-choices').replaceChildren(...choices); $('simulation-overrides').replaceChildren(...overrideButtons);
    $('simulation-history').replaceChildren(...simulation.trace.slice(-30).map(t => h('li', { class: t.assumption ? 'assumption' : null, title: `${t.file}:${t.line}` }, (t.assumption ? 'Manual · ' : '') + t.message)));
    $('simulation-history').start = Math.max(1, simulation.trace.length - 29);
    renderStateStrip();
  }
  // Fixed-scale snapshots of each variable the route changed, one column per choice.
  function renderStateStrip() {
    stateLog = stateLog.filter(s => s.h <= simulation.history.length);
    const columns = stateLog.slice(-3).map(s => ({ title: s.title, vars: s.vars }));
    const last = columns.at(-1), nowText = JSON.stringify(simulation.variables);
    if (!last || JSON.stringify(last.vars) !== nowText) columns.push({ title: 'Now', vars: simulation.variables });
    const names = [...new Set(columns.flatMap(c => Object.keys(c.vars)))].filter(k => k !== '_return' && new Set(columns.map(c => JSON.stringify(c.vars[k]))).size > 1).slice(0, 14);
    $('state-strip').hidden = !names.length || columns.length < 2;
    if (!names.length) return;
    const lit = v => v === undefined ? '—' : RpySimulator.literal(v);
    $('state-strip').replaceChildren(h('table', {}, h('caption', {}, 'What this route changed'),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, h('span', { class: 'sr' }, 'Variable')), columns.map(c => h('th', { scope: 'col', title: c.title }, clip(c.title, 16))))),
      h('tbody', {}, names.map(name => h('tr', {}, h('th', { scope: 'row' }, name), columns.map((c, i) => h('td', { class: i && JSON.stringify(c.vars[name]) !== JSON.stringify(columns[i - 1].vars[name]) ? 'changed' : null }, clip(lit(c.vars[name]), 12))))))));
  }
  function performSimulation(action, record) {
    try {
      action(); $('simulation-error').hidden = true;
      if (simulation) { stateLog = stateLog.filter(s => s.h <= simulation.history.length); if (record) stateLog.push({ h: simulation.history.length, title: record, vars: JSON.parse(JSON.stringify(simulation.variables)) }); }
      refreshSimulation(); render(false);
      const target = simulation?.pc || simulation?.trace.at(-1)?.id;
      if (target) requestAnimationFrame(() => center(target));
    } catch (error) { $('simulation-error').textContent = error.message; $('simulation-error').hidden = false; $('variables-panel').open = true; }
  }
  $('open-simulation').onclick = () => {
    $('inspector').hidden = true; selected = null; $('simulation').hidden = false; refreshSimulation(false);
    if (simulation?.pc) requestAnimationFrame(() => center(simulation.pc));
  };
  $('close-simulation').onclick = () => { $('simulation').hidden = true; };
  $('start-simulation').onclick = () => performSimulation(() => {
    const label = startLabel(), variables = RpySimulator.edit($('variables').value, initialState.variables);
    simulation = new RpySimulator.Simulation(graph, label, variables);
    stateLog = [{ h: 0, title: 'Start', vars: JSON.parse(JSON.stringify(variables)) }];
    if (initialState.issues.length) simulation.record(simulation.nodes.get(simulation.pc), 'Manual starting state accepted for unresolved initialization', true);
    simulation.run();
    $('variables-panel').open = false;
  });
  $('apply-variables').onclick = () => performSimulation(() => simulation.setVariables($('variables').value), 'Edited');
  $('step-simulation').onclick = () => performSimulation(() => simulation.step());
  $('run-simulation').onclick = () => performSimulation(() => simulation.run());
  $('back-simulation').onclick = () => performSimulation(() => simulation.back());
  $('reset-simulation').onclick = () => resetSimulation();

  // Loading
  function projectTitle(files, example) {
    if (example) return 'The lantern path';
    const folders = files.map(f => f.name.split('/')).filter(p => p.length > 1).map(p => p[0]);
    if (folders.length === files.length && new Set(folders).size === 1) return folders[0] === 'game' ? 'game folder' : folders[0];
    return files.length === 1 ? files[0].name.replace(/\.rpy$/i, '') : `${files.length} story files`;
  }
  function load(files, example = false, { navigate = true } = {}) {
    const parsed = RpyParser.parse(files);
    graph = parsed; index = BranchlightIndex.build(graph, RpyParser);
    closePanels();
    meta = { title: projectTitle(files, example), example };
    $('mode').textContent = 'Example'; $('mode').hidden = !example;
    $('project').textContent = meta.title; document.title = `${meta.title} — Branchlight`;
    $('entry').replaceChildren(new Option('Whole story', ''), ...Object.entries(graph.labels).map(([name, id]) => new Option(name, id)));
    const first = graph.labels.start || Object.values(graph.labels)[0];
    if (first) $('entry').value = first;
    initialState = RpySimulator.initialize(graph); simulation = null; stateLog = [];
    $('variables').value = variableText(initialState.variables); $('simulation-error').hidden = true; refreshSimulation(false);
    views.load(index, meta);
    $('import-message').hidden = true; mapDirty = true;
    if (navigate) go('overview');
  }
  async function readFiles(list, { folder = false } = {}) {
    let files = Array.from(list); const version = ++loadVersion;
    if (!files.length) return;
    // A whole game folder is welcome: keep story scripts, skip translations and everything else.
    if (folder || files.some(f => f.webkitRelativePath)) files = files.filter(f => /\.rpy$/i.test(f.name) && !/(^|\/)tl\//.test(f.webkitRelativePath || ''));
    if (!files.length) { notice('That folder has no .rpy story files. Compiled .rpyc files cannot be read.'); return; }
    const projectFile = files.length === 1 && /\.json$/i.test(files[0].name);
    if (!projectFile && files.some(f => !/\.rpy$/i.test(f.name))) { notice('Choose .rpy source files together, or one project bundle (.json). Compiled .rpyc files cannot be read.'); return; }
    if (files.reduce((sum, f) => sum + f.size, 0) > 12 * 1024 * 1024) { notice('That selection is over 12 MB. Load a smaller group of story files.'); return; }
    try {
      if (projectFile) {
        const text = await files[0].text(); if (version !== loadVersion) return;
        BranchlightProject.open(BranchlightBundle.parse(text)); $('import-message').hidden = true; return;
      }
      const content = await Promise.all(files.map(async f => ({ name: (f.webkitRelativePath || f.name).replace(/^[^/]+\/(?=game\/)/, ''), text: await f.text() })));
      const names = new Set(); for (const f of content) { const base = f.name; let i = 2; while (names.has(f.name)) f.name = `${base} (${i++})`; names.add(f.name); }
      if (version !== loadVersion) return;
      load(content);
    } catch (error) { if (version === loadVersion) notice(`Could not build this map: ${error.message} The previous map is still open.`); }
  }
  document.addEventListener('branchlight:cancel-import', () => { loadVersion++; $('import-message').hidden = true; });

  // Open menu
  const menu = $('open-list'), menuButton = $('open-menu');
  function setMenu(open, focus = true) {
    menu.hidden = !open; menuButton.setAttribute('aria-expanded', String(open));
    if (open && focus) menu.querySelector('[role="menuitem"]').focus();
  }
  menuButton.onclick = () => setMenu(menu.hidden);
  menu.addEventListener('click', e => { if (e.target.closest('[role="menuitem"]')) setMenu(false, false); });
  menu.addEventListener('keydown', e => {
    const items = [...menu.querySelectorAll('[role="menuitem"]')], i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); }
    else if (e.key === 'Escape') { e.stopPropagation(); setMenu(false); menuButton.focus(); }
    else if (e.key === 'Tab') setMenu(false, false);
  });
  document.addEventListener('pointerdown', e => { if (!menu.hidden && !e.target.closest('.menu-wrap')) setMenu(false, false); });
  $('open').onclick = () => $('files').click();
  $('open-bundle').onclick = () => $('bundle-files').click();
  $('open-folder').onclick = () => $('folder').click();
  $('folder').onchange = e => { readFiles(e.target.files, { folder: true }); e.target.value = ''; };
  $('bundle-files').onchange = e => { readFiles(e.target.files); e.target.value = ''; };
  $('files').onchange = e => { readFiles(e.target.files); e.target.value = ''; };
  $('example').onclick = () => { loadVersion++; load(sample.map(f => ({ ...f })), true); };

  $('entry').onchange = () => { closePanels(); resetSimulation(false); render(); };
  $('dialogue').onchange = () => { closePanels(); render(); };
  $('close-detail').onclick = () => { closePanels(); };
  $('zoom-in').onclick = () => pz.zoomBy(1.2); $('zoom-out').onclick = () => pz.zoomBy(1 / 1.2); $('fit').onclick = () => fitMap(false);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !menu.hidden) return;
    if (currentView === 'map' && !$('inspector').hidden) closePanels();
  });
  document.addEventListener('dragenter', e => { if (!Array.from(e.dataTransfer?.types || []).includes('Files')) return; e.preventDefault(); dragDepth++; $('drop-overlay').hidden = false; });
  document.addEventListener('dragover', e => { e.preventDefault(); });
  document.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('drop-overlay').hidden = true; } });
  document.addEventListener('drop', e => { e.preventDefault(); dragDepth = 0; $('drop-overlay').hidden = true; readFiles(e.dataTransfer.files); });
  new ResizeObserver(() => { if (currentView === 'map' && !selected && !simulation) fitMap(); }).observe($('canvas'));

  load(sample.map(f => ({ ...f })), true, { navigate: false });
  showView(location.hash.slice(1) || 'overview');
  // Optional browser agent access uses the same state as the visible controls.
  if (document.modelContext?.registerTool) {
    for (const tool of [{ name: 'read_branch_map', description: 'Read the currently loaded static RenPy branch map, variable index, and problems.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute: () => ({ labels: graph.labels, nodes: graph.nodes, edges: graph.edges, warnings: graph.warnings, variables: index.variables.map(({ name, kind, initial, sets, checks }) => ({ name, kind, initial, changed: sets.map(u => `${u.file}:${u.line}`), checked: checks.map(u => `${u.file}:${u.line}`) })), problems: index.problems }) },
      { name: 'focus_story_label', description: 'Focus the visible diagram on a label in the currently loaded files.', inputSchema: { type: 'object', properties: { label: { type: 'string' } }, required: ['label'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: true }, execute: ({ label }) => { if (!Object.hasOwn(graph.labels, label)) throw new Error('Label is not loaded.'); openLabel(graph.labels[label]); return { focused: label, visibleNodes: view.nodes.length }; } }]) {
      try { Promise.resolve(document.modelContext.registerTool(tool)).catch(() => {}); } catch (_) { /* Optional API. */ }
    }
  }
})();
