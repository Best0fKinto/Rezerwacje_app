from pydantic import BaseModel


class TableOut(BaseModel):
    id: int
    restaurant_id: int
    number: str
    capacity: int
    is_active: bool

    model_config = {"from_attributes": True}


class TableToggle(BaseModel):
    is_active: bool
