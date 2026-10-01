const test = require('node:test');
const assert = require('node:assert/strict');
const { parse, validate, view, example } = require('../project-bundle.js');

test('example round-trips as JSON with campaign-specific snapshots', () => {
  const b = parse(JSON.stringify(example()));
  const a = view(b, 'traveler', 'traveler-start');
  assert.equal(a.events.length, 4);
  assert.equal(a.checkpoint.events.arrival.status, 'available');
  assert.equal(a.checkpoint.events.door.status, 'blocked');
  assert.equal(view(b, 'keeper', 'keeper-lantern').events.length, 5);
  assert.equal(view(b, 'traveler', 'traveler-lantern').checkpoint.events.door.status, 'available');
});

test('group filtering retains only visible edges without altering assessments', () => {
  const b = example(), v = view(b, 'traveler', 'traveler-start', 'The paths');
  assert.deepEqual(v.events.map(e => e.id), ['river', 'door']);
  assert.deepEqual(v.edges, [{ from: 'river', to: 'door' }]);
  assert.equal(v.checkpoint.events.river.status, 'blocked');
  assert.throws(() => view(b, 'keeper', 'traveler-start'), /checkpoint/);
});

test('unknown formats, malformed JSON, and large inputs fail clearly', () => {
  assert.throws(() => parse('{'), /valid JSON/);
  const b = example(); b.version = 2;
  assert.throws(() => validate(b), /version 1/);
  assert.throws(() => parse(' '.repeat(12 * 1024 * 1024 + 1)), /12 MB/);
});

test('duplicate IDs and dangling references cannot create misleading maps', () => {
  let b = example(); b.events.push(b.events[0]); assert.throws(() => validate(b), /Duplicate/);
  b = example(); b.events[1].dependencies.traveler = ['missing']; assert.throws(() => validate(b), /Dependency/);
  b = example(); b.events[1].dependencies.traveler = ['watch']; assert.throws(() => validate(b), /Dependency/);
  b = example(); b.checkpoints[0].events.unknown = { status: 'unknown', reasons: [] }; assert.throws(() => validate(b), /unknown event/);
  b = example(); b.events[0].campaigns.push('missing'); assert.throws(() => validate(b), /campaign IDs/);
});

test('cyclic prerequisites fail before the view is built', () => {
  const b = example(); b.events[0].dependencies.traveler = ['door'];
  assert.throws(() => validate(b), /Cyclic/);
});

test('every campaign and event needs an explicit checkpoint assessment', () => {
  let b = example(); delete b.checkpoints[0].events.door; assert.throws(() => validate(b), /Assessment/);
  b = example(); b.checkpoints = b.checkpoints.filter(c => c.campaign === 'traveler'); assert.throws(() => validate(b), /Each campaign/);
  b = example(); b.checkpoints[0].kind = 'verified'; assert.throws(() => validate(b), /kind/);
  b = example(); b.checkpoints[0].events.door.reasons = []; assert.throws(() => validate(b), /reasons/);
  b = example(); b.checkpoints[0].events.door.status = 'excluded'; assert.throws(() => validate(b), /membership/);
});

test('unresolved requirements remain explicitly unknown', () => {
  const b = example(); b.checkpoints[0].events.door = { status: 'unknown', reasons: [{ label: 'Custom rule was not evaluated', met: null }] };
  assert.equal(validate(b).checkpoints[0].events.door.status, 'unknown');
});

test('prototype keys, executable values and excessive nesting are rejected', () => {
  let b = example(); b.checkpoints[0].state = JSON.parse('{"__proto__":{"polluted":true}}'); assert.throws(() => validate(b), /Unsafe/);
  b = example(); b.checkpoints[0].state.bad = () => {}; assert.throws(() => validate(b), /JSON data/);
  b = example(); let nested = {}; b.checkpoints[0].state = nested;
  for (let i = 0; i < 42; i++) { nested.child = {}; nested = nested.child; }
  assert.throws(() => validate(b), /nested/);
  assert.equal({}.polluted, undefined);
});

test('source locations and export metadata are checked without fetching content', () => {
  const b = example(); b.events[0].source = { file: 'story/start.rpy', line: 1 }; b.project.exportedAt = '2026-09-30T00:00:00Z';
  assert.equal(validate(b), b);
  b.events[0].source.line = 0; assert.throws(() => validate(b), /positive integer/);
});


test('dense imports have a bounded edge count', () => {
  const b = example();
  b.events = Array.from({ length: 102 }, (_, i) => ({ id: 'e' + i, title: 'Event ' + i, group: 'Chapter', campaigns: ['traveler'], dependencies: { traveler: Array.from({ length: i }, (_, j) => 'e' + j) } }));
  assert.throws(() => validate(b), /5,000/);
});
