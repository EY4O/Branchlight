const test = require('node:test');
const assert = require('node:assert/strict');
const { parse } = require('../parser.js');
const { evaluate, edit, truth, initialize, Simulation } = require('../simulator.js');
const make = (text, overrides = '') => {
  const graph = parse([{ name: 'test.rpy', text }]);
  return new Simulation(graph, 'start', edit(overrides, initialize(graph).variables));
};
const choose = (s, title) => s.choose(s.menu().find(c => c.title === title).id);

test('expressions use Python truthiness, short circuiting, membership, and comparison order', () => {
  assert.equal(evaluate('not [] and 1 < 2 < 3', {}), true);
  assert.equal(evaluate('False and missing', {}), false);
  assert.equal(evaluate('True or missing', {}), true);
  assert.equal(evaluate('not 1 == 2', {}), true);
  assert.equal(evaluate('(2 < 1) < 1', {}), true);
  assert.equal(evaluate('"lantern" in inventory and score >= 5', { inventory: ['lantern'], score: 7 }), true);
  assert.equal(evaluate('"key" not in {"door": True}', {}), true);
  assert.equal(evaluate('[] or "fallback"', {}), 'fallback');
  assert.equal(truth({}), false);
  assert.equal(evaluate('True == 1', {}), true);
});

test('arithmetic, strings, lists, dictionaries, and nested assignment are interpreted', () => {
  const state = edit('score = 2\nscore += 4\nworld = {"score": score}\nworld["score"] -= 1\nitems = ["a", "b"]\nitems[-1] = "c"');
  assert.equal(state.world.score, 5);
  assert.equal(evaluate('items[-1] + "!"', state), 'c!');
  assert.equal(evaluate('3 + 4 * 2', {}), 11);
  assert.equal(evaluate('-3 // 2', {}), -2);
  assert.equal(evaluate('-3 % 2', {}), 1);
  assert.equal(evaluate('2 % -3', {}), -1);
  assert.deepEqual(evaluate('[1] + [2]', {}), [1, 2]);
  assert.equal(evaluate('"🚀a"[0]', {}), '🚀');
});

test('unsafe access and unsupported Python fail without executing input', () => {
  for (const text of ['fetch("https://example.com")', '__import__("os")', 'world.__proto__', 'world.constructor', '2 ** 5']) {
    assert.throws(() => evaluate(text, { world: {} }));
  }
  assert.throws(() => edit('world = {}\nworld["__proto__"] = {}'));
  assert.throws(() => evaluate('missing + 1', {}), /needs a value/);
  assert.throws(() => evaluate('1 / 0', {}), /zero/);
  assert.throws(() => evaluate('99999999999999999', {}), /range/);
  const original = { score: 2 };
  assert.throws(() => edit('score = 5\nunknown_function()', original));
  assert.equal(original.score, 2);
});

test('initialization respects defines and reports unsupported initializers', () => {
  const g = parse([{ name: 'test.rpy', text: 'define score = 4\ndefault score = 0\ndefault points = 2\ndefault unknown = custom()\ninit python:\n    flag = True\nlabel start:\n    return' }]);
  const initial = initialize(g);
  assert.equal(initial.variables.score, 4);
  assert.equal(initial.variables.points, 2);
  assert.equal(initial.issues.length, 2);
  assert.equal(Object.hasOwn(initial.variables, 'unknown'), false);
});

const story = `default affection = 0
label start:
    menu:
        "Help":
            $ affection += 2
        "Leave":
            pass
    if affection >= 2:
        jump good
    else:
        jump bad
label good:
    return
label bad:
    return`;

test('choices update variables and follow the matching ending; undo restores the choice and state', () => {
  const s = make(story); s.run();
  assert.equal(s.status, 'choice'); choose(s, 'Help');
  assert.equal(s.status, 'ended'); assert.equal(s.lastLabel, 'good'); assert.equal(s.variables.affection, 2);
  s.back(); assert.equal(s.status, 'choice'); assert.equal(s.variables.affection, 0); assert.equal(s.variables._return, undefined);
  choose(s, 'Leave'); assert.equal(s.lastLabel, 'bad'); assert.equal(s.variables.affection, 0);
});

test('starting overrides change the route and step advances exactly one statement', () => {
  const s = make(story, 'affection = 5'); s.step(); assert.equal(s.steps, 1); s.run(); choose(s, 'Leave'); assert.equal(s.lastLabel, 'good');
});

test('conditional choices are filtered and no choices continues after the menu', () => {
  const code = `default unlocked = False
label start:
    menu:
        "Secret" if unlocked:
            $ secret = True
    $ finished = True
    return`;
  const s = make(code); s.run(); assert.equal(s.status, 'ended'); assert.equal(s.variables.secret, undefined); assert.equal(s.variables.finished, true);
  const open = make(code, 'unlocked = True'); open.run(); assert.equal(open.menu()[0].enabled, true); choose(open, 'Secret'); assert.equal(open.variables.secret, true);
});

test('call stack resumes the actual caller and returns a value across loaded files', () => {
  const graph = parse([{ name: 'main.rpy', text: `label start:
    call outer
    $ final = score
    return
label outer:
    call inner
    $ score = _return + 1
    return` }, { name: 'helper.rpy', text: 'label inner:\n    return 4' }]);
  const s = new Simulation(graph, 'start'); s.run();
  assert.equal(s.status, 'ended'); assert.equal(s.variables.final, 5); assert.equal(s.stack.length, 0);
});

test('calls with arguments and parameterized labels stop explicitly', () => {
  const s = make('label start:\n    call helper(3)\n    return\nlabel helper(value):\n    return'); s.run();
  assert.equal(s.status, 'blocked'); assert.match(s.problem, /arguments/);
  const t = make('label start(value=2):\n    return'); t.run(); assert.equal(t.status, 'blocked'); assert.match(t.problem, /parameters/);
});

test('loops change state, and unbounded loops pause at the batch limit', () => {
  const s = make('default count = 3\nlabel start:\n    while count > 0:\n        $ count -= 1\n    return'); s.run(); assert.equal(s.status, 'ended'); assert.equal(s.variables.count, 0);
  const infinite = make('label start:\n    while True:\n        pass'); infinite.run(); assert.equal(infinite.status, 'limit'); assert.equal(infinite.steps, 300);
});

test('missing condition variables pause; edits and retry resolve it without assumptions', () => {
  const s = make('label start:\n    if flag:\n        $ selected = "yes"\n    else:\n        $ selected = "no"\n    return'); s.run();
  assert.equal(s.status, 'blocked'); assert.match(s.problem, /flag/);
  s.setVariables('flag = False'); s.run(); assert.equal(s.status, 'ended'); assert.equal(s.variables.selected, 'no');
  assert.equal(s.trace.some(t => t.assumption), false);
});

test('manual condition decisions are recorded and undoable', () => {
  const s = make('label start:\n    if custom():\n        $ selected = "yes"\n    else:\n        $ selected = "no"\n    return'); s.run(); s.resolveCondition(true);
  assert.equal(s.variables.selected, 'yes'); assert.equal(s.trace.some(t => t.assumption), true);
  s.back(); assert.equal(s.status, 'blocked'); assert.equal(s.variables.selected, undefined);
});

test('unsupported assignments stop at their exact statement and can be explicitly skipped', () => {
  const s = make('label start:\n    $ score = 2\n    $ result = custom(score)\n    $ score += 3\n    return'); s.run();
  assert.equal(s.status, 'blocked'); assert.equal(s.variables.score, 2); assert.equal(s.variables.result, undefined);
  s.setVariables('result = 10'); s.run(); assert.equal(s.status, 'blocked');
  s.skip(); assert.equal(s.variables.score, 5); assert.equal(s.variables.result, 10); assert.equal(s.status, 'ended');
  assert.equal(s.trace.some(t => t.assumption), true);
});

test('Python blocks, screen calls, and custom statements cannot silently disappear', () => {
  for (const body of ['python:\n        score = 100', 'call screen custom_menu', 'show screen custom_menu', 'custom_statement foo']) {
    const s = make('label start:\n    ' + body + '\n    return'); s.run(); assert.equal(s.status, 'blocked');
  }
});

test('calculated string destinations resolve and missing targets pause', () => {
  const s = make('default target = "ending"\nlabel start:\n    jump expression target\nlabel ending:\n    return'); s.run(); assert.equal(s.status, 'ended'); assert.equal(s.lastLabel, 'ending');
  const missing = make('label start:\n    jump missing'); missing.run(); assert.equal(missing.status, 'blocked');
});

test('menu sets require an explicit override, recorded in route history', () => {
  const s = make('label start:\n    menu:\n        set seen\n        "Go":\n            return'); s.run(); assert.equal(s.status, 'blocked');
  assert.throws(() => choose(s, 'Go'), /manual override/);
  s.choose(s.menu()[0].id, true); assert.equal(s.status, 'ended'); assert.equal(s.trace.some(t => t.assumption), true);
});

test('if inside a menu argument string does not become a condition', () => {
  const s = make('label start:\n    menu:\n        "Go" (hint="if you like"):\n            return'); s.run();
  assert.equal(s.menu()[0].condition, ''); assert.equal(s.menu()[0].enabled, true);
});

test('file boundaries stop with uncertainty rather than reporting a completed ending', () => {
  const s = make('label start:\n    "Hello"'); s.run(); assert.equal(s.status, 'boundary');
});


test('quoted delimiters stay values and formatted strings can be edited again', () => {
  assert.deepEqual(evaluate('["]", "}", "and", "<end>"]', {}), [']', '}', 'and', '<end>']);
  assert.equal(evaluate('{"}": ":"}["}"]', {}), ':');
  const { literal } = require('../simulator.js');
  const text = 'a\b\f\n';
  assert.equal(evaluate(literal(text), {}), text);
  assert.throws(() => evaluate('world.score', { world: { score: 5 } }), /attributes/);
});

test('list augmented assignment preserves aliases', () => {
  const state = edit('items = [1]\nalias = items\nitems += [2]');
  assert.deepEqual(state.alias, [1, 2]);
  assert.equal(state.items, state.alias);
});


test('calculated calls return to their caller and local destinations keep their scope', () => {
  const s = make('default target = "helper"\nlabel start:\n    call expression target\n    $ result = _return\n    jump .done\nlabel .done:\n    return\nlabel helper:\n    return 7');
  s.run();
  assert.equal(s.status, 'ended');
  assert.equal(s.variables.result, 7);
  assert.equal(s.lastLabel, 'start.done');
});
