DOMAIN = "notification_center"
PLATFORMS = ["sensor"]

CONF_NAME = "name"
CONF_PERSISTENCE = "persistence"
CONF_PERSISTENCE_UNIT = "persistence_unit"
CONF_MUTE_DURATION = "mute_duration"
CONF_MUTE_UNIT = "mute_unit"
CONF_DEVICES = "devices"
CONF_NOTIFICATIONS = "notifications"
CONF_SETTINGS = "settings"
CONF_TEMPLATE = "template"
CONF_MODE = "mode"
CONF_OUTCOMES = "outcomes"
CONF_ENTITY = "entity"
CONF_ENABLED = "enabled"

MODE_BOOLEAN = "boolean"
MODE_OUTCOME = "outcome"

DEFAULT_SETTINGS = {
    CONF_PERSISTENCE: 24,
    CONF_PERSISTENCE_UNIT: "hours",
    CONF_MUTE_DURATION: 4,
    CONF_MUTE_UNIT: "hours",
    CONF_DEVICES: [],
}
