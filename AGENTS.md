# Development guide

## Purpose

This repository provides a Signal K server plugin and companion WebApp that
form a central notification centre. It observes all Signal K notifications,
applies local presentation/audio policies, and exposes only the actions the
Signal K notification source permits.

Signal K and the plugin that raised a notification are authoritative. This
project never invents a competing alarm lifecycle.

## Signal K internal Node-RED

The planned graphical flow configuration targets the Node-RED instance
integrated into the Signal K installation on the Raspberry Pi. It is not an
independent external Node-RED service. Changes to the prototype and its
successor should therefore preserve Signal K plugin/API boundaries and be
validated against the live internal instance over SSH (`raspi`).
The separate systemd service `nodered.service` is not part of this project and
is currently stopped; do not deploy flows to `/home/pi/.node-red` or restart
that service for this work.

### Node-RED builder semantics

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
- Treat `emergency` as non-silenceable even if stale data claims otherwise.
- Preserve unknown notifications and classify them as `OTHER`; do not hide
  them merely because no rule exists.
- Keep Signal K alarm state separate from local policy state. A local audio
  suppression must not change a foreign notification to `normal`.
- Do not take ownership of existing audio scripts until an explicit migration
  and stop/hand-off behaviour has been implemented and tested.

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
- Individual actions belong in the selected info window; global actions are
  separate and clearly labelled. The current info window is not draggable;
  mobile may use the bottom-sheet presentation.
