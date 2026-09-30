const test = require('node:test');
const assert = require('node:assert/strict');
const { parse } = require('../parser.js');
const read = text => parse([{ name: 'story.rpy', text }]);
const node = (g, title, type) => g.nodes.find(n => n.title === title && (!type || n.type === type));
function reaches(g, a, b) {
  const seen = new Set(), queue = [a];
  while (queue.length) { const id = queue.pop(); if (id === b) return true; if (seen.has(id)) continue; seen.add(id); for (const e of g.edges.filter(e => e.from === id)) queue.push(e.to); }
  return false;
}
test('choices rejoin following statements; jump and return terminate their branch', () => {
  const g = read(`label start:
    menu:
        "Continue":
            "A"
        "Jump":
            jump ending
        "Stop":
            return
    "Rejoined"
    return
label ending:
    "End"
    return`);
  assert.equal(g.nodes.filter(n => n.type === 'choice').length, 3);
  assert.ok(reaches(g, node(g, 'Continue').id, node(g, 'Rejoined').id));
  assert.ok(!reaches(g, node(g, 'Jump', 'choice').id, node(g, 'Rejoined').id));
  assert.ok(!reaches(g, node(g, 'Stop').id, node(g, 'Rejoined').id));
  assert.ok(reaches(g, node(g, 'Jump', 'choice').id, g.labels.ending));
});
test('nested menus and if/elif/else preserve ordered conditions and merge', () => {
  const g = read(`label start:
    if a:
        menu:
            "One":
                pass
            "Two":
                pass
    elif b:
        "B"
    else:
        "C"
    "Together"
    return`);
  const a = node(g, 'a'), b = node(g, 'b'), end = node(g, 'Together');
  assert.ok(g.edges.some(e => e.from === a.id && e.to === b.id && e.label === 'No'));
  for (const title of ['One', 'Two', 'B', 'C']) assert.ok(reaches(g, node(g, title).id, end.id));
});
test('multi-file static jumps, local labels, and named menus resolve', () => {
  const g = parse([{ name: 'a.rpy', text: `label start:
    jump .next
label .next:
    jump other` }, { name: 'b.rpy', text: `label other:
    jump choose
menu choose:
    "Done":
        return` }]);
  assert.ok(g.labels['start.next']); assert.ok(g.labels.choose);
  assert.equal(g.warnings.length, 0);
  assert.ok(reaches(g, g.labels.start, g.labels.choose));
});
test('calls have a distinct target and conditional continuation; from labels exist', () => {
  const g = read(`label start:
    call helper(1) from after_helper
    "Back"
    return
label helper(value):
    return value`);
  const c = g.nodes.find(n => n.type === 'call');
  assert.ok(g.edges.some(e => e.from === c.id && e.to === g.labels.helper && e.kind === 'call'));
  assert.ok(g.edges.some(e => e.from === c.id && e.to === g.labels.after_helper && e.kind === 'resume'));
  assert.ok(reaches(g, g.labels.after_helper, node(g, 'Back').id));
});
test('while loops connect the body back to the condition with a separate exit', () => {
  const g = read(`label start:
    while count:
        $ count -= 1
    "Done"
    return`);
  const c = node(g, 'count');
  assert.ok(reaches(g, node(g, '$ count -= 1').id, c.id));
  assert.ok(g.edges.some(e => e.from === c.id && e.to === node(g, 'Done').id && e.label === 'No'));
});
test('strings, comments, multiline strings and menu arguments do not create false branches', () => {
  const g = read(`label start:
    """A story:
label fake:
    menu:
        'Not a choice':
    """
    # jump absent
    menu (screen="choice"):
        "Say \\"hi\\" # now" (event="open") if ready:
            "Done"
    return`);
  assert.equal(Object.keys(g.labels).length, 1);
  assert.equal(g.nodes.filter(n => n.type === 'choice').length, 1);
  assert.equal(g.nodes.find(n => n.type === 'choice').condition, 'ready');
  assert.equal(g.warnings.length, 0);
});
test('all conditional menu options produce an unavailable-choices continuation', () => {
  const g = read(`label start:
    menu:
        "Hidden" if unlocked:
            return
    "Skipped"
    return`);
  const m = g.nodes.find(n => n.type === 'menu');
  assert.ok(g.edges.some(e => e.from === m.id && e.to === node(g, 'Skipped').id && e.label === 'No choices available'));
});
test('computed and missing targets are visible and Python is not executed', () => {
  const g = read(`label start:
    python:
        jump = "fake"
    call expression destination
    jump missing`);
  assert.equal(g.nodes.filter(n => n.dynamic).length, 1);
  assert.equal(g.nodes.filter(n => n.type === 'external').length, 1);
  assert.equal(g.warnings.length, 3);
});
test('unindented label bodies fall through in file order', () => {
  const g = read(`label start:
"Opening"
label second:
    return`);
  assert.ok(reaches(g, g.labels.start, g.labels.second));
});
test('duplicate labels are noted and malformed logical lines fail clearly', () => {
  assert.equal(read('label start:\n    return\nlabel start:\n    return').warnings.length, 1);
  assert.throws(() => read('label start:\n    "unfinished'), /Unclosed/);
});
test('screens and init Python do not become story branches', () => {
  const g = read(`init python:
    def f():
        if value:
            pass
screen choice(items):
    for i in items:
        textbutton i.caption action i.action
label start:
    return`);
  assert.equal(g.nodes.filter(n => n.type === 'condition').length, 0);
  assert.equal(g.nodes.filter(n => n.type === 'choice').length, 0);
});
