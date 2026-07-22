# Notification Center

Notification Center is a Home Assistant custom integration and Lovelace card for named, Jinja-driven notifications. It evaluates Boolean or multi-outcome templates, keeps active/muted state, and sends mobile-app notifications to selected Home Assistant devices.

## Status

Initial development release. This project is intended for testing and general-purpose Home Assistant notification workflows.

## Features

- Boolean and multi-outcome Jinja templates.
- Panel-wide persistence and mute defaults.
- Per-notification persistence and mute overrides.
- Active-only dashboard list behavior.
- Per-notification device targets, including none, one, or multiple devices.
- Mobile-app delivery on activation and active-outcome changes.
- Repeating, clear, and mute-expiration delivery options are disabled by default.
- Notification-specific CSS overrides card-wide CSS when supplied.

## Installation

1. Open HACS.
2. Add https://github.com/atl6688846993/notification-center as a custom repository if it is not indexed.
3. Install the Notification Center integration.
4. Restart Home Assistant.
5. Add Notification Center from Settings > Devices & services.
6. Add the frontend resource below if HACS does not register it automatically:
   - URL: /hacsfiles/notification-center/notification-center-card.js
   - Type: JavaScript Module
7. Add the Notifications List card to a test dashboard.

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

## Configuration guidance

Create notification definitions in the integration options flow. Use generic or
user-defined names, entity references, messages, outcomes, device targets,
persistence overrides, and mute settings. The project does not require any
specific household configuration.

## License and attribution

This project is released under the MIT License. It is an independent community project and is not affiliated with or endorsed by the Home Assistant project. Home Assistant is a trademark of its respective owner. Third-party dependencies retain their original licenses.
