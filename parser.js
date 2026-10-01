/* Static Ren'Py control-flow reader. Never executes the input script. */
(function (root) {
  'use strict';
  function logicalLines(source) {
    const lines = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
    const result = []; let quote = '', triple = false, depth = 0, text = '', start = 0, indent = 0;
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      if (!text) { start = i + 1; indent = raw.match(/^\s*/)[0].replace(/\t/g, '        ').length; }
      let part = '';
      for (let j = 0; j < raw.length; j++) {
        const c = raw[j];
        if (quote) {
          part += c;
          if (c === '\\') { if (j + 1 < raw.length) part += raw[++j]; continue; }
          if (c === quote && (!triple || raw.slice(j, j + 3) === quote.repeat(3))) {
            if (triple) { part += quote.repeat(2); j += 2; }
            quote = ''; triple = false;
          }
        } else if (c === '#') { break;
        } else if (c === '"' || c === "'") {
          quote = c; triple = raw.slice(j, j + 3) === c.repeat(3); part += c;
          if (triple) { part += c.repeat(2); j += 2; }
        } else { part += c; if ('([{'.includes(c)) depth++; if (')]}'.includes(c)) depth--; }
      }
      const continuation = !quote && /\\\s*$/.test(part);
      text += (text ? '\n' : '') + part.replace(/\\\s*$/, '');
      if (!quote && depth <= 0 && !continuation) {
        if (text.trim()) result.push({ text: text.trim(), line: start, end: i + 1, indent, children: [] });
        text = ''; depth = 0;
      }
    }
    if (text.trim()) throw new Error(`Unclosed string, bracket, or continuation near line ${start}.`);
    return { lines, statements: result };
  }
  function tree(statements) {
    const root = { indent: -1, children: [] }, stack = [root];
    for (const s of statements) {
      while (stack.length > 1 && s.indent <= stack.at(-1).indent) stack.pop();
      stack.at(-1).children.push(s); stack.push(s);
    }
    return root.children;
  }
  const opaque = /^(?:init\b|python\b|screen\b|transform\b|image\b|style\b|translate\b|testcase\b|layeredimage\b)/;
  function stringValue(text) {
    const m = text.match(/^(?:[rRuUbBfF]{0,2})?("""|'''|"|')/);
    if (!m) return null;
    const q = m[1]; let end = m[0].length;
    for (; end < text.length; end++) {
      if (text[end] === '\\') { end++; continue; }
      if (text.slice(end, end + q.length) === q) break;
    }
    return { value: text.slice(m[0].length, end).replace(/\\(["'\\])/g, '$1').replace(/\\n/g, ' '), rest: text.slice(end + q.length).trim() };
  }
  function parse(files) {
    const nodes = [], edges = [], warnings = [], labels = new Map(), pending = [], initializers = [], initializationNotes = [];
    let counter = 0;
    const warn = (message, s, file) => warnings.push({ message, file, line: s?.line || 1 });
    function add(type, title, s, file, extra = {}) {
      if (nodes.length >= 3000) throw new Error('This selection exceeds 3,000 flow nodes. Load fewer story files at a time.');
      const n = { id: 'n' + ++counter, type, title, file, line: s?.line || 1, end: s?.end || s?.line || 1, statement: s?.text || '', scope: s?.scope || '', ...extra };
      nodes.push(n); return n.id;
    }
    const edge = (from, to, label = '', kind = 'flow') => { if (from && to) edges.push({ from, to, label, kind }); };
    const resolve = (name, scope) => name.startsWith('.') ? (scope || '') + name : name;
    function register(name, id, s, file) {
      if (labels.has(name)) warn(`Duplicate label “${name}”; links use the first definition.`, s, file);
      else labels.set(name, id);
    }
    function collect(items, scope, file) {
      for (const s of items) {
        s.scope = scope;
        if (/^(?:default|define)\b/.test(s.text)) initializers.push({ text: s.text, file, line: s.line });
        if (/^init\b/.test(s.text)) initializationNotes.push({ message: 'Initialization block needs manual starting values.', file, line: s.line });
        if (opaque.test(s.text)) continue;
        const label = s.text.match(/^label\s+([\p{L}_][\p{L}\p{N}_.]*|\.[\p{L}_][\p{L}\p{N}_]*)/u);
        const menu = s.text.match(/^menu\s+([\p{L}_][\p{L}\p{N}_.]*|\.[\p{L}_][\p{L}\p{N}_]*)\s*(?:\(|:)/u);
        if (label) {
          const name = resolve(label[1], scope);
          if (!label[1].startsWith('.')) scope = name.split('.')[0];
          s.scope = scope; s.node = add('label', name, s, file); register(name, s.node, s, file);
        } else if (menu) {
          const name = resolve(menu[1], scope);
          if (!menu[1].startsWith('.')) scope = name.split('.')[0];
          s.scope = scope; s.node = add('menu', name, s, file); register(name, s.node, s, file);
        }
        scope = collect(s.children, scope, file);
        const from = s.text.match(/^call\s+(?!screen\b).*\sfrom\s+([\w.]+)\s*$/);
        if (from) { s.after = add('label', resolve(from[1], scope), s, file); register(resolve(from[1], scope), s.after, s, file); }
      }
      return scope;
    }
    const parsed = files.map(file => {
      const lex = logicalLines(file.text), items = tree(lex.statements);
      collect(items, '', file.name); return { ...file, ...lex, items };
    });
    function build(items, continuation, file) {
      let next = continuation;
      for (let i = items.length - 1; i >= 0; i--) {
        const s = items[i], t = s.text;
        if (/^(?:python|translate)\b/.test(t)) {
          const id = add('unsupported', t, s, file); edge(id, next); next = id; continue;
        }
        if (opaque.test(t) || /^(?:define|default)\b/.test(t)) continue;
        if (/^label\s/.test(t)) { edge(s.node, build(s.children, next, file)); next = s.node; continue; }
        if (/^menu(?:\s|\(|:)/.test(t)) {
          const options = s.children.map(c => ({ s: c, str: stringValue(c.text) })).filter(c => c.str && /:\s*$/.test(c.str.rest));
          const caption = s.children.find(c => stringValue(c.text) && !/:\s*$/.test(c.text));
          const id = s.node || add('menu', caption ? stringValue(caption.text).value : 'Make a choice', s, file);
          const menuNode = nodes.find(n => n.id === id);
          menuNode.menuSet = s.children.find(c => /^set\s/.test(c.text))?.text.replace(/^set\s+/, '') || '';
          menuNode.continuation = next;
          for (const option of options) {
            // Find an if-clause outside quoted menu arguments.
            const rest = option.str.rest; let depth = 0, quote = '', condition = '';
            for (let p = 0; p < rest.length; p++) {
              const char = rest[p];
              if (quote) { if (char === '\\') p++; else if (char === quote) quote = ''; }
              else if (char === '"' || char === "'") quote = char;
              else if (char === '(' || char === '[' || char === '{') depth++;
              else if (char === ')' || char === ']' || char === '}') depth--;
              else if (!depth && /^if\s/.test(rest.slice(p)) && (p === 0 || /\s/.test(rest[p - 1]))) { condition = rest.slice(p + 2).replace(/:\s*$/, '').trim(); break; }
            }
            const c = add('choice', option.str.value, option.s, file, { condition: condition || '', end: option.s.children.at(-1)?.end || option.s.end });
            edge(id, c, condition ? `if ${condition}` : '', 'choice');
            edge(c, build(option.s.children, next, file));
          }
          if (!options.length) warn('Menu has no recognized choices.', s, file);
          if (s.children.some(c => /^set\s/.test(c.text)) || (options.length && options.every(o => /\bif\s/.test(o.str.rest)))) edge(id, next, 'No choices available', 'condition');
          next = id; continue;
        }
        if (/^(?:if|elif|else)\b/.test(t)) {
          const clauses = [s];
          while (/^(?:elif|else)\b/.test(clauses[0].text) && i > 0 && /^(?:if|elif)\b/.test(items[i - 1].text)) clauses.unshift(items[--i]);
          let no = next;
          for (let k = clauses.length - 1; k >= 0; k--) {
            const c = clauses[k];
            if (/^else\b/.test(c.text)) { no = build(c.children, next, file); continue; }
            const id = add('condition', c.text.replace(/^(?:if|elif)\s+/, '').replace(/:\s*$/, ''), c, file);
            edge(id, build(c.children, next, file), 'Yes', 'condition'); edge(id, no, 'No', 'condition'); no = id;
          }
          next = no; continue;
        }
        if (/^while\b/.test(t)) {
          const id = add('condition', t.replace(/^while\s+/, '').replace(/:\s*$/, ''), s, file, { loop: true });
          edge(id, build(s.children, id, file), 'Yes · repeat', 'condition'); edge(id, next, 'No', 'condition'); next = id; continue;
        }
        if (/^(?:jump|call)\s/.test(t) && !/^call\s+screen\b/.test(t)) {
          const call = t.startsWith('call '), dynamic = /^(?:jump|call)\s+expression\b/.test(t);
          const target = t.match(/^(?:jump|call)\s+([^\s(]+)/)?.[1];
          const id = add(call ? 'call' : 'jump', t, s, file, { dynamic });
          if (dynamic) warn('Calculated destination: unresolved in the static map; simulation can try supported expressions.', s, file);
          else pending.push({ id, target: resolve(target || '', s.scope), s, file, kind: call ? 'call' : 'jump' });
          if (call) {
            if (s.after) { edge(s.after, next); next = s.after; }
            edge(id, next, 'After return', 'resume');
          }
          next = id; continue;
        }
        if (/^return(?:\s|$)/.test(t)) { next = add('return', 'Return', s, file); continue; }
        // Group straight-line dialogue and actions to keep story diagrams readable.
        const group = [s];
        const special = /^(?:label|menu|if|elif|else|while|jump|call|return|init|python|screen|transform|image|style|translate|testcase|layeredimage|define|default)\b/;
        while (i > 0 && !special.test(items[i - 1].text) && !items[i - 1].children.length) group.unshift(items[--i]);
        const dialogue = group.map(x => stringValue(x.text) || stringValue(x.text.replace(/^[\w.]+(?:\s+\w+)*\s+(?=["'])/, ''))).find(Boolean);
        const id = add('passage', dialogue?.value || (group.length === 1 ? group[0].text : `${group.length} actions`), group[0], file, { end: group.at(-1).end, count: group.length, statements: group.map(item => ({ text: item.text, line: item.line, hasBlock: !!item.children.length })) });
        for (const item of group) {
          if (item.children.length) warn(`Block “${item.text.split(/\s/)[0]}” is not analyzed.`, item, file);
          if (/\brenpy\.(?:jump|call|call_in_new_context|set_return_stack|pop_call)\s*\(/.test(item.text) || /^call\s+screen\b/.test(item.text)) warn('Python or screen-driven navigation may add routes not shown in the graph.', item, file);
        }
        edge(id, next); next = id;
      }
      return next;
    }
    for (const file of parsed) {
      // A file boundary is deliberately not treated as an ending or a guessed jump.
      const eof = add('boundary', 'End of loaded file', { line: file.lines.length }, file.name);
      build(file.items, eof, file.name);
      function inspect(items) { for (const s of items) { if (/^(?:python|translate)\b/.test(s.text)) warn(`${s.text.startsWith('python') ? 'Python' : 'Translation'} block is not analyzed.`, s, file.name); if (!opaque.test(s.text)) inspect(s.children); } }
      inspect(file.items);
    }
    const external = new Map();
    for (const p of pending) {
      let target = labels.get(p.target);
      if (!target) {
        if (!external.has(p.target)) external.set(p.target, add('external', p.target, p.s, p.file));
        target = external.get(p.target); warn(`Label “${p.target}” is not in the loaded files.`, p.s, p.file);
      }
      edge(p.id, target, p.kind === 'call' ? 'Call' : '', p.kind);
    }
    const used = new Set(edges.flatMap(e => [e.from, e.to]));
    return { nodes: nodes.filter(n => n.type !== 'boundary' || used.has(n.id)), edges, labels: Object.fromEntries(labels), warnings, initializers, initializationNotes, files: parsed.map(({ name, text, lines }) => ({ name, text, lines })) };
  }
  root.RpyParser = { parse, logicalLines };
  if (typeof module !== 'undefined') module.exports = root.RpyParser;
})(typeof window === 'undefined' ? globalThis : window);
