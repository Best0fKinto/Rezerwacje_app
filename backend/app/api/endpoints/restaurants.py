from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.base import get_db
from app.models.restaurant import Restaurant
from app.models.table import Table
from app.schemas.restaurant import RestaurantOut
from app.schemas.table import TableOut

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
        .filter(Table.restaurant_id == restaurant_id, Table.is_active == True)
        .all()
    )
    return tables
