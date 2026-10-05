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

`Notification Engine config` contains the versioned configuration block for
the Notification Engine. The adapter extracts this block at startup and after
every deployment; the app does not interpret the Node-RED flow file.

This prototype requires no additional nodes.
