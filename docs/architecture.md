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

## Product model

Every incoming notification is represented in the active view. The plugin first assigns an automatic
base category from its path/source/data rules; unknown notifications become
`OTHER`. Persistent user classification overrides are configured in Signal K's
Plugin Config, not edited directly in the WebApp. Policies then match path,
source, or category and determine local presentation behaviour. No matching
policy means visible, no custom audio, and retained in history.

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
