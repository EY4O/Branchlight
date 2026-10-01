/* Versioned, data-only event snapshots. Imported bundles never contain executable rules. */
(function (root) {
  'use strict';
  const statuses = ['available', 'blocked', 'completed', 'excluded', 'unknown'];
  function fail(message) { throw new Error('Invalid project bundle: ' + message); }
  function object(value, name) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(name + ' must be an object.'); }
  function string(value, name, max = 500) { if (typeof value !== 'string' || !value.trim() || value.length > max) fail(name + ' must be a non-empty string (up to ' + max + ' characters).'); }
  function optional(value, name, max) { if (value !== undefined) string(value, name, max); }
  function array(value, name, max, min = 0) { if (!Array.isArray(value) || value.length < min || value.length > max) fail(name + ' must contain ' + min + '–' + max + ' items.'); }
  function id(value, name) { string(value, name, 100); if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(value)) fail(name + ' contains unsupported characters.'); }
  function indexed(items, name) {
    const result = new Map();
    for (const item of items) { object(item, name); id(item.id, name + ' ID'); if (result.has(item.id)) fail('Duplicate ' + name + ' ID: ' + item.id); result.set(item.id, item); string(item.title, name + ' title', 200); }
    return result;
  }
  function safeData(value, depth = 0) {
    if (depth > 40) fail('Data is nested too deeply.');
    if (value === null || typeof value === 'boolean' || typeof value === 'string') return;
    if (typeof value === 'number') { if (!Number.isFinite(value)) fail('Numbers must be finite.'); return; }
    if (typeof value !== 'object') fail('Only JSON data is supported.');
    for (const [key, entry] of Object.entries(value)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) fail('Unsafe object key.');
      safeData(entry, depth + 1);
    }
  }
  function validate(bundle) {
    object(bundle, 'Bundle'); safeData(bundle);
    if (bundle.format !== 'branchlight-project' || bundle.version !== 1) fail('Expected branchlight-project version 1.');
    object(bundle.project, 'Project'); id(bundle.project.id, 'Project ID'); string(bundle.project.title, 'Project title', 200);
    optional(bundle.project.description, 'Project description', 4000); optional(bundle.project.revision, 'Revision', 200);
    optional(bundle.project.exportedAt, 'Export time', 100);
    if (bundle.project.exportedAt && !Number.isFinite(Date.parse(bundle.project.exportedAt))) fail('Export time must be an ISO date.');
    array(bundle.campaigns, 'Campaigns', 50, 1); array(bundle.events, 'Events', 500, 1); array(bundle.checkpoints, 'Checkpoints', 200, 1);
    const campaigns = indexed(bundle.campaigns, 'campaign'), events = indexed(bundle.events, 'event');
    indexed(bundle.checkpoints, 'checkpoint');
    let dependencyCount = 0;
    for (const event of bundle.events) {
      string(event.group, 'Event group', 100); optional(event.label, 'Source label', 200);
      if (event.source !== undefined) { object(event.source, 'Source'); string(event.source.file, 'Source file', 500); if (!Number.isInteger(event.source.line) || event.source.line < 1) fail('Source line must be a positive integer.'); }
      array(event.campaigns, 'Event campaigns', 50, 1);
      if (new Set(event.campaigns).size !== event.campaigns.length || event.campaigns.some(c => !campaigns.has(c))) fail('Event campaigns must reference unique campaign IDs.');
      object(event.dependencies, 'Dependencies');
      for (const [campaign, deps] of Object.entries(event.dependencies)) {
        if (!event.campaigns.includes(campaign)) fail('Dependencies reference an inapplicable campaign.');
        array(deps, 'Dependencies', 500);
        dependencyCount += deps.length; if (dependencyCount > 5000) fail('More than 5,000 prerequisite references.');
        if (new Set(deps).size !== deps.length) fail('Duplicate dependency.');
        for (const dep of deps) if (!events.has(dep) || dep === event.id || !events.get(dep).campaigns.includes(campaign)) fail('Dependency must reference another event in the campaign.');
      }
      for (const campaign of event.campaigns) if (!Object.hasOwn(event.dependencies, campaign)) fail('Missing dependencies for ' + campaign + '.');
    }
    // Dependencies express prerequisites, so cycles cannot represent a valid schedule.
    for (const campaign of campaigns.keys()) {
      const visiting = new Set(), done = new Set();
      function visit(event) {
        if (visiting.has(event.id)) fail('Cyclic event dependencies in ' + campaign + '.');
        if (done.has(event.id)) return;
        visiting.add(event.id);
        for (const dep of event.dependencies[campaign]) visit(events.get(dep));
        visiting.delete(event.id); done.add(event.id);
      }
      for (const event of bundle.events.filter(e => e.campaigns.includes(campaign))) visit(event);
    }
    for (const checkpoint of bundle.checkpoints) {
      if (!campaigns.has(checkpoint.campaign)) fail('Checkpoint campaign is not defined.');
      if (!['recorded', 'scenario'].includes(checkpoint.kind)) fail('Checkpoint kind must be recorded or scenario.');
      optional(checkpoint.description, 'Checkpoint description', 4000); object(checkpoint.state, 'Checkpoint state'); array(checkpoint.summary, 'Checkpoint summary', 60);
      for (const item of checkpoint.summary) { object(item, 'Summary item'); string(item.label, 'Summary label', 100); string(item.value, 'Summary value', 2000); }
      object(checkpoint.events, 'Checkpoint event assessments');
      for (const key of Object.keys(checkpoint.events)) if (!events.has(key)) fail('Assessment references unknown event ' + key + '.');
      for (const event of bundle.events) {
        const assessment = checkpoint.events[event.id]; object(assessment, 'Assessment for ' + event.id);
        if (!statuses.includes(assessment.status)) fail('Unrecognized event status.');
        const applicable = event.campaigns.includes(checkpoint.campaign);
        if (applicable === (assessment.status === 'excluded')) fail('Excluded status must match campaign membership.');
        array(assessment.reasons, 'Assessment reasons', 60, 1);
        for (const reason of assessment.reasons) {
          object(reason, 'Reason'); string(reason.label, 'Reason label', 300); optional(reason.detail, 'Reason detail', 2000);
          if (![true, false, null].includes(reason.met)) fail('Reason met must be true, false, or null.');
        }
      }
    }
    for (const campaign of campaigns.keys()) if (!bundle.checkpoints.some(c => c.campaign === campaign)) fail('Each campaign needs a checkpoint.');
    return bundle;
  }
  function parse(text) {
    if (typeof text !== 'string' || new TextEncoder().encode(text).length > 12 * 1024 * 1024) fail('File exceeds 12 MB.');
    let bundle; try { bundle = JSON.parse(text); } catch (_) { fail('File is not valid JSON.'); }
    return validate(bundle);
  }
  function view(bundle, campaign, checkpointId, group = '') {
    const checkpoint = bundle.checkpoints.find(c => c.id === checkpointId && c.campaign === campaign);
    if (!checkpoint) fail('Choose a checkpoint for this campaign.');
    const events = bundle.events.filter(e => e.campaigns.includes(campaign));
    const visible = events.filter(e => !group || e.group === group), ids = new Set(visible.map(e => e.id));
    return { checkpoint, events: visible, groups: [...new Set(events.map(e => e.group))], edges: visible.flatMap(e => e.dependencies[campaign].filter(id => ids.has(id)).map(id => ({ from: id, to: e.id }))) };
  }
  function example() {
    const campaigns = [{ id: 'traveler', title: 'The traveler' }, { id: 'keeper', title: 'The keeper' }];
    const event = (id, title, group, deps, members = ['traveler', 'keeper']) => ({ id, title, group, campaigns: members, dependencies: Object.fromEntries(members.map(c => [c, deps])), label: id });
    const events = [event('arrival', 'Arrive at the crossroads', 'Arrival', []), event('river', 'Find the river lantern', 'The paths', ['arrival']), event('door', 'Open the hidden door', 'The paths', ['river']), event('watch', 'Keep the night watch', 'Home', ['arrival'], ['keeper']), event('home', 'Return home', 'Home', ['arrival'])];
    const checkpoints = campaigns.flatMap(c => [false, true].map(lantern => {
      const assessments = {};
      for (const e of events) {
        const excluded = !e.campaigns.includes(c.id), completed = lantern && ['arrival', 'river'].includes(e.id);
        const available = !excluded && !completed && (lantern ? true : e.id === 'arrival');
        assessments[e.id] = { status: excluded ? 'excluded' : completed ? 'completed' : available ? 'available' : 'blocked', reasons: [{ label: excluded ? 'This event belongs to another campaign' : completed ? 'Already visited' : e.id === 'door' ? 'A lantern is required' : e.id === 'arrival' ? 'Your journey can begin' : 'Visit the crossroads first', met: excluded || completed ? null : available }] };
      }
      return { id: c.id + (lantern ? '-lantern' : '-start'), title: lantern ? 'With the lantern' : 'New journey', campaign: c.id, kind: lantern ? 'scenario' : 'recorded', description: lantern ? 'A hypothetical state with the crossroads and river already visited.' : 'The starting state of this example story.', state: { has_lantern: lantern }, summary: [{ label: 'Lantern', value: lantern ? 'Carried' : 'Not yet found' }], events: assessments };
    }));
    return validate({ format: 'branchlight-project', version: 1, project: { id: 'lantern-path', title: 'The lantern path', description: 'An example project bundle with two campaigns and exported checkpoints.', revision: 'example-v1' }, campaigns, events, checkpoints });
  }
  root.BranchlightBundle = { parse, validate, view, example, statuses };
  if (typeof module !== 'undefined') module.exports = root.BranchlightBundle;
})(typeof window === 'undefined' ? globalThis : window);
