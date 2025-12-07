#!/usr/bin/env python3
"""
MANTA-JARVIS Unified Calendar Server v2.0
- Single Flask backend serving everything
- Per-user .ics calendar feeds for Google Calendar subscription
- Event sync from frontend
- Conversational greeting layer
- Production-ready with environment variable support
"""

from flask import Flask, Response, request, jsonify
from flask_cors import CORS
from datetime import datetime
import json
import os
import base64
import logging
from urllib.parse import quote

# ============================================================================
# Configuration & Logging
# ============================================================================
app = Flask(__name__)
CORS(app)

# Environment variables
PORT = int(os.environ.get("PORT", 5000))
DEBUG = os.environ.get("DEBUG", "False").lower() == "true"
DATA_DIR = os.environ.get("DATA_DIR", "calendar_data")
os.makedirs(DATA_DIR, exist_ok=True)

# Logging setup
logging.basicConfig(
    level=logging.INFO if not DEBUG else logging.DEBUG,
    format='[%(levelname)s] %(asctime)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# Helper Functions
# ============================================================================

def get_user_file_path(username_b64):
    """Get the file path for a user's event data"""
    try:
        safe_name = username_b64.replace('/', '_').replace('\\', '_')
        return os.path.join(DATA_DIR, f'{safe_name}.json')
    except Exception as e:
        logger.error(f"Error getting user file path: {e}")
        return None

def load_user_events(username_b64):
    """Load events for a user from JSON file"""
    path = get_user_file_path(username_b64)
    if not path or not os.path.exists(path):
        logger.debug(f"No events file found for: {username_b64}")
        return []
    
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            events = data.get('events', [])
            logger.info(f"✅ Loaded {len(events)} events for user")
            return events
    except Exception as e:
        logger.error(f"Error loading events: {e}")
        return []

def save_user_events(username_b64, events):
    """Save events for a user to JSON file"""
    path = get_user_file_path(username_b64)
    if not path:
        return False
    
    try:
        data = {
            'username_b64': username_b64,
            'events': events,
            'last_updated': datetime.utcnow().isoformat()
        }
        
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"💾 Saved {len(events)} events for user")
        return True
    except Exception as e:
        logger.error(f"Error saving events: {e}")
        return False

def format_datetime_ics(iso_str):
    """Convert ISO 8601 datetime to iCalendar format (YYYYMMDDTHHMMSSZ)"""
    try:
        dt_str = iso_str.replace('Z', '+00:00')
        dt = datetime.fromisoformat(dt_str)
        return dt.strftime('%Y%m%dT%H%M%SZ')
    except Exception as e:
        logger.warning(f"Date format error for '{iso_str}': {e}")
        return datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')

def generate_ics_calendar(events):
    """Generate iCalendar (.ics) format from events list"""
    lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//MANTA-JARVIS//Calendar//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:MANTA-JARVIS',
        'X-WR-TIMEZONE:UTC',
        'X-WR-CALDESC:Your personal MANTA-JARVIS calendar'
    ]
    
    for event in events:
        try:
            event_id = event.get('id', str(hash(event.get('summary', ''))))
            summary = event.get('summary', 'Untitled Event')
            start = event.get('start')
            end = event.get('end')
            description = event.get('description', '')
            location = event.get('location', '')
            created = event.get('created', datetime.utcnow().isoformat())
            
            if not start:
                logger.warning(f"Skipping event without start time: {summary}")
                continue
            
            dtstart = format_datetime_ics(start)
            dtend = format_datetime_ics(end if end else start)
            dtstamp = format_datetime_ics(created)
            
            lines.extend([
                'BEGIN:VEVENT',
                f'UID:{event_id}@manta-jarvis.local',
                f'DTSTAMP:{dtstamp}',
                f'DTSTART:{dtstart}',
                f'DTEND:{dtend}',
                f'SUMMARY:{summary}',
                'STATUS:CONFIRMED',
                'SEQUENCE:0'
            ])
            
            if description:
                lines.append(f'DESCRIPTION:{description}')
            if location:
                lines.append(f'LOCATION:{location}')
            
            lines.append('END:VEVENT')
            logger.debug(f"✅ Added event to calendar: {summary}")
            
        except Exception as e:
            logger.error(f"Error processing event: {e}")
            continue
    
    lines.append('END:VCALENDAR')
    return '\r\n'.join(lines) + '\r\n'

def get_base_url():
    """Get the base URL for calendar feed URLs"""
    if request.host_url:
        return request.host_url.rstrip('/')
    return f'http://localhost:{PORT}'

# ============================================================================
# API Endpoints
# ============================================================================

@app.route('/api/sync', methods=['POST'])
def sync_events():
    """
    Sync events from frontend to backend storage
    
    Request body:
    {
        "username_b64": "base64_encoded_username",
        "events": [...]
    }
    """
    try:
        data = request.get_json()
        username_b64 = data.get('username_b64')
        events = data.get('events', [])
        
        if not username_b64:
            logger.warning("Sync request missing username_b64")
            return jsonify({'error': 'username_b64 required'}), 400
        
        success = save_user_events(username_b64, events)
        
        if success:
            base_url = get_base_url()
            calendar_url = f'{base_url}/calendar/{username_b64}.ics'
            logger.info(f"✅ Synced {len(events)} events for {username_b64}")
            
            return jsonify({
                'status': 'success',
                'events_count': len(events),
                'calendar_url': calendar_url,
                'message': 'Events synced successfully'
            }), 200
        else:
            return jsonify({'error': 'Failed to save events'}), 500
            
    except Exception as e:
        logger.error(f"Sync error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/calendar/<username_b64>.ics', methods=['GET'])
def serve_calendar(username_b64):
    """
    Serve iCalendar feed for Google Calendar subscription
    
    URL: /calendar/<base64_username>.ics
    """
    try:
        logger.info(f"📡 Calendar feed requested for: {username_b64}")
        
        events = load_user_events(username_b64)
        
        if not events:
            logger.debug(f"⚠️ No events found, returning empty calendar")
            empty_cal = generate_ics_calendar([])
            response = Response(empty_cal, mimetype='text/calendar')
            response.headers['Content-Disposition'] = 'inline; filename="calendar.ics"'
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
            return response
        
        ics_content = generate_ics_calendar(events)
        
        logger.info(f"📅 Serving calendar with {len(events)} events")
        
        response = Response(ics_content, mimetype='text/calendar')
        response.headers['Content-Disposition'] = 'inline; filename="manta-jarvis.ics"'
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        
        return response
        
    except Exception as e:
        logger.error(f"Calendar feed error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/get-calendar-url', methods=['POST'])
def get_calendar_url():
    """
    Get the calendar URL for a user (called after login)
    """
    try:
        data = request.get_json()
        username_b64 = data.get('username_b64')
        
        if not username_b64:
            return jsonify({'error': 'username_b64 required'}), 400
        
        base_url = get_base_url()
        calendar_url = f'{base_url}/calendar/{username_b64}.ics'
        
        logger.info(f"Generated calendar URL for user")
        
        return jsonify({
            'status': 'success',
            'calendar_url': calendar_url
        }), 200
        
    except Exception as e:
        logger.error(f"Error generating calendar URL: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/')
def index():
    """Home page with status and instructions"""
    users = len([f for f in os.listdir(DATA_DIR) if f.endswith('.json')]) if os.path.exists(DATA_DIR) else 0
    
    return f'''
    <html>
        <head>
            <title>MANTA-JARVIS Calendar Server</title>
            <style>
                body {{ 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    max-width: 900px; 
                    margin: 30px auto; 
                    padding: 20px;
                    background: linear-gradient(135deg, #0a1929 0%, #1a4d6d 100%);
                    color: white;
                }}
                .container {{
                    background: rgba(10, 57, 84, 0.95);
                    padding: 30px;
                    border-radius: 10px;
                    box-shadow: 0 2px 20px rgba(0, 188, 212, 0.2);
                    border: 2px solid rgba(0, 188, 212, 0.3);
                }}
                h1 {{ color: #00bcd4; }}
                h2 {{ color: #7dd3fc; border-bottom: 2px solid #00bcd4; padding-bottom: 10px; }}
                .status {{ 
                    padding: 15px; 
                    margin: 15px 0; 
                    border-radius: 5px;
                    background: rgba(0, 188, 212, 0.1); 
                    color: #00ffff;
                    border-left: 4px solid #00bcd4;
                }}
                code {{ 
                    background: rgba(0, 0, 0, 0.3); 
                    padding: 3px 8px; 
                    border-radius: 3px;
                    color: #00ffff;
                }}
                .endpoint {{
                    background: rgba(0, 0, 0, 0.2);
                    padding: 12px;
                    margin: 8px 0;
                    border-radius: 5px;
                    border-left: 3px solid #00bcd4;
                    color: #7dd3fc;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🗓️ MANTA-JARVIS Calendar Server v2.0</h1>
                
                <div class="status">
                    ✅ Server is running on port {PORT}<br>
                    👥 Active users: {users}<br>
                    📁 Data directory: {os.path.abspath(DATA_DIR)}<br>
                    🔧 Debug mode: {'ON' if DEBUG else 'OFF'}
                </div>
                
                <h2>📡 Endpoints</h2>
                
                <div class="endpoint">
                    <strong>POST</strong> /api/sync<br>
                    <small>Sync events from frontend</small>
                </div>
                
                <div class="endpoint">
                    <strong>POST</strong> /api/get-calendar-url<br>
                    <small>Get unique calendar URL after login</small>
                </div>
                
                <div class="endpoint">
                    <strong>GET</strong> /calendar/&lt;username_b64&gt;.ics<br>
                    <small>iCalendar feed for Google Calendar subscription</small>
                </div>
                
                <h2>🚀 How to Use</h2>
                <ol>
                    <li>Open <code>index.html</code> in your browser</li>
                    <li>Create an account and login</li>
                    <li>Your unique calendar link appears automatically</li>
                    <li>Create events using voice or text commands</li>
                    <li>Copy the calendar link from the sidebar</li>
                    <li>Add to Google Calendar → "Other calendars" → "From URL"</li>
                    <li>Events sync in real-time!</li>
                </ol>
                
                <h2>🔗 Deployment</h2>
                <ul>
                    <li><strong>Render.com:</strong> Start command: <code>gunicorn calendar_server:app</code></li>
                    <li><strong>Environment variables:</strong> PORT, DEBUG, DATA_DIR</li>
                    <li><strong>Requirements:</strong> Flask, Flask-CORS, gunicorn, Werkzeug</li>
                </ul>
            </div>
        </body>
    </html>
    '''

@app.route('/health')
def health():
    """Health check endpoint"""
    users = len([f for f in os.listdir(DATA_DIR) if f.endswith('.json')]) if os.path.exists(DATA_DIR) else 0
    return jsonify({
        'status': 'ok',
        'server': 'MANTA-JARVIS Calendar Server v2.0',
        'users': users,
        'port': PORT
    })

# ============================================================================
# Application Startup
# ============================================================================

if __name__ == '__main__':
    logger.info('=' * 70)
    logger.info('🗓️  MANTA-JARVIS UNIFIED CALENDAR SERVER v2.0')
    logger.info('=' * 70)
    logger.info(f'📁 Data directory: {os.path.abspath(DATA_DIR)}')
    logger.info(f'🌐 Server URL: http://localhost:{PORT}')
    logger.info(f'📅 Calendar feeds: http://localhost:{PORT}/calendar/<username>.ics')
    logger.info(f'🔧 Debug mode: {DEBUG}')
    logger.info('=' * 70)
    logger.info('✨ Server ready! Open index.html in your browser.')
    logger.info('Press Ctrl+C to stop')
    logger.info('=' * 70)
    
    app.run(host='0.0.0.0', port=PORT, debug=DEBUG)
