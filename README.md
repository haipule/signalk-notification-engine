# Signal K Notification Engine

A Signal K server plugin evolving from the Notification Manager into a visual
notification automation engine. It observes Signal K notifications, keeps a
safe local lifecycle/history model, and will execute configurable flows from
triggers through conditions to actions.

## Direction

The WebApp will become a flow editor. Flows are stored as versioned JSON but
edited graphically. Signal K remains authoritative for foreign notification
state; the engine owns automation state and effects such as audio, UI output,
and newly generated notifications.

The first engine boundary is documented in [Flow architecture](docs/flow-architecture.md).

The current Node-RED prototype is in [node-red/prototype](node-red/prototype/README.md).

## Status

First working draft: active-notification WebApp, history, safe Signal K
actions, and basic local presentation policies. Version `0.1.0` is installed
and integration-tested on the Raspberry Pi.

## Design principles

- All notifications are visible, including unknown ones.
- Signal K remains authoritative for notification state and lifecycle.
- The manager applies local policies: category, display priority, audio,
  repetition, retention, and later external actions.
- `silence`, `acknowledge`, and `clear` are separate operations and only shown
  when Signal K permits them.
- Existing alarm producers and audio scripts remain in place until deliberately
  migrated.

Notification state visibility and sorting are configured together in Plugin
Config. Listed states are visible in the listed order; `emergency` and `alarm`
are always visible first.

## Documentation

- [Phase-1 brief](docs/codex-phase-1.md)
- [Notification API analysis](docs/notification-api-analysis.md)
- [Architecture](docs/architecture.md)
- [Testing strategy](docs/testing.md)
- [Current implementation and API](docs/current-implementation.md)
- [Pi integration notes](docs/pi-integration.md)
- [UI and touch interaction concept](docs/ui-ux.md)

## Intended delivery sequence

The first working draft is a read-only-but-useful alarm centre: an active list,
snapshot reconstruction, delta updates, basic classification, history, and
safe Signal K actions. The first policies are configured through Plugin Config;
audio backends and the WebApp policy editor are subsequent stages.
