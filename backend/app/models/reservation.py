from datetime import datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Reservation(Base):
    __tablename__ = "reservations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    table_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tables.id"), nullable=False, index=True
    )
    date: Mapped[object] = mapped_column(Date, nullable=False)
    time_slot: Mapped[str] = mapped_column(String(10), nullable=False)
    party_size: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    user: Mapped[object] = relationship("User")
    table: Mapped[object] = relationship("Table")

    @property
    def table_number(self):
        return self.table.number if self.table else None

    @property
    def customer_name(self):
        return self.user.full_name if self.user else None

    @property
    def customer_email(self):
        return self.user.email if self.user else None
