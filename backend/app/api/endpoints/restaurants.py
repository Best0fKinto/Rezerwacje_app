from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.base import get_db
from app.models.restaurant import Restaurant
from app.models.table import Table
from app.models.reservation import Reservation
from app.schemas.restaurant import RestaurantOut, OptimizationResponse, TableOptimizationStats, OptimizationRecommendation
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


@router.get("/restaurants/{restaurant_id}/optimization", response_model=OptimizationResponse)
def get_optimization(
    restaurant_id: int,
    window_days: int = 30,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> OptimizationResponse:
    """
    Analyse table utilisation and capacity fit for the given restaurant.
    Returns per-table stats and actionable recommendations.
    """
    restaurant = (
        db.query(Restaurant)
        .filter(Restaurant.id == restaurant_id, Restaurant.is_active == True)
        .first()
    )
    if not restaurant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")

    # --- Time window: past window_days + next window_days ---
    today = date.today()
    window_start = today - timedelta(days=window_days)
    window_end = today + timedelta(days=window_days)

    # --- Calculate available slots per day (open_time → close_time with slot_duration_minutes) ---
    from datetime import datetime, timedelta as tdelta
    def _slot_count(open_t, close_t, duration_min: int) -> int:
        fmt_options = ["%H:%M:%S", "%H:%M"]
        def _parse(t):
            s = str(t)
            for f in fmt_options:
                try:
                    return datetime.strptime(s, f)
                except ValueError:
                    continue
            raise ValueError(f"Cannot parse time: {t}")
        cur = _parse(open_t)
        end = _parse(close_t)
        count = 0
        delta = tdelta(minutes=duration_min)
        while cur < end:
            count += 1
            cur += delta
        return count

    slots_per_day = _slot_count(restaurant.open_time, restaurant.close_time, restaurant.slot_duration_minutes)
    total_possible_slots = slots_per_day * (window_days * 2)  # past + future window per table

    # --- All tables for this restaurant ---
    tables = db.query(Table).filter(Table.restaurant_id == restaurant_id).all()

    # --- Reservations in window ---
    reservations = (
        db.query(Reservation)
        .join(Table, Reservation.table_id == Table.id)
        .filter(
            Table.restaurant_id == restaurant_id,
            Reservation.date >= window_start,
            Reservation.date <= window_end,
        )
        .all()
    )

    # --- Party size distribution (all reservations regardless of status) ---
    party_dist: dict[str, int] = {}
    for r in reservations:
        key = str(r.party_size)
        party_dist[key] = party_dist.get(key, 0) + 1

    # --- Per-table stats ---
    table_stats: List[TableOptimizationStats] = []
    for table in tables:
        table_reservations = [r for r in reservations if r.table_id == table.id]
        confirmed = [r for r in table_reservations if r.status == "confirmed"]
        total_res = len(table_reservations)
        confirmed_count = len(confirmed)
        avg_party = sum(r.party_size for r in confirmed) / confirmed_count if confirmed else 0.0
        avg_waste = sum(table.capacity - r.party_size for r in confirmed) / confirmed_count if confirmed else 0.0
        utilization_pct = (confirmed_count / total_possible_slots * 100) if total_possible_slots > 0 else 0.0
        table_stats.append(TableOptimizationStats(
            table_id=table.id,
            table_number=table.number,
            capacity=table.capacity,
            is_active=table.is_active,
            total_reservations=total_res,
            confirmed_reservations=confirmed_count,
            avg_party_size=round(avg_party, 1),
            avg_waste=round(avg_waste, 1),
            utilization_pct=round(utilization_pct, 1),
        ))

    # --- Recommendations ---
    recommendations: List[OptimizationRecommendation] = []
    active_tables = [t for t in table_stats if t.is_active]

    if not reservations:
        recommendations.append(OptimizationRecommendation(
            level="info",
            message=f"No reservation data in the ±{window_days}-day window. Come back after collecting some bookings.",
        ))
    else:
        # Unused tables
        for t in active_tables:
            if t.confirmed_reservations == 0:
                recommendations.append(OptimizationRecommendation(
                    level="warning",
                    message=f"Table {t.table_number} (cap: {t.capacity}) had 0 confirmed reservations in the ±{window_days}-day window. Consider deactivating it.",
                ))

        # Oversized tables (wasting more than half their capacity on average)
        for t in active_tables:
            if t.confirmed_reservations > 0 and t.avg_waste > t.capacity * 0.5:
                recommendations.append(OptimizationRecommendation(
                    level="warning",
                    message=(
                        f"Table {t.table_number} (cap: {t.capacity}) serves parties of {t.avg_party_size:.1f} on average "
                        f"— {t.avg_waste:.1f} seats wasted per booking. Consider replacing with smaller tables."
                    ),
                ))

        # Highly utilised tables
        for t in active_tables:
            if t.utilization_pct >= 70:
                recommendations.append(OptimizationRecommendation(
                    level="info",
                    message=f"Table {t.table_number} is heavily used ({t.utilization_pct:.1f}% utilisation). Consider adding a similar table.",
                ))

        # Demand exceeds available capacity (party sizes larger than any table)
        max_capacity = max((t.capacity for t in tables if t.is_active), default=0)
        oversized_parties = [r for r in reservations if r.party_size > max_capacity]
        if oversized_parties:
            recommendations.append(OptimizationRecommendation(
                level="danger",
                message=f"{len(oversized_parties)} reservation(s) requested a party size larger than your largest table (cap: {max_capacity}). Consider adding a bigger table.",
            ))

        # Perfectly sized tables
        well_fit = [t for t in active_tables if t.confirmed_reservations > 0 and t.avg_waste <= 1.0]
        if well_fit:
            names = ", ".join(t.table_number for t in well_fit[:3])
            recommendations.append(OptimizationRecommendation(
                level="info",
                message=f"Table(s) {names} are well-matched to their typical party sizes (avg waste ≤ 1 seat).",
            ))

        if not recommendations:
            recommendations.append(OptimizationRecommendation(
                level="info",
                message="Your table configuration looks balanced for the current demand.",
            ))

    return OptimizationResponse(
        window_days=window_days,
        table_stats=table_stats,
        party_size_distribution=party_dist,
        recommendations=recommendations,
    )
