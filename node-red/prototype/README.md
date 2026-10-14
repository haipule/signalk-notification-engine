# Notification Engine – Node-RED prototype

Import `flows.json` into the embedded Node-RED instance. The flow shows:

```text
Notification Input → Policy/Filter → Visual
                                ├→ Sound
                                └→ History
```

`Demo alarm` creates an example notification. `Notification input` normalizes
it. The filter routes `alarm` and `emergency` in parallel to visual, sound, and
history adapters, which are initially debug nodes.

This prototype contains no configuration inject node. Select the imported
active tab in Signal K Plugin Config; connected branches ending at `Activate`
are the Rule Builder configuration. Host, maintenance, persistence, browser,
diagnostics, flow-selection, and external-task authorization settings remain
owned by Signal K Plugin Config.

This prototype requires no additional nodes.
