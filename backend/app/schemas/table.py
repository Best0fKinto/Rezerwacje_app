from typing import Optional
from pydantic import BaseModel, Field


class TableOut(BaseModel):
    id: int
    restaurant_id: int
    table_number: str = Field(validation_alias="number")
    capacity: int
    is_active: bool

    model_config = {"from_attributes": True, "populate_by_name": True}


class TableCreate(BaseModel):
    number: str
    capacity: int


class TableUpdate(BaseModel):
    number: Optional[str] = None
    capacity: Optional[int] = None


class TableToggle(BaseModel):
    is_active: bool
