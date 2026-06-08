import datetime
import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Set DATABASE_URL before importing app so config picks it up
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")

from app.main import app
from app.db.base import Base, get_db
from app.models.user import User
from app.models.restaurant import Restaurant
from app.models.table import Table
from app.core.security import hash_password  # noqa: E402

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True, scope="session")
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="session")
def db():
    db = TestingSessionLocal()
    yield db
    db.close()


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


@pytest.fixture(scope="session")
def seeded_data(db):
    # Admin
    admin = User(
        email="test_admin@test.com",
        hashed_password=hash_password("Admin1234!"),
        full_name="Test Admin",
        role="admin",
    )
    db.add(admin)
    # Customer
    customer = User(
        email="test_customer@test.com",
        hashed_password=hash_password("Customer1234!"),
        full_name="Test Customer",
        role="customer",
    )
    db.add(customer)
    # Restaurant
    restaurant = Restaurant(
        name="Test Restaurant",
        open_time=datetime.time(10, 0),
        close_time=datetime.time(22, 0),
        slot_duration_minutes=60,
        address="123 Test St",
        phone="555-0000",
    )
    db.add(restaurant)
    db.commit()
    db.refresh(admin)
    db.refresh(customer)
    db.refresh(restaurant)
    # Table
    table = Table(
        restaurant_id=restaurant.id,
        number="T1",
        capacity=4,
        is_active=True,
    )
    db.add(table)
    db.commit()
    db.refresh(table)
    return {
        "admin": admin,
        "customer": customer,
        "restaurant": restaurant,
        "table": table,
    }


@pytest.fixture(scope="session")
def admin_token(client, seeded_data):
    r = client.post(
        "/auth/login",
        json={"email": "test_admin@test.com", "password": "Admin1234!"},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def customer_token(client, seeded_data):
    r = client.post(
        "/auth/login",
        json={"email": "test_customer@test.com", "password": "Customer1234!"},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def restaurant(seeded_data):
    return seeded_data["restaurant"]


@pytest.fixture(scope="session")
def table(seeded_data):
    return seeded_data["table"]
