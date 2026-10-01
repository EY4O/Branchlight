/* A deliberately small Python-expression interpreter. No eval or source execution. */
(function (root) {
  'use strict';
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const copy = value => structuredClone(value);
  const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
  function safeKey(key) { if (typeof key !== 'string' || forbidden.has(key) || key.startsWith('__')) throw new Error('Unsupported variable or dictionary key.'); return key; }
  function truth(value) {
    if (value === null || value === false || value === 0 || value === '') return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
  }
  function numeric(value) { if (typeof value === 'boolean') return Number(value); if (typeof value !== 'number') throw new Error('Expected a number.'); return value; }
  function checked(value) {
    if (typeof value === 'number' && (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)) throw new Error('Number exceeds the supported range.');
    if (typeof value === 'string' && value.length > 32000) throw new Error('String exceeds the simulation limit.');
    return value;
  }
  function equal(a, b) {
    if (a === null || b === null) return a === b;
    if (['number', 'boolean'].includes(typeof a) && ['number', 'boolean'].includes(typeof b)) return Number(a) === Number(b);
    if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b)) return false;
    if (typeof a !== 'object') return a === b;
    const ak = Object.keys(a), bk = Object.keys(b);
    return ak.length === bk.length && ak.every(k => own(b, k) && equal(a[k], b[k]));
  }
  function binary(op, a, b) {
    if (op === '==' || op === '!=') return equal(a, b) === (op === '==');
    if (op === 'in' || op === 'not in') {
      let result;
      if (Array.isArray(b)) result = b.some(v => equal(a, v));
      else if (typeof b === 'string' && typeof a === 'string') result = b.includes(a);
      else if (b && typeof b === 'object') result = own(b, safeKey(a));
      else throw new Error('Membership needs a list, string, or dictionary.');
      return op === 'in' ? result : !result;
    }
    if (['<', '<=', '>', '>='].includes(op)) {
      if (!(typeof a === 'string' && typeof b === 'string')) { a = numeric(a); b = numeric(b); }
      return op === '<' ? a < b : op === '<=' ? a <= b : op === '>' ? a > b : a >= b;
    }
    if (op === '+' && typeof a === 'string' && typeof b === 'string') return checked(a + b);
    if (op === '+' && Array.isArray(a) && Array.isArray(b)) { if (a.length + b.length > 1000) throw new Error('List exceeds the simulation limit.'); return [...a, ...b]; }
    a = numeric(a); b = numeric(b);
    if (['/', '//', '%'].includes(op) && b === 0) throw new Error('Division by zero.');
    return checked(op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : op === '/' ? a / b : op === '//' ? Math.floor(a / b) : a - Math.floor(a / b) * b);
  }
  function tokens(text) {
    if (text.length > 32000) throw new Error('Expression exceeds the simulation limit.');
    const out = []; let i = 0;
    while (i < text.length) {
      if (out.length > 1024) throw new Error('Expression is too complex.');
      const c = text[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '#') break;
      if (c === '"' || c === "'") {
        const q = text.slice(i, i + 3) === c.repeat(3) ? c.repeat(3) : c;
        i += q.length; let value = '', closed = false;
        while (i < text.length) {
          if (text.slice(i, i + q.length) === q) { i += q.length; closed = true; break; }
          if (text[i] !== '\\') { value += text[i++]; continue; }
          const e = text[++i]; i++;
          const escapes = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', a: '\x07', v: '\v', '\\': '\\', "'": "'", '"': '"' };
          if (own(escapes, e)) value += escapes[e];
          else if (e === 'u' || e === 'x') {
            const size = e === 'u' ? 4 : 2, hex = text.slice(i, i + size);
            if (!new RegExp('^[0-9a-fA-F]{' + size + '}$').test(hex)) throw new Error('Unsupported string escape.');
            value += String.fromCharCode(parseInt(hex, 16)); i += size;
          } else throw new Error('Unsupported string escape.');
        }
        if (!closed) throw new Error('Unclosed string.');
        out.push({ type: 'literal', value }); continue;
      }
      const num = text.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
      if (num) { out.push({ type: 'literal', value: checked(Number(num[0])) }); i += num[0].length; continue; }
      const name = text.slice(i).match(/^[\p{L}_][\p{L}\p{N}_]*/u);
      if (name) { out.push({ type: 'name', value: name[0] }); i += name[0].length; continue; }
      const op = text.slice(i).match(/^(?:\/\/=|\+=|-=|\*=|\/=|%=|==|!=|<=|>=|\/\/|[+\-*/%<>=()[\]{},.:])/);
      if (!op) throw new Error(`Unsupported expression near “${text.slice(i, i + 18)}”.`);
      out.push({ type: 'op', value: op[0] }); i += op[0].length;
    }
    out.push({ type: 'end', value: '<end>' }); return out;
  }
  class Reader {
    constructor(text) { this.list = tokens(text); this.index = 0; this.depth = 0; }
    peek() { return this.list[this.index].value; }
    at(v) { return this.list[this.index].type === 'op' && this.peek() === v; }
    take(v) { if (this.at(v)) { this.index++; return true; } return false; }
    need(v) { if (!this.take(v)) throw new Error(`Expected “${v}”.`); }
    expression(min = 0) {
      if (++this.depth > 80) throw new Error('Expression nesting exceeds the simulation limit.');
      let left;
      const t = this.list[this.index++];
      if (t.type === 'literal') left = { type: 'literal', value: t.value };
      else if (['True', 'False', 'None'].includes(t.value)) left = { type: 'literal', value: t.value === 'None' ? null : t.value === 'True' };
      else if (t.value === 'not' || t.value === '+' || t.value === '-') left = { type: 'unary', op: t.value, child: this.expression(t.value === 'not' ? 3 : 6) };
      else if (t.value === '(') { left = { type: 'group', child: this.expression() }; this.need(')'); }
      else if (t.value === '[') {
        const items = [];
        if (!this.take(']')) { do { if (this.at(']')) break; items.push(this.expression()); } while (this.take(',')); this.need(']'); }
        left = { type: 'list', items };
      } else if (t.value === '{') {
        const items = [];
        if (!this.take('}')) { do { if (this.at('}')) break; const key = this.expression(); this.need(':'); items.push([key, this.expression()]); } while (this.take(',')); this.need('}'); }
        left = { type: 'dict', items };
      } else if (t.type === 'name') left = { type: 'name', name: safeKey(t.value) };
      else throw new Error('Expected a supported value or variable.');
      while (true) {
        if (this.at('[') && min <= 7) { this.index++; const key = this.expression(); this.need(']'); left = { type: 'index', object: left, key }; continue; }
        if (this.at('.')) throw new Error('Object attributes and named stores are not supported. Use brackets for dictionary keys.');
        if (this.list[this.index].type === 'literal') break;
        let op = this.peek();
        if (op === 'not' && this.list[this.index + 1]?.value === 'in') op = 'not in';
        const prec = { or: 1, and: 2, '==': 3, '!=': 3, '<': 3, '<=': 3, '>': 3, '>=': 3, in: 3, 'not in': 3, '+': 4, '-': 4, '*': 5, '/': 5, '//': 5, '%': 5 }[op];
        if (typeof prec !== 'number' || prec < min) break;
        this.index += op === 'not in' ? 2 : 1;
        const right = this.expression(prec + 1);
        if (prec === 3) {
          if (left.type !== 'compare') left = { type: 'compare', first: left, rest: [] };
          left.rest.push({ op, right });
        } else left = { type: 'binary', op, left, right };
      }
      this.depth--; return left;
    }
    finish() { if (this.list[this.index].type !== 'end') throw new Error(`Unsupported syntax near “${this.peek()}”. Function calls are not evaluated.`); }
  }
  function getIndex(obj, key) {
    if (Array.isArray(obj) || typeof obj === 'string') {
      const items = typeof obj === 'string' ? Array.from(obj) : obj;
      let n = numeric(key); if (!Number.isInteger(n)) throw new Error('List index must be an integer.'); if (n < 0) n += items.length;
      if (n < 0 || n >= items.length) throw new Error('Index is out of range.'); return items[n];
    }
    if (!obj || typeof obj !== 'object') throw new Error('Expected a dictionary or list.');
    key = safeKey(key); if (!own(obj, key)) throw new Error(`Missing key “${key}”.`); return obj[key];
  }
  function value(ast, env) {
    if (ast.type === 'group') return value(ast.child, env);
    if (ast.type === 'literal') return ast.value;
    if (ast.type === 'name') { if (!own(env, ast.name)) throw new Error(`Variable “${ast.name}” needs a value.`); return env[ast.name]; }
    if (ast.type === 'index') return getIndex(value(ast.object, env), value(ast.key, env));
    if (ast.type === 'list') return ast.items.map(a => value(a, env));
    if (ast.type === 'dict') { const result = Object.create(null); for (const [k, v] of ast.items) result[safeKey(value(k, env))] = value(v, env); return result; }
    if (ast.type === 'unary') { const v = value(ast.child, env); return ast.op === 'not' ? !truth(v) : checked((ast.op === '-' ? -1 : 1) * numeric(v)); }
    if (ast.type === 'compare') { let a = value(ast.first, env); for (const part of ast.rest) { const b = value(part.right, env); if (!binary(part.op, a, b)) return false; a = b; } return true; }
    const a = value(ast.left, env);
    if (ast.op === 'and') return truth(a) ? value(ast.right, env) : a;
    if (ast.op === 'or') return truth(a) ? a : value(ast.right, env);
    return binary(ast.op, a, value(ast.right, env));
  }
  function evaluate(text, env) { const r = new Reader(text), ast = r.expression(); r.finish(); return value(ast, env); }
  function assign(text, env) {
    const r = new Reader(text), target = r.expression(); const op = r.peek();
    if (!['=', '+=', '-=', '*=', '/=', '//=', '%='].includes(op)) throw new Error('Only simple variable assignments are supported here.');
    r.index++; const rhs = r.expression(); r.finish();
    let base = target; while (base.type === 'index') base = base.object;
    if (base.type !== 'name') throw new Error('Assignment must target a variable.');
    let result = op === '=' ? value(rhs, env) : binary(op.slice(0, -1), value(target, env), value(rhs, env));
    // Python list += mutates the original list, including its aliases.
    if (op === '+=' && Array.isArray(value(target, env))) { const original = value(target, env); original.splice(0, original.length, ...result); result = original; }
    if (target.type === 'name') env[target.name] = result;
    else if (target.type === 'index') {
      const obj = value(target.object, env); let key = value(target.key, env);
      if (Array.isArray(obj)) { key = numeric(key); if (!Number.isInteger(key)) throw new Error('List index must be an integer.'); if (key < 0) key += obj.length; if (key < 0 || key >= obj.length) throw new Error('Index is out of range.'); }
      else if (obj && typeof obj === 'object') key = safeKey(key);
      else throw new Error('Only dictionaries and lists support item assignment.');
      obj[key] = result;
    } else throw new Error('Unsupported assignment target.');
    if (JSON.stringify(env).length > 64000) throw new Error('Variables exceed the simulation limit (64 KB).');
    return base.name;
  }
  function literal(v) {
    if (v === null) return 'None'; if (typeof v === 'boolean') return v ? 'True' : 'False';
    if (Array.isArray(v)) return '[' + v.map(literal).join(', ') + ']';
    if (typeof v === 'object') return '{' + Object.entries(v).map(([k, v]) => JSON.stringify(k) + ': ' + literal(v)).join(', ') + '}';
    return JSON.stringify(v);
  }
  function edit(text, env = {}) {
    const result = copy(env);
    const parser = root.RpyParser || (typeof require === 'function' ? require('./parser.js') : null);
    for (const s of parser.logicalLines(text).statements) assign(s.text, result);
    return result;
  }
  function initialize(graph) {
    let variables = {}; const issues = [...(graph.initializationNotes || [])];
    const entries = [...(graph.initializers || [])].map(s => {
      const m = s.text.match(/^(default|define)\s+(?:(-?\d+)\s+)?([\s\S]+)$/); return { ...s, kind: m?.[1], priority: Number(m?.[2] || 0), assignment: m?.[3] || '' };
    }).sort((a, b) => (a.kind === 'default') - (b.kind === 'default') || a.priority - b.priority || (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line));
    for (const s of entries) {
      try {
        if (s.kind === 'default') {
          const r = new Reader(s.assignment), target = r.expression(); let exists = false;
          try { value(target, variables); exists = true; } catch (_) { /* A missing variable needs its default. */ }
          if (exists) continue;
        }
        const candidate = copy(variables); assign(s.assignment, candidate); variables = candidate;
      }
      catch (error) { issues.push({ message: `${s.text}: ${error.message}`, file: s.file, line: s.line }); }
    }
    return { variables, issues };
  }
  class Simulation {
    constructor(graph, start, variables = {}) {
      if (!own(graph.labels, start)) throw new Error('Choose a loaded starting label.');
      this.graph = graph; this.nodes = new Map(graph.nodes.map(n => [n.id, n]));
      this.out = new Map(); for (const e of graph.edges) { if (!this.out.has(e.from)) this.out.set(e.from, []); this.out.get(e.from).push(e); }
      this.variables = copy(variables); this.pc = graph.labels[start]; this.offset = 0; this.stack = []; this.trace = []; this.traversed = []; this.history = []; this.status = 'ready'; this.problem = ''; this.steps = 0; this.lastLabel = start;
    }
    snapshot() { return copy({ variables: this.variables, pc: this.pc, offset: this.offset, stack: this.stack, trace: this.trace, traversed: this.traversed, status: this.status, problem: this.problem, steps: this.steps, lastLabel: this.lastLabel }); }
    checkpoint() { this.history.push(this.snapshot()); if (this.history.length > 60) this.history.shift(); }
    back() { if (this.history.length) Object.assign(this, this.history.pop()); }
    record(n, message, assumption = false) { this.trace.push({ id: n.id, message, assumption, line: n.line, file: n.file }); }
    move(id) { if (id) this.traversed.push([this.pc, id]); this.pc = id; this.offset = 0; this.status = id ? 'ready' : 'ended'; }
    next() { return (this.out.get(this.pc) || []).find(e => e.kind !== 'call')?.to; }
    menu() {
      const n = this.nodes.get(this.pc); if (n?.type !== 'menu') return [];
      return (this.out.get(n.id) || []).filter(e => e.kind === 'choice').map(e => {
        const c = this.nodes.get(e.to);
        try { return { id: c.id, title: c.title, condition: c.condition, enabled: !c.condition || truth(evaluate(c.condition, this.variables)) }; }
        catch (error) { return { id: c.id, title: c.title, condition: c.condition, enabled: false, unknown: true, reason: error.message }; }
      });
    }
    internalStep() {
      const n = this.nodes.get(this.pc); if (!n) { this.status = 'ended'; return; }
      if (this.steps >= 5000) { this.status = 'limit'; this.problem = 'Reached 5,000 steps. Restart with different values to continue.'; return; }
      const before = this.snapshot();
      try {
        this.problem = ''; this.status = 'ready';
        if (n.type === 'condition') {
          const yes = truth(evaluate(n.title, this.variables));
          const e = (this.out.get(n.id) || []).find(e => e.label.startsWith(yes ? 'Yes' : 'No'));
          this.record(n, `${n.title} → ${yes ? 'True' : 'False'}`); this.move(e?.to);
        } else if (n.type === 'menu') {
          if (n.menuSet) throw new Error('Menu sets require a manual decision.');
          if (/\b(?:screen|nvl)\s*=/.test(n.statement)) throw new Error('Custom menu screens may change choice behavior.');
          const choices = this.menu();
          if (!choices.length) throw new Error('This menu has no recognized choices.');
          if (choices.some(c => c.unknown)) { this.status = 'blocked'; this.problem = 'Some choices need values or unsupported expressions. Edit variables and retry, or choose an available option.'; }
          else if (choices.some(c => c.enabled)) this.status = 'choice';
          else { this.record(n, 'No choices available; continue after menu'); this.move(n.continuation); }
        } else if (n.type === 'jump' || n.type === 'call') {
          let destination;
          const text = n.statement || n.title;
          if (n.type === 'call' && /\(|\bpass\b/.test(text)) throw new Error('Calls with arguments require a manual override.');
          if (n.dynamic) {
            const expr = text.replace(/^(?:jump|call)\s+expression\s+/, '').replace(/\s+from\s+[\w.]+\s*$/, '');
            let label = evaluate(expr, this.variables);
            if (typeof label !== 'string') throw new Error('A calculated destination must be a label name.');
            if (label.startsWith('.')) label = n.scope + label;
            if (!own(this.graph.labels, label)) throw new Error(`Label “${label}” is not loaded.`);
            destination = this.graph.labels[label];
          } else destination = (this.out.get(n.id) || []).find(e => e.kind === (n.type === 'call' ? 'call' : 'jump'))?.to;
          if (n.type === 'call') {
            if (this.stack.length >= 80) throw new Error('Call stack limit reached.');
            this.stack.push({ returnTo: (this.out.get(n.id) || []).find(e => e.kind === 'resume')?.to, caller: n.id });
          }
          this.record(n, n.title); this.move(destination);
        } else if (n.type === 'return') {
          const expr = n.statement.replace(/^return\s*/, '');
          this.variables._return = expr ? evaluate(expr, this.variables) : null;
          const frame = this.stack.pop(); this.record(n, frame ? 'Return to caller' : 'Route finished');
          if (frame?.returnTo) this.traversed.push([frame.caller, frame.returnTo]);
          this.move(frame?.returnTo);
        } else if (n.type === 'passage') {
          const statement = n.statements?.[this.offset] || { text: n.statement, hasBlock: false }, text = statement.text;
          if (/^show\s+screen\b/.test(text)) throw new Error('Screen behavior is not simulated.');
          if (statement.hasBlock) throw new Error('This block is not supported by the simulator.');
          if (text.startsWith('$')) {
            const candidate = copy(this.variables); assign(text.slice(1).trim(), candidate); this.variables = candidate;
          } else if (!/^(?:(?:[\p{L}_][\p{L}\p{N}_.]*(?:\s+\w+)*)?\s*["']|pass\s*$|(?:scene|show|hide|with|play|stop|queue|voice|pause|window|nvl)\b)/u.test(text)) throw new Error('This statement needs a manual override.');
          else if (/\bexpression\b|\$|\b(?:call|jump)\b/.test(text.replace(/(["'])[\s\S]*\1/, ''))) throw new Error('Runtime expressions in this statement are not simulated.');
          this.record({ ...n, line: statement.line || n.line }, text);
          this.offset++;
          if (this.offset >= (n.statements?.length || 1)) this.move(this.next());
        } else if (n.type === 'label') {
          if (/^label\s+[^\s(]+\s*\([^)]*\S[^)]*\)/.test(n.statement)) throw new Error('Labels with parameters are not supported yet.');
          this.lastLabel = n.title; this.record(n, 'Enter ' + n.title); this.move(this.next());
        } else if (n.type === 'boundary') { this.status = 'boundary'; this.problem = 'End of this file. The next file in Ren’Py execution order is not inferred.'; }
        else if (n.type === 'external') throw new Error(`Load the file containing label “${n.title}”.`);
        else if (n.type === 'unsupported') throw new Error('This Python or translation block is not supported.');
        else { this.record(n, n.title); this.move(this.next()); }
        this.steps++;
      } catch (error) { Object.assign(this, before); this.status = 'blocked'; this.problem = error.message; }
    }
    step() { if (['ended', 'boundary'].includes(this.status)) return; this.checkpoint(); this.internalStep(); }
    run(checkpoint = true) {
      if (['ended', 'boundary'].includes(this.status)) return;
      if (checkpoint) this.checkpoint();
      for (let i = 0; i < 300; i++) { this.internalStep(); if (this.status !== 'ready') return; }
      this.status = 'limit'; this.problem = 'Paused after 300 steps, possibly in a loop. Continue for another batch or edit variables.';
    }
    choose(id, manual = false) {
      const n = this.nodes.get(this.pc), choice = this.menu().find(c => c.id === id);
      if (n?.type !== 'menu' || !choice) throw new Error('That choice is no longer current.');
      if ((!choice.enabled || n.menuSet || /\b(?:screen|nvl)\s*=/.test(n.statement)) && !manual) throw new Error('This choice needs a manual override.');
      this.checkpoint(); this.record(n, 'Choose: ' + choice.title, manual); this.move(id); this.run(false);
    }
    setVariables(text) { const variables = edit(text, this.variables); this.checkpoint(); this.variables = variables; this.problem = ''; if (!['ended', 'boundary'].includes(this.status)) this.status = 'ready'; }
    resolveCondition(yes) {
      const n = this.nodes.get(this.pc); if (n?.type !== 'condition' || this.status !== 'blocked') throw new Error('No unresolved condition is selected.');
      this.checkpoint(); const e = (this.out.get(n.id) || []).find(e => e.label.startsWith(yes ? 'Yes' : 'No'));
      this.record(n, `Assume ${n.title} → ${yes ? 'True' : 'False'}`, true); this.move(e?.to); this.run(false);
    }
    skip() {
      const n = this.nodes.get(this.pc);
      if (this.status !== 'blocked' || !['passage', 'unsupported', 'call'].includes(n?.type)) throw new Error('This step cannot be skipped.');
      this.checkpoint(); this.record(n, 'Manual override: skipped ' + (n.statements?.[this.offset]?.text || n.title), true);
      if (n.type === 'passage' && this.offset + 1 < (n.statements?.length || 1)) { this.offset++; this.status = 'ready'; }
      else this.move(this.next());
      this.run(false);
    }
  }
  root.RpySimulator = { evaluate, assign, edit, literal, truth, initialize, Simulation };
  if (typeof module !== 'undefined') module.exports = root.RpySimulator;
})(typeof window === 'undefined' ? globalThis : window);
