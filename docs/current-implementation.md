# Current implementation

## What works

- The plugin reconstructs an active notification view from
  `app.notifications.list()`, reconciles it every five seconds to tolerate
  plugin-start ordering, and falls back to the read-only `notifications` data
  model subtree when the managed list is temporarily empty. It also receives
  subsequent `notifications.*` deltas through Signal K's supported
  subscription manager.
- The WebApp is served from `/signalk-notification-engine/` and reads active
  notifications and a bounded local audit history from plugin routes.
- `silence`, `acknowledge`, and `clear` are requested only via the Signal K
  Notification API after server-side capability checks.
- An action request is appended to the local audit trail without claiming that
  the producer has changed its underlying alarm state.
- Automatic categories are assigned by the built-in classifier for display only.
  `notifications.noaaHurricane.*` is classified as `WEATHER`; environment
  notifications are not assumed to be weather, so paths such as
  `notifications.environment.bilgeWater.*` fall back to `OTHER`. Path-prefix
- Local policies match state, path prefix, source, and conditions. They affect
  presentation priority, visibility, and future audio behaviour; they never
  modify an alarm's Signal K `state` or manually assign a category.

## API routes

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/plugins/signalk-notification-engine/notifications` | readonly | Active reconstructed notifications and effective policy. |
| GET | `/plugins/signalk-notification-engine/history` | readonly | Bounded persistent local audit history (500 entries by default). |
| GET | `/plugins/signalk-notification-engine/diagnostics` | readonly | Snapshot/delta timings, critical-input freshness, Node-RED configuration, audio process/result and playback signatures, and local-history persistence health. |
| POST | `/plugins/signalk-notification-engine/audio-test/start` | readwrite | Start one bounded audible maintenance tone and open the 15-second feedback window after technical success. |
| POST | `/plugins/signalk-notification-engine/audio-test/heard` | readwrite | Record explicit human confirmation that the technically successful tone was heard. |
| POST | `/plugins/signalk-notification-engine/audio-test/not-heard` | readwrite | Record explicit inaudible feedback while that feedback window is open. |
| GET | `/plugins/signalk-notification-engine/runtime-tests` | readwrite | List only test notifications owned by the current plugin runtime. |
| POST | `/plugins/signalk-notification-engine/runtime-tests/{slot}` | readwrite | Raise a bounded simulated notification in a fixed plugin-owned path. |
| PATCH | `/plugins/signalk-notification-engine/runtime-tests/{slot}` | readwrite | Change the state/message of that owned simulated notification. |
| DELETE | `/plugins/signalk-notification-engine/runtime-tests/{slot}` | readwrite | Clear that owned simulated notification. |
| POST | `/plugins/signalk-notification-engine/notifications/{id}/{action}` | readwrite | Allowed `silence`, `acknowledge`, or `clear`. |

## Deliberate limitations

- Runtime test slots are maintenance interfaces, not a second alarm source.
  Slots accept only short safe names, use the fixed
  `notifications.system.notificationEngine.runtimeTest.*` namespace, expire
  after 10 to 600 seconds, and retain their Signal K ids only in memory. The
  plugin can update or clear only ids it raised itself; startup removes stale
  entries carrying both the fixed path and plugin marker after an unclean stop.

- History is a local audit trail, not the Signal K source of truth. It is kept
  in the plugin data directory and survives restarts.
- Policies are currently configured through the protected Signal K Plugin
  Config screen. The WebApp is not a policy editor; a future UI may provide a
  link to that configuration screen.
- Audio uses the configured player and device. State sounds use playback count
  `0` for loop, `1` for once, and `2` through `99` for an exact finite count;
  optional `pauseSeconds` adds a validated `0` through `5` second delay only
  between complete plays, while a missing value remains zero;
  each notification lifecycle has an independent playback process, and
  `silence` stops only that lifecycle's audio. Legacy `mode`/`repeatCount`
  input remains readable during the migration.
- `audioDevice` is an ALSA PCM passed to `aplay`. Numeric `plughw` card indices
  are host-specific: on the verified Pi cards 0 and 1 are HDMI, while
  `plughw:2,0` is the analog Headphones output used by the plugin. Passive
  Diagnostics verify only that the PCM exists; the bounded authenticated audio
  test plus operator feedback remains the audible end-to-end check.
- The legacy embedded Node-RED `Audio Alarms` tab is retained but disabled, and
  its Anchor/Bilge audio scripts are stopped. The Notification Engine is the
  only active rule-based notification audio path. Re-enabling the legacy tab
  would create competing ALSA ownership and requires a controlled hand-off.
- The authenticated WebApp self-test plays the configured test-tone file once
  without taking ownership of existing audio. It logs its technical result and
  offers explicit `Alarm heard` and `Sound not heard` choices for 15 seconds.
  Positive feedback records human audibility immediately. Silence after that
  window is an operational pass, not evidence that a human heard the tone.
- The Plugin Config also controls the combined state visibility/sort order, info-window auto-close
  timeout, and the `i`/`h` keyboard shortcuts. A zero timeout keeps the info
  window open until it is closed manually.
- The WebApp polls every five seconds, permits a bounded twelve-second
  notification response, and marks the view stale after fifteen seconds
  without success. Native browser offline events still lock actions
  immediately; connectivity presentation never changes Signal K state.
- History records now include `firstSeenAt` and a `historyKey` composed from
  path and source, so changing technical notification IDs can still be
  correlated in later history views.
- History records also include a local `occurrenceId`; the WebApp uses it to
  keep one alarm lifecycle together when the technical Signal K ID changes.
- The local `occurrenceId` is shown in notification details and can be entered
  in `Clear History Occurrence ID` for configuration-based cleanup.
- A rule with `visibleInTable: true` records history by default. An explicit
  `history: true` or `history: false` on the same Node-RED rule overrides that
  default. History is therefore no longer forced by notification state; a rule
  can match a notification path, source label, or both.
- `clearHistoryOnStart` is a one-shot cleanup switch in Plugin Config. Enable
  it, restart the plugin, then disable it again; it removes the local history
  file but does not alter Signal K notifications.
- A safer targeted cleanup is available with `clearHistoryPath` and
  `clearHistoryPathOnSave`. Saving the Plugin Config removes only non-critical
  history events whose path starts with the configured prefix; `alarm` and
  `emergency` entries are retained.
- The WebApp can delete the complete local audit history after confirmation;
  this does not call any Signal K notification action. `historyRetentionDays`
  optionally removes old local audit events at startup; zero disables it.
- The History window can delete only the selected notification lifecycle by
  its local `occurrenceId`.
- Optional lifecycle exceptions are loaded from `lifecycle-rules.json` in the
  plugin data directory. The packaged file documents the format and includes
  the Hoekens rule: `normal` with message `Off` closes the local lifecycle, so
  the next alarm starts a new local `occurrenceId` even when Signal K reuses
  the technical notification ID. The file is read at plugin start; saving the
  Signal K Plugin Config reloads the plugin and applies changed rules without
  a separate server restart.

## Next UI iteration

The compact-card, selected-notification detail-sheet interaction is implemented
in the WebApp. See `docs/ui-ux.md` for touch requirements and the responsive
layout rationale.

## Policy configuration

Notification states are configured through one `Notification State Order and
Visibility` list. Listed states are shown and sorted in the listed order;
`emergency` and `alarm` are always shown first as safety-critical states.

Policies are configured in order in **Server → Plugin Config**. The first
matching policy wins. A policy must define at least one of state, path prefix,
source label, or condition. Each configured match is evaluated against the
notification. Its
display priority can be `low`, `normal`, `high`, or
`critical`. The configuration is ordered in three layers: `Notification State
Colors` and `Visual Presentation by State` define visual defaults, `Standard
Sound by State` defines sound defaults, and an individual presentation policy
may override the sound with `Specific Sound`. A policy sound has precedence
over the state default; `audio: inherit` keeps that resolved sound, while
`audio: off` suppresses it and `audio: on` explicitly enables audio. Audio
remains a declared policy result until an audio backend is implemented.
The WebApp displays the resulting automatic category. Categories are not a
second rule or policy language.

`Color Palette File` and `Sound Palette File` optionally point to user-editable
JSON files. The color file contains the eight stable color names used by both
visual configuration sections. The sound file contains the eight standard
sound slots: `emergency`, `alarm`, `warn`, `alert`, `nominal`, `normal`, `info`,
and `notification`. Invalid or missing palette files fall back to built-in
defaults.

### Lifecycle rules file

Copy the packaged `lifecycle-rules.json` to the plugin data directory:

```text
<Signal K plugin data directory>/lifecycle-rules.json
```

Edit the `rules` array for producer-specific end markers. Specify `source` and
`path` whenever possible. Every field in `endWhen` must match; then the current
local lifecycle is closed and the next notification starts a new
`occurrenceId`. The file is read at plugin start. Save the Signal K Plugin
Config after editing it; Signal K reloads the plugin as part of that operation,
so a server restart is not required. Removing the file restores the built-in
Hoekens rule; use an empty `rules` array to disable special lifecycle rules.

An explicit `Show in Alarm Centre: false` hides a matching notification from
the active view, but does not delete it, silence it, or change its Signal K
state. Unknown notifications have no matching rule and therefore remain
visible by default.

The WebApp provides a link to the Signal K Plugin Verwaltung for persistent
rule changes; clear any active search/status filter there before selecting this
plugin. Its “Recent activity” area remains a compact history preview while
the fuller per-notification history interaction is being refined.

The active view uses a scrollable table. Individual `silence`, `acknowledge`,
and `clear` actions are shown with icons and visible labels in the
selected-notification info window. Clear requires an explicit confirmation
before the WebApp asks Signal K to change its authoritative state. Global
`silence all` and `acknowledge all` actions remain below the table. History entries are
grouped by day, with the date shown once per day.
