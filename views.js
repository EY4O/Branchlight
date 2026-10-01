/* Overview, Variables, and Problems views, plus the layered layout shared with the map. */
(function (root) {
  'use strict';
  const $ = id => document.getElementById(id), NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs = {}, text) { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v); if (text !== undefined) e.textContent = text; return e; }
  function h(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (v === undefined || v === null || v === false) continue; if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); }
    for (const c of children.flat()) if (c !== undefined && c !== null && c !== false) e.append(c instanceof Node ? c : document.createTextNode(c));
    return e;
  }
  const plural = (n, word, many = word + 's') => `${n} ${n === 1 ? word : many}`;
  const clip = (text, max) => text.length > max ? text.slice(0, max - 1) + '…' : text;
  function icon(name, cls = 'icon small') { const s = svg('svg', { class: cls, 'aria-hidden': 'true' }); s.append(svg('use', { href: '#i-' + name })); return s; }

  // Ranked layout: DFS back edges are ignored for ranking, then barycentric sweeps reduce crossings.
  function layout(nodes, edges, { w = 226, h = 96, gapX = 32, gapY = 70, pad = 30 } = {}) {
    const byId = new Map(nodes.map(n => [n.id, n])), outgoing = new Map(nodes.map(n => [n.id, []])), incoming = new Map(nodes.map(n => [n.id, []]));
    for (const e of edges) { outgoing.get(e.from)?.push(e); }
    const color = new Map(), order = [];
    const sorted = [...nodes].sort((a, b) => (a.type !== 'label') - (b.type !== 'label') || (a.order ?? 0) - (b.order ?? 0) || String(a.file).localeCompare(String(b.file)) || a.line - b.line);
    for (const n of sorted) {
      if (color.has(n.id)) continue;
      // Iterative DFS keeps very long scripts from overflowing the call stack.
      const stack = [[n.id, 0]]; color.set(n.id, 1);
      while (stack.length) {
        const top = stack.at(-1), list = outgoing.get(top[0]) || [];
        if (top[1] < list.length) {
          const e = list[top[1]++];
          if (!byId.has(e.to)) continue;
          if (color.get(e.to) === 1) e.back = true; else if (!color.has(e.to)) { color.set(e.to, 1); stack.push([e.to, 0]); }
        } else { color.set(top[0], 2); order.push(top[0]); stack.pop(); }
      }
    }
    for (const e of edges) if (!e.back && byId.has(e.to)) incoming.get(e.to)?.push(e);
    const ranks = new Map(nodes.map(n => [n.id, 0]));
    for (const id of order.reverse()) for (const e of outgoing.get(id) || []) if (!e.back && byId.has(e.to)) ranks.set(e.to, Math.max(ranks.get(e.to), ranks.get(id) + 1));
    const layers = [];
    for (const n of sorted) { n.rank = ranks.get(n.id); (layers[n.rank] ||= []).push(n); }
    const pos = new Map();
    for (const layer of layers) layer?.forEach((n, i) => pos.set(n.id, i));
    for (let sweep = 0; sweep < 4; sweep++) for (let r = 1; r < layers.length; r++) {
      const layer = layers[r] || [];
      const score = n => { const es = incoming.get(n.id); return es.length ? es.reduce((s, e) => s + (pos.get(e.from) || 0), 0) / es.length : pos.get(n.id); };
      const scores = new Map(layer.map(n => [n.id, score(n)]));
      layer.sort((a, b) => scores.get(a.id) - scores.get(b.id)); layer.forEach((n, i) => pos.set(n.id, i));
    }
    const widest = Math.max(1, ...layers.map(l => l?.length || 0)), stepX = w + gapX, stepY = h + gapY;
    for (const layer of layers) for (let i = 0; i < (layer?.length || 0); i++) {
      const n = layer[i]; n.x = pad + ((widest - layer.length) / 2 + i) * stepX; n.y = pad + n.rank * stepY; n.w = w; n.h = h;
    }
    return { nodes, edges, byId, layers: layers.length, stepY, width: widest * stepX - gapX + pad * 2, height: Math.max(1, layers.length) * stepY - gapY + pad * 2 };
  }
  function edgePath(a, b, i = 0, back = false) {
    const sx = a.x + a.w / 2, sy = a.y + a.h, ex = b.x + b.w / 2, ey = b.y, mid = (sy + ey) / 2;
    if (back || ey <= sy) {
      const side = Math.max(a.x + a.w, b.x + b.w) + 22 + (i % 4) * 9;
      return { d: `M${a.x + a.w},${a.y + a.h / 2} C${side},${a.y + a.h / 2} ${side},${b.y + b.h / 2} ${b.x + b.w},${b.y + b.h / 2}`, lx: side, ly: (a.y + b.y + b.h) / 2 };
    }
    return { d: `M${sx},${sy} C${sx},${mid} ${ex},${mid} ${ex},${ey}`, lx: (sx + ex) / 2 + 8, ly: mid - 5 };
  }

  function barcode(v, files, total) {
    const s = svg('svg', { class: 'barcode', viewBox: '0 0 1000 22', preserveAspectRatio: 'none', role: 'img', 'aria-label': `${v.name}: changed ${plural(v.sets.length, 'time')}, checked ${plural(v.checks.length, 'time')}` });
    for (const f of files) {
      const x1 = f.offset / total * 1000, x2 = (f.offset + f.lines) / total * 1000;
      s.append(svg('line', { class: 'base', x1: x1 + (x1 ? 3 : 0), x2: Math.max(x1 + 1, x2 - 3), y1: 11, y2: 11, style: `stroke:var(--f${f.color})` }));
    }
    for (const u of v.sets) { const x = (u.position * 1000).toFixed(1); s.append(svg('line', { class: 'set', x1: x, x2: x, y1: 1, y2: 9.5 })); }
    for (const u of v.checks) { const x = (u.position * 1000).toFixed(1); s.append(svg('line', { class: 'check', x1: x, x2: x, y1: 12.5, y2: 21 })); }
    return s;
  }
  const kindNames = { flag: 'flag', number: 'number', text: 'text', collection: 'collection', empty: 'None', other: 'value' };

  class Views {
    constructor(handlers) {
      this.handlers = handlers; this.varKind = 'all'; this.varQuery = ''; this.openVars = new Set(); this.highlight = '';
      const layer = $('skeleton-svg').querySelector('.pan-layer');
      this.skeletonPan = new root.PanZoom($('skeleton'), layer, { min: .12, max: 1.6 });
      $('variable-search').addEventListener('input', e => { this.varQuery = e.target.value.trim().toLowerCase(); this.renderVariables(); });
      new ResizeObserver(() => { if (this.skeleton && !this.skeletonTouched) this.fitSkeleton(); }).observe($('skeleton'));
      $('skeleton').addEventListener('pointerdown', () => { this.skeletonTouched = true; });
      document.querySelector('.ledger').addEventListener('scroll', () => this.checkOverflow(), { passive: true });
      new ResizeObserver(() => this.checkOverflow()).observe(document.querySelector('.ledger'));
      $('skeleton').addEventListener('wheel', () => { this.skeletonTouched = true; }, { passive: true });
    }
    load(index, meta) { this.index = index; this.meta = meta; this.openVars.clear(); this.highlight = ''; this.skeletonTouched = false; this.renderOverview(); this.renderVariableKinds(); this.renderVariables(); this.renderProblems(); }
    fileColor(name) { return this.index.files.find(f => f.name === name)?.color ?? 0; }

    renderOverview() {
      const ix = this.index, total = ix.totalLines;
      // Folders
      // A folder's tab grows with its share of the story's labels, so the biggest files read first.
      const most = Math.max(1, ...ix.files.map(f => f.labels));
      $('file-list').replaceChildren(...ix.files.map(f => h('li', {}, h('button', { class: 'folder', 'data-f': f.color, style: `--share:${(f.labels / most).toFixed(3)}`, 'aria-pressed': String(this.highlight === f.name), title: 'Highlight this file in the skeleton', onclick: () => { this.highlight = this.highlight === f.name ? '' : f.name; this.renderOverview(); } },
        h('span', { class: 'fname' }, f.name), f.problems ? h('span', { class: 'fprob', title: plural(f.problems, 'problem') }, String(f.problems)) : h('span'),
        h('span', { class: 'fmeta' }, `${plural(f.labels, 'label')} · ${plural(f.choices, 'choice')} · ${f.lines.toLocaleString()} lines`)))));
      // Collection label
      const errors = ix.problems.filter(p => p.severity === 'error').length, gates = ix.labels.reduce((s, l) => s + l.gates, 0), choices = ix.labels.reduce((s, l) => s + l.choices, 0);
      const rows = [['Files', ix.files.length], ['Labels', ix.labels.filter(l => l.type === 'label').length], ['Choices', choices], ['Gates', gates], ['Variables', ix.variables.length], ['Characters', ix.characters.length], ['Problems', ix.problems.length], ['To fix', errors]];
      $('collection-label').replaceChildren(h('div', { class: 'label-title' }, this.meta.title, h('span', { class: 'label-sub' }, ix.start ? 'starts at start' : 'no start label')), ...rows.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, typeof v === 'number' ? v.toLocaleString() : v)]));
      this.renderSkeleton();
      // Ledger
      const top = [...ix.variables].sort((a, b) => (b.sets.length + b.checks.length) - (a.sets.length + a.checks.length)).slice(0, 6);
      $('ledger-var-count').textContent = ix.variables.length;
      $('ledger-variables').replaceChildren(...(top.length ? top.map(v => h('li', {}, h('button', { class: 'mini-var', onclick: () => this.handlers.showVariable(v.name) },
        h('span', { class: 'vname' }, v.name), h('span', { class: 'vmeta' }, `${v.sets.length} changed · ${v.checks.length} checked`), barcode(v, ix.files, total)))) : [h('li', { class: 'all-clear' }, 'No variables found. default, define, and $ assignments appear here.')]));
      $('ledger-problem-count').textContent = ix.problems.length;
      const slips = ix.problems.slice(0, 3).map(p => this.slip(p));
      if (ix.problems.length > 3) slips.push(h('li', { class: 'ledger-more' }, h('a', { href: '#problems', class: 'link' }, `${ix.problems.length - 3} more on the Problems tab`, icon('arrow'))));
      $('ledger-slips').replaceChildren(...(slips.length ? slips : [h('li', { class: 'all-clear' }, 'No problems found in this static reading.')]));
      requestAnimationFrame(() => this.checkOverflow());
      $('tab-variables').textContent = ix.variables.length;
      $('tab-problems').textContent = ix.problems.length;
      $('tab-problems').classList.toggle('alert', errors > 0);
    }

    renderSkeleton() {
      const ix = this.index, layer = $('skeleton-svg').querySelector('.pan-layer');
      const nodes = ix.labels.map((l, i) => ({ ...l, order: i, title: l.name }));
      const edges = ix.links.map(e => ({ ...e }));
      const view = layout(nodes, edges, { w: 178, h: 52, gapX: 26, gapY: 46, pad: 24 });
      this.skeleton = view;
      const edgeLayer = svg('g'), nodeLayer = svg('g');
      const hl = this.highlight;
      view.edges.forEach((e, i) => {
        const a = view.byId.get(e.from), b = view.byId.get(e.to); if (!a || !b) return;
        const p = edgePath(a, b, i, e.back), dim = hl && a.file !== hl && b.file !== hl;
        const path = svg('path', { d: p.d, class: `edge ${e.kind === 'call' ? 'call' : e.kind === 'flow' ? 'flow-through' : ''}${dim ? ' dim' : ''}`, style: `marker-end:url(#${e.kind === 'call' ? 'arrow-c' : 'arrow-s'})` });
        path.append(svg('title', {}, `${a.name} ${e.kind === 'call' ? 'calls' : e.kind === 'flow' ? 'falls through to' : 'jumps to'} ${b.name}`));
        edgeLayer.append(path);
      });
      for (const n of view.nodes) {
        const missing = n.type === 'external';
        const g = svg('g', { class: `s-node${missing ? ' external' : ''}${n.reached ? '' : ' unreached'}${hl && n.file !== hl ? ' dim' : ''}`, transform: `translate(${n.x},${n.y})`, 'data-f': this.fileColor(n.file), tabindex: 0, role: 'button', 'aria-label': `${n.name}${missing ? ', missing label' : ''}, ${plural(n.choices, 'choice')}. Open in map.` });
        if (!missing) g.append(svg('rect', { class: 'tab', x: 0, y: -5, width: 30, height: 6, rx: 1.5, style: 'fill:var(--f)' }));
        g.append(svg('rect', { class: 'body', width: n.w, height: n.h, rx: 3 }));
        g.append(svg('text', { x: 12, y: 21, class: 'node-title' }, clip(n.name, n.start ? 15 : 20)));
        const meta = missing ? 'Missing label' : [n.choices && plural(n.choices, 'choice'), n.gates && plural(n.gates, 'gate'), !n.choices && !n.gates && (n.endings ? 'Ends route' : 'Passes through')].filter(Boolean).join(' · ');
        g.append(svg('text', { x: 12, y: 39, class: 'node-meta' }, meta));
        if (n.start) { g.append(svg('circle', { class: 'start-mark', cx: n.w - 40, cy: 17, r: 3 })); g.append(svg('text', { x: n.w - 33, y: 21, class: 'start-text' }, 'start')); }
        g.append(svg('title', {}, `${n.name}\n${n.file || ''}${n.line ? ':' + n.line : ''}${n.reached ? '' : '\nNot reached from start'}${n.variables?.size ? '\nUses ' + [...n.variables].join(', ') : ''}`));
        const open = () => { if (!this.skeletonPan.moved) this.handlers.openLabel(n.id); };
        g.addEventListener('click', open);
        g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.handlers.openLabel(n.id); } });
        nodeLayer.append(g);
      }
      layer.replaceChildren(edgeLayer, nodeLayer);
      this.skeletonPan.content = { x: 0, y: -6, width: view.width, height: view.height + 6 };
      if (!this.skeletonTouched) requestAnimationFrame(() => this.fitSkeleton());
    }
    // The collection label sits in the sheet's corner, so the skeleton fits beside it when there is room.
    fitSkeleton() {
      const pan = this.skeletonPan; pan.fit({ padding: 28, maxScale: 1 });
      // On a phone the whole skeleton would shrink past reading size: keep it legible and start at the top.
      if (pan.k < .6) { const first = this.skeleton.nodes.find(n => n.start) || this.skeleton.nodes[0]; pan.k = .6; pan.x = pan.width / 2 - (first.x + first.w / 2) * pan.k; pan.y = 20 - pan.content.y * pan.k; pan.apply(); }
    }
    checkOverflow() { const l = document.querySelector('.ledger'); l.classList.toggle('overflowing', l.scrollHeight > l.clientHeight + 4 && l.scrollTop + l.clientHeight < l.scrollHeight - 4); }

    slip(p, full = false) {
      const ref = p.file ? `${p.file}${p.line ? ':' + p.line : ''}${p.label ? ' · ' + p.label : ''}` : '';
      return h('li', { class: `slip ${p.severity}` },
        h('div', { class: 'slip-top' }, h('span', { class: 'stamp' }, p.category)),
        h('p', {}, p.message),
        (ref || p.node) && h('div', { class: 'ref' }, p.file && h('span', { class: 'ftab', 'data-f': this.fileColor(p.file) }), h('span', {}, ref),
          p.node && h('button', { class: 'link', onclick: () => this.handlers.showNode(p.node) }, 'Show on map', icon('arrow'))));
    }

    renderVariableKinds() {
      const counts = { all: this.index.variables.length, flag: 0, number: 0, text: 0, other: 0 };
      for (const v of this.index.variables) counts[['flag', 'number', 'text'].includes(v.kind) ? v.kind : 'other']++;
      const names = { all: 'All', flag: 'Flags', number: 'Numbers', text: 'Text', other: 'Other' };
      if (!counts[this.varKind] && this.varKind !== 'all') this.varKind = 'all';
      $('variable-kinds').replaceChildren(...Object.keys(names).filter(k => k === 'all' || counts[k]).map(k => h('button', { role: 'radio', 'aria-checked': String(this.varKind === k), onclick: () => { this.varKind = k; this.renderVariableKinds(); this.renderVariables(); } }, names[k], h('span', { class: 'n' }, String(counts[k])))));
    }

    renderVariables() {
      const ix = this.index; if (!ix) return;
      const list = ix.variables.filter(v => (this.varKind === 'all' || (this.varKind === 'other' ? !['flag', 'number', 'text'].includes(v.kind) : v.kind === this.varKind)) && (!this.varQuery || v.name.toLowerCase().includes(this.varQuery)));
      const numbers = ix.variables.filter(v => v.kind === 'number').length, flags = ix.variables.filter(v => v.kind === 'flag').length;
      $('variables-summary').textContent = ix.variables.length ? `${plural(ix.variables.length, 'variable')}: ${plural(numbers, 'number')} (stats and relationships), ${plural(flags, 'flag')}, ${ix.variables.length - numbers - flags} other. Grouped by shared name prefix.` : 'No variables found.';
      const rows = []; let group = null;
      for (const v of list) {
        if (v.group !== group) {
          group = v.group;
          const members = list.filter(x => x.group === group).length;
          rows.push(h('div', { class: 'var-group', role: 'row' }, h('h3', { role: 'cell' }, group ? group + '_' : 'Ungrouped'), h('span', {}, plural(members, 'variable'))));
        }
        const open = this.openVars.has(v.name), id = 'var-' + v.name.replace(/\W/g, '-');
        const toggle = () => { if (this.openVars.has(v.name)) this.openVars.delete(v.name); else this.openVars.add(v.name); this.renderVariables(); };
        const row = h('div', { class: `var-row var-item${open ? ' open' : ''}`, role: 'row', id, onclick: e => { if (!e.target.closest('button')) toggle(); } },
          h('span', { role: 'cell' }, h('button', { class: 'var-name', 'aria-expanded': String(open), 'aria-controls': id + '-detail', onclick: toggle }, h('span', {}, v.name), h('span', { class: 'kind' }, kindNames[v.kind] || 'value'))),
          h('span', { role: 'cell', class: `var-initial${v.declared ? '' : ' none'}`, title: v.initial || '' }, v.declared ? clip(v.initial, 28) : 'No default'),
          h('span', { role: 'cell', class: `num${v.sets.length ? '' : ' zero'}`, 'data-label': 'changed' }, String(v.sets.length)),
          h('span', { role: 'cell', class: `num${v.checks.length ? '' : ' zero'}`, 'data-label': 'checked' }, String(v.checks.length)),
          h('span', { role: 'cell' }, barcode(v, ix.files, ix.totalLines)));
        rows.push(row);
        if (open) rows.push(h('div', { class: 'var-detail', id: id + '-detail', role: 'row' }, this.uses(v.defs.length ? 'Declared and changed' : 'Changed', [...v.defs.map(d => ({ ...d, op: d.how })), ...v.sets]), this.uses('Checked', v.checks)));
      }
      $('variable-rows').replaceChildren(...rows);
      $('variables-empty').hidden = !!list.length;
      $('variables-empty').textContent = ix.variables.length ? 'No variables match this filter.' : 'No variables found. Declare them with default or define, or assign them with $.';
    }
    uses(title, items) {
      return h('div', { class: 'uses', role: 'cell' }, h('h4', {}, `${title} · ${items.length}`),
        items.length ? items.slice(0, 60).map(u => h('button', { onclick: () => this.handlers.showUse(u), title: 'Show this line on the map' },
          h('span', { class: 'ftab', 'data-f': this.fileColor(u.file) }), h('span', { class: 'where' }, `${u.file}:${u.line}`), h('span', { class: 'in-label' }, u.label || (u.how ? u.how : '')),
          h('code', {}, u.text))) : h('p', { class: 'none' }, title === 'Checked' ? 'No condition reads this variable.' : 'Never changed.'),
        items.length > 60 ? h('p', { class: 'none' }, `${items.length - 60} more not shown.`) : null);
    }
    revealVariable(name) {
      this.varKind = 'all'; this.varQuery = ''; $('variable-search').value = ''; this.openVars.add(name);
      this.renderVariableKinds(); this.renderVariables();
      requestAnimationFrame(() => { const row = document.getElementById('var-' + name.replace(/\W/g, '-')); row?.scrollIntoView({ block: 'center' }); row?.querySelector('.var-name')?.focus({ preventScroll: true }); });
    }

    renderProblems() {
      const groups = [['error', 'Needs fixing', 'These break a route: missing destinations, duplicate labels, and variables nothing ever sets.'], ['warning', 'Worth checking', 'Labels nothing reaches, routes that run off a file, assignments without a default, and navigation the map cannot follow.'], ['note', 'For your information', 'Variables nothing reads, and code this static reading skips.']];
      const sections = groups.map(([sev, title, text]) => { const list = this.index.problems.filter(p => p.severity === sev); return list.length ? h('section', { class: 'problem-group' }, h('h3', {}, title, h('span', {}, String(list.length))), h('p', { class: 'note' }, text), h('ol', { class: 'slips' }, list.slice(0, 300).map(p => this.slip(p, true)))) : null; }).filter(Boolean);
      $('problem-groups').replaceChildren(...(sections.length ? sections : [h('p', { class: 'empty-note' }, 'No problems found. This is a static reading, so playtest and run Ren’Py’s lint as well.')]));
    }
  }
  root.BranchlightViews = { Views, layout, edgePath, h, svg, icon, plural, clip };
})(window);
