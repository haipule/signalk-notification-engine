# Architecture

## Component boundary

```text
Signal K notifications and API
             │ snapshot + deltas + permitted actions
             ▼
Server plugin
  ├─ notification store       local reconstructed view
  ├─ classifier               automatic base category
  ├─ classification rules     persistent Plugin Config overrides
  ├─ policy resolver          display/audio/retention decisions
  ├─ actions adapter          safe app.notifications calls
  ├─ history repository       audit trail, never alarm authority
  └─ WebApp API / event feed
             ▼
WebApp
  active centre · history · diagnostics · link to Plugin Config
             ▼
Optional audio backends
  mock → existing script adapter → native ALSA / other backends
```

Diagnostics are a read-only observation path. Server-side snapshot and delta
timings, Node-RED revision/configuration health, audio process results, and
history persistence status are exposed separately from notification authority.
The WebApp adds its own local poll start/end, duration, and network error so a
slow client can be distinguished from a slow Signal K snapshot.

The audio watchdog is deliberately passive. It verifies that the configured
player executable and ALSA playback PCM exist once per minute, but never opens
the device or emits sound. It therefore cannot prove the amplifier, speaker,
volume, or audible signal; that remains the responsibility of an explicit
operator-initiated test.

The plugin normalizes producer identity at the Signal K boundary. Deltas and
data-model/API snapshots may represent the same source as `label`, `$source`,
`type`, or a string; internally they are stored as `{ label }` (with `type`
preserved when present). The WebApp and policy layer therefore never need to
interpret a server-version-specific source shape.

Node-RED is a graphical policy authoring layer, not a second notification
engine. The extractor reads the declarative `msg.payload` produced by any
connected node. A chain ending at the `Activate` debug node becomes one policy;
`payload.match.path` and `payload.match.conditions` stay attached to that chain.
Matching policies are composed property by property from general to specific.
A path-specific sound rule can therefore inherit visibility and history from a
general state rule, while a longer fully satisfied condition chain overrides
only the properties it explicitly defines.

Runtime Node-RED validation has a fail-closed boundary. If a deployed
configuration cannot be validated or restored, the plugin latches the error,
stops rule-dependent subscriptions, snapshot polling, and audio, and rejects
write actions. WebApp polling exposes the latched health state but does not
revalidate the same bad flow repeatedly; only a later deploy attempts recovery.

## Product model

Every incoming notification is represented in the active view. The plugin first assigns an automatic
base category from its path/source/data rules; unknown notifications become
`OTHER`. The built-in classifier is display-only. Policies then match path or
source and determine local presentation behaviour. No matching
policy means visible and no custom audio; history is recorded only when the
matching rule enables it through `visibleInTable` or an explicit `history`
override.

This avoids an allow-list failure mode where a new notification is invisible.
It also keeps complex policy configuration out of the immediate active-alarm
view.

The local history is a notification audit trail, not Signal K's measurement
History API. Signal K remains authoritative for current notification state;
deleting this local history never changes Signal K notifications or provider
measurement data.

## Initial release boundary

The first implementation now includes an in-memory bounded history and a
WebApp. It exposes `silence`, `acknowledge`, and `clear` only after server-side
capability checks. It does not replace existing audio or implement a full rule
language. The anchor alarm is observed first and its existing audio script
continues to operate independently.

The WebApp is an observation and action surface, not the authority for
classification or configuration. It links to Signal K's Plugin Config for
persistent rule changes. The compact-card and responsive detail-sheet design
changes presentation only; all action capability checks remain server-side.
The WebApp treats connectivity as a safety boundary. Browser `offline` events,
failed API polling, and an independent eight-second snapshot-age watchdog
disable actions, every API request has a six-second deadline, and refreshes are
serialized so interval and reconnect polls cannot overlap. The age watchdog
defers to an in-progress bounded refresh, preventing timer coalescing on slow
clients from producing a false stale state. The last rendered
table is explicitly marked stale with a fixed banner above alarm overlays until
the authoritative current-notification snapshot completes successfully. Local
history refreshes independently because audit display latency must not make a
current Signal K notification snapshot appear offline or disable otherwise
permitted actions. This avoids presenting a frozen tablet as a current alarm
display while keeping Signal K as the action authority.

Notification source reconstruction distinguishes the producer from Signal K's
notification-handler projection. Snapshot and delta processing read the source
of the corresponding underlying data path where available. Once a producer is
known, a later `self.notificationhandler` projection cannot replace it; this
keeps classification and local history keys stable without changing Signal K's
authoritative notification lifecycle.
