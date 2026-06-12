from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.base import get_db
from app.models.restaurant import Restaurant
from app.models.table import Table
from app.schemas.restaurant import RestaurantOut
from app.schemas.table import TableOut, TableCreate, TableUpdate, TableToggle
from app.api.deps import require_admin
from app.models.user import User

router = APIRouter()


@router.get("/restaurants", response_model=List[RestaurantOut])
def list_restaurants(db: Session = Depends(get_db)) -> List[RestaurantOut]:
    restaurants = db.query(Restaurant).filter(Restaurant.is_active == True).all()
    return restaurants


@router.get("/restaurants/{restaurant_id}", response_model=RestaurantOut)
def get_restaurant(restaurant_id: int, db: Session = Depends(get_db)) -> RestaurantOut:
    restaurant = (
        db.query(Restaurant)
        .filter(Restaurant.id == restaurant_id, Restaurant.is_active == True)
        .first()
    )
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found",
        )
    return restaurant


@router.get("/restaurants/{restaurant_id}/tables", response_model=List[TableOut])
def list_restaurant_tables(
    restaurant_id: int, db: Session = Depends(get_db)
) -> List[TableOut]:
    restaurant = (
        db.query(Restaurant)
        .filter(Restaurant.id == restaurant_id, Restaurant.is_active == True)
        .first()
    )
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found",
        )
    tables = (
        db.query(Table)
        .filter(Table.restaurant_id == restaurant_id)
        .order_by(Table.number)
        .all()
    )
    return tables


@router.post("/restaurants/{restaurant_id}/tables", response_model=TableOut, status_code=status.HTTP_201_CREATED)
def create_table(
    restaurant_id: int,
    payload: TableCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> TableOut:
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id, Restaurant.is_active == True).first()
    if not restaurant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")
    existing = db.query(Table).filter(Table.restaurant_id == restaurant_id, Table.number == payload.number).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Table with this number already exists")
    table = Table(restaurant_id=restaurant_id, number=payload.number, capacity=payload.capacity, is_active=True)
    db.add(table)
    db.commit()
    db.refresh(table)
    return table


@router.patch("/tables/{table_id}", response_model=TableOut)
def update_table(
    table_id: int,
    payload: TableUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> TableOut:
    table = db.query(Table).filter(Table.id == table_id).first()
    if not table:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Table not found")
    if payload.number is not None:
        conflict = db.query(Table).filter(
            Table.restaurant_id == table.restaurant_id,
            Table.number == payload.number,
            Table.id != table_id,
        ).first()
        if conflict:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Table number already in use")
        table.number = payload.number
    if payload.capacity is not None:
        table.capacity = payload.capacity
    db.commit()
    db.refresh(table)
    return table


@router.patch("/tables/{table_id}/toggle", response_model=TableOut)
def toggle_table(
    table_id: int,
    payload: TableToggle,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> TableOut:
    table = db.query(Table).filter(Table.id == table_id).first()
    if not table:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Table not found")
    table.is_active = payload.is_active
    db.commit()
    db.refresh(table)
    return table


@router.delete("/tables/{table_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_table(
    table_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> None:
    table = db.query(Table).filter(Table.id == table_id).first()
    if not table:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Table not found")
    db.delete(table)
    db.commit()
