# Visual rule editor prototype

Import `flows-rule-editor.json` into the embedded Node-RED instance.

The flow is designed as a reusable pattern: connect a Notification node by
wire to the required property nodes. Unconnected nodes are permitted and have
no effect. The assembler collects properties by `ruleId`; `Validate rule`
checks the generated rules before deployment.

Notification order is not configurable here. It follows the Signal K
hierarchy and therefore the priority defined by the Signal K data model.

Alarm and emergency states are always recorded in history. Connect the
`History` node for additional states. A test alarm remains available as a
configuration option and is disabled by default.

Node color groups for a future editor UI:

- Visible/UI: green
- Color: blue
- Notification: yellow
- Sound: pink
- Validate/Deploy: gray or purple

The current sound semantics use `payload.sound.count`: `0` means loop, `1`
means one playback, and `2` through `99` specify the exact playback count. The
server continues to read the legacy `payload.sound.mode` and
`payload.sound.repeatCount` fields during migration; new or updated flows
should emit only `payload.sound.count`.

Optional `payload.sound.pauseSeconds` adds a pause only between fully completed
playbacks. Valid values are integers from `0` through `5`; an absent field or
`0` means no additional pause. Any other value makes the deployed rule invalid
so the server does not silently correct or clamp it.
