import smtplib
from email.mime.text import MIMEText

from app.core.config import settings


def send_reservation_email(to_email: str, subject: str, body: str) -> None:
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        print(f"[Email mock] To: {to_email} | Subject: {subject}")
        return
    try:
        msg = MIMEText(body, "html")
        msg["Subject"] = subject
        msg["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
        msg["To"] = to_email
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
    except Exception as e:
        print(f"[Email error] {e}")


def send_confirmation_email(
    user_email: str,
    user_name: str,
    reservation_date: str,
    time_slot: str,
    table_number: str,
) -> None:
    send_reservation_email(
        user_email,
        "Reservation Confirmed — TableBook",
        (
            f"<h2>Hi {user_name},</h2>"
            f"<p>Your reservation on <b>{reservation_date}</b> at <b>{time_slot}</b> "
            f"(Table {table_number}) is confirmed.</p>"
        ),
    )


def send_cancellation_email(
    user_email: str,
    user_name: str,
    reservation_date: str,
    time_slot: str,
) -> None:
    send_reservation_email(
        user_email,
        "Reservation Cancelled — TableBook",
        (
            f"<h2>Hi {user_name},</h2>"
            f"<p>Your reservation on <b>{reservation_date}</b> at <b>{time_slot}</b> "
            f"has been cancelled.</p>"
        ),
    )
