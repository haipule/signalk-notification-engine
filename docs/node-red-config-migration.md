# Node-RED configuration migration

The first migration targets the Node-RED instance embedded in Signal K. The
standalone `nodered.service` is not used.

## Ownership boundary

Signal K remains responsible for plugin lifecycle and server logging. The
plugin's `start()` and `stop()` methods continue to create and tear down the
bridge to Node-RED. Signal-K logging and its log-level configuration remain in
Signal K Plugin Config.

Node-RED becomes the owner of notification behaviour where it can represent
and execute that behaviour reliably. The plugin remains the safety boundary
for Signal K API calls and lifecycle state.

| Current Plugin Config area | First target | Reason |
| --- | --- | --- |
| `policies` | Node-RED | Flow conditions and presentation decisions |
| `classificationRules` | Node-RED | Notification classification logic |
| `stateOrder`, `visibleStates` | Node-RED | Visibility and ordering policy |
| `stateColors`, `visualRules` | Node-RED | Visual presentation decisions |
| `soundsByState`, `soundPaletteFile` | Node-RED | Sound selection and timing |
| `historyRules`, `historyStates` | Node-RED | History routing decisions |
| `testNotif` | Node-RED | Test trigger and test lifecycle |
| `audioPlayer`, `audioDevice`, `testTonePath` | Signal K initially | Host/device boundary and safe execution |
| `historyLimit`, `historyRetentionDays` | Signal K initially | Local persistence ownership |
| `clearHistory*` | Signal K initially | Destructive administrative operations |
| `shortcutInfo`, `shortcutHistory` | Signal K initially | WebApp input handling |
| plugin enabled/start/stop and logging | Signal K | Signal K lifecycle and logging authority |

The Node-RED-owned settings are now authoritative. On startup and after every
successful deploy, the engine reads the `Notification Engine config` node and
applies its complete `notificationEngine` object. Signal K Plugin Config is
used only for the host boundary and local persistence settings listed above.

## Startup contract

Signal K starts the plugin with only the required technical options. Before
notification processing begins, the plugin must obtain a valid deployed
configuration from internal Node-RED. If Node-RED is unavailable or the
configuration is invalid, plugin startup fails and Signal-K logging reports the
reason. The plugin must not silently fall back to stale or default behaviour.

## Deploy integration and updates

The internal Node-RED runtime exposes its event bus in the same Signal-K
process. A deploy emits `runtime-event` with `id: "runtime-deploy"` and a flow
revision. The Notification Engine listens to that event through the shared
Node-RED runtime and reloads the active flow configuration.

The Notification Engine must not modify files below Signal K's managed
`node_modules` directory at runtime. No patch of
`@signalk/signalk-node-red/index.js` is required. A Node-RED package update
may change the runtime event API; the engine must check that the expected event
interface exists and refuse startup with a Signal-K log error if it does not.

Node-RED flow files are stored separately in the configured Node-RED user
directory (on the current Raspberry Pi installation this is
`/home/pi/.node-red/flows.json`; some Signal K installations use
`/home/pi/.signalk/red/flows_openplotter.json`) and are not modified by a
Node-RED package update. After a compatible update and Signal-K restart, the
existing deployed flows remain the source of the configuration.

The Notification Engine also keeps the last flow that contained a valid
`Notification Engine config` node in a sibling directory named
`notification-engine-backups/last-valid-flow.json`. A valid startup or deploy
updates this backup atomically. If a deploy removes or corrupts the
Notification Engine configuration, the embedded runtime restores that backup
through Node-RED's `setFlows` API, retaining the currently deployed
credentials. A flow without a valid engine configuration is therefore never
accepted silently as the new notification configuration.

## Change detection

The deploy event is only a reload trigger. The engine extracts the
Notification-Engine configuration from the active flow, normalizes it into a
stable representation, and calculates a checksum. A deploy with the same
checksum does not restart processing. A changed checksum is validated first
and then applied as one configuration update. The Node-RED revision is useful
for diagnostics but is not by itself evidence of a behavioural change.

## First integration test

The first test deliberately uses only the state policy. The prototype's
existing `Policy snapshot` inject node is to be replaced by a dedicated
Notification Engine configuration block with this payload:

```json
{
  "schemaVersion": 1,
  "notificationEngine": {
    "stateOrder": ["emergency", "alarm", "warn", "normal"],
    "visibleStates": ["emergency", "alarm", "warn", "normal"]
  }
}
```

The adapter test covers four cases: valid startup configuration, identical
deploy without an update, changed state policy with exactly one update, and a
malformed or unsupported payload that is rejected without replacing the last
valid configuration. The test uses an isolated prototype tab; existing
Signal-K production flows are not changed.
