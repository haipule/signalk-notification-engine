# Signal K Notification API analysis

## Authority and operating modes

The Signal K server Notification API is the primary integration surface. The
plugin API is `app.notifications`. In the normal managed mode it supports
`list`, `getId`, `getPath`, `raise`, `update`, `silence`, `silenceAll`,
`acknowledge`, `acknowledgeAll`, and `clear`.

The server setting `notifications.manageNotifications` is a required feature
check. When it is `false`, the server passes notification deltas through to the
data model but does not maintain their lifecycle. `list()` can still expose
self-context data-model values, but action methods throw an error with code
`NOTIFICATION_MANAGER_DISABLED`. The manager must remain read-only and show
this condition in its diagnostics and UI.

## Notification model

API-managed notification values contain `state`, `message`, `method`, a stable
`id`, and `status`. They may also contain `createdAt`, `position`, and arbitrary
structured `data`. The manager records the Signal K path and source alongside
these fields, plus its own `lastUpdatedAt`, category, and local presentation
priority.

`status` has two kinds of data:

- Permissions: `canSilence`, `canAcknowledge`, and `canClear`.
- Performed actions: `silenced`, `acknowledged`, and optionally
  `acknowledgedAt`.

An API notification has a server-assigned ID. Ordinary `notifications.*` delta
values can be viewed and classified too, but are not necessarily API-managed.
The server documents that their `canClear` is always `false`.

## Lifecycle rules

| Operation | Meaning | Manager rule |
|---|---|---|
| Active | A state other than normal/nominal as defined by Signal K. | Display and evaluate policy. |
| Silence | Alarm remains active; sound is removed/suppressed. | Only if `canSilence`; never silence `emergency`. |
| Acknowledge | Operator has seen the alarm; it may remain active. | Only if `canAcknowledge`. |
| Clear | Signal K transitions the alarm to `normal`. | Only if `canClear`; never use as a local dismiss button. |

The manager does not publish a `normal` delta merely because a user dismisses a
card. For classic producer deltas, the producer is responsible for clearing
the underlying condition.

## Store reconstruction

At start, retrieve `app.notifications.list()` to establish a snapshot. Then
apply subsequent notification deltas to the local store. The store is a cache,
not the source of truth: it must tolerate duplicate and out-of-order updates,
and it must be rebuilt after restart.

## Implications for the WebApp

The WebApp receives an all-notifications view. Each card displays its current
Signal K state, API identifier where available, status flags, source/path, and
the effective local policy. Buttons are hidden or disabled based on the current
capability flags and report errors returned by the server.
