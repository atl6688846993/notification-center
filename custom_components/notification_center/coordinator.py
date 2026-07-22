from __future__ import annotations

from datetime import datetime, timedelta
import logging
from typing import Any

from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.template import Template
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator

from .const import (
    CONF_MODE,
    CONF_MUTE_DURATION,
    CONF_MUTE_UNIT,
    CONF_ENTITY,
    CONF_OUTCOMES,
    CONF_PERSISTENCE,
    CONF_PERSISTENCE_UNIT,
    CONF_TEMPLATE,
    DEFAULT_SETTINGS,
    DOMAIN,
    MODE_BOOLEAN,
)
from .models import RuntimeNotification
from .delivery import NotificationDelivery

_LOGGER = logging.getLogger(__name__)


def _duration(value: Any, unit: str) -> timedelta:
    value = max(0, float(value or 0))
    if unit == "minutes":
        return timedelta(minutes=value)
    if unit == "days":
        return timedelta(days=value)
    return timedelta(hours=value)


class NotificationCoordinator(DataUpdateCoordinator[dict[str, RuntimeNotification]]):
    def __init__(self, hass: HomeAssistant, entry) -> None:
        super().__init__(hass, _LOGGER, name="Notification Center", update_interval=None)
        self.entry = entry
        self.settings = {**DEFAULT_SETTINGS, **entry.data.get("settings", {})}
        self.definitions = entry.data.get("notifications", [])
        self.runtime: dict[str, RuntimeNotification] = {}
        self._unsub_state = None
        self._unsub_timer = None
        self.delivery = NotificationDelivery(hass)

    async def async_setup(self) -> None:
        self._unsub_state = self.hass.bus.async_listen("state_changed", self._state_changed)
        self._unsub_timer = async_track_time_interval(
            self.hass, self._scheduled_update, timedelta(seconds=30)
        )
        await self.async_refresh()

    async def async_shutdown(self) -> None:
        if self._unsub_state:
            self._unsub_state()
        if self._unsub_timer:
            self._unsub_timer()

    @callback
    def _state_changed(self, event: Event) -> None:
        self.hass.async_create_task(self.async_refresh())

    @callback
    def _scheduled_update(self, _now) -> None:
        self.hass.async_create_task(self.async_refresh())

    async def _async_update_data(self) -> dict[str, RuntimeNotification]:
        now = datetime.now().astimezone()
        for definition in self.definitions:
            notification_id = definition["id"]
            previous = self.runtime.get(notification_id)
            current = self._evaluate(definition)
            if not previous and current.active:
                current.activated_at = now
                current.expires_at = now + self._persistence(definition)
            elif previous and current.state != previous.state:
                current.activated_at = (
                    now if current.active and not previous.active else previous.activated_at
                )
                current.expires_at = (
                    now + self._persistence(definition) if current.active else None
                )
                current.muted_until = previous.muted_until
                current.last_delivered = previous.last_delivered
            elif previous:
                current.activated_at = previous.activated_at
                current.expires_at = previous.expires_at
                current.muted_until = previous.muted_until
                current.last_delivered = previous.last_delivered
            elif notification_id in self.entry.data.get("runtime", {}):
                persisted = self.entry.data["runtime"][notification_id]
                if persisted.get("muted_until"):
                    try:
                        current.muted_until = datetime.fromisoformat(persisted["muted_until"])
                    except ValueError:
                        current.muted_until = None
            self.runtime[notification_id] = current
            if previous and current.state != previous.state:
                event_name = None
                if current.active and not previous.active:
                    event_name = "activate"
                elif current.active and previous.active:
                    event_name = "outcome_change"
                elif previous.active and not current.active:
                    event_name = "clear"
                if event_name:
                    delivery_definition = dict(definition)
                    delivery_definition["devices"] = (
                        definition.get("devices") or self.settings.get("devices", [])
                    )
                    await self.delivery.async_deliver(delivery_definition, current, event_name)
        self.async_set_updated_data(self.runtime)
        return self.runtime

    def _persistence(self, definition: dict[str, Any]) -> timedelta:
        settings = {**self.settings, **definition.get("persistence", {})}
        return _duration(settings.get(CONF_PERSISTENCE), settings.get(CONF_PERSISTENCE_UNIT))

    def _evaluate(self, definition: dict[str, Any]) -> RuntimeNotification:
        try:
            mode = definition.get(CONF_MODE, MODE_BOOLEAN)
            if mode == MODE_BOOLEAN and definition.get(CONF_ENTITY):
                rendered = self.hass.states.get(definition[CONF_ENTITY])
                rendered = rendered.state if rendered else "off"
            else:
                template = Template(definition.get(CONF_TEMPLATE) or "false", self.hass)
                rendered = template.async_render(parse_result=False).strip()
            if mode == MODE_BOOLEAN:
                active = str(rendered).lower() in ("true", "on", "yes", "1")
                state = "on" if active else "off"
                outcomes = definition.get(CONF_OUTCOMES, {})
                outcome = next(
                    (outcomes[key] for key in (state, "true" if active else "false", "1" if active else "0") if key in outcomes),
                    {},
                )
            else:
                state = rendered or "0"
                outcome = definition.get(CONF_OUTCOMES, {}).get(state, {})
                active = bool(outcome.get("active", state not in ("0", "off", "false")))
            return RuntimeNotification(
                notification_id=definition["id"],
                name=definition.get("name", definition["id"]),
                state=state,
                active=active,
                outcome=outcome,
            )
        except Exception as err:
            _LOGGER.error("Notification %s template failed: %s", definition["id"], err)
            return RuntimeNotification(
                notification_id=definition["id"],
                name=definition.get("name", definition["id"]),
                state="0",
                active=False,
                error=str(err),
            )

    async def async_test_notification(self, notification_id: str, outcome_key: str | None = None) -> None:
        definition = self.definition(notification_id)
        if not definition:
            return
        if outcome_key in (None, "__current__"):
            item = self._evaluate(definition)
        else:
            outcome = definition.get(CONF_OUTCOMES, {}).get(outcome_key, {})
            active = bool(outcome.get("active", outcome_key not in ("0", "off", "false")))
            item = RuntimeNotification(
                notification_id=notification_id,
                name=definition.get("name", notification_id),
                state=outcome_key,
                active=active,
                outcome=outcome,
            )
        delivery_definition = dict(definition)
        delivery_definition["devices"] = definition.get("devices") or self.settings.get("devices", [])
        await self.delivery.async_test(delivery_definition, item)

    def definition(self, notification_id: str) -> dict[str, Any] | None:
        return next((item for item in self.definitions if item["id"] == notification_id), None)

    def active_count(self) -> int:
        return sum(
            1 for item in self.runtime.values()
            if item.active and not item.is_muted and not self.global_muted
        )

    @property
    def global_muted(self) -> bool:
        value = self.settings.get("global_muted_until")
        if not value:
            return False
        try:
            return datetime.fromisoformat(value) > datetime.now().astimezone()
        except ValueError:
            return False

    async def async_mute(self, notification_id: str, duration: float | None = None, unit: str | None = None) -> None:
        item = self.runtime[notification_id]
        definition = self.definition(notification_id) or {}
        mute = {**self.settings, **definition.get("mute", {})}
        item.muted_until = datetime.now().astimezone() + _duration(
            duration if duration is not None else mute.get(CONF_MUTE_DURATION),
            unit or mute.get(CONF_MUTE_UNIT),
        )
        self._persist_runtime()
        self.async_set_updated_data(self.runtime)

    async def async_unmute(self, notification_id: str) -> None:
        if notification_id in self.runtime:
            self.runtime[notification_id].muted_until = None
            self._persist_runtime()
            self.async_set_updated_data(self.runtime)

    async def async_global_mute(self, duration: float | None = None, unit: str | None = None) -> None:
        self.settings["global_muted_until"] = (
            datetime.now().astimezone() + _duration(
                duration if duration is not None else self.settings["mute_duration"],
                unit or self.settings["mute_unit"],
            )
        ).isoformat()
        self._persist_runtime()
        self.async_set_updated_data(self.runtime)

    def _persist_runtime(self) -> None:
        data = dict(self.entry.data)
        data["settings"] = self.settings
        data["runtime"] = {
            key: {
                "muted_until": value.muted_until.isoformat() if value.muted_until else None,
                "activated_at": value.activated_at.isoformat() if value.activated_at else None,
                "expires_at": value.expires_at.isoformat() if value.expires_at else None,
            }
            for key, value in self.runtime.items()
        }
        self.hass.config_entries.async_update_entry(self.entry, data=data)
