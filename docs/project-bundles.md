# Project bundles

A project bundle is a JSON snapshot that adds an event map, campaigns, checkpoints, and availability explanations to Branchlight. It is useful when a game's progression is controlled by a scheduler, custom functions, or screens that cannot be understood from script branches alone.

Use **Open project bundle**, or drop one `.json` file into Branchlight. Choose a campaign and checkpoint, then select an event. **Group** narrows the map to a chapter or act; prerequisite buttons can take you to an event in another group. **Back to script map** returns to the script viewer without discarding either view.

The example project is available from the script sidebar. Its **Download example bundle** button supplies a working JSON file to adapt.

## What a snapshot means

The exporter calculates availability using the game's rules. Branchlight displays the result without running those rules, contacting a server, or executing imported code. A snapshot does not update when a source file or state changes. Re-export it to get current results.

A `recorded` checkpoint is a starting state, captured state, or replayed state reported by the exporter. Branchlight does not independently verify that it is reachable in the game. A `scenario` is a hypothetical state, such as a manually raised relationship value for inspecting a gate. These are visibly distinguished in the interface.

Event status describes entry to an event at that checkpoint. Dialogue variants, choices, minigame outcomes, and other requirements inside the scene are separate. This first version does not apply variable edits to snapshots or explore new routes from them. The existing `.rpy` simulator remains available in the script view.

## Version 1 format

The complete top-level shape is:

```json
{
  "format": "branchlight-project",
  "version": 1,
  "project": {
    "id": "example-story",
    "title": "Example story",
    "description": "A short description",
    "revision": "source-revision-or-fingerprint",
    "exportedAt": "2026-09-30T12:00:00Z"
  },
  "campaigns": [{ "id": "traveler", "title": "The traveler" }],
  "events": [{
    "id": "arrival",
    "title": "Arrive at the crossroads",
    "group": "Chapter 1",
    "label": "arrival",
    "source": { "file": "game/story/start.rpy", "line": 10 },
    "campaigns": ["traveler"],
    "dependencies": { "traveler": [] }
  }],
  "checkpoints": [{
    "id": "traveler-start",
    "title": "New journey",
    "campaign": "traveler",
    "kind": "recorded",
    "description": "The state returned by the new-game initializer.",
    "state": { "has_lantern": false },
    "summary": [{ "label": "Lantern", "value": "Not yet found" }],
    "events": {
      "arrival": {
        "status": "available",
        "reasons": [{ "label": "The journey can begin", "met": true }]
      }
    }
  }]
}
```

`project.description`, `project.revision`, `project.exportedAt`, event `label` and `source`, checkpoint `description`, and reason `detail` are optional. Other fields above are required. IDs must start with an ASCII letter or digit and contain only letters, digits, dots, underscores, or hyphens. Titles and IDs are separate so source identifiers can stay stable as prose changes.

| Field | Meaning |
| --- | --- |
| `event.group` | A chapter, act, or other grouping. Groups and events retain exporter order. |
| `event.campaigns` | Campaign IDs in which the event exists. |
| `event.dependencies` | Prerequisite event IDs for each applicable campaign. Use an empty array for roots. References must stay within that campaign and cannot form cycles. |
| `checkpoint.state` | A JSON object containing the exported variables. Shown for inspection only. |
| `checkpoint.summary` | Selected state values for the sidebar. Both labels and values are strings. |
| `checkpoint.events` | An assessment of **every** event, including events outside the checkpoint's campaign. |
| `reason.met` | `true` for a satisfied requirement, `false` for an unsatisfied requirement, or `null` for information or an unresolved check. |
| `reason.detail` | Optional explanatory text, such as a current value and threshold. |

Each assessment has at least one reason and one of these statuses:

- `available`: the game's rules say the event can be entered at this checkpoint.
- `blocked`: it cannot currently be entered; reasons should explain what is missing.
- `completed`: the state records that the event has already happened.
- `excluded`: the event is not part of this campaign. This must match `event.campaigns`.
- `unknown`: the exporter could not evaluate availability reliably.

Branchlight does not infer a status from individual reasons. For example, satisfying an event's own requirements may still leave it blocked by scheduler order. The exporter must report that ordering restriction as well as the individual gates.

## Writing an exporter

Keep project-specific code and data in the game project. Load its actual rules, produce checkpoints, and ask those rules which events are due. Add human-readable explanations for prerequisites, schedule, resources, and flags. Test explanations against the authoritative selection functions so they do not silently drift.

Export a source revision or content fingerprint and a timestamp. If initialization, a condition, or a state cannot be evaluated, report the uncertainty; do not treat it as an available path. Keep manufactured test states labeled `scenario`.

Prefer minimal snapshots when sharing a bundle. Source references are plain text and are never fetched; full story text and art are not needed. Branchlight keeps imported data in browser memory and does not persist it after a reload.

## Limits and validation

Version 1 supports files up to 12 MB, 50 campaigns, 500 events, 5,000 prerequisite references across campaigns, and 200 checkpoints. Each campaign requires a checkpoint. Imports reject invalid or duplicate IDs, missing assessments, invalid references, cyclic prerequisites, unsafe object keys, and excessively nested data. Failed imports leave the previous map available.

This is a data interchange format, not a save-game format or a plugin execution interface. Ren'Py `.save` and `.rpyc` files cannot be used as bundles.
