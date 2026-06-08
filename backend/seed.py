"""Seed script — run with: python seed.py

Creates initial data:
- 1 restaurant (La Bella Italia)
- 10 tables (T1–T10)
- 1 admin user
- 1 customer user

Idempotent: safe to run multiple times.
"""

import sys
import os

# Ensure the project root is on sys.path for absolute imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import time

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.base import SessionLocal

# Import all models so SQLAlchemy registers them with Base.metadata
from app.models.restaurant import Restaurant  # noqa: F401
from app.models.table import Table  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.reservation import Reservation  # noqa: F401


def seed(db: Session) -> None:
    # Idempotency check — skip if a restaurant already exists
    existing = db.query(Restaurant).first()
    if existing:
        print("Already seeded, skipping.")
        return

    # ------------------------------------------------------------------ #
    # Restaurant
    # ------------------------------------------------------------------ #
    restaurant = Restaurant(
        name="La Bella Italia",
        description="Authentic Italian cuisine in a cosy atmosphere.",
        address="123 Pasta Street, Florence, IT",
        phone="+39 055 123456",
        open_time=time(10, 0),
        close_time=time(22, 0),
        slot_duration_minutes=60,
        is_active=True,
    )
    db.add(restaurant)
    db.flush()  # populate restaurant.id before creating tables

    # ------------------------------------------------------------------ #
    # Tables T1–T10 with cycling capacities
    # ------------------------------------------------------------------ #
    capacities = [2, 2, 4, 4, 4, 6, 6, 6, 8, 8]
    for i, cap in enumerate(capacities, start=1):
        table = Table(
            restaurant_id=restaurant.id,
            number=f"T{i}",
            capacity=cap,
            is_active=True,
        )
        db.add(table)

    # ------------------------------------------------------------------ #
    # Admin user
    # ------------------------------------------------------------------ #
    admin = User(
        email="admin@tablebook.com",
        hashed_password=hash_password("Admin1234!"),
        full_name="Admin User",
        role="admin",
        is_active=True,
    )
    db.add(admin)

    # ------------------------------------------------------------------ #
    # Customer user
    # ------------------------------------------------------------------ #
    customer = User(
        email="customer@tablebook.com",
        hashed_password=hash_password("Customer1234!"),
        full_name="Demo Customer",
        role="customer",
        is_active=True,
    )
    db.add(customer)

    db.commit()
    print("Seed complete.")


def main() -> None:
    db = SessionLocal()
    try:
        seed(db)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
