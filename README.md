# Notification Center

Notification Center is a Home Assistant custom integration and Lovelace card for named, Jinja-driven notifications. It evaluates Boolean or multi-outcome templates, keeps active/muted state, and sends mobile-app notifications to selected Home Assistant devices.

## Status

Initial development release. This project is intended for testing and migration from dashboard-only notification prototypes.

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

## Jinja evaluation

Boolean mode should return true or false:

    {{ states('sensor.hvac_filter_days_remaining') | int(999) <= 7 }}

Outcome mode should return a configured outcome key:

    {% set moisture = states('sensor.plant_sensor_1_soil_moisture') | float(-1) %}
    {% set target = states('sensor.sensor_1_moisture_threshold') | float(-1) %}
    {% if moisture <= target - 5 %}
      needs_water
    {% elif moisture >= target + 15 %}
      too_wet
    {% else %}
      0
    {% endif %}

The returned value selects the outcome. The outcome supplies the message, title, icon, severity, styling, and delivery behavior. Templates should return an evaluation value, not HTML or CSS.

## Current migration

The first configuration includes:

- HVAC Filter
- Cat Feeder
- Plant Sensor 1
- Plant Sensor 2

The Dog Poop placeholder is intentionally excluded.

## License and attribution

This project is released under the MIT License. It is an independent community project and is not affiliated with or endorsed by the Home Assistant project. Home Assistant is a trademark of its respective owner. Third-party dependencies retain their original licenses.

