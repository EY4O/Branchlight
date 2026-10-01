/* Project-wide index of a parsed story: files, label skeleton, variables, and problems. Static; never executes the script. */
(function (root) {
  'use strict';
  const keywords = new Set(['and', 'or', 'not', 'in', 'is', 'if', 'else', 'True', 'False', 'None', 'lambda', 'for', 'pass']);
  const engineSpaces = /^(?:config|gui|build|style|audio|preferences|renpy|achievement|layeredimage|_)/;
  const python = /^(?:init(?:\s+-?\d+)?\s+)?python\b[^:]*:$/;
  const assignment = /^([A-Za-z_][\w]*(?:\.[A-Za-z_]\w*)*)\s*(?:\[[^\]]*\])?\s*(\+=|-=|\*=|\/=|\/\/=|%=|=)(?!=)\s*([\s\S]+)$/;
  function stripStrings(text) { return text.replace(/("""|'''|"|')(?:\\[\s\S]|(?!\1)[\s\S])*?\1/g, '""'); }
  function identifiers(expression) {
    const names = new Set();
    for (const m of stripStrings(expression).matchAll(/(?<![\w.\]\)])([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)(\s*\()?/g)) {
      if (m[2] || keywords.has(m[1]) || engineSpaces.test(m[1])) continue;
      names.add(m[1]);
    }
    return names;
  }
  function kindOf(value) {
    const v = (value || '').trim();
    if (/^(?:True|False)$/.test(v)) return 'flag';
    if (/^-?\d+(?:\.\d+)?$/.test(v)) return 'number';
    if (/^[rRuUbBfF]{0,2}["']/.test(v)) return 'text';
    if (/^[[{(]/.test(v) || /^(?:set|list|dict|tuple)\(/.test(v)) return 'collection';
    if (v === 'None') return 'empty';
    return 'other';
  }
  // Readable opposite of a condition: flip a single comparison or a bare flag, otherwise wrap it in not (...).
  function negate(expr) {
    const t = expr.trim(), flip = { '>=': '<', '<=': '>', '==': '!=', '!=': '==', '>': '<=', '<': '>=' };
    if (/^not\s+[\w.]+$/.test(t)) return t.replace(/^not\s+/, '');
    if (/^[\w.]+$/.test(t)) return 'not ' + t;
    const m = !/\b(?:and|or)\b/.test(stripStrings(t)) && t.match(/^([\w.]+(?:\[[^\]]*\])?)\s*(>=|<=|==|!=|>|<)\s*([^<>=!]+)$/);
    if (m) return `${m[1]} ${flip[m[2]]} ${m[3].trim()}`;
    const n = !/\b(?:and|or)\b/.test(stripStrings(t)) && t.match(/^(.+?)\s+(not\s+in|in)\s+(.+)$/);
    if (n) return `${n[1]} ${n[2] === 'in' ? 'not in' : 'in'} ${n[3]}`;
    return `not (${t})`;
  }
  // A choice line is a quoted caption followed by an optional "if" clause and a colon.
  function choiceCondition(text) {
    if (!/^[rRuUbBfF]{0,2}["']/.test(text) || !/:\s*$/.test(text)) return '';
    return stripStrings(text).match(/^""\s*(?:\([^)]*\)\s*)?if\s+([\s\S]+?):\s*$/)?.[1] || '';
  }
  function build(graph, parser) {
    const byId = new Map(graph.nodes.map(n => [n.id, n])), out = new Map();
    for (const e of graph.edges) { if (!out.has(e.from)) out.set(e.from, []); out.get(e.from).push(e); }

    // Files, ordered as loaded, with an offset so every line has one position across the project.
    let offset = 0;
    const files = graph.files.map((f, i) => { const file = { name: f.name, lines: f.lines.length, offset, color: i % 6, labels: 0, choices: 0, problems: 0 }; offset += f.lines.length; return file; });
    const fileByName = new Map(files.map(f => [f.name, f])), totalLines = Math.max(1, offset);
    const labelNodes = graph.nodes.filter(n => n.type === 'label');
    const labelsByFile = new Map();
    for (const n of labelNodes) { if (!labelsByFile.has(n.file)) labelsByFile.set(n.file, []); labelsByFile.get(n.file).push(n); }
    for (const list of labelsByFile.values()) list.sort((a, b) => a.line - b.line);
    const labelAt = (file, line) => { let found = null; for (const n of labelsByFile.get(file) || []) { if (n.line <= line) found = n; else break; } return found; };
    const nodeAt = (file, line) => {
      let best = null;
      for (const n of graph.nodes) if (n.file === file && n.type !== 'label' && n.type !== 'boundary' && n.line <= line && line <= n.end && (!best || n.end - n.line < best.end - best.line)) best = n;
      return best || labelAt(file, line);
    };
    for (const n of graph.nodes) { const f = fileByName.get(n.file); if (!f) continue; if (n.type === 'label') f.labels++; if (n.type === 'choice') f.choices++; }
    // The innermost player choice whose block contains a line, so a change can be credited to the choice that causes it.
    const choiceNodes = graph.nodes.filter(n => n.type === 'choice');
    const choiceAt = (file, line) => { let best = null; for (const c of choiceNodes) if (c.file === file && c.line < line && line <= c.end && (!best || c.line > best.line)) best = c; return best; };

    // Reachability from the start label follows every static edge.
    const reachable = new Set(), start = graph.labels.start;
    if (start) { const queue = [start]; while (queue.length) { const id = queue.pop(); if (reachable.has(id)) continue; reachable.add(id); for (const e of out.get(id) || []) queue.push(e.to); } }

    // Label skeleton: one node per label, linked to the labels it reaches without passing another label.
    const labels = [], links = [], linkKeys = new Set();
    for (const L of [...labelNodes, ...graph.nodes.filter(n => n.type === 'external')]) {
      const item = { id: L.id, name: L.title, file: L.file, line: L.line, type: L.type, choices: 0, gates: 0, endings: 0, fallsOff: false, reached: !start || reachable.has(L.id), start: L.id === start, variables: new Set() };
      labels.push(item);
      if (L.type === 'external') continue;
      const queue = (out.get(L.id) || []).map(e => ({ id: e.to, kind: e.kind })), seen = new Set();
      while (queue.length) {
        const { id, kind } = queue.shift(), n = byId.get(id);
        if (!n) continue;
        if ((n.type === 'label' || n.type === 'external') && n.id !== L.id) {
          const linkKind = kind === 'call' ? 'call' : kind === 'jump' ? 'jump' : 'flow', key = L.id + '>' + n.id + '>' + linkKind;
          if (!linkKeys.has(key)) { linkKeys.add(key); links.push({ from: L.id, to: n.id, kind: linkKind }); }
          continue;
        }
        if (seen.has(id)) continue; seen.add(id);
        if (n.type === 'choice') { item.choices++; if (n.condition) item.gates++; }
        if (n.type === 'condition') item.gates++;
        if (n.type === 'return') item.endings++;
        if (n.type === 'boundary') item.fallsOff = true;
        for (const e of out.get(id) || []) queue.push({ id: e.to, kind: e.kind });
      }
    }
    const labelById = new Map(labels.map(l => [l.id, l]));

    // Variables: declarations, assignments (script, python blocks, screen actions), and conditions that read them.
    const vars = new Map(), characters = [];
    const variable = name => { if (!vars.has(name)) vars.set(name, { name, kind: 'other', initial: null, declared: null, defs: [], sets: [], checks: [] }); return vars.get(name); };
    const pendingChecks = [];
    for (const f of graph.files) {
      const statements = (parser || root.RpyParser).logicalLines(f.text).statements;
      let pythonIndent = -1;
      for (const s of statements) {
        const text = s.text;
        if (pythonIndent >= 0 && s.indent <= pythonIndent) pythonIndent = -1;
        const inPython = pythonIndent >= 0;
        const where = () => { const node = nodeAt(f.name, s.line), label = labelAt(f.name, s.line), choice = choiceAt(f.name, s.line); return { file: f.name, line: s.line, text, node: node?.id || null, label: label?.title || null, labelId: label?.id || null, choice: choice?.title || null, choiceId: choice?.id || null, position: ((fileByName.get(f.name)?.offset || 0) + s.line - 1) / totalLines }; };
        if (!inPython && python.test(text)) { pythonIndent = s.indent; continue; }
        const decl = !inPython && text.match(/^(default|define)\s+(?:-?\d+\s+)?([A-Za-z_][\w.]*)\s*=\s*([\s\S]+)$/);
        if (decl) {
          const [, how, name, value] = decl;
          if (/^Character\s*\(/.test(value.trim())) { characters.push({ name, display: value.match(/Character\s*\(\s*[rRuU]?(["'])(.*?)\1/)?.[2] || name, file: f.name, line: s.line }); continue; }
          if (engineSpaces.test(name) || (how === 'define' && /^[A-Z]\w*\s*\(/.test(value.trim()))) continue;
          const v = variable(name); v.defs.push({ ...where(), how });
          if (!v.declared) { v.declared = how; v.initial = value.trim(); v.kind = kindOf(value); }
          continue;
        }
        const set = (inPython ? text : text.startsWith('$') ? text.slice(1).trim() : '').match(assignment);
        if (set && !engineSpaces.test(set[1])) {
          const v = variable(set[1]); v.sets.push({ ...where(), op: set[2], value: set[3].trim(), via: inPython ? 'python' : 'script' });
          if (!v.declared && v.kind === 'other') v.kind = set[2] === '=' ? kindOf(set[3]) : 'number';
        }
        for (const m of text.matchAll(/\bSetVariable\(\s*["']([A-Za-z_][\w.]*)["']\s*,\s*([^)]*)\)/g)) variable(m[1]).sets.push({ ...where(), op: '=', value: m[2].trim(), via: 'screen' });
        for (const m of text.matchAll(/\b(?:ToggleVariable|IncrementVariable)\(\s*["']([A-Za-z_][\w.]*)["']/g)) variable(m[1]).sets.push({ ...where(), op: m[0].startsWith('Toggle') ? 'toggle' : '+=', value: '', via: 'screen' });
        if (inPython) continue;
        const condition = text.match(/^(?:if|elif|while|showif)\s+([\s\S]+?):\s*$/)?.[1] || choiceCondition(text);
        if (condition) pendingChecks.push({ condition, at: where(), via: /^while\b/.test(text) ? 'loop' : /^["'rRuUbBfF]/.test(text) ? 'choice' : 'condition' });
      }
    }
    // Checks resolve after every assignment is known, so unknown names can be reported precisely.
    for (const { condition, at, via } of pendingChecks) {
      for (const name of identifiers(condition)) {
        const base = vars.has(name) ? name : vars.has(name.split('.')[0]) ? name.split('.')[0] : name;
        if (!vars.has(base) && (name.includes('.') && !name.startsWith('persistent.'))) continue;
        variable(base).checks.push({ ...at, condition, via });
      }
    }
    const variables = [...vars.values()].map(v => {
      for (const use of [...v.sets, ...v.checks]) if (use.labelId && labelById.has(use.labelId)) labelById.get(use.labelId).variables.add(v.name);
      const prefix = v.name.startsWith('persistent.') ? 'persistent' : v.name.includes('_') ? v.name.split('_')[0] : '';
      return { ...v, prefix };
    });
    const prefixCount = new Map(); for (const v of variables) if (v.prefix) prefixCount.set(v.prefix, (prefixCount.get(v.prefix) || 0) + 1);
    for (const v of variables) v.group = v.prefix && prefixCount.get(v.prefix) > 1 && v.prefix.length > 1 ? v.prefix : '';
    variables.sort((a, b) => (a.group === '') - (b.group === '') || a.group.localeCompare(b.group) || a.name.localeCompare(b.name));

    // Problems: graded so the list leads with what breaks the story.
    const problems = [];
    const problem = (severity, category, message, at = {}) => { problems.push({ severity, category, message, file: at.file || null, line: at.line || null, node: at.node || null, label: at.label || null }); if (at.file && fileByName.has(at.file)) fileByName.get(at.file).problems++; };
    for (const w of graph.warnings) {
      const node = w.file ? nodeAt(w.file, w.line) : null, at = { file: w.file, line: w.line, node: node?.id, label: w.file ? labelAt(w.file, w.line)?.title : null };
      if (/not in the loaded files/.test(w.message)) problem('error', 'Missing label', w.message, at);
      else if (/Duplicate label/.test(w.message)) problem('error', 'Duplicate label', w.message, at);
      else if (/Calculated destination/.test(w.message)) problem('warning', 'Calculated jump', 'Destination is calculated at runtime, so the map cannot follow it.', at);
      else if (/Python or screen-driven navigation/.test(w.message)) problem('warning', 'Hidden navigation', w.message, at);
      else if (/no recognized choices/.test(w.message)) problem('warning', 'Empty menu', w.message, at);
      else problem('note', 'Not analysed', w.message, at);
    }
    for (const l of labels) {
      if (l.type === 'label' && !l.reached) problem('warning', 'Not reached from start', `“${l.name}” is never reached from start by a jump, call, or fall-through. It may still be reached from screens or Python.`, { file: l.file, line: l.line, node: l.id, label: l.name });
      if (l.type === 'label' && l.reached && l.fallsOff) problem('warning', 'Runs off the file', `“${l.name}” can reach the end of ${l.file} without a jump or return.`, { file: l.file, line: l.line, node: l.id, label: l.name });
    }
    for (const v of variables) {
      const first = v.checks[0] || v.sets[0] || v.defs[0];
      if (!v.defs.length && !v.sets.length) problem('error', 'Never set', `“${v.name}” is checked but never declared or assigned.`, first);
      else if (!v.defs.length && v.sets.some(s => s.via !== 'python')) problem('warning', 'No default', `“${v.name}” is assigned but has no default statement, so saves made earlier will not have it.`, v.sets[0]);
      else if (!v.checks.length) problem('note', 'Never checked', `“${v.name}” is ${v.sets.length ? 'changed' : 'declared'} but no condition reads it.`, v.defs[0] || v.sets[0]);
    }
    // Requirements: what every route from start must pass through to reach each node.
    const requirements = new Map();
    if (start) {
      const position = n => (fileByName.get(n.file)?.offset || 0) + n.line;
      const cond = (expr, negated, n) => ({ key: (negated ? '-' : '+') + expr.replace(/\s+/g, ' ').trim(), type: 'condition', expr, negated, text: negated ? negate(expr) : expr, node: n.id, file: n.file, line: n.line, order: position(n) });
      const guards = e => {
        if (e.kind === 'choice') { const c = byId.get(e.to); if (!c || c.type !== 'choice') return []; const g = [{ key: 'c:' + c.id, type: 'choice', text: c.title, node: c.id, file: c.file, line: c.line, order: position(c) }]; if (c.condition) g.push(cond(c.condition, false, c)); return g; }
        const n = byId.get(e.from);
        if (e.kind === 'condition' && n?.type === 'condition') return /^Yes/.test(e.label) ? [cond(n.title, false, n)] : e.label === 'No' ? [cond(n.title, true, n)] : [];
        return [];
      };
      // A must-analysis: each node keeps only the guards shared by every way in, iterated until nothing shrinks.
      const must = new Map([[start, new Map()]]), work = [start];
      while (work.length) {
        const id = work.pop(), current = must.get(id);
        for (const e of out.get(id) || []) {
          const candidate = new Map(current); for (const g of guards(e)) candidate.set(g.key, g);
          const old = must.get(e.to);
          if (old) { const next = new Map([...old].filter(([k]) => candidate.has(k))); if (next.size === old.size) continue; must.set(e.to, next); }
          else must.set(e.to, candidate);
          work.push(e.to);
        }
      }
      const incoming = new Map(); for (const e of graph.edges) { if (!incoming.has(e.to)) incoming.set(e.to, []); incoming.get(e.to).push(e); }
      for (const [id, set] of must) {
        const n = byId.get(id), always = [...set.values()].sort((a, b) => a.order - b.order);
        const conflict = always.find(g => g.type === 'condition' && set.has((g.negated ? '+' : '-') + g.key.slice(1)));
        const entry = { always, impossible: conflict ? conflict.expr : null, entrances: [] };
        if (n.type === 'label') {
          // Ways in: each entrance keeps the guards it adds beyond what every route needs.
          const seen = new Set();
          for (const e of incoming.get(id) || []) {
            if (!must.has(e.from)) continue;
            const p = byId.get(e.from), from = p.type === 'label' ? p : labelAt(p.file, p.line);
            const extra = [...must.get(e.from).values(), ...guards(e)].filter(g => !set.has(g.key)).sort((a, b) => a.order - b.order);
            const key = (from?.id || p.id) + '|' + e.kind + '|' + extra.map(g => g.key).join(',');
            if (seen.has(key)) continue; seen.add(key);
            entry.entrances.push({ from: from?.title || p.title, fromId: from?.id || p.id, node: p.id, kind: e.kind, extra });
          }
        }
        requirements.set(id, entry);
        if (n.type === 'label' && conflict) problem('error', 'Impossible route', `Every route into “${n.title}” needs both ${conflict.expr} and ${negate(conflict.expr)}, so it can never be reached.`, { file: n.file, line: n.line, node: n.id, label: n.title });
      }
    }
    const rank = { error: 0, warning: 1, note: 2 };
    problems.sort((a, b) => rank[a.severity] - rank[b.severity] || a.category.localeCompare(b.category) || (a.file || '').localeCompare(b.file || '') || (a.line || 0) - (b.line || 0));
    return { files, labels, links, variables, problems, characters, reachable, requirements, totalLines, start: start || null, nodeAt, labelAt };
  }
  root.BranchlightIndex = { build, identifiers, kindOf, negate };
  if (typeof module !== 'undefined') module.exports = root.BranchlightIndex;
})(typeof window === 'undefined' ? globalThis : window);
