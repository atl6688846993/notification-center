from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class RuntimeNotification:
    notification_id: str
    name: str
    state: str = "0"
    active: bool = False
    muted_until: datetime | None = None
    activated_at: datetime | None = None
    expires_at: datetime | None = None
    last_delivered: datetime | None = None
    outcome: dict[str, Any] = field(default_factory=dict)
    error: str | None = None

    @property
    def is_muted(self) -> bool:
        return bool(self.muted_until and self.muted_until > datetime.now().astimezone())

    @property
    def visible(self) -> bool:
        return self.active and not self.is_muted

