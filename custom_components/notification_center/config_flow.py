from __future__ import annotations

import json

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import (
    CONF_DEVICES,
    CONF_MUTE_DURATION,
    CONF_MUTE_UNIT,
    CONF_NAME,
    CONF_NOTIFICATIONS,
    CONF_PERSISTENCE,
    CONF_PERSISTENCE_UNIT,
    CONF_SETTINGS,
    DEFAULT_SETTINGS,
    DOMAIN,
    MODE_BOOLEAN,
    MODE_OUTCOME,
)

_UNIT_SELECTOR = selector.SelectSelector(
    selector.SelectSelectorConfig(
        options=["minutes", "hours", "days"],
        mode=selector.SelectSelectorMode.DROPDOWN,
    )
)
_MODE_SELECTOR = selector.SelectSelector(
    selector.SelectSelectorConfig(
        options=[MODE_BOOLEAN, MODE_OUTCOME],
        mode=selector.SelectSelectorMode.DROPDOWN,
    )
)


class NotificationCenterConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        if user_input is not None:
            return self.async_create_entry(
                title=user_input[CONF_NAME],
                data={
                    CONF_SETTINGS: {
                        CONF_PERSISTENCE: user_input[CONF_PERSISTENCE],
                        CONF_PERSISTENCE_UNIT: user_input[CONF_PERSISTENCE_UNIT],
                        CONF_MUTE_DURATION: user_input[CONF_MUTE_DURATION],
                        CONF_MUTE_UNIT: user_input[CONF_MUTE_UNIT],
                        CONF_DEVICES: user_input.get(CONF_DEVICES, []),
                    },
                    CONF_NOTIFICATIONS: [],
                },
            )
        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_NAME, default="Notification Center"): str,
                    vol.Required(CONF_PERSISTENCE, default=24): vol.Coerce(float),
                    vol.Required(CONF_PERSISTENCE_UNIT, default="hours"): _UNIT_SELECTOR,
                    vol.Required(CONF_MUTE_DURATION, default=4): vol.Coerce(float),
                    vol.Required(CONF_MUTE_UNIT, default="hours"): _UNIT_SELECTOR,
                    vol.Optional(CONF_DEVICES, default=[]): selector.DeviceSelector(
                        selector.DeviceSelectorConfig(multiple=True)
                    ),
                }
            ),
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return NotificationCenterOptionsFlow()


class NotificationCenterOptionsFlow(config_entries.OptionsFlow):
    def __init__(self):
        self._selected_id = None

    async def async_step_init(self, user_input=None):
        return self.async_show_menu(
            step_id="init",
            menu_options=["settings", "add_notification", "edit_notification", "remove_notification"],
        )

    async def async_step_settings(self, user_input=None):
        if user_input is not None:
            data = dict(self.config_entry.data)
            settings = dict(data.get(CONF_SETTINGS, {}))
            settings.update(user_input)
            data[CONF_SETTINGS] = settings
            self.hass.config_entries.async_update_entry(self.config_entry, data=data)
            return self.async_create_entry(title="", data={})
        settings = self.config_entry.data.get(CONF_SETTINGS, DEFAULT_SETTINGS)
        return self.async_show_form(
            step_id="settings",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_PERSISTENCE, default=settings.get(CONF_PERSISTENCE, 24)): vol.Coerce(float),
                    vol.Required(CONF_PERSISTENCE_UNIT, default=settings.get(CONF_PERSISTENCE_UNIT, "hours")): _UNIT_SELECTOR,
                    vol.Required(CONF_MUTE_DURATION, default=settings.get(CONF_MUTE_DURATION, 4)): vol.Coerce(float),
                    vol.Required(CONF_MUTE_UNIT, default=settings.get(CONF_MUTE_UNIT, "hours")): _UNIT_SELECTOR,
                }
            ),
        )

    async def async_step_add_notification(self, user_input=None):
        if user_input is not None:
            notifications = list(self.config_entry.data.get(CONF_NOTIFICATIONS, []))
            notifications.append(self._normalize(user_input))
            self._save(notifications)
            return await self.async_step_init()
        return self.async_show_form(step_id="add_notification", data_schema=self._notification_schema())

    async def async_step_edit_notification(self, user_input=None):
        notifications = self.config_entry.data.get(CONF_NOTIFICATIONS, [])
        if not notifications:
            return self.async_abort(reason="no_notifications")
        if user_input is not None and self._selected_id:
            target = next(item for item in notifications if item["id"] == self._selected_id)
            updated = self._normalize(user_input)
            updated["id"] = target["id"]
            self._save([updated if item["id"] == target["id"] else item for item in notifications])
            return await self.async_step_init()
        if user_input is not None:
            self._selected_id = user_input["selected_id"]
            target = next(item for item in notifications if item["id"] == self._selected_id)
            return self.async_show_form(step_id="edit_notification", data_schema=self._notification_schema(target))
        return self.async_show_form(
            step_id="edit_notification",
            data_schema=vol.Schema(
                {
                    vol.Required("selected_id"): vol.In(
                        {item["id"]: item.get("name", item["id"]) for item in notifications}
                    )
                }
            ),
        )

    async def async_step_remove_notification(self, user_input=None):
        notifications = self.config_entry.data.get(CONF_NOTIFICATIONS, [])
        if not notifications:
            return self.async_abort(reason="no_notifications")
        if user_input is not None:
            self._save([item for item in notifications if item["id"] != user_input["selected_id"]])
            return await self.async_step_init()
        return self.async_show_form(
            step_id="remove_notification",
            data_schema=vol.Schema(
                {
                    vol.Required("selected_id"): vol.In(
                        {item["id"]: item.get("name", item["id"]) for item in notifications}
                    )
                }
            ),
        )

    def _notification_schema(self, item=None):
        item = item or {}
        return vol.Schema(
            {
                vol.Required(CONF_NAME, default=item.get(CONF_NAME, "")): str,
                vol.Required("id", default=item.get("id", "")): str,
                vol.Required("mode", default=item.get("mode", MODE_BOOLEAN)): _MODE_SELECTOR,
                vol.Required("template", default=item.get("template", "false")): selector.TemplateSelector(),
                vol.Optional("outcomes", default=json.dumps(item.get("outcomes", {}), indent=2)): selector.TextSelector(
                    selector.TextSelectorConfig(multiline=True)
                ),
                vol.Optional(CONF_DEVICES, default=item.get(CONF_DEVICES, [])): selector.DeviceSelector(
                    selector.DeviceSelectorConfig(multiple=True)
                ),
                vol.Optional(CONF_PERSISTENCE, default=str(item.get(CONF_PERSISTENCE, ""))): str,
                vol.Optional(CONF_PERSISTENCE_UNIT, default=item.get(CONF_PERSISTENCE_UNIT, "hours")): _UNIT_SELECTOR,
                vol.Optional(CONF_MUTE_DURATION, default=str(item.get(CONF_MUTE_DURATION, ""))): str,
                vol.Optional(CONF_MUTE_UNIT, default=item.get(CONF_MUTE_UNIT, "hours")): _UNIT_SELECTOR,
            }
        )

    def _normalize(self, value):
        item = dict(value)
        for key in (CONF_PERSISTENCE, CONF_MUTE_DURATION):
            if item.get(key, "") == "":
                item.pop(key, None)
            elif item.get(key) is not None:
                item[key] = float(item[key])
        try:
            item["outcomes"] = json.loads(item.get("outcomes", "{}"))
        except (TypeError, ValueError):
            item["outcomes"] = {}
        return item

    def _save(self, notifications):
        data = dict(self.config_entry.data)
        data[CONF_NOTIFICATIONS] = notifications
        self.hass.config_entries.async_update_entry(self.config_entry, data=data)
