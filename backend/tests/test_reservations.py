"""
Tests for reservation-related endpoints:
  GET  /restaurants/{id}/availability
  POST /reservations
  GET  /reservations/my
  GET  /reservations          (admin)
  PATCH /reservations/{id}/cancel
"""
import datetime

# Use a date well in the future so "past reservation" guards never trigger.
FUTURE_DATE = (datetime.date.today() + datetime.timedelta(days=30)).isoformat()
# A second date so we don't collide with the first booking inside the same test run.
FUTURE_DATE_2 = (datetime.date.today() + datetime.timedelta(days=31)).isoformat()
SLOT = "11:00"


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# --------------------------------------------------------------------------- #
# 1. Availability
# --------------------------------------------------------------------------- #

def test_availability_returns_200_with_slots(client, restaurant, table):
    """GET /restaurants/{id}/availability should return 200 with a slots list."""
    r = client.get(
        f"/restaurants/{restaurant.id}/availability",
        params={"date": FUTURE_DATE, "party_size": 2},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["date"] == FUTURE_DATE
    assert "slots" in data
    assert isinstance(data["slots"], list)
    # Our seeded table (capacity 4) should appear because party_size=2 <= 4
    table_ids = [s["table_id"] for s in data["slots"]]
    assert table.id in table_ids
    # Each slot entry must contain available_slots list
    for slot_entry in data["slots"]:
        assert "available_slots" in slot_entry
        assert isinstance(slot_entry["available_slots"], list)


# --------------------------------------------------------------------------- #
# 2. Create reservation (customer)
# --------------------------------------------------------------------------- #

def test_create_reservation_as_customer_returns_201(client, customer_token, table):
    """POST /reservations as an authenticated customer should return 201."""
    payload = {
        "table_id": table.id,
        "date": FUTURE_DATE,
        "time_slot": SLOT,
        "party_size": 2,
        "notes": "Window seat please",
    }
    r = client.post("/reservations", json=payload, headers=_auth(customer_token))
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["table_id"] == table.id
    assert data["time_slot"] == SLOT
    assert data["party_size"] == 2
    assert data["status"] in ("pending", "confirmed")


# --------------------------------------------------------------------------- #
# 3. Duplicate booking returns 409
# --------------------------------------------------------------------------- #

def test_duplicate_booking_returns_409(client, customer_token, table):
    """Booking the same table+date+slot twice should return 409 Conflict."""
    payload = {
        "table_id": table.id,
        "date": FUTURE_DATE,
        "time_slot": SLOT,
        "party_size": 1,
    }
    # First call: must succeed (or the slot was already booked by test_2 above, which is fine)
    r1 = client.post("/reservations", json=payload, headers=_auth(customer_token))
    # If the slot is free this should be 201; if test_2 already booked it, it's 409 — both valid for
    # "ensuring there is now a conflict".  Either way we attempt once more:
    r2 = client.post("/reservations", json=payload, headers=_auth(customer_token))
    # At least one of the two calls must have seen a conflict, or the second definitively should.
    if r1.status_code == 201:
        assert r2.status_code == 409, r2.text
    else:
        # r1 was already 409 (slot taken by test_2), r2 must also be 409
        assert r1.status_code == 409
        assert r2.status_code == 409


# --------------------------------------------------------------------------- #
# 4. GET /reservations/my as customer
# --------------------------------------------------------------------------- #

def test_my_reservations_contains_customer_booking(client, customer_token, table):
    """GET /reservations/my should return a list that includes our booking."""
    r = client.get("/reservations/my", headers=_auth(customer_token))
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    # We created at least one reservation in this test run
    assert len(data) >= 1
    table_ids = [res["table_id"] for res in data]
    assert table.id in table_ids


# --------------------------------------------------------------------------- #
# 5. Cancel reservation
# --------------------------------------------------------------------------- #

def test_cancel_reservation_sets_status_to_cancelled(
    client, customer_token, table, db
):
    """PATCH /reservations/{id}/cancel should return 200 and status=cancelled."""
    # Create a fresh reservation on a different date to avoid conflict
    payload = {
        "table_id": table.id,
        "date": FUTURE_DATE_2,
        "time_slot": "14:00",
        "party_size": 1,
    }
    create_r = client.post(
        "/reservations", json=payload, headers=_auth(customer_token)
    )
    assert create_r.status_code == 201, create_r.text
    reservation_id = create_r.json()["id"]

    cancel_r = client.patch(
        f"/reservations/{reservation_id}/cancel",
        headers=_auth(customer_token),
    )
    assert cancel_r.status_code == 200, cancel_r.text
    assert cancel_r.json()["status"] == "cancelled"


# --------------------------------------------------------------------------- #
# 6. Admin can list all reservations
# --------------------------------------------------------------------------- #

def test_admin_can_list_all_reservations(client, admin_token):
    """GET /reservations (admin-only) should return 200 with a list."""
    r = client.get("/reservations", headers=_auth(admin_token))
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    # The test run has created several reservations by now
    assert len(data) >= 1


# --------------------------------------------------------------------------- #
# 7. Oversized party_size does NOT cause 5xx
# --------------------------------------------------------------------------- #

def test_reservation_with_party_size_exceeding_capacity_no_5xx(
    client, customer_token, table
):
    """
    Posting a reservation with party_size > table.capacity should not raise a 5xx.
    Capacity enforcement happens on the availability query, not the booking endpoint.
    """
    payload = {
        "table_id": table.id,
        "date": (
            datetime.date.today() + datetime.timedelta(days=60)
        ).isoformat(),
        "time_slot": "10:00",
        "party_size": table.capacity + 10,  # intentionally oversized
    }
    r = client.post("/reservations", json=payload, headers=_auth(customer_token))
    # Must not be a 5xx
    assert r.status_code < 500, f"Got 5xx: {r.status_code} — {r.text}"
