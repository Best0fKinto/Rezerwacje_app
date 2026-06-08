# TableBook — Restaurant Table Reservation App

A full-stack restaurant reservation system with customer booking flow, admin dashboard, JWT authentication, and conflict-safe double-booking prevention.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Compose                        │
│                                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────┐ │
│  │  PostgreSQL   │◄──│   Backend    │◄──│  Frontend   │ │
│  │  (port 5432)  │   │  FastAPI     │   │  React/Vite │ │
│  │               │   │  (port 8000) │   │  (port 5173)│ │
│  └──────────────┘   └──────────────┘   └─────────────┘ │
└─────────────────────────────────────────────────────────┘

Backend stack:
  FastAPI + SQLAlchemy + Alembic + PostgreSQL
  JWT (access + refresh tokens) | bcrypt | smtplib

Frontend stack:
  React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
  Zustand | React Router v6 | react-hook-form + zod | Recharts
```

---

## Quickstart

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)

### 1. Clone & configure

```bash
git clone <repo-url>
cd restaurant-reservation
cp .env.example .env   # already copied — edit if needed
```

### 2. Start everything

```bash
docker compose up --build
```

On first start, the backend will automatically:
1. Run Alembic migrations (`alembic upgrade head`)
2. Seed the database with demo data

### 3. Open the app

| Service  | URL                        |
|----------|----------------------------|
| Frontend | http://localhost:5173      |
| Backend  | http://localhost:8000      |
| API Docs | http://localhost:8000/docs |
| Health   | http://localhost:8000/health |

---

## Demo Credentials

| Role     | Email                      | Password       |
|----------|----------------------------|----------------|
| Admin    | admin@tablebook.com        | Admin1234!     |
| Customer | customer@tablebook.com     | Customer1234!  |

---

## Environment Variables

Copy `.env.example` to `.env` and adjust as needed:

| Variable                    | Default                        | Description                          |
|-----------------------------|--------------------------------|--------------------------------------|
| `POSTGRES_USER`             | `restaurant`                   | PostgreSQL username                  |
| `POSTGRES_PASSWORD`         | `secret`                       | PostgreSQL password                  |
| `POSTGRES_DB`               | `restaurant_db`                | PostgreSQL database name             |
| `DATABASE_URL`              | auto-built in compose          | Full SQLAlchemy connection string    |
| `SECRET_KEY`                | `change-me-in-production...`   | JWT signing key (change in prod!)    |
| `ALGORITHM`                 | `HS256`                        | JWT algorithm                        |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30`                         | Access token lifetime                |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7`                            | Refresh token lifetime               |
| `SMTP_HOST`                 | `smtp.gmail.com`               | SMTP server (optional)               |
| `SMTP_PORT`                 | `587`                          | SMTP port                            |
| `SMTP_USER`                 | *(empty)*                      | SMTP username (leave empty to mock)  |
| `SMTP_PASSWORD`             | *(empty)*                      | SMTP password                        |
| `EMAILS_FROM_EMAIL`         | `noreply@tablebook.example`    | Sender address                       |
| `VITE_API_URL`              | `http://localhost:8000`        | Backend URL seen by the browser      |
| `FRONTEND_URL`              | `http://localhost:5173`        | Frontend URL (for CORS)              |

> **Email**: reservations work fine without SMTP config — confirmations are printed to the backend log instead.

---

## API Endpoints

### Auth
| Method | Path              | Auth     | Description                    |
|--------|-------------------|----------|--------------------------------|
| POST   | /auth/register    | —        | Register new customer          |
| POST   | /auth/login       | —        | Login, receive tokens          |
| POST   | /auth/refresh     | —        | Refresh access token           |
| GET    | /auth/me          | Bearer   | Get current user               |

### Restaurants
| Method | Path                                      | Auth     | Description                    |
|--------|-------------------------------------------|----------|--------------------------------|
| GET    | /restaurants                              | —        | List all restaurants           |
| GET    | /restaurants/{id}                         | —        | Get restaurant details         |
| GET    | /restaurants/{id}/tables                  | —        | List tables                    |
| GET    | /restaurants/{id}/availability            | —        | Available slots for date+party |

### Reservations
| Method | Path                          | Auth        | Description                  |
|--------|-------------------------------|-------------|------------------------------|
| POST   | /reservations                 | Bearer      | Create reservation           |
| GET    | /reservations/my              | Bearer      | Customer's own reservations  |
| GET    | /reservations                 | Admin       | All reservations (filterable)|
| PATCH  | /reservations/{id}/cancel     | Bearer      | Cancel reservation           |
| PATCH  | /reservations/{id}/confirm    | Admin       | Confirm reservation          |

### System
| Method | Path    | Description  |
|--------|---------|--------------|
| GET    | /health | Health check |

---

## Running Tests

### Backend (pytest)
```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v
```

### Frontend (Vitest)
```bash
cd frontend
npm install
npm test
```

---

## Project Structure

```
restaurant-reservation/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── seed.py
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   │       └── 001_initial.py
│   ├── app/
│   │   ├── core/       (config, security)
│   │   ├── db/         (engine, session, Base)
│   │   ├── models/     (User, Restaurant, Table, Reservation)
│   │   ├── schemas/    (Pydantic v2 schemas)
│   │   ├── api/        (routers, deps)
│   │   ├── services/   (email)
│   │   └── main.py
│   └── tests/
│       ├── conftest.py
│       ├── test_auth.py
│       └── test_reservations.py
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── src/
        ├── App.tsx
        ├── components/   (Layout, ProtectedRoute, ui/*)
        ├── pages/        (Login, Register, Dashboard, NewReservation, MyReservations, Admin, NotFound)
        ├── store/        (authStore — Zustand)
        ├── lib/          (api — axios, utils)
        └── tests/        (authStore.test.ts, reservationForm.test.tsx)
```
