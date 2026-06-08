# AGENTS.md — Multi-Agent Build Log

This project was built autonomously using a parallel multi-agent approach. Each agent was responsible for a distinct concern.

---

## Agent Responsibilities

### Orchestrator (Claude Code — main session)
- Created the monorepo directory structure
- Wrote `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `.env.example`
- Spawned all subagents in parallel
- Performed integration review and bug fixes (auth `role` field)
- Wrote `README.md` and this file

### Agent 1 — Backend: Models & Database
**Files produced:**
- `backend/requirements.txt`
- `backend/app/core/config.py` — pydantic-settings BaseSettings
- `backend/app/core/security.py` — bcrypt + JWT helpers
- `backend/app/db/base.py` — SQLAlchemy engine, session, Base, get_db
- `backend/app/models/user.py`
- `backend/app/models/restaurant.py`
- `backend/app/models/table.py`
- `backend/app/models/reservation.py`
- `backend/alembic.ini`
- `backend/alembic/env.py`
- `backend/alembic/script.py.mako`
- `backend/alembic/versions/001_initial.py` — full migration
- `backend/seed.py` — idempotent seed (demo restaurant, 10 tables, admin + customer users)

### Agent 2 — Backend: API Endpoints & Business Logic
**Files produced:**
- `backend/app/schemas/user.py`
- `backend/app/schemas/restaurant.py`
- `backend/app/schemas/table.py`
- `backend/app/schemas/reservation.py`
- `backend/app/api/deps.py` — get_current_user, require_admin
- `backend/app/api/endpoints/auth.py` — register, login, refresh, /me
- `backend/app/api/endpoints/restaurants.py` — list, get, tables
- `backend/app/api/endpoints/reservations.py` — availability, create, my, all (admin), cancel, confirm
- `backend/app/services/email.py` — SMTP with mock fallback
- `backend/app/main.py` — FastAPI app with CORS

**Key logic:**
- Availability engine generates time slots between open/close time, subtracts booked ones per table
- 409 Conflict on double-booking same table+date+slot
- Email sent via daemon thread (fire-and-forget)

### Agent 3 — Backend: Tests
**Files produced:**
- `backend/tests/__init__.py`
- `backend/tests/conftest.py` — SQLite in-memory test DB, fixtures
- `backend/tests/test_auth.py` — 6 auth endpoint tests
- `backend/tests/test_reservations.py` — 7 reservation tests incl. 409 conflict

### Agent 4 — Frontend: Config & Infrastructure
**Files produced:**
- `frontend/package.json`
- `frontend/vite.config.ts`
- `frontend/tsconfig.json`, `tsconfig.node.json`
- `frontend/tailwind.config.js`
- `frontend/postcss.config.js`
- `frontend/index.html`
- `frontend/src/main.tsx`
- `frontend/src/index.css` — Tailwind + CSS variable theming
- `frontend/src/lib/utils.ts` — cn() helper
- `frontend/src/lib/api.ts` — Axios with JWT interceptor and auto-refresh
- `frontend/src/store/authStore.ts` — Zustand persisted auth store
- `frontend/src/test/setup.ts`

### Agent 5 — Frontend: Pages, Components & Tests
**Files produced:**
- `frontend/src/components/ui/button.tsx`
- `frontend/src/components/ui/input.tsx`
- `frontend/src/components/ui/label.tsx`
- `frontend/src/components/ui/card.tsx`
- `frontend/src/components/ui/badge.tsx`
- `frontend/src/components/ui/skeleton.tsx`
- `frontend/src/components/ui/select.tsx`
- `frontend/src/components/Layout.tsx` — responsive navbar
- `frontend/src/components/ProtectedRoute.tsx`
- `frontend/src/App.tsx` — React Router v6 routes
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/RegisterPage.tsx`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/pages/NewReservationPage.tsx` — 5-step booking wizard
- `frontend/src/pages/MyReservationsPage.tsx`
- `frontend/src/pages/AdminPage.tsx` — stats cards, Recharts chart, reservations table
- `frontend/src/pages/NotFoundPage.tsx`
- `frontend/src/tests/authStore.test.ts`
- `frontend/src/tests/reservationForm.test.tsx`

---

## Bug Fixes Applied During Integration Check (live `docker compose up`)
1. `app/api/endpoints/auth.py`: register endpoint set `role="user"` (invalid value) → fixed to `role="customer"`.
2. `frontend/package.json`: agent invented a non-existent dependency `@radix-ui/react-badge@^1.0.0` → npm install failed → removed (badge uses CVA, not a Radix primitive).
3. `docker-compose.yml`: removed obsolete `version` attribute (compose warning).
4. `backend/requirements.txt`: `passlib 1.7.4` crashed on `bcrypt 4.1+` ("password cannot be longer than 72 bytes") during seed → pinned `bcrypt==4.0.1`.
5. `backend/app/schemas/restaurant.py`: `open_time`/`close_time` typed as `str` but DB returns `datetime.time` → `GET /restaurants` raised 500 ResponseValidationError → changed to `time` type with a `field_serializer` emitting "HH:MM".

## Frontend↔Backend Contract Fixes (found via live browser test)
The frontend agent assumed a different API contract than the backend agent produced. Fixed:
6. **Login/Register broken** — `LoginPage`/`RegisterPage` destructured `user` from `/auth/login`, but the backend returns only tokens → `user=undefined` → `ProtectedRoute` bounced back to `/login` (could not enter the app). Fixed: fetch `/auth/me` after login, then `setAuth`.
7. **`DashboardPage`** used `opening_time`/`closing_time` and `r.time` → API returns `open_time`/`close_time` and `time_slot`. Fixed field names.
8. **`NewReservationPage`** — read `/availability` as a flat array, but API returns `{ slots: [{ table_number, available_slots: [] }] }`; also POSTed `time` instead of `time_slot`. Fixed: flatten response, use `time_slot`.
9. **`MyReservationsPage` / `AdminPage`** used `r.time` → fixed to `r.time_slot`.
10. **Missing `table_number` / `customer_name`** — `ReservationOut` returned only `table_id`, so UI showed "Table undefined". Added `table_number`, `customer_name`, `customer_email` `@property` to the `Reservation` model + matching optional fields on the schema.
11. **Missing `src/vite-env.d.ts`** — `import.meta.env` was untyped → `tsc --noEmit` failed with 2 errors (TS2339) → quality gate "frontend builds without TS errors" failed. Added the Vite client type-reference file. Verified: `npm run build` now passes (2780 modules, 0 errors).
12. **Email thread read expired ORM objects** — confirmation/cancellation email threads read `current_user`/`reservation`/`table` attributes *after* `db.commit()`, which expires them → `[Email fire-and-forget error] tuple index out of range` in logs. Fixed by snapshotting plain values into locals before starting the thread. (Was harmless — caught & logged — but now the email mock logs cleanly.)

## Final Verification (all live, in containers)
- `tsc --noEmit` → 0 errors
- `npm run build` → 2780 modules, built OK
- `pytest tests/` → **13 passed**
- 8/8 frontend↔backend contract checks pass (login→me, availability, create 201, double-book 409, my-reservations fields, admin fields, confirm 200)
- Email mock logs cleanly on reservation create

## Integration Check Results (verified live)
- `docker compose up --build` → all 3 containers healthy/up
- Migrations + seed run automatically on backend start
- `GET /health` → 200; `GET /restaurants` → 200 (restaurant id=1)
- `GET /restaurants/1/tables` → 200 (10 tables)
- Customer login → availability → create reservation → 201
- Double-book same table+date+slot → **409**
- `GET /reservations/my` → 200; admin `GET /reservations` → 200; customer → **403**
- admin confirm → 200; customer cancel → 200
- Frontend (http://localhost:5173) → 200
