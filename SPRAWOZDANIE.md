# Sprawozdanie z projektu: TableBook — Aplikacja do Rezerwacji Stolików

**Repozytorium:** https://github.com/Best0fKinto/Rezerwacje_app  
**Data sporządzenia sprawozdania:** Czerwiec 2026
# Autorzy: Wiktor, Dominik, Vladyslav, Agnieszka
---

## 1. Wstęp

Niniejsze sprawozdanie dotyczy projektu **TableBook** — pełnostosowej aplikacji webowej umożliwiającej rezerwację stolików w restauracji. Projekt powstał jako samodzielna inicjatywa programistyczna i stanowi przykład kompletnego systemu obsługi rezerwacji, zrealizowanego z wykorzystaniem nowoczesnych technologii frontendowych i backendowych.

Aplikacja odpowiada na realne potrzeby branży gastronomicznej: zarówno klienci, jak i administratorzy restauracji potrzebują narzędzia, które w prosty i niezawodny sposób pozwoli na zarządzanie dostępnością stolików, przyjmowanie rezerwacji oraz zapobieganie konfliktom w harmonogramie. TableBook rozwiązuje te problemy, dostarczając przejrzysty interfejs użytkownika po stronie klienta oraz dedykowany panel administracyjny.

---

## 2. Cel projektu

Celem projektu było zaprojektowanie i zaimplementowanie systemu rezerwacji stolików restauracyjnych, który realizuje następujące założenia funkcjonalne:

- umożliwienie klientom przeglądania restauracji oraz dostępnych terminów,
- obsługa procesu rezerwacji z zabezpieczeniem przed podwójnym bookingiem (ang. *double-booking*),
- autoryzacja i uwierzytelnianie użytkowników z użyciem tokenów JWT (dostępowego i odświeżającego),
- panel administracyjny pozwalający zarządzać rezerwacjami i potwierdzać bądź anulować je,
- opcjonalne powiadomienia e-mail po złożeniu rezerwacji,
- wdrożenie całości aplikacji za pomocą Docker Compose w izolowanym środowisku kontenerowym.

---

## 3. Architektura systemu

Aplikacja oparta jest na architekturze **klient-serwer** z wyraźnym podziałem na warstwę frontendową, backendową oraz bazę danych. Całość uruchamiana jest przy pomocy Docker Compose, co zapewnia pełną przenośność i powtarzalność środowiska.

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
```

### 3.1 Backend

Warstwa backendowa zbudowana jest w oparciu o framework **FastAPI** (Python). Do komunikacji z bazą danych wykorzystano bibliotekę **SQLAlchemy** w trybie ORM, a migracje schematu zarządzane są narzędziem **Alembic**. Dane przechowywane są w relacyjnej bazie **PostgreSQL**.

Bezpieczeństwo aplikacji zapewnione jest przez:
- tokeny JWT (access token — ważność 30 minut, refresh token — ważność 7 dni),
- hashowanie haseł z użyciem biblioteki **bcrypt**,
- autoryzację opartą na rolach (klient / administrator).

Powiadomienia e-mail wysyłane są przez wbudowany moduł **smtplib**; w przypadku braku konfiguracji SMTP potwierdzenia drukowane są w logach serwera.

Stos technologiczny backendu: **FastAPI · SQLAlchemy · Alembic · PostgreSQL · JWT · bcrypt · smtplib**

### 3.2 Frontend

Warstwa frontendowa zbudowana jest w oparciu o **React 18** z **TypeScript**, bundlowana przez **Vite**. Stylowanie realizowane jest przy pomocy **Tailwind CSS** i komponentów biblioteki **shadcn/ui**. Zarządzanie stanem globalnym (sesja użytkownika) zapewnia **Zustand**, a routing aplikacji oparty jest na **React Router v6**. Formularze walidowane są przez **react-hook-form** wraz z biblioteką **zod**. Widoki statystyczne korzystają z biblioteki **Recharts**.

Stos technologiczny frontendu: **React 18 · TypeScript · Vite · Tailwind CSS · shadcn/ui · Zustand · React Router v6 · react-hook-form · zod · Recharts**

### 3.3 Struktura katalogów projektu

```
restaurant-reservation/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── app/
│   │   ├── core/       # konfiguracja, zabezpieczenia
│   │   ├── db/         # silnik bazy, sesje, modele bazowe
│   │   ├── models/     # User, Restaurant, Table, Reservation
│   │   ├── schemas/    # schematy Pydantic v2
│   │   ├── api/        # routery, zależności
│   │   ├── services/   # serwis e-mail
│   │   └── main.py
│   └── tests/
│       ├── conftest.py
│       ├── test_auth.py
│       └── test_reservations.py
└── frontend/
    └── src/
        ├── components/   # Layout, ProtectedRoute, ui/*
        ├── pages/        # Login, Register, Dashboard, NewReservation,
        │                 # MyReservations, Admin, NotFound
        ├── store/        # authStore (Zustand)
        └── lib/          # api (axios), utils
```

---

## 4. Opis techniczny i kluczowe funkcjonalności

### 4.1 Uwierzytelnianie i autoryzacja

System uwierzytelniania oparty jest na dwóch tokenach JWT. Po zalogowaniu klient otrzymuje krótkotrwały *access token* (30 minut) oraz długotrwały *refresh token* (7 dni). Dzięki temu sesja użytkownika może być odświeżana bez ponownego logowania. Hasła przechowywane są wyłącznie w postaci skrótu kryptograficznego (bcrypt). System rozróżnia dwie role: **klient** oraz **administrator**, co pozwala ograniczyć dostęp do wrażliwych endpointów API.

### 4.2 Rezerwacje i zapobieganie podwójnemu bookingowi

Kluczową funkcją systemu jest mechanizm bezpiecznego tworzenia rezerwacji z zabezpieczeniem przed nakładającymi się terminami. Przy każdej próbie rezerwacji backend weryfikuje dostępność stolika w żądanym przedziale czasowym, eliminując możliwość kolizji. Klient może przeglądać dostępność wolnych miejsc z filtrowaniem po dacie i liczbie osób.

### 4.3 Endpointy API

Aplikacja udostępnia REST API z następującymi grupami zasobów:

| Zasób | Metoda | Ścieżka | Opis |
|---|---|---|---|
| Auth | POST | /auth/register | Rejestracja nowego klienta |
| Auth | POST | /auth/login | Logowanie, wydanie tokenów |
| Auth | POST | /auth/refresh | Odświeżenie access tokena |
| Auth | GET | /auth/me | Dane zalogowanego użytkownika |
| Restauracje | GET | /restaurants | Lista wszystkich restauracji |
| Restauracje | GET | /restaurants/{id} | Szczegóły restauracji |
| Restauracje | GET | /restaurants/{id}/tables | Lista stolików |
| Restauracje | GET | /restaurants/{id}/availability | Wolne terminy |
| Rezerwacje | POST | /reservations | Utwórz rezerwację |
| Rezerwacje | GET | /reservations/my | Rezerwacje zalogowanego klienta |
| Rezerwacje | GET | /reservations | Wszystkie rezerwacje (admin) |
| Rezerwacje | PATCH | /reservations/{id}/cancel | Anulowanie rezerwacji |
| Rezerwacje | PATCH | /reservations/{id}/confirm | Potwierdzenie rezerwacji (admin) |
| System | GET | /health | Sprawdzenie stanu serwera |

Pełna dokumentacja API dostępna jest automatycznie pod adresem `http://localhost:8000/docs` dzięki wbudowanemu mechanizmowi Swagger UI generowanemu przez FastAPI.

### 4.4 Panel administracyjny

Użytkownicy z rolą administratora mają dostęp do dedykowanego panelu, który umożliwia przeglądanie wszystkich rezerwacji (z możliwością filtrowania), potwierdzanie bądź anulowanie rezerwacji oraz wgląd w statystyki (wizualizacja danych przez Recharts).

### 4.5 Wdrożenie i konfiguracja środowiska

Uruchomienie całego systemu sprowadza się do jednego polecenia:

```bash
git clone <repo-url>
cd restaurant-reservation
cp .env.example .env
docker compose up --build
```

Przy pierwszym starcie backend automatycznie wykonuje migracje bazy danych oraz ładuje dane demonstracyjne (seed). Konfiguracja odbywa się przez plik `.env`, zawierający m.in. dane dostępowe do PostgreSQL, klucz podpisywania JWT, parametry SMTP oraz adresy serwisów.

---

## 5. Testowanie

Projekt zawiera testy automatyczne zarówno dla backendu, jak i frontendu.

**Backend (pytest):** testy jednostkowe i integracyjne obejmują moduły uwierzytelniania (`test_auth.py`) oraz logiki rezerwacji (`test_reservations.py`). Konfiguracja testów oparta jest na pliku `conftest.py`.

**Frontend (Vitest):** testy obejmują store zarządzania stanem (`authStore.test.ts`) oraz komponenty formularzy rezerwacji (`reservationForm.test.tsx`).

Uruchomienie testów:
```bash
# Backend
cd backend && pytest tests/ -v

# Frontend
cd frontend && npm test
```

---

## 6. Wnioski

Projekt TableBook stanowi kompletną, działającą aplikację do rezerwacji stolików restauracyjnych. Jego realizacja pozwoliła na praktyczne zastosowanie szeregu nowoczesnych technologii webowych po stronie zarówno klienta, jak i serwera. Zastosowanie Docker Compose znacząco upraszcza wdrożenie i zapewnia spójność środowiska niezależnie od platformy uruchomieniowej.

Do mocnych stron projektu należą: czytelna architektura warstwowa, mechanizm zabezpieczenia przed podwójnym bookingiem, przemyślany system uwierzytelniania z tokenami JWT, automatyczna dokumentacja API oraz obecność testów automatycznych. Pr@jekt stanowi solidną podstawę do dalszego rozbudowania — np. o obsługę wielu restauracji zarządzanych przez oddzielnych właścicieli, integrację z systemem płatności czy aplikację mobilną.

---

## 7. Bibliografia

1. FastAPI — oficjalna dokumentacja: https://fastapi.tiangolo.com/
2. SQLAlchemy — oficjalna dokumentacja: https://docs.sqlalchemy.org/
3. Alembic — migracje bazy danych: https://alembic.sqlalchemy.org/
4. React — oficjalna dokumentacja: https://react.dev/
5. Vite — narzędzie do budowania: https://vitejs.dev/
6. Tailwind CSS — dokumentacja: https://tailwindcss.com/docs
7. shadcn/ui — biblioteka komponentów: https://ui.shadcn.com/
8. Zustand — zarządzanie stanem: https://zustand-demo.pmnd.rs/
9. JSON Web Tokens (JWT) — specyfikacja: https://jwt.io/introduction
10. Docker Compose — dokumentacja: https://docs.docker.com/compose/
11. PostgreSQL — oficjalna dokumentacja: https://www.postgresql.org/docs/
12. Recharts — biblioteka wykresów dla React: https://recharts.org/
13. Repozytorium projektu: https://github.com/Best0fKinto/Rezerwacje_app
