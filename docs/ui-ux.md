# UI and touch interaction concept

## Goal

The alarm centre must remain legible and operable on a chart-table touch screen,
in motion and under time pressure. The active-alarm list is therefore the
primary interface; technical metadata must not crowd every notification card.

## Active notification cards

Each active notification is a compact vertical card. Cards are sorted by state
(`emergency`, `alarm`, `warn`, then lower states) and then by most recent
update.

When the operator selects the Notification column, rows within each state are
sorted by dot-delimited Signal K path segments. Shared path prefixes therefore
stay together even though the column continues to display the concise message.

`normal` and `nominal` notifications are also shown as calm status cards at
the end of the list. This avoids an empty centre during normal operation while
keeping warnings and alarms visually dominant.

The card shows only immediately actionable information:

- State first, as text and colour: `EMERGENCY`, `ALARM`, `WARN`.
- Category and short human-readable message.
- Visible state badges for `acknowledged` and `silenced`.
- Large permitted action buttons: Silence, Acknowledge, and Clear.

Colour is supplemental only. State text and badges must remain understandable
for colour-impaired users and in bright daylight.

## Selection and detail sheet

A single tap selects a card. The selected card receives a strong outline and
opens a non-modal detail sheet. Other active alarms remain visible throughout.

The sheet contains the information intentionally omitted from the card:

- source/plugin label;
- complete Signal K path;
- notification ID;
- state/status flags and the reason an action is unavailable;
- current local policy and later its editor;
- notification-specific history.

It has a visible `×` close button. Closing never dismisses or alters the
notification.

## Responsive layout proposal

```text
Wide screen / landscape

┌──────── Active notifications ────────┬──── Selected notification ────┐
│ [WARN] GNSS heading unavailable       │ GNSS heading unavailable   × │
│ [Silence] [Acknowledge]                │ Source · Path · Status       │
│                                         │ Policy · History              │
│ [ALARM] Anchor alarm                   │ [Silence] [Acknowledge]      │
│ [Silence] [Acknowledge]                │                               │
└────────────────────────────────────────┴───────────────────────────────┘

Narrow screen / portrait

┌──────── Active notifications ─────────┐
│ [WARN] GNSS heading unavailable        │
│ [ALARM] Anchor alarm                   │
└────────────────────────────────────────┘
              ↑ tap a card
┌──────── Bottom detail sheet ──────────┐
│ GNSS heading unavailable             × │
│ Source · Path · Status · Policy         │
│ [ Silence ] [ Acknowledge ]             │
└────────────────────────────────────────┘
```

On a narrow touch display, the sheet slides up from the bottom and may be
closed by its `×` button or a downward swipe. On a wide display it stays beside
the list as a persistent detail panel.

## Touch requirements

- Every primary target is at least 48 × 48 CSS pixels.
- Action buttons have labels as well as icons; no hover-only affordances.
- Keep generous gaps between destructive or high-impact actions.
- Acknowledge and Silence act immediately but report success/failure clearly.
- Clear requires an explicit confirmation step when it is permitted.
- Scrolling the list must not accidentally select or trigger an action.
- The selected state must be visible without relying only on a subtle colour
  change: use outline, elevation, or a clear selection marker.

## Design decision for the next implementation

Replace the current all-details-on-card layout with compact selectable cards
and the responsive detail sheet described here. Retain the current server-side
capability checks; the UI only changes how those safe actions are presented.
