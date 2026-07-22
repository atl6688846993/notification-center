from __future__ import annotations

from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.config_entries import ConfigEntry

from .const import DOMAIN, PLATFORMS
from .coordinator import NotificationCoordinator


async def async_setup(hass: HomeAssistant, config) -> bool:
    hass.data.setdefault(DOMAIN, {})

    async def mute(call: ServiceCall) -> None:
        coordinator = next(iter(hass.data[DOMAIN].values()))
        await coordinator.async_mute(
            call.data["notification_id"],
            call.data.get("duration"),
            call.data.get("unit"),
        )

    async def unmute(call: ServiceCall) -> None:
        coordinator = next(iter(hass.data[DOMAIN].values()))
        await coordinator.async_unmute(call.data["notification_id"])

    async def global_mute(call: ServiceCall) -> None:
        coordinator = next(iter(hass.data[DOMAIN].values()))
        await coordinator.async_global_mute(call.data.get("duration"), call.data.get("unit"))

    async def test(call: ServiceCall) -> None:
        coordinator = next(iter(hass.data[DOMAIN].values()))
        await coordinator.async_test_notification(
            call.data["notification_id"], call.data.get("outcome", "__current__")
        )

    hass.services.async_register(DOMAIN, "mute", mute)
    hass.services.async_register(DOMAIN, "unmute", unmute)
    hass.services.async_register(DOMAIN, "global_mute", global_mute)
    hass.services.async_register(DOMAIN, "test", test)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    coordinator = NotificationCoordinator(hass, entry)
    hass.data[DOMAIN][entry.entry_id] = coordinator
    await coordinator.async_setup()
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    coordinator = hass.data[DOMAIN].pop(entry.entry_id)
    await coordinator.async_shutdown()
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
