/* Play mode: read the story line by line as a script page, with a minimap of where you are. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const { layout, edgePath, h, svg: el, icon, clip } = BranchlightViews;
  const app = () => window.Branchlight;
  const directions = /^(?:scene|show|hide|with|play|stop|queue|voice|pause|window|nvl)\b/;
  let sim = null, startVars = {}, lastVars = {}, changed = new Set(), pz, view = null, viewKey = '', staticEdges = new Set(), byId = new Map(), characters = new Map(), error = '';
  const copy = value => JSON.parse(JSON.stringify(value));

  // A say statement: an optional speaker (a character variable or a quoted name) and the quoted line.
  function parseSay(text) {
    const m = text.match(/^(?:([\p{L}_][\p{L}\p{N}_.]*)(?:\s+[\p{L}\p{N}_-]+)*\s+|(["'])(.+?)\2\s+)?[rRuU]?("""|'''|"|')([\s\S]*)\4(?:\s+(?:with\s+\S+|nointeract|\([^)]*\)))*\s*$/u);
    if (!m || /^(?:scene|show|hide|play|stop|queue|voice|pause|window|jump|call|return|pass|menu|label|define|default)$/.test(m[1] || '')) return null;
    const who = m[1] ? characters.get(m[1]) || { display: m[1] } : m[3] ? { display: m[3] } : null;
    return { who, text: m[5].replace(/\\(["'\\])/g, '$1').replace(/\\n/g, ' ') };
  }
  // Ren'Py text tags are dropped and [name] interpolation uses the current values.
  function render(text) {
    return text.replace(/\{[^{}]*\}/g, '').replace(/\[([\w.]+)(?:![\w]+)?\]/g, (all, name) => Object.hasOwn(sim.variables, name) ? String(RpySimulator.literal(sim.variables[name])).replace(/^"(.*)"$/, '$1') : all);
  }
  function linesFrom(trace) {
    const lines = [];
    for (const t of trace) {
      const n = byId.get(t.id);
      if (t.message.startsWith('Choose: ')) lines.push({ type: 'pick', text: t.message.slice(8), manual: t.assumption });
      else if (n?.type === 'label' && t.message.startsWith('Enter ')) lines.push({ type: 'scene', text: n.title });
      else if (t.message === 'Route finished') lines.push({ type: 'end', text: 'End of route' });
      else if (t.assumption) lines.push({ type: 'note', manual: true, text: t.message });
      else if (n?.type === 'passage') {
        const say = parseSay(t.message);
        if (say) lines.push({ type: say.who ? 'say' : 'narration', who: say.who, text: say.text, id: t.id });
        else if (/^pass\s*$/.test(t.message)) continue;
        else lines.push({ type: 'note', code: !directions.test(t.message), text: t.message.replace(/^\$\s*/, '') });
      } else if (n?.type === 'condition') lines.push({ type: 'note', code: true, text: t.message });
    }
    return lines;
  }

  // Advancing runs the story until the next spoken line or decision; Back undoes one advance.
  function advance(checkpoint = true) {
    if (!sim || !['ready', 'limit'].includes(sim.status)) return;
    if (checkpoint) sim.checkpoint();
    const before = sim.trace.length;
    for (let i = 0; i < 400; i++) {
      sim.internalStep();
      if (sim.status !== 'ready') break;
      const t = sim.trace.at(-1);
      if (sim.trace.length > before && byId.get(t.id)?.type === 'passage' && parseSay(t.message)) break;
    }
    settle();
  }
  // Keyboard focus returns to the page after every action, so Space keeps reading instead of pressing a stale button.
  const focusPage = () => $('play-page').focus({ preventScroll: true });
  function act(fn) { try { error = ''; fn(); advance(false); } catch (e) { error = e.message; settle(); } focusPage(); }
  function settle() {
    changed = new Set(Object.keys(sim.variables).filter(k => JSON.stringify(sim.variables[k]) !== JSON.stringify(lastVars[k])));
    lastVars = copy(sim.variables);
    paint();
  }
  function start() {
    const g = app().graph, label = Object.keys(g.labels).find(k => g.labels[k] === $('play-entry').value);
    try {
      const variables = RpySimulator.edit($('play-variables').value, app().initialState.variables);
      sim = new RpySimulator.Simulation(g, label, variables);
      startVars = copy(sim.variables); lastVars = copy(sim.variables); error = '';
      if (app().initialState.issues.length) sim.record(sim.nodes.get(sim.pc), 'Manual starting state accepted for unresolved initialization', true);
      $('play-values').open = false;
      advance(false); focusPage();
    } catch (e) { error = e.message; paint(); }
  }

  function paint() {
    $('play-undo').disabled = !sim?.history.length;
    $('play-start').querySelector('span').textContent = sim ? 'Restart' : 'Start';
    renderStrip(); renderPage(); renderMap();
  }
  // Only variables this playthrough has changed; the last advance's changes are marked.
  function renderStrip() {
    if (!sim) return $('play-state').replaceChildren(h('span', { class: 'note' }, 'Changed variables appear here as you play.'));
    const names = Object.keys(sim.variables).filter(k => k !== '_return' && JSON.stringify(sim.variables[k]) !== JSON.stringify(startVars[k]));
    $('play-state').replaceChildren(...(names.length ? names.map(k => h('button', { class: `var-chip${changed.has(k) ? ' fresh' : ''}`, title: `Started as ${startVars[k] === undefined ? 'unset' : RpySimulator.literal(startVars[k])}. Open in Variables.`, onclick: () => app().showVariable(k) },
      h('span', {}, k), h('b', {}, clip(String(RpySimulator.literal(sim.variables[k])), 18)))) : [h('span', { class: 'note' }, 'No variables changed yet.')]));
  }
  function renderPage() {
    const list = $('play-lines'), prompt = $('play-prompt');
    if (!sim) {
      list.replaceChildren(h('li', { class: 'l-empty' }, h('p', {}, 'Choose where to start, then press Start to read the story as a player would.'), h('p', { class: 'note' }, 'Space or Enter continues · number keys pick a choice · Backspace goes back. Choices you can’t take are shown with what they need.')));
      prompt.replaceChildren(); return;
    }
    const notes = $('play-notes').checked, lines = linesFrom(sim.trace).filter(l => notes || l.type !== 'note' || l.manual);
    const lastSpoken = lines.map(l => l.type === 'say' || l.type === 'narration').lastIndexOf(true);
    list.replaceChildren(...lines.slice(-160).map((l, i, shown) => {
      const at = lines.length - shown.length + i, cls = `l-${l.type}${at === lastSpoken ? ' current' : at < lastSpoken ? ' past' : ''}`;
      if (l.type === 'scene') return h('li', { class: cls }, l.text);
      if (l.type === 'say') return h('li', { class: cls }, h('span', { class: 'who', style: l.who.color ? `--who:${l.who.color}` : null }, l.who.display), h('p', {}, render(l.text)));
      if (l.type === 'narration') return h('li', { class: cls }, h('p', {}, render(l.text)));
      if (l.type === 'pick') return h('li', { class: cls }, icon('arrow'), h('span', {}, l.text), l.manual ? h('span', { class: 'manual' }, 'manual') : null);
      if (l.type === 'end') return h('li', { class: cls }, l.text);
      return h('li', { class: `${cls}${l.code ? ' code' : ''}${l.manual ? ' manual' : ''}` }, l.text);
    }));
    prompt.replaceChildren(...promptParts());
    // Keep the newest line in view: wait for layout, then jump to the end of the page.
    requestAnimationFrame(() => requestAnimationFrame(() => { const page = $('play-page'); page.scrollTop = page.scrollHeight; }));
  }
  function promptParts() {
    const n = sim.nodes.get(sim.pc), parts = [];
    if (error) parts.push(h('p', { class: 'play-alert' }, error));
    if (n?.type === 'menu' && ['choice', 'blocked'].includes(sim.status)) {
      const custom = n.menuSet || /\b(?:screen|nvl)\s*=/.test(n.statement || '');
      if (n.title && n.title !== 'Make a choice') parts.push(h('p', { class: 'menu-caption' }, render(n.title)));
      let number = 0;
      parts.push(h('ol', { class: 'play-choices' }, sim.menu().map(c => {
        const open = c.enabled && !custom && !c.unknown, key = open ? ++number : null;
        const need = c.unknown ? c.reason : custom ? 'This menu uses a custom screen or set, so Branchlight can’t tell which choices show.' : c.condition ? `Needs ${c.condition}` : '';
        return h('li', { class: open ? 'open' : 'locked' },
          h('button', { disabled: !open, 'data-key': key, onclick: () => act(() => sim.choose(c.id, false, false)) }, h('span', { class: 'key' }, key ? String(key) : ''), h('span', {}, c.title)),
          !open ? h('div', { class: 'why' }, h('code', {}, need), h('button', { class: 'link', onclick: () => act(() => sim.choose(c.id, true, false)) }, 'Choose anyway')) : null);
      })));
      return parts;
    }
    if (sim.status === 'blocked') {
      parts.push(h('p', { class: 'play-alert' }, sim.problem || 'Branchlight can’t run this line.'));
      const row = h('div', { class: 'play-actions' });
      if (n?.type === 'condition') row.append(h('button', { class: 'button', onclick: () => act(() => sim.resolveCondition(true, false)) }, `Assume ${clip(n.title, 30)} is true`), h('button', { class: 'button', onclick: () => act(() => sim.resolveCondition(false, false)) }, 'Assume false'));
      if (['passage', 'unsupported', 'call'].includes(n?.type)) row.append(h('button', { class: 'button', onclick: () => act(() => sim.skip(false)) }, 'Skip this line'));
      row.append(h('button', { class: 'link', onclick: () => app().showNode(sim.pc) }, 'Show on map'));
      parts.push(row); return parts;
    }
    if (sim.status === 'ended') return [...parts, h('div', { class: 'play-end' }, h('p', {}, `The route ends in ${sim.lastLabel}.`), h('button', { class: 'button action', onclick: start }, icon('reset', 'icon'), 'Play again'))];
    if (sim.status === 'boundary') return [...parts, h('p', { class: 'play-alert' }, 'This file ends here. Ren’Py would carry on into the next file, which Branchlight doesn’t guess.')];
    return [...parts, h('button', { class: 'continue', onclick: () => advance() }, 'Continue', h('kbd', {}, 'Space'))];
  }

  // Minimap: structure only, the route lit, and the camera following the current position.
  function renderMap() {
    const g = app().graph, entry = $('play-entry').value;
    const extras = (sim?.traversed || []).filter(([a, b]) => !staticEdges.has(a + '>' + b)).map(p => p.join('>')).join(',');
    if (!view || viewKey !== entry + '|' + extras) {
      const { nodes, edges } = app().visibleGraph({ entry, sim, dialogue: false, jumps: false });
      view = layout(nodes, edges, { w: 168, h: 42, gapX: 18, gapY: 34, pad: 20 }); viewKey = entry + '|' + extras;
      pz.content = { x: 0, y: 0, width: view.width, height: view.height };
    }
    const visited = new Set(sim?.trace.map(t => t.id) || []), walked = new Set(sim?.traversed.map(p => p.join('>')) || []);
    const current = sim && (view.byId.has(sim.pc) ? sim.pc : [...sim.trace].reverse().find(t => view.byId.has(t.id))?.id);
    const edges = el('g'), nodes = el('g');
    view.edges.forEach((e, i) => {
      const a = view.byId.get(e.from), b = view.byId.get(e.to); if (!a || !b) return;
      const lit = sim && e.path?.every(p => walked.has(p.join('>')));
      edges.append(el('path', { d: edgePath(a, b, i, e.back).d, class: `edge ${e.kind}${lit ? ' traversed' : ''}`, style: `marker-end:url(#${lit ? 'arrow-p-route' : 'arrow-p'})` }));
    });
    for (const n of view.nodes) {
      const node = el('g', { class: `node mini ${n.type}${n.dynamic ? ' dynamic' : ''}${visited.has(n.id) ? ' visited' : ''}${n.id === current ? ' current' : ''}${sim && !visited.has(n.id) && n.id !== current ? ' sim-unvisited' : ''}`, transform: `translate(${n.x},${n.y})`, 'data-f': app().index.files.find(f => f.name === n.file)?.color ?? 0 });
      node.append(el('rect', { class: 'halo', x: -4, y: -4, width: n.w + 8, height: n.h + 8, rx: 6 }));
      if (n.type === 'label') node.append(el('rect', { class: 'tab', x: 0, y: -4, width: 26, height: 5, rx: 1.5, style: 'fill:var(--f)' }));
      node.append(el('rect', { class: 'body', width: n.w, height: n.h, rx: n.type === 'return' ? 16 : 3 }));
      node.append(el('text', { x: 10, y: 26, class: 'node-title' }, clip(n.type === 'condition' ? 'if ' + n.title : n.title, 24)));
      node.append(el('title', {}, `${app().kindOf(n)}: ${n.title}`));
      nodes.append(node);
    }
    $('play-viewport').replaceChildren(edges, nodes);
    follow(380);
  }
  function follow(ms) {
    const id = sim && (view?.byId.has(sim.pc) ? sim.pc : [...sim.trace].reverse().find(t => view?.byId.has(t.id))?.id), target = id && view.byId.get(id);
    if (target) pz.glide(pz.centerTarget(target.x + target.w / 2, target.y + target.h / 2, Math.max(.7, Math.min(pz.k, 1.1))), ms);
    else if (view) pz.fit({ padding: 20, maxScale: 1 });
  }

  function load() {
    const g = app().graph, index = app().index;
    byId = new Map(g.nodes.map(n => [n.id, n])); staticEdges = new Set(g.edges.map(e => e.from + '>' + e.to));
    characters = new Map(index.characters.map(c => [c.name, c]));
    $('play-entry').replaceChildren(...Object.entries(g.labels).map(([name, id]) => new Option(name, id)));
    if (g.labels.start) $('play-entry').value = g.labels.start;
    $('play-variables').value = Object.entries(app().initialState.variables).map(([k, v]) => `${k} = ${RpySimulator.literal(v)}`).join('\n');
    sim = null; view = null; error = ''; changed = new Set();
    if (!$('view-play').hidden) paint();
  }
  function shown() { requestAnimationFrame(() => { paint(); if (!sim) pz.fit({ padding: 20, maxScale: 1 }); }); }

  pz = new PanZoom($('play-canvas'), $('play-viewport'), { min: .15, max: 1.6 });
  // When the panes resize (fonts loading, a rotated phone), recentre on the current position.
  new ResizeObserver(() => { if (!$('view-play').hidden) follow(0); }).observe($('play-canvas'));
  $('play-start').onclick = start;
  $('play-undo').onclick = () => { if (sim?.history.length) { sim.back(); error = ''; settle(); } };
  $('play-notes').onchange = () => sim && renderPage();
  $('play-entry').onchange = () => { sim = null; view = null; error = ''; paint(); requestAnimationFrame(() => pz.fit({ padding: 20, maxScale: 1 })); };
  document.addEventListener('keydown', e => {
    const target = e.target instanceof Element ? e.target : document.body;
    if ($('view-play').hidden || e.metaKey || e.ctrlKey || e.altKey || target.closest('input, textarea, select, summary')) return;
    if (e.key === 'Backspace') { e.preventDefault(); $('play-undo').click(); return; }
    if (!sim) return;
    if ((e.key === ' ' || e.key === 'Enter') && !target.closest('button')) { e.preventDefault(); advance(); return; }
    if (/^[1-9]$/.test(e.key)) document.querySelector(`#play-prompt button[data-key="${e.key}"]`)?.click();
  });
  window.BranchlightPlay = { load, shown };
})();
