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

The plugin normalizes producer identity at the Signal K boundary. Deltas and
data-model/API snapshots may represent the same source as `label`, `$source`,
`type`, or a string; internally they are stored as `{ label }` (with `type`
preserved when present). The WebApp and policy layer therefore never need to
interpret a server-version-specific source shape.

Node-RED is a graphical policy authoring layer, not a second notification
engine. The extractor reads the declarative `msg.payload` produced by any
connected node. A chain ending at the `Activate` debug node becomes one policy;
`payload.match.path` and `payload.match.conditions` stay attached to that chain.
When multiple policies share a state/path scope, a longer fully satisfied
condition chain has precedence over a shorter one.

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
