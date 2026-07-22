from __future__ import annotations

import re
from typing import Any

from homeassistant.helpers import device_registry as dr


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def _compact(value: str) -> str:
    return _slug(value).replace("_", "")


class NotificationDelivery:
    def __init__(self, hass) -> None:
        self.hass = hass

    async def async_deliver(self, definition: dict[str, Any], item, event_name: str) -> None:
        delivery = definition.get("delivery", {})
        events = delivery.get(
            "events",
            {"activate": True, "outcome_change": True, "repeat": False, "clear": False},
        )
        if not events.get(event_name, False):
            return

        device_ids = delivery.get("devices") or definition.get("devices") or []
        if not device_ids:
            return

        services = self._services_for_devices(device_ids)
        if not services:
            return

        title = item.outcome.get("title", item.name)
        message = item.outcome.get("message", item.name)
        for service in services:
            await self.hass.services.async_call(
                "notify",
                service,
                {"title": title, "message": message},
                blocking=False,
            )

    async def async_test(self, definition: dict[str, Any], item) -> None:
        device_ids = definition.get("devices", [])
        services = self._services_for_devices(device_ids)
        if not services:
            return
        title = item.outcome.get("title", item.name)
        message = item.outcome.get("message", item.name)
        for service in services:
            await self.hass.services.async_call(
                "notify",
                service,
                {"title": f"[Test] {title}", "message": message},
                blocking=False,
            )

    def _services_for_devices(self, device_ids: list[str]) -> set[str]:
        registry = dr.async_get(self.hass)
        names = {
            _slug(registry.async_get(device_id).name_by_user or registry.async_get(device_id).name)
            for device_id in device_ids
            if registry.async_get(device_id)
        }
        result = set()
        for service in self.hass.services.async_services().get("notify", {}):
            service_slug = _slug(service.removeprefix("mobile_app_"))
            if any(
                name and (
                    name in service_slug
                    or service_slug in name
                    or _compact(name) in _compact(service_slug)
                    or _compact(service_slug) in _compact(name)
                )
                for name in names
            ):
                result.add(service)
        return result
