"""
Tests for /auth endpoints: register, login, /me
"""


def test_register_new_user_returns_201_with_token(client):
    """Registering a new user should return 201 and both tokens."""
    payload = {
        "email": "newuser@test.com",
        "password": "NewUser1234!",
        "full_name": "New User",
    }
    r = client.post("/auth/register", json=payload)
    assert r.status_code == 201, r.text
    data = r.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


def test_register_duplicate_email_returns_400(client):
    """Registering with an already-used e-mail should return 400."""
    payload = {
        "email": "duplicate@test.com",
        "password": "Dup1234!",
        "full_name": "Dup User",
    }
    # First registration must succeed
    r = client.post("/auth/register", json=payload)
    assert r.status_code == 201, r.text
    # Second registration with same email must fail
    r2 = client.post("/auth/register", json=payload)
    assert r2.status_code == 400
    assert "already" in r2.json()["detail"].lower()


def test_login_valid_credentials_returns_200_with_access_token(client, seeded_data):
    """Logging in with correct credentials should return 200 and access_token."""
    r = client.post(
        "/auth/login",
        json={"email": "test_customer@test.com", "password": "Customer1234!"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password_returns_401(client, seeded_data):
    """Logging in with a wrong password should return 401."""
    r = client.post(
        "/auth/login",
        json={"email": "test_customer@test.com", "password": "WrongPassword!"},
    )
    assert r.status_code == 401


def test_me_with_valid_token_returns_200_and_user_data(client, customer_token, seeded_data):
    """GET /auth/me with a valid Bearer token should return the user's profile."""
    r = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["email"] == "test_customer@test.com"
    assert data["full_name"] == "Test Customer"
    assert "id" in data
    assert "role" in data


def test_me_without_token_returns_401(client):
    """GET /auth/me without any token should return 401."""
    r = client.get("/auth/me")
    assert r.status_code == 401
