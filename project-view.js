(function () {
  'use strict';
  const $ = id => document.getElementById(id), NS = 'http://www.w3.org/2000/svg';
  const statusNames = { available: 'Available', blocked: 'Blocked', completed: 'Completed', excluded: 'Other campaign', unknown: 'Unknown' };
  let bundle, selected, current, zoom = 1, mapWidth = 800, mapHeight = 600;
  function element(tag, className, text) { const e = document.createElement(tag); if (className) e.className = className; if (text !== undefined) e.textContent = text; return e; }
  function svg(tag, attrs, text) { const e = document.createElementNS(NS, tag); for (const [key, value] of Object.entries(attrs)) e.setAttribute(key, value); if (text !== undefined) e.textContent = text; return e; }
  // Script files and bundles coexist; loading scripts keeps the bundle available on its own tab.
  function close() {}
  function open(value) {
    // Validate completely before changing the currently visible project.
    BranchlightBundle.validate(value); bundle = value; selected = null;
    $('bundle-title').textContent = bundle.project.title; $('bundle-description').textContent = bundle.project.description || 'Exported event map and checkpoints.';
    $('bundle-campaign').replaceChildren(...bundle.campaigns.map(c => new Option(c.title, c.id)));
    $('tab-checkpoints').hidden = false; window.Branchlight?.showView('checkpoints');
    const metadata = [bundle.project.revision && 'Revision ' + bundle.project.revision, bundle.project.exportedAt && 'Exported ' + new Date(bundle.project.exportedAt).toLocaleString()].filter(Boolean);
    $('bundle-provenance').textContent = metadata.join(' · ') || 'No revision or export time provided.';
    campaignChanged();
  }
  function campaignChanged() {
    const campaign = $('bundle-campaign').value;
    $('bundle-checkpoint').replaceChildren(...bundle.checkpoints.filter(c => c.campaign === campaign).map(c => new Option(c.title, c.id)));
    const groups = [...new Set(bundle.events.filter(e => e.campaigns.includes(campaign)).map(e => e.group))];
    $('bundle-group').replaceChildren(new Option('All groups', ''), ...groups.map(g => new Option(g, g)));
    selected = null; update(true);
  }
  function update(fit = false) {
    current = BranchlightBundle.view(bundle, $('bundle-campaign').value, $('bundle-checkpoint').value, $('bundle-group').value);
    const checkpoint = current.checkpoint;
    $('checkpoint-kind').textContent = checkpoint.kind === 'scenario' ? 'Hypothetical scenario' : 'Recorded checkpoint';
    $('checkpoint-kind').className = 'tag ' + checkpoint.kind;
    $('checkpoint-description').textContent = checkpoint.description || '';
    $('checkpoint-summary').replaceChildren();
    for (const item of checkpoint.summary) $('checkpoint-summary').append(element('dt', '', item.label), element('dd', '', item.value));
    $('checkpoint-state').textContent = JSON.stringify(checkpoint.state, null, 2);
    $('bundle-counts').textContent = `${current.events.length} events · ${current.events.filter(e => checkpoint.events[e.id].status === 'available').length} available`;
    if (!current.events.some(e => e.id === selected)) selected = (current.events.find(e => checkpoint.events[e.id].status === 'available') || current.events[0])?.id;
    draw(); details(); if (fit) requestAnimationFrame(() => fitMap(true));
  }
  function lines(text, width = 26) {
    const words = text.split(/\s+/), rows = []; let row = '';
    for (const word of words) { if ((row + ' ' + word).trim().length > width && row) { rows.push(row); row = word; } else row = (row + ' ' + word).trim(); }
    if (row) rows.push(row);
    return rows.slice(0, 2).map((r, i) => r.length > width ? r.slice(0, width - 1) + '…' : i === 1 && rows.length > 2 ? r + '…' : r);
  }
  function draw() {
    const map = $('bundle-map'); map.replaceChildren();
    const defs = svg('defs', {}), marker = svg('marker', { id: 'bundle-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }); marker.append(svg('path', { d: 'M0 1.5L9 5 0 8.5z' })); defs.append(marker); map.append(defs);
    const groups = [...new Set(current.events.map(e => e.group))], positions = new Map();
    const largest = Math.max(1, ...groups.map(group => current.events.filter(e => e.group === group).length));
    mapWidth = Math.max(290, groups.length * 290); mapHeight = largest * 132 + 75;
    map.setAttribute('viewBox', `0 0 ${mapWidth} ${mapHeight}`);
    for (let col = 0; col < groups.length; col++) {
      const title = svg('text', { x: col * 290 + 26, y: 32, class: 'bundle-group-heading' }, groups[col].length > 32 ? groups[col].slice(0, 31) + '…' : groups[col]); title.append(svg('title', {}, groups[col])); map.append(title);
      current.events.filter(e => e.group === groups[col]).forEach((event, row) => positions.set(event.id, { x: col * 290 + 25, y: row * 132 + 60 }));
    }
    for (const edge of current.edges) {
      const a = positions.get(edge.from), b = positions.get(edge.to);
      let d;
      if (a.x === b.x) { const mid = (a.y + 96 + b.y) / 2; d = `M${a.x + 120} ${a.y + 96} C${a.x + 120} ${mid} ${b.x + 120} ${mid} ${b.x + 120} ${b.y}`; }
      else { const right = b.x > a.x, sx = a.x + (right ? 240 : 0), ex = b.x + (right ? 0 : 240), mid = (sx + ex) / 2; d = `M${sx} ${a.y + 48} C${mid} ${a.y + 48} ${mid} ${b.y + 48} ${ex} ${b.y + 48}`; }
      const path = svg('path', { d, class: 'bundle-edge' }); path.append(svg('title', {}, `${edge.from} → ${edge.to}`)); map.append(path);
    }
    for (const event of current.events) {
      const pos = positions.get(event.id), assessment = current.checkpoint.events[event.id];
      const node = svg('g', { transform: `translate(${pos.x},${pos.y})`, class: `bundle-node ${assessment.status}${selected === event.id ? ' selected' : ''}`, role: 'button', tabindex: 0, 'aria-label': `${event.title} — ${statusNames[assessment.status]}`, 'aria-pressed': selected === event.id, 'data-event': event.id });
      node.append(svg('rect', { width: 240, height: 96, rx: 3 }));
      lines(event.title).forEach((line, i) => node.append(svg('text', { x: 14, y: 28 + i * 18, class: 'bundle-node-title' }, line)));
      const foot = svg('text', { x: 14, y: 80 }); foot.append(svg('tspan', { class: 'bundle-node-status' }, statusNames[assessment.status]), svg('tspan', { class: 'bundle-node-id' }, ' · ' + (event.id.length > 24 ? event.id.slice(0, 23) + '…' : event.id))); node.append(foot);
      node.append(svg('title', {}, event.title));
      function select() { selected = event.id; for (const n of map.querySelectorAll('[data-event]')) { const active = n.dataset.event === selected; n.classList.toggle('selected', active); n.setAttribute('aria-pressed', active); } details(); }
      node.addEventListener('click', select); node.addEventListener('keydown', e => { if (['Enter', ' '].includes(e.key)) { e.preventDefault(); select(); } }); map.append(node);
    }
    resizeMap();
  }
  function resizeMap() { $('bundle-map').style.width = mapWidth * zoom + 'px'; $('bundle-map').style.height = mapHeight * zoom + 'px'; $('bundle-zoom-value').textContent = Math.round(zoom * 100) + '%'; }
  function fitMap(readable = false) { if (!$('view-checkpoints').hidden) { zoom = Math.min(1, Math.max(readable ? .8 : .35, ($('bundle-canvas').clientWidth - 20) / mapWidth)); resizeMap(); } }
  function details() {
    const event = current.events.find(e => e.id === selected); $('event-detail').hidden = !event; if (!event) return;
    const assessment = current.checkpoint.events[event.id];
    $('event-title').textContent = event.title; $('event-status').textContent = statusNames[assessment.status]; $('event-status').className = 'event-status ' + assessment.status;
    $('event-source').textContent = [event.label && 'Label: ' + event.label, event.source && `${event.source.file}:${event.source.line}`].filter(Boolean).join(' · ');
    $('event-reasons').replaceChildren();
    for (const reason of assessment.reasons) {
      const li = element('li', reason.met === true ? 'met' : reason.met === false ? 'unmet' : 'informational');
      const mark = svg('svg', { class: 'icon small reason-symbol', 'aria-hidden': 'true' }); mark.append(svg('use', { href: reason.met === true ? '#i-check' : reason.met === false ? '#i-close' : '#i-dot' }));
      li.append(mark, element('strong', '', reason.label), element('span', 'sr', reason.met === true ? ' (met)' : reason.met === false ? ' (not met)' : ''));
      if (reason.detail) li.append(element('p', '', reason.detail)); $('event-reasons').append(li);
    }
    $('event-dependencies').replaceChildren();
    const deps = event.dependencies[current.checkpoint.campaign];
    $('dependency-heading').hidden = !deps.length;
    for (const id of deps) {
      const dep = bundle.events.find(e => e.id === id), b = element('button', '', dep.title);
      b.onclick = () => { if (!current.events.some(e => e.id === id)) $('bundle-group').value = ''; selected = id; update(true); requestAnimationFrame(() => $('bundle-map').querySelector(`[data-event="${id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })); };
      $('event-dependencies').append(b);
    }
  }
  $('bundle-campaign').onchange = campaignChanged;
  $('bundle-checkpoint').onchange = () => update();
  $('bundle-group').onchange = () => update(true);
  $('bundle-zoom-in').onclick = () => { zoom = Math.min(1.5, zoom * 1.2); resizeMap(); };
  $('bundle-zoom-out').onclick = () => { zoom = Math.max(.25, zoom / 1.2); resizeMap(); };
  $('bundle-fit').onclick = () => fitMap();
  $('bundle-example').onclick = () => { document.dispatchEvent(new Event('branchlight:cancel-import')); open(BranchlightBundle.example()); };
  $('download-bundle-example').onclick = () => { const url = URL.createObjectURL(new Blob([JSON.stringify(BranchlightBundle.example(), null, 2)], { type: 'application/json' })); const a = element('a'); a.href = url; a.download = 'lantern.branchlight.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  window.BranchlightProject = { open, close, fit: () => fitMap(true), loaded: () => !!bundle };
  new ResizeObserver(() => { if (!$('view-checkpoints').hidden) fitMap(true); }).observe($('bundle-canvas'));
})();
