# Notification Center

![Sputnik Digital](custom_components/notification_center/brand/logo.png)

Notification Center is a Home Assistant custom integration and Lovelace card for named, Jinja-driven notifications. It evaluates Boolean or multi-outcome templates, keeps active/muted state, and sends mobile-app notifications to selected Home Assistant devices.

The integration is branded with the Sputnik Digital logo. Home Assistant uses the bundled `brand/icon.png` and `brand/logo.png` files for the Notification Center integration surfaces.

## Status

Initial development release. This project is intended for testing and general-purpose Home Assistant notification workflows.

## Features

- Boolean and multi-outcome Jinja templates.
- Optional entity picker for simple Boolean `on`/`off` evaluation.
- Panel-wide active notification duration and mute defaults.
- Per-notification active duration and mute overrides.
- Active-only dashboard list behavior.
- Per-notification device targets, including none, one, or multiple devices.
- Mobile-app delivery on activation and active-outcome changes.
- A **Test notification delivery** flow for sending a selected outcome without changing runtime state.
- Repeating, clear, and mute-expiration delivery options are disabled by default.
- Notification-specific CSS overrides card-wide CSS when supplied.

## Installation

1. Open HACS.
2. Add `https://github.com/atl6688846993/notification-center` as a custom repository if it is not indexed. Select **Integration** as the repository category.
3. Install **Notification Center**.
4. Restart Home Assistant.
5. Open **Settings > Devices & services > Add integration** and add **Notification Center**.
6. Copy the repository's `notification-center-card.js` file into Home Assistant's `/config/www/` directory as `notification-center-card.js`. File Editor or SSH can be used for this step.
7. Add the frontend resource if HACS does not register it automatically:
   - URL: `/local/notification-center-card.js`
   - Type: `JavaScript Module`
8. Restart or refresh Home Assistant after adding the resource.
9. Add a `custom:notification-center-card` to a dashboard.

The integration includes its Sputnik Digital icon and logo under
`custom_components/notification_center/brand/`.

## Card

The visual card editor provides controls for the title, empty-list message,
notification selection, sorting, initial muted/inactive visibility, and custom
CSS. Select **All configured notifications** to include new definitions
automatically, or turn it off to choose notifications from a checklist.

```yaml
type: custom:notification-center-card
title: Notifications
empty_text: All clear
notifications:
  - front_door
  - hvac_filter
show_muted: false
show_inactive: false
sort: severity
```

The card shows only active, unmuted notifications by default. Muted active notifications remain evaluated but are hidden until their mute timer expires. The Show Muted button can reveal active muted rows.

### Card styling

The card editor's **Custom CSS** field applies CSS inside that card. These
stable classes are available:

- `.row`: Every notification row.
- `.is-active` and `.is-inactive`: Whether the notification is currently active.
- `.is-muted` and `.is-unmuted`: Whether the notification is currently muted.
- `.value-0`, `.value-1`, `.value-true`, `.value-false`, and `.value-<outcome>`: The evaluated outcome. Custom outcome names are converted to lowercase CSS-safe names.
- `.severity-normal`, `.severity-info`, `.severity-warning`, `.severity-error`, and `.severity-critical`: The configured severity.
- `.notification-<id>`: A single notification, such as `.notification-front_door`.
- `.notification-icon`: The leading status icon.
- `.notification-name`: The notification's display name.
- `.notification-message`: The outcome message.
- `.notification-meta`: Outcome or mute timing text.
- `.mute-button`: The row's mute or unmute button.
- `.toggle-muted`: The card header's show/hide muted button.
- `.empty`: The empty-list message.

Example card-wide styling:

```yaml
type: custom:notification-center-card
title: Notifications
notifications: all
empty_text: No alerts need attention
custom_css: |
  .row.is-active {
    background: rgba(255, 255, 255, 0.08);
  }
  .row.value-1,
  .row.value-true {
    border-left-color: #ff5252;
  }
  .notification-front_door .notification-icon {
    color: #ffb300;
  }
  .notification-name {
    font-size: 1rem;
    font-weight: 700;
  }
  .notification-message,
  .notification-meta {
    color: rgba(255, 255, 255, 0.72);
  }
  .mute-button {
    color: rgba(255, 255, 255, 0.65);
  }
  .mute-button:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.12);
  }
```

Each outcome may also define a `css` string. Outcome CSS is applied directly to
that row and therefore overrides matching card-wide declarations:

```yaml
needs_attention:
  active: true
  title: Filter needs attention
  message: Replace the HVAC filter soon.
  icon: mdi:air-filter
  severity: warning
  css: "--notification-color: #ffb300; background: rgba(255, 179, 0, 0.12);"
```

## Active Notifications sensor

The integration creates `sensor.active_notifications` on setup. This sensor is
the total count of currently active, unmuted notification definitions. It is a
summary sensor, not a notification definition, and it does not create example
notifications automatically. A clean installation starts with zero configured
notifications; add definitions through the integration's **Configure** menu.

## Jinja evaluation

Boolean mode should return true or false:

    {{ is_state('input_boolean.example_notification_enabled', 'on')
       and states('sensor.example_value') | int(999) <= 7 }}

Outcome mode should return a configured outcome key:

    {% set value = states('sensor.example_value') | float(-1) %}
    {% if value < 0 %}
      0
    {% elif value < 25 %}
      needs_attention
    {% elif value > 90 %}
      critical
    {% else %}
      0
    {% endif %}

The returned value selects the outcome. The outcome supplies the message, title, icon, severity, styling, and delivery behavior. Templates should return an evaluation value, not HTML or CSS.

## Configuration Guide

Open the Notification Center integration and choose **Configure**. The options
menu uses these terms:

- **Panel settings**: Defaults used when an individual notification does not provide an override.
- **Default maximum active time**: The longest an alert may remain active. It clears sooner when its entity or template becomes inactive.
- **Default mute time**: How long a muted active alert stays hidden before it appears again.
- **Default mobile notification devices**: Devices used when a notification does not specify its own delivery targets.
- **Display name**: Friendly name shown on cards and in mobile notifications.
- **Unique notification ID**: Stable internal key used by cards and actions. Use lowercase letters, numbers, and underscores.
- **How should this notification be evaluated?**: Choose **Boolean (on/off)** for two-state checks or **Multiple outcomes** for a template that returns several named values.
- **Entity for a simple on/off check**: Direct entity picker for Boolean notifications. It is used only when the Jinja template is blank.
- **Advanced Jinja template**: Optional logic for checks involving multiple entities, attributes, or calculations. When supplied, it takes precedence over the entity picker.
- **Messages and appearance for each result**: Expandable YAML/JSON object mapping returned values to `active`, `title`, `message`, `icon`, `severity`, and optional `css` fields.
- **Mobile devices for this notification**: One or more Home Assistant mobile app devices. An empty list disables mobile delivery for that definition.
- **Active time** and **Mute time** overrides: Optional per-notification values that replace Panel settings.

### Active and mute timing

**Maximum active time** starts when a notification first becomes active or
changes to another active outcome. It is a maximum display window, not a delay:

- If the source entity or template clears first, the notification clears immediately.
- If maximum active time expires first, the notification becomes inactive and disappears from cards.
- It can activate again only after its source clears and later becomes active again.
- Cards show `Active until` for active, unmuted rows.

**Mute time** only hides an active notification. It does not clear the source,
change the outcome, or extend maximum active time:

- If mute expires while the notification is still active and within its active window, it appears again.
- If maximum active time expires while muted, the notification remains inactive when the mute ends.
- `Minutes`, `Hours`, and `Days` are elapsed durations.
- `Days from now` uses local calendar boundaries. A value of `1` always ends at midnight at the start of tomorrow; `2` ends at midnight at the start of the following day.

### Boolean notifications

For a simple entity-based notification, choose **Boolean**, select an **Entity to evaluate**, and define `on` and `off` outcomes. The `active` property controls whether the result appears in the dashboard.

```json
{
  "on": {
    "active": true,
    "title": "Door is open",
    "message": "The back door is open.",
    "icon": "mdi:door-open",
    "severity": "warning"
  },
  "off": {
    "active": false,
    "title": "Door is closed",
    "message": "The back door is closed.",
    "icon": "mdi:door-closed",
    "severity": "normal"
  }
}
```

Boolean outcomes may also use `true`/`false` or `1`/`0` keys. The entity picker is the clearest choice for a direct on/off check; use the Jinja template when the Boolean result depends on multiple entities or conditions.

### Outcome notifications

Choose **Outcome** when the template can return more than two meaningful results. The returned text must match an outcome key. Use `0`, `off`, or `false` for a clear/inactive result unless every result should be active.

```jinja
{% set value = states('sensor.example_value') | float(-1) %}
{% if value < 0 %}
  0
{% elif value < 25 %}
  needs_attention
{% elif value > 90 %}
  critical
{% else %}
  0
{% endif %}
```

Templates return evaluation values only. They should not return HTML or CSS. The matching outcome supplies the user-facing message and styling.

### Testing delivery

After editing a notification, choose **Configure > Test notification delivery**. Select the notification, then choose **Current template result** or a specific configured outcome. The integration sends the configured title and message to the notification's selected mobile devices with `[Test]` added to the title.

Testing does not activate, clear, mute, or extend the notification and does not change its duration timers. If no devices are selected on the notification or panel, the test has no mobile destination.

The same test can be called from an automation or Developer Tools using the
`notification_center.test` action:

```yaml
action: notification_center.test
data:
  notification_id: example_notification
  outcome: critical
```

Omit `outcome` to test the notification's current template result.

## License and attribution

This project is released under the MIT License. It is an independent community project and is not affiliated with or endorsed by the Home Assistant project. Home Assistant is a trademark of its respective owner. Third-party dependencies retain their original licenses.
