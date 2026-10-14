# Development guide

## Purpose

This repository provides a Signal K server plugin and companion WebApp that
form a central notification centre. It observes all Signal K notifications,
applies local presentation/audio policies, and exposes only the actions the
Signal K notification source permits.

Signal K and the plugin that raised a notification are authoritative. This
project never invents a competing alarm lifecycle.

## Rule interpretation and escalation

All existing project rules remain binding during implementation. Do not
silently reinterpret, weaken, or bypass a rule to make an implementation fit.
If two rules appear to conflict, a rule is technically ambiguous, or a
safety-relevant decision is not covered clearly enough, stop before making the
affected change and discuss the concrete alternatives with the user. Record
the agreed decision in the appropriate project documentation before relying on
it in later work.

## Signal K internal Node-RED

The planned graphical flow configuration targets the Node-RED instance
integrated into the Signal K installation on the Raspberry Pi. It is not an
independent external Node-RED service. Changes to the prototype and its
successor should therefore preserve Signal K plugin/API boundaries and be
validated against the live internal instance over SSH (`raspi`).

### Pi SSH access

The reachable Signal K host is `pi@192.168.100.10`; use the SSH alias `raspi` only if it resolves to the same host. The embedded Node-RED flow is `/home/pi/.signalk/red/flows_openplotter.json`, and the installed plugin is `/home/pi/.signalk/node_modules/signalk-notification-engine`. Use SSH for read-only inspection by default, never store passwords or private keys in this repository, and back up the installed plugin before replacement.
The separate systemd service `nodered.service` is not part of this project and
is currently stopped; do not deploy flows to `/home/pi/.node-red` or restart
that service for this work.

### Node-RED builder semantics

- The live embedded editor currently uses Node-RED 4.x (`4.1.13` at the last
  verification). Any flow JSON prepared for import must use complete Node-RED
  4 export structures copied from or compared with the live embedded flow. Do
  not hand-write abbreviated import nodes. In particular, inject nodes must
  include their Node-RED 4 scheduling/default fields (`repeat`, `crontab`,
  `once`, `onceDelay`, and `topic`) and every node must be free of the editor's
  red invalid-node triangle before deploy. Validate the exact import fixture
  against the installed Node-RED version before giving it to the operator.

The graphical builder is a message-flow builder. Each wire branch adds one
property to `msg.payload` when that branch is triggered; branches are not an
implicit shared object that may be merged indiscriminately. A sound branch may
therefore add `soundFile`, another branch may add `sound.mode` or
`sound.repeatCount`, and a path branch may add `match.path`. The rule extractor
must preserve the branch/activation semantics and must not combine properties
from unrelated parallel branches into one rule. A branch with a matching
`match.path` has priority over a state-only branch: its sound file, playback
mode, and other properties must override the corresponding general state
defaults. Always validate the generated rules against the live embedded
Node-RED flow and the deployed-rules output, especially when sound paths or
loop/repeat behaviour are involved.

### Rule Builder flow selection and configuration ownership

- Do not scan all Node-RED tabs for Notification Engine rules. Signal K Plugin
  Config must list only active embedded Node-RED tabs by display name, persist
  the selected stable tab ID, and show that ID read-only below the selection.
  Rule extraction and validation are scoped exclusively to nodes whose `z`
  equals that selected ID; all other tabs are ignored.
- A missing selection, missing selected tab, or selected tab that later becomes
  disabled must fail notification processing closed. Never switch to another
  tab because its label matches. Renaming the selected tab is harmless because
  its ID remains authoritative.
- The legacy inject node named `Notification Engine config` is to be removed
  after its remaining effective contents have been migrated and live parity
  has been proved. Do not introduce a hidden configuration file as a third
  source of truth.
- Signal K Plugin Config owns the selected Rule Builder tab, audio hardware and
  maintenance tests, local persistence limits, WebApp shortcuts/timeouts,
  critical-input diagnostics, and exact external-task authorization. The
  selected Rule Builder tab owns notification match, visibility, presentation,
  history, sound, ignore, and execution-request rules.
- Notification state ordering is not configurable. Use the Signal K alarm
  states in fixed descending severity order for presentation:
  `emergency`, `alarm`, `warn`, `alert`, `normal`, `nominal`. Unknown foreign
  states remain visible and are not discarded merely because they are absent
  from this known order.
- Configuration schema versioning and non-negotiable safety rules belong in
  plugin code. Obsolete `classificationRules`, `historyStates`, and the
  Node-RED copy of `testNotif` are removed rather than migrated.
- Before deleting the legacy config node, prove that rule-derived `display`,
  `color`/`hex`, `flash`, visibility, history, sound, ignore, and execute values
  reach their actual runtime consumers. Preserve Signal K capability checks;
  a local acknowledgement-required display hint must never grant an action.

## Deployment requirement

Every code change intended for testing or use must be packaged and deployed
to the Raspberry Pi (`raspi`) before the task is considered complete. After
deployment, restart `signalk.service` when required, verify that the service
becomes active, and perform a live health/configuration check. Keep a backup
of the previously installed plugin package before replacing it. This does not
authorize deploying Node-RED flows to `/home/pi/.node-red`; use the Signal K
embedded Node-RED paths described above.

Signal-K plugin lifecycle and logging remain Signal-K responsibilities. Keep
plugin start/stop handling and Signal-K logging configuration in the Signal-K
Plugin Config. Port only notification and flow behaviour to the internal
Node-RED where it is technically reliable. If a setting cannot be represented
or safely operated there, keep that setting in the plugin configuration.
The plugin must not start notification processing without a valid, deployed
configuration from the internal Node-RED instance. If Node-RED is unavailable
or its configuration is invalid at startup, fail the plugin start and report
the reason through Signal-K logging; do not silently use stale or default
notification rules.
Do not patch Signal K or Node-RED managed files under `node_modules` at runtime.
Use the shared internal Node-RED runtime event bus for deploy notifications.
The expected `runtime-event` / `runtime-deploy` interface must be checked for
compatibility; if it is unavailable, notification processing must not start.

## Non-negotiable safety rules

- Never clear a notification unless its current `status.canClear` is `true`.
- Only offer or call silence and acknowledge when `canSilence` and
  `canAcknowledge` respectively are `true`.
- Acknowledge capability is state-independent: if the current Signal K record
  reports `status.canAcknowledge === true` and is not already acknowledged,
  the action is available even for `normal` or `nominal`. Global acknowledge
  remains scoped to the exact records visible in the current table. Never add
  a local state ban that overrides Signal K permission.
- Treat `emergency` as non-silenceable even if stale data claims otherwise.
- Preserve unknown notifications and classify them as `OTHER`; do not hide
  them merely because no rule exists.
- Keep Signal K alarm state separate from local policy state. A local audio
  suppression must not change a foreign notification to `normal`.
- Do not take ownership of existing audio scripts until an explicit migration
  and stop/hand-off behaviour has been implemented and tested.

## External task execution policy

- A Rule Builder branch requests one external task by setting only
  `payload.execute` to an absolute executable path and reaching `Activate`.
  Do not add a redundant `execute_task` flag; the message-flow wiring is the
  activation signal.
- Signal K Plugin Config is the protected authorization boundary. Each exact
  executable path has its own `enabled` switch and timeout. There is no global
  execution switch. A request is accepted only when its path exactly matches
  an enabled configuration entry.
- Start the configured path directly without an additional command shell and
  without dynamic arguments from notification data. Executable shell scripts
  remain supported through their shebang; their content and effects are the
  operator's responsibility. Files and symbolic links are both valid OS
  targets, and normal OS start errors are delivery results rather than reasons
  for the engine to inspect script content or intent.
- External execution is a bounded delivery facility, not notification
  authority. Attempt at most once per notification occurrence and executable,
  enforce the configured timeout and global concurrency limit, do not retry,
  and never change, silence, acknowledge, clear, or normalize the originating
  Signal K notification because of a task result.
- Record accepted, denied, start-failed, completed, and timed-out attempts in
  local audit/diagnostics and normal Signal K logging. Do not create a second
  alarm lifecycle for a user task failure. Limit captured output and terminate
  the spawned process group at timeout or plugin stop.
- Startup reconstruction, unchanged deltas, browser refreshes, and unchanged
  Node-RED deploys must not execute a task. A valid new live occurrence may do
  so. Explicit normal-state recovery execution requires the corresponding
  per-file Plugin Config permission.

## History and configuration policy

- The History delete action removes only the Notification Engine's local audit
  entry. It must never be described or implemented as deleting a Signal K
  notification; Signal K remains the authority for the notification lifecycle.
- `visibleInTable` is the default signal for local history recording: when a
  notification is explicitly visible, `history` inherits enabled behaviour.
- A rule may explicitly override that default with `history: true` or
  `history: false`; visibility and retention remain related but are not
  inseparably coupled.
- Resolve the history decision once when a new local `occurrenceId` begins and
  retain that decision for the complete occurrence. An occurrence admitted to
  History keeps its final `normal`/cleared transition even if that terminal
  state is hidden; an occurrence suppressed with `history: false` must not
  later create an isolated terminal entry merely because a different
  state-level rule matches. Preserve this decision across exact restart
  correlation.
- `emergency` and `alarm` follow the same rule resolution as other
  notifications; they are not hard-coded as permanently retained exceptions.
- Removing visibility stops new history recording for that notification, but
  does not delete existing audit entries automatically. Retroactive deletion
  requires an explicit, separately named purge option.
- Keep local history in the atomic, bounded JSON repository for now. Move it
  to SQLite only when query volume, retention length, or reporting needs
  clearly exceed the JSON model; a migration must preserve entries and have a
  rollback/backup path.
- Do not move all notification conditions into a database at this stage.
  Node-RED remains the graphical rule authoring layer and Signal K Plugin
  Config remains the protected configuration boundary. A database must not
  become an untracked third source of truth for rules.

## Category policy

- Categories are automatic display/classification metadata only. The built-in
  classifier may label a notification for the Alarm Centre, but users do not
  assign categories through Node-RED `payload.category` nodes.
- Policies and builder rules match operational properties such as state, path,
  source, and conditions. Category is not a second rule language or a policy
  selector; this keeps one path from having two competing meanings.
- The old category-assignment prototype is obsolete and must not be deployed.

## Implementation order

1. Complete and keep `docs/notification-api-analysis.md` accurate.
2. Build a read-only snapshot + delta-backed notification store.
3. Build the active-notification WebApp view and permitted Signal K actions.
4. Add classification and persisted display/audio policies.
5. Add audio backends and rule-based repetition only after the above is tested.

## Code structure and documentation

- Keep modules small and single-purpose: store, classifier, policy, actions,
  audio backend, and HTTP/WebApp integration must not be tightly coupled.
- Every exported function and non-obvious state transition needs JSDoc that
  explains inputs, outputs, side effects, and its Signal K authority boundary.
- Explain *why* a safety check exists in comments; do not narrate trivial code.
- Document public configuration fields in both schema descriptions and README.
- Add a short entry to `CHANGELOG.md` for user-visible behaviour changes.
- Update `docs/architecture.md` whenever a component boundary or data flow
  changes, and `docs/testing.md` when adding a new test category.

## Language and localization policy

- English is the canonical project and runtime language. Source code,
  identifiers, comments, API fields and values, persisted event codes, server
  logs, diagnostics, configuration descriptions, built-in UI strings and
  maintained project documentation must be English.
- Localization is a presentation layer only. It must never change Signal K
  notification state, policy evaluation, action permissions, lifecycle
  ownership, matching behaviour or persisted machine-readable values.
- The WebApp must use stable translation keys and ship a complete English
  catalog. Every missing or invalid translation must fall back to English;
  localization failure must not stop notification processing or make the
  Node-RED configuration invalid.
- User-provided translations must be declarative JSON, one file per locale,
  and must be loaded from persistent Signal K plugin configuration data outside
  the installed npm package so upgrades do not overwrite them. Translation
  files are untrusted input: validate their schema, size, value types and
  placeholders; ignore unknown keys; never evaluate them as code or inject
  their values as HTML.
- Language selection is per browser. Prefer an explicit locally persisted user
  choice, then `navigator.languages`, and finally English. Update the document
  language and format dates, times, durations, numbers and plurals with the
  browser `Intl` APIs.
- Translate only Notification Engine labels, instructions and known display
  descriptions. Preserve producer-supplied notification messages, Signal K
  paths, IDs, sources, raw diagnostics and other authoritative external data
  verbatim. A future API may expose stable English statement codes and
  parameters for localized rendering, but must retain an English fallback for
  compatibility and diagnostics.

## Tests and verification

- Unit-test state transitions, classification precedence, policy resolution,
  and every disabled action.
- Test both Notification API-managed notifications and ordinary
  `notifications.*` delta notifications.
- Test startup reconstruction from `app.notifications.list()` and duplicate or
  out-of-order deltas.
- Test the anchor alarm as the first integration scenario.
- Run syntax checks, unit tests, and `npm pack --dry-run` before release.

## WebApp UX

- Show all active notifications. Rules control treatment, not whether an
  unknown alarm exists in the operator's view.
- Make `active`, `silenced`, and `acknowledged` visibly distinct.
- Disable unavailable actions and state why; never show a destructive action
  that is known to be unsupported.
- Keep the active alarm view usable at a glance. Configuration, history, and
  diagnostics belong on separate views.
- Use a scrollable table for active notifications; do not repeat the selected
  notification name beside global actions.
- Keep `emergency` and `alarm` visible and visually distinct by default, but
  allow configured per-state marker colors with readable text on white.
- Show `silenced` and `acknowledged` as independent status indicators; a
  cleared notification belongs in history, not the active table.
- `display: banner` means a fixed strip inside the Notification Centre; it is
  not the full attention overlay.
- Acknowledging an active `emergency` calms its visual presentation by removing
  the attention overlay and returning it to the persistent in-centre
  presentation. It does not change the authoritative `emergency` state and
  does not stop or suppress audio; audio ends only through its independent
  permitted control or the authoritative lifecycle transition.
- When the current browser can read a notification but lacks write
  authorization for an otherwise applicable action, keep the action visible
  but disabled and explain that the current Signal K user lacks permission.
- Individual actions belong in the selected info window; global actions are
  separate and clearly labelled. The current info window is not draggable;
  mobile may use the bottom-sheet presentation.
