from datetime import time

from pydantic import BaseModel, field_serializer


class RestaurantOut(BaseModel):
    id: int
    name: str
    description: str | None
    address: str | None
    phone: str | None
    open_time: time
    close_time: time
    slot_duration_minutes: int
    is_active: bool

    model_config = {"from_attributes": True}

    @field_serializer("open_time", "close_time")
    def _serialize_time(self, value: time) -> str:
        return value.strftime("%H:%M")
