# Flow architecture

## Goal

Notification Engine connects any supported event to one or more reactions. A
flow is a directed graph of nodes and wires:

```text
event/trigger → condition → state/timing → action
                         └────────────→ action
```

The graph is edited in the WebApp and persisted as JSON. Users should not
need to edit the JSON directly; import/export is intended for backup and
sharing.

## Runtime boundaries

```text
Signal K inputs
      ↓
Event normalizer
      ↓
Flow runtime  ←→  flow state store
      ↓
Effect dispatcher
      ├── audio
      ├── WebApp/system presentation
      ├── Signal K notification actions
      └── external outputs (later)
```

The runtime must not call individual integrations directly. The dispatcher
is the single place for capability checks, priority handling, cancellation,
logging, and safety rules.

## Initial node families

- Trigger: notification raised/changed/cleared, Signal K path event, timer,
  manual event.
- Condition: state, path, source, category, value comparison, AND, OR, NOT.
- Timing/state: delay, debounce, repeat, timeout, cooldown, latch.
- Action: play/stop audio, present UI alert, acknowledge/silence/clear when
  permitted, create a Signal K notification, log.
- Control: split, merge, parallel, subflow, stop.

## Safety and execution rules

- Unknown notifications remain observable.
- Signal K remains authoritative for notification lifecycle and permissions.
- Every flow execution receives an execution ID and origin metadata.
- Loops and cascades require depth, rate, and lifetime limits.
- Actions are idempotent where practical and cancellable where they have a
  duration.
- Flow state is separate from notification history.
- Errors are visible in diagnostics and do not silently disappear.

## Suggested persisted shape

```json
{
  "schemaVersion": 1,
  "flows": [{
    "id": "anchor-alarm",
    "name": "Anchor alarm",
    "enabled": true,
    "nodes": [{ "id": "n1", "type": "notification.trigger", "config": {} }],
    "wires": [{ "from": "n1", "to": "n2" }]
  }]
}
```

The runtime API should be designed around this model before adding a full
editor. A small MVP should support triggers, conditions, boolean nodes,
timing, audio/UI actions, execution logging, and loop protection.
