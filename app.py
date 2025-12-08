from flask import Flask, Response, request, jsonify
from datetime import datetime, timedelta
import uuid
import json
import os
import base64

app = Flask(__name__)

# ============================================================================
# Storage
# ============================================================================
EVENTS_DIR = "user_events"
os.makedirs(EVENTS_DIR, exist_ok=True)

def get_user_events_path(username_b64: str) -> str:
    """Get the path to a user's events file."""
    safe_name = username_b64.replace("/", "_").replace("\\", "_")
    return os.path.join(EVENTS_DIR, f"{safe_name}.json")

def load_user_events(username_b64: str) -> list:
    """Load events for a user from storage."""
    path = get_user_events_path(username_b64)
    if not os.path.exists(path):
        return []
    try:
        with open(path, 'r') as f:
            data = json.load(f)
            return data.get("events", [])
    except Exception as e:
        print(f"Error loading events for {username_b64}: {e}")
        return []

def save_user_events(username_b64: str, events: list) -> bool:
    """Save events for a user to storage."""
    path = get_user_events_path(username_b64)
    try:
        with open(path, 'w') as f:
            json.dump({"username_b64": username_b64, "events": events}, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving events for {username_b64}: {e}")
        return False

# ============================================================================
# ICS Generation
# ============================================================================

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

def events_to_ics(events: list) -> str:
    """Convert a list of events to iCalendar format."""
    ics_events = []
    
    for event in events:
        try:
            # Parse ISO 8601 timestamps
            start_dt = datetime.fromisoformat(event.get("start", "").replace("Z", "+00:00"))
            end_dt = datetime.fromisoformat(event.get("end", "").replace("Z", "+00:00"))
            
            summary = event.get("summary", "Untitled Event")
            description = event.get("description", "")
            location = event.get("location", "")
            
            ics_event = make_event(summary, start_dt, end_dt, description, location)
            ics_events.append(ics_event)
        except Exception as e:
            print(f"Error converting event to ICS: {e}")
            continue
    
    ics_lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//MANTA JARVIS//Calendar Feed//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        *ics_events,
        "END:VCALENDAR",
        ""
    ]
    return "\n".join(ics_lines)

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

# ============================================================================
# Routes
# ============================================================================

@app.route("/api/sync", methods=["POST"])
def sync_events():
    """Receive events from frontend and store them."""
    try:
        data = request.get_json()
        username_b64 = data.get("username_b64")
        events = data.get("events", [])
        
        if not username_b64:
            return jsonify({"error": "Missing username_b64"}), 400
        
        success = save_user_events(username_b64, events)
        
        if success:
            return jsonify({
                "status": "success",
                "message": f"Saved {len(events)} events"
            }), 200
        else:
            return jsonify({"error": "Failed to save events"}), 500
    except Exception as e:
        print(f"Error in /api/sync: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/calendar/<token>.ics", methods=["GET"])
def calendar_ics_user(token):
    """Serve per-user calendar feed."""
    try:
        # token is the base64-encoded username
        events = load_user_events(token)
        ics_text = events_to_ics(events)
        return Response(ics_text, mimetype="text/calendar")
    except Exception as e:
        print(f"Error in /calendar/<token>.ics: {e}")
        return Response("", mimetype="text/calendar"), 200

@app.route("/calendar.ics")
def calendar_ics():
    """Serve the default calendar feed (for testing)."""
    ics_text = generate_calendar()
    return Response(ics_text, mimetype="text/calendar")

@app.route("/healthz")
def health_check():
    """Simple health check endpoint."""
    return "OK", 200
