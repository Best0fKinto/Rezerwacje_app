from datetime import date, datetime, timedelta
from typing import List, Optional
import threading

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.reservation import Reservation
from app.models.restaurant import Restaurant
from app.models.table import Table
from app.models.user import User
from app.schemas.reservation import (
    AvailabilityResponse,
    AvailableSlot,
    ReservationCreate,
    ReservationOut,
    ReservationUpdate,
)
from app.api.deps import get_current_user, require_admin
from app.services.email import send_confirmation_email, send_cancellation_email

router = APIRouter()


def _generate_time_slots(open_time: str, close_time: str, slot_duration_minutes: int) -> List[str]:
    """Generate list of HH:MM time slot strings between open_time and close_time."""
    fmt = "%H:%M"
    # open_time/close_time may be stored as "HH:MM:SS" or "HH:MM"
    def parse_time(t: str) -> datetime:
        for f in ("%H:%M:%S", "%H:%M"):
            try:
                return datetime.strptime(t, f)
            except ValueError:
                continue
        raise ValueError(f"Cannot parse time: {t}")

    current = parse_time(open_time)
    end = parse_time(close_time)
    slots: List[str] = []
    delta = timedelta(minutes=slot_duration_minutes)
    while current < end:
        slots.append(current.strftime("%H:%M"))
        current += delta
    return slots


@router.get(
    "/restaurants/{restaurant_id}/availability",
    response_model=AvailabilityResponse,
)
def check_availability(
    restaurant_id: int,
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    party_size: int = Query(..., ge=1),
    db: Session = Depends(get_db),
) -> AvailabilityResponse:
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

    all_slots = _generate_time_slots(
        str(restaurant.open_time),
        str(restaurant.close_time),
        restaurant.slot_duration_minutes,
    )

    tables = (
        db.query(Table)
        .filter(
            Table.restaurant_id == restaurant_id,
            Table.is_active == True,
            Table.capacity >= party_size,
        )
        .all()
    )

    result_slots: List[AvailableSlot] = []
    for table in tables:
        booked = (
            db.query(Reservation.time_slot)
            .filter(
                Reservation.table_id == table.id,
                Reservation.date == date,
                Reservation.status != "cancelled",
            )
            .all()
        )
        booked_set = {row.time_slot for row in booked}
        available = [s for s in all_slots if s not in booked_set]
        result_slots.append(
            AvailableSlot(
                table_id=table.id,
                table_number=str(table.number),
                capacity=table.capacity,
                available_slots=available,
            )
        )

    return AvailabilityResponse(date=date, party_size=party_size, slots=result_slots)


@router.post("/reservations", response_model=ReservationOut, status_code=status.HTTP_201_CREATED)
def create_reservation(
    payload: ReservationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReservationOut:
    table = (
        db.query(Table)
        .filter(Table.id == payload.table_id, Table.is_active == True)
        .first()
    )
    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Table not found or inactive",
        )

    conflict = (
        db.query(Reservation)
        .filter(
            Reservation.table_id == payload.table_id,
            Reservation.date == payload.date,
            Reservation.time_slot == payload.time_slot,
            Reservation.status != "cancelled",
        )
        .first()
    )
    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This time slot is already booked for the selected table",
        )

    reservation = Reservation(
        user_id=current_user.id,
        table_id=payload.table_id,
        date=payload.date,
        time_slot=payload.time_slot,
        party_size=payload.party_size,
        notes=payload.notes,
        status="pending",
    )
    db.add(reservation)
    db.commit()
    db.refresh(reservation)

    # Snapshot values before starting the thread — after commit the ORM objects
    # may be expired/detached and unsafe to read from another thread.
    email_to = current_user.email
    email_name = current_user.full_name
    email_date = str(reservation.date)
    email_slot = reservation.time_slot
    email_table = str(table.number)

    # Fire-and-forget email notification
    def _send_email() -> None:
        try:
            send_confirmation_email(
                user_email=email_to,
                user_name=email_name,
                reservation_date=email_date,
                time_slot=email_slot,
                table_number=email_table,
            )
        except Exception as exc:
            print(f"[Email fire-and-forget error] {exc}")

    threading.Thread(target=_send_email, daemon=True).start()

    return reservation


@router.get("/reservations/my", response_model=List[ReservationOut])
def my_reservations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[ReservationOut]:
    reservations = (
        db.query(Reservation)
        .filter(Reservation.user_id == current_user.id)
        .order_by(Reservation.date.desc())
        .all()
    )
    return reservations


@router.get("/reservations", response_model=List[ReservationOut])
def list_all_reservations(
    date: Optional[str] = Query(None, description="Filter by date YYYY-MM-DD"),
    status: Optional[str] = Query(None, description="Filter by status"),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> List[ReservationOut]:
    query = db.query(Reservation)
    if date is not None:
        query = query.filter(Reservation.date == date)
    if status is not None:
        query = query.filter(Reservation.status == status)
    reservations = query.order_by(Reservation.date.desc()).all()
    return reservations


@router.patch("/reservations/{reservation_id}/cancel", response_model=ReservationOut)
def cancel_reservation(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReservationOut:
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation not found",
        )

    is_admin = current_user.role == "admin"
    is_owner = reservation.user_id == current_user.id

    if not is_admin and not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to cancel this reservation",
        )

    if not is_admin:
        # Regular users can only cancel future reservations that are pending or confirmed
        if reservation.status not in ("pending", "confirmed"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only pending or confirmed reservations can be cancelled",
            )
        today = date.today()
        reservation_date = (
            reservation.date
            if isinstance(reservation.date, date)
            else datetime.strptime(str(reservation.date), "%Y-%m-%d").date()
        )
        if reservation_date < today:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot cancel a past reservation",
            )

    reservation.status = "cancelled"
    db.commit()
    db.refresh(reservation)

    # Fire-and-forget cancellation email — snapshot values before the thread
    user = db.query(User).filter(User.id == reservation.user_id).first()
    if user:
        email_to = user.email
        email_name = user.full_name
        email_date = str(reservation.date)
        email_slot = reservation.time_slot

        def _send_cancel_email() -> None:
            try:
                send_cancellation_email(
                    user_email=email_to,
                    user_name=email_name,
                    reservation_date=email_date,
                    time_slot=email_slot,
                )
            except Exception as exc:
                print(f"[Email fire-and-forget error] {exc}")

        threading.Thread(target=_send_cancel_email, daemon=True).start()

    return reservation


@router.patch("/reservations/{reservation_id}/confirm", response_model=ReservationOut)
def confirm_reservation(
    reservation_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> ReservationOut:
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation not found",
        )
    if reservation.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot confirm a cancelled reservation",
        )

    reservation.status = "confirmed"
    db.commit()
    db.refresh(reservation)
    return reservation
