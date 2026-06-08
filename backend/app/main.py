from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.endpoints import auth, restaurants, reservations

app = FastAPI(title="TableBook API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(restaurants.router, prefix="", tags=["restaurants"])
app.include_router(reservations.router, prefix="", tags=["reservations"])


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
