from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class ReservationCreate(BaseModel):
    table_id: int
    date: date
    time_slot: str
    party_size: int
    notes: Optional[str] = None


class ReservationOut(BaseModel):
    id: int
    user_id: int
    table_id: int
    date: date
    time_slot: str
    party_size: int
    status: str
    notes: Optional[str]
    created_at: datetime
    table_number: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None

    model_config = {"from_attributes": True}


class ReservationUpdate(BaseModel):
    status: str


class AvailableSlot(BaseModel):
    table_id: int
    table_number: str
    capacity: int
    available_slots: list[str]


class AvailabilityResponse(BaseModel):
    date: str
    party_size: int
    slots: list[AvailableSlot]
