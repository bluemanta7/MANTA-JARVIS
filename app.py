from flask import Flask, Response
from datetime import datetime, timedelta
import uuid

app = Flask(__name__)

def format_ics_datetime(dt: datetime) -> str:
    """Format datetime in iCalendar UTC format."""
    return dt.strftime("%Y%m%dT%H%M%SZ")

def make_event(summary: str, start: datetime, end: datetime, description: str = "", location: str = "") -> str:
    """Generate a single VEVENT block."""
    uid = f"{uuid.uuid4()}@manta-jarvis"
    dtstamp = format_ics_datetime(datetime.utcnow())
    return "\n".join([
        "BEGIN:VEVENT",
        f"UID:{uid}",
        f"DTSTAMP:{dtstamp}",
        f"DTSTART:{format_ics_datetime(start)}",
        f"DTEND:{format_ics_datetime(end)}",
        f"SUMMARY:{summary}",
        f"DESCRIPTION:{description}",
        f"LOCATION:{location}",
        "END:VEVENT",
    ])

def generate_calendar() -> str:
    """Generate a VCALENDAR with sample events."""
    now = datetime.utcnow()
    events = [
        make_event(
            summary="Deep Work Sprint",
            start=now + timedelta(days=1, hours=14),
            end=now + timedelta(days=1, hours=16),
            description="Focus block for calendar backend",
            location="Needham, MA"
        ),
        make_event(
            summary="Team Sync",
            start=now + timedelta(days=2, hours=15),
            end=now + timedelta(days=2, hours=16),
            description="Status + blockers"
        ),
    ]

    ics_lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//MANTA JARVIS//Calendar Feed//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        *events,
        "END:VCALENDAR",
        ""
    ]
    return "\n".join(ics_lines)

@app.route("/calendar.ics")
def calendar_ics():
    """Serve the calendar feed."""
    ics_text = generate_calendar()
    return Response(ics_text, mimetype="text/calendar")

@app.route("/healthz")
def health_check():
    """Simple health check endpoint."""
    return "OK", 200
