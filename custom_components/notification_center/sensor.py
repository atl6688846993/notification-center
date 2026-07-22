from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN


async def async_setup_entry(hass, entry, async_add_entities):
    coordinator = hass.data[DOMAIN][entry.entry_id]
    entities = [
        NotificationSensor(coordinator, definition["id"])
        for definition in coordinator.definitions
    ]
    entities.append(ActiveCountSensor(coordinator))
    async_add_entities(entities)


class NotificationSensor(CoordinatorEntity, SensorEntity):
    _attr_should_poll = False

    def __init__(self, coordinator, notification_id):
        super().__init__(coordinator)
        self.notification_id = notification_id
        self._attr_unique_id = f"notification_center_{notification_id}"
        self._attr_name = coordinator.definition(notification_id).get("name", notification_id)

    @property
    def native_value(self):
        item = self.coordinator.runtime.get(self.notification_id)
        return item.state if item else "0"

    @property
    def extra_state_attributes(self):
        item = self.coordinator.runtime.get(self.notification_id)
        if not item:
            return {}
        return {
            "notification_id": item.notification_id,
            "active": item.active,
            "visible": item.visible,
            "muted": item.is_muted,
            "global_muted": self.coordinator.global_muted,
            "muted_until": item.muted_until.isoformat() if item.muted_until else None,
            "activated_at": item.activated_at.isoformat() if item.activated_at else None,
            "expires_at": item.expires_at.isoformat() if item.expires_at else None,
            "message": item.outcome.get("message", ""),
            "title": item.outcome.get("title", item.name),
            "severity": item.outcome.get("severity", "normal"),
            "icon": item.outcome.get("icon"),
            "outcome": item.state,
            "error": item.error,
        }

    @property
    def icon(self):
        item = self.coordinator.runtime.get(self.notification_id)
        return item.outcome.get("icon") if item else "mdi:bell-outline"


class ActiveCountSensor(CoordinatorEntity, SensorEntity):
    _attr_should_poll = False
    _attr_name = "Active Notifications"
    _attr_unique_id = "notification_center_active_count"
    _attr_icon = "mdi:bell-badge"

    @property
    def native_value(self):
        return self.coordinator.active_count()
