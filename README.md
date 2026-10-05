# Signal K Notification Engine

A Signal K server plugin evolving from the Notification Manager into a visual
notification automation engine. It observes Signal K notifications, keeps a
safe local lifecycle/history model, and will execute configurable flows from
triggers through conditions to actions.

## Current direction

The WebApp will become a flow editor. Flows are stored as versioned JSON but
edited graphically. Signal K remains authoritative for foreign notification
state; the engine owns automation state and effects such as audio, UI output,
and newly generated notifications.

The first engine boundary is documented in [Flow architecture](docs/flow-architecture.md).

The current Node-RED prototype is in [node-red/prototype](node-red/prototype/README.md).

## Current status

The project is an active development build (`0.1.32`). The plugin currently
provides an active-notification WebApp, snapshot/delta reconstruction,
capability-checked Signal K actions, local lifecycle/history persistence,
classification, presentation and audio policies, and the first Node-RED flow
rule extraction/runtime integration.

The current implementation is documented in
[Current implementation](docs/current-implementation.md). The working tree may
contain changes that have not yet been deployed to the Raspberry Pi.

## Design principles

- All notifications are visible, including unknown ones.
- Signal K remains authoritative for notification state and lifecycle.
- The manager applies local policies: display priority, audio,
  repetition, retention, and later external actions.
- `silence`, `acknowledge`, and `clear` are separate operations and only shown
  when Signal K permits them.
- Existing alarm producers remain authoritative. The retained Node-RED
  `Audio Alarms` legacy tab is disabled; its scripts remain only as a controlled
  rollback path and must not be enabled alongside Notification Engine audio.

Notification state visibility and sorting are configured together in Plugin
Config. Listed states are visible in the listed order; `emergency` and `alarm`
are always visible first.

Policies are evaluated in order and may match by state, path prefix, or
source. Unknown notifications remain visible unless an explicit rule hides
them. The local history is an audit/history model owned by this plugin; deleting
it does not delete or alter the Signal K notification. It is not a replacement
for Signal K's notification or history APIs. Lifecycles are
tracked with a local `occurrenceId`, and producer-specific end markers can be
configured in `lifecycle-rules.json`.

The WebApp supports permitted per-notification actions, global silence and
acknowledge actions, history inspection, and confirmed local-history cleanup.
Audio uses one playback count: `0` loops, `1` plays once, and `2` through `99`
play exactly that many times. Optional `payload.sound.pauseSeconds` accepts
only whole seconds from `0` through `5` and delays playback only between
complete plays; a missing value behaves like `0`. Values outside that range
and values of another type reject the deployed rule. Existing
`once`/`repeat`/`loop` flow fields are accepted through a migration adapter.
The disabled embedded Node-RED `Audio Alarms` legacy tab is
retained for rollback, while the plugin is the only active rule-based
notification audio path. The WebApp also provides an authenticated, bounded `Alarmton testen`
maintenance action. Its configured test-tone file is played once; a successful
player exit opens a 15-second `Ton nicht gehört` counter-feedback window. With
no counter-report the result is only technically played, never proven audible.
Full automatic amplifier/loudspeaker verification requires hardware loopback
or a microphone.

### Audio device selection

`audioDevice` is passed to ALSA `aplay` as its playback PCM. `default` uses
the host's configured default route (PulseAudio on the current Pi), while
`plughw:<card>,<device>` selects one hardware card and permits ALSA format and
rate conversion. Numeric card indices are host-specific and must be confirmed
with `aplay -l`; they must not be copied to another installation blindly.

On the currently verified Pi, `plughw:0,0` is the first HDMI output,
`plughw:1,0` is the second HDMI output, and `plughw:2,0` is the BCM2835 analog
Headphones output used by Notification Engine. The equivalent symbolic form
is `plughw:CARD=Headphones,DEV=0`, which is easier to understand when card
indices change. After changing the device, first check Diagnostics for passive
backend/PCM availability and then run the authenticated bounded
`Alarmton testen` action. Only the operator's audible confirmation verifies
the amplifier, volume, cabling, and loudspeaker; exit code zero alone does not.

The Alarm Centre polls every five seconds. A notification request may take up
to twelve seconds and the displayed snapshot becomes stale after fifteen
seconds without a successful refresh. A browser-reported offline event still
disables actions immediately; these presentation limits never alter Signal K
notification state or server-side audio.

## Documentation

- [Phase-1 brief](docs/codex-phase-1.md)
- [Notification API analysis](docs/notification-api-analysis.md)
- [Architecture](docs/architecture.md)
- [Flow architecture](docs/flow-architecture.md)
- [Testing strategy](docs/testing.md)
- [Current implementation and API](docs/current-implementation.md)
- [Node-RED configuration migration](docs/node-red-config-migration.md)
- [Node-RED prototype](node-red/prototype/README.md)
- [Pi integration notes](docs/pi-integration.md)
- [UI and touch interaction concept](docs/ui-ux.md)

## Intended delivery sequence

The current delivery is an alarm centre with an active list, snapshot
reconstruction, delta updates, classification, policy-driven presentation and
audio, local lifecycle/history views, and safe Signal K actions. Persistent
configuration remains in Signal K Plugin Config; the WebApp is not yet a full
policy editor. Node-RED flow deployment and live Raspberry Pi validation remain
part of the development/handoff work described in `AGENTS.md` and `TODO.md`.

## Development checks

```text
npm run check
npm test
npm pack --dry-run
```

See `AGENTS.md` for the deployment, Node-RED, safety, and verification rules
that apply before a change is considered ready for use.
