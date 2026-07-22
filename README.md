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

    type: custom:notification-center-card
    title: Notifications
    notifications: all
    show_muted: false
    show_inactive: false
    sort: severity

The card shows only active, unmuted notifications by default. Muted active notifications remain evaluated but are hidden until their mute timer expires. The Show Muted button can reveal active muted rows.

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
- **Default active notification duration**: How long an active notification remains available before it expires. This is the user-facing meaning of the internal term "persistence."
- **Default mute duration**: How long a muted active notification stays hidden before it becomes visible again.
- **Default mobile devices**: Devices used when a notification does not specify its own device list.
- **Notification name**: The friendly name shown in the dashboard and mobile notification.
- **Notification ID**: A unique, stable internal key. Use lowercase letters, numbers, and underscores; dashboard cards use this value to select notifications.
- **Evaluation mode**: Choose **Boolean** for an on/off result or **Outcome** for several named results.
- **Entity to evaluate**: Optional entity picker for Boolean notifications. When supplied, the entity state is evaluated as on/off and the Jinja template is not required for the basic case.
- **Jinja evaluation template**: Optional advanced logic that returns the value used by the notification. Templates can read Home Assistant states and attributes.
- **Outcome definitions (JSON)**: A JSON object mapping returned values to the title, message, icon, severity, active state, and optional CSS for that result.
- **Mobile devices to notify**: One or more device targets. An empty list disables mobile delivery for that notification.
- **Active duration override** and **Mute duration override**: Per-notification timing values that replace the panel defaults.

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
