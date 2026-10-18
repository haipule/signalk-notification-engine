# Signal K Notification Engine

Notification Engine is a Signal K server plugin and companion WebApp that
collects active notifications in one centre and applies locally authored
presentation, history, audio, and bounded external-task rules. Rules are built
visually with ordinary nodes in the Node-RED instance embedded in Signal K.

Signal K and the plugin that raised a notification remain authoritative. The
engine never invents another alarm lifecycle and offers Silence, Acknowledge,
or Clear only when the current Signal K notification permits that action.

## Requirements

- Signal K Server with its embedded Node-RED plugin enabled
- Node-RED 4.x for the supplied reference flow
- `aplay` and a working ALSA playback device when server-side audio is used
- a Signal K user with write permission for notification actions and tests

The currently tested development version is `0.1.91`.

## Five-minute quick start

1. Install `signalk-notification-engine` in Signal K. Leave it disabled until
   the Rule Builder flow below has been deployed.
2. Open the Node-RED editor embedded in Signal K.
3. Import
   [`node-red/notification-engine-release-flow.json`](node-red/notification-engine-release-flow.json).
4. Keep the imported tab active. Connect the final wire from **Quick Start:
   show in table** to the supplied debug node named exactly `Activate`, then
   deploy.
5. In Signal K Plugin Config, open Notification Engine, enable the plugin, and
   select that tab under **Rule Builder Flow**. Verify the stable ID displayed
   below the selector, then save.
6. Open the Notification Engine WebApp and verify Diagnostics reports
   configuration `ready` and the generated Quick Start rule is listed.

Every active rule needs one uninterrupted wire from a notification-state node,
through its match and action nodes, to `Activate`. Importing the reference flow
does not activate any rule, sound, or external task.

## Safety boundary

- Unknown notifications remain visible by default.
- `emergency` is never locally silenceable.
- Local audio suppression never changes a Signal K notification state.
- Acknowledge, Silence, and Clear require both current Signal K Notification
  API manager membership and the corresponding current capability.
- A `normal` record leaves the active table when Signal K removes its ID from
  that manager; its existing local History is retained without a synthetic
  cleanup event.
- Deleting History removes only the engine's local audit entry.
- External tasks never acknowledge, silence, clear, or normalize a
  notification.
- **Important:** Other installed plugins, flows, alarm applications, or scripts
  may produce additional audio for the same alarm. This can cause duplicate,
  overlapping, or independently controlled sounds. The operator must check for
  and prevent these interactions and leave only the intended audio path active
  for an alarm.

## Documentation

- [User guide](docs/user-guide.md) — configuration, rule authoring, operation,
  audio tests, History, Diagnostics, upgrades, troubleshooting, and rollback
- [Architecture](docs/architecture.md)
- [Notification API authority analysis](docs/notification-api-analysis.md)
- [Testing strategy](docs/testing.md)
- [End-to-end safety matrix](docs/e2e-safety-matrix.md)
- [Raspberry Pi integration and rollback evidence](docs/pi-integration.md)

## Development

This project was designed and developed by its maintainer with assistance from
OpenAI Codex.

AI-assisted contributions are reviewed and validated by the maintainer, who
remains responsible for the project's functionality, security, and
maintenance.

## Development checks

```sh
npm run check
npm test
npm pack --dry-run
```

Repository work must also follow [`AGENTS.md`](AGENTS.md), especially its
Signal K authority, deployment, backup, Node-RED, and live-test requirements.
