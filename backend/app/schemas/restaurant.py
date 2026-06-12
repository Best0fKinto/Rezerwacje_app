from datetime import time
from typing import List

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


class TableOptimizationStats(BaseModel):
    table_id: int
    table_number: str
    capacity: int
    is_active: bool
    total_reservations: int
    confirmed_reservations: int
    avg_party_size: float
    avg_waste: float          # avg(capacity - party_size) for confirmed reservations
    utilization_pct: float    # confirmed / total_slots_in_window * 100


class OptimizationRecommendation(BaseModel):
    level: str   # "info" | "warning" | "danger"
    message: str


class OptimizationResponse(BaseModel):
    window_days: int
    table_stats: List[TableOptimizationStats]
    party_size_distribution: dict   # {"1": count, "2": count, ...}
    recommendations: List[OptimizationRecommendation]
