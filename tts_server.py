from flask import Response
from ics import Calendar, Event
import json

#!/usr/bin/env python3
"""
MANTA-JARVIS Flask Backend
Handles TTS synthesis, Google OAuth, and Calendar event creation
"""

from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from io import BytesIO
import os
import datetime

# Google Calendar API
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

# Coqui TTS
try:
    from TTS.api import TTS  # type: ignore
    COQUI_AVAILABLE = True
except Exception as e:
    print(f'⚠️  Coqui TTS import failed: {e}')
    print('TTS will fall back to browser synthesis')
    COQUI_AVAILABLE = False

# ============================================================================
# Flask App Configuration
# ============================================================================

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

# Environment configuration
SCOPES = ['https://www.googleapis.com/auth/calendar.events']
SERVER_TOKEN = os.environ.get('TTS_TOKEN', '')  # Optional authentication token
CREDENTIALS_FILE = 'credentials.json'
TOKEN_FILE = 'user_token.json'

# Global TTS model instance
_tts_model = None

# ============================================================================
# TTS Synthesizer
# ============================================================================

def get_tts():
    """Initialize and return TTS model (singleton pattern)"""
    global _tts_model
    if _tts_model is None:
        if not COQUI_AVAILABLE:
            raise RuntimeError('Coqui TTS not available in this environment')
        
        model_name = os.environ.get('TTS_MODEL', 'tts_models/en/ljspeech/tacotron2-DDC')
        print(f'🔊 Loading TTS model: {model_name}')
        _tts_model = TTS(model_name)
        print('✓ TTS model loaded successfully')
    
    return _tts_model


@app.route('/synthesize', methods=['POST'])
def synthesize_audio():
    data = request.get_json(force=True)
    subject = data.get('subject_request')  # Optional: used for calendar logic
    text = data.get('text')  # This is the actual speech input

    if not subject:
        return jsonify({'error': 'Missing subject_request'}), 400

    if not text:
        return jsonify({'error': 'No text provided'}), 400

    # Optional parameters
    speaker = data.get('speaker')
    speed = data.get('rate', 1.0)

    try:
        tts = get_tts()

        # Generate audio file
        out_path = 'temp_out.wav'
        print(f'🎤 Synthesizing: "{text[:50]}..."')
        tts.tts_to_file(text=text, file_path=out_path)

        # Load into memory and return
        bio = BytesIO()
        with open(out_path, 'rb') as f:
            bio.write(f.read())
        bio.seek(0)

        # Clean up temp file
        if os.path.exists(out_path):
            os.remove(out_path)

        print('✓ Audio synthesized successfully')
        return send_file(
            bio,
            mimetype='audio/wav',
            as_attachment=False,
            download_name='speech.wav'
        )

    except Exception as e:
        print(f'❌ TTS synthesis failed: {e}')
        return jsonify({'error': str(e)}), 500



# ============================================================================
# Google OAuth & Authentication
# ============================================================================

@app.route('/oauth2callback')
def oauth2callback():
    try:
        flow = Flow.from_client_secrets_file(
            CREDENTIALS_FILE,
            scopes=SCOPES,
            redirect_uri='http://localhost:8080/oauth2callback'
        )
        flow.fetch_token(authorization_response=request.url)

        creds = flow.credentials

        # Build calendar service to extract user email
        service = build('calendar', 'v3', credentials=creds)
        profile = service.calendarList().get(calendarId='primary').execute()
        user_email = profile.get('id')

        # Save token to file
        token_path = f'tokens/{user_email}.json'
        with open(token_path, 'w') as f:
            f.write(creds.to_json())

        print('✓ User authenticated successfully')
        
        # Return HTML that sets localStorage and redirects
        return f"""
        <html>
            <head><title>Authentication Successful</title></head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h1>✓ Authentication Successful!</h1>
                <p>You can now close this window and return to MANTA-JARVIS.</p>
                <script>
                    localStorage.setItem('jarvis_user_email', '{user_email}');
                    setTimeout(() => {{
                        window.location.href = 'http://localhost:8080';
                    }}, 2000);
                </script>
            </body>
        </html>
        """
    
    except Exception as e:
        print(f'❌ OAuth callback failed: {e}')
        return jsonify({'error': str(e)}), 500


def get_calendar_credentials(email):
    token_path = f'tokens/{email}.json'
    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)
        return creds
    return None


@app.route('/update_event', methods=['POST'])
def update_event():
    """
    Update an existing calendar event.
    
    Request body:
    {
        "event_id": "abc123def456",
        "summary": "Updated title",
        "start_time": "2025-10-15T16:00:00-04:00",
        "end_time": "2025-10-15T17:00:00-04:00",
        "description": "Updated description",
        "location": "Updated location"
    }
    
    Returns: Updated event details or error
    """
    data = request.get_json(force=True)
    event_id = data.get('event_id')
    summary = data.get('summary')
    start_time = data.get('start_time')
    end_time = data.get('end_time')
    description = data.get('description')
    location = data.get('location')

    if not event_id:
        return jsonify({'error': 'Missing required field: event_id'}), 400

    try:
        creds = get_calendar_credentials(data.get('email'))
        if not creds:
            return jsonify({'error': 'Not authenticated'}), 401
            
        service = build('calendar', 'v3', credentials=creds)

        # Fetch the existing event
        event = service.events().get(calendarId='primary', eventId=event_id).execute()

        # Update fields if provided
        if summary:
            event['summary'] = summary
        if start_time:
            event['start']['dateTime'] = start_time
        if end_time:
            event['end']['dateTime'] = end_time
        if description is not None:
            event['description'] = description
        if location is not None:
            event['location'] = location

        updated_event = service.events().update(calendarId='primary', eventId=event_id, body=event).execute()

        print(f'✏️ Event updated: {updated_event.get("htmlLink")}')
        return jsonify({
            'status': 'Event updated successfully',
            'event_id': updated_event.get('id'),
            'event_link': updated_event.get('htmlLink'),
            'summary': updated_event.get('summary'),
            'start': updated_event['start']['dateTime'],
            'end': updated_event['end']['dateTime']
        }), 200

    except Exception as e:
        print(f'❌ Failed to update event: {e}')
        return jsonify({'error': str(e)}), 500

# ============================================================================
# Health Check & Info Routes
# ============================================================================

@app.route('/')
def index():
    """Serve the main application page"""
    return '''
    <html>
        <head>
            <title>MANTA-JARVIS Backend</title>
            <style>
                body { font-family: Arial; max-width: 800px; margin: 50px auto; padding: 20px; }
        </head>
        <body>
            <h1>🤖 MANTA-JARVIS Backend</h1>
            <p>Flask server is running successfully!</p>
            
            <h2>Status</h2>
            <div class="status ok">✓ Server: Online</div>
            <div class="status {}">
                {} TTS: {}
            </div>
            <div class="status {}">
                {} Authentication: {}
            </div>
            
            <h2>Available Endpoints</h2>
            <ul>
                <li><code>POST /synthesize</code> - Text-to-speech synthesis</li>
                <li><code>GET /oauth2callback</code> - OAuth callback handler</li>
                <li><code>POST /create_event</code> - Create calendar event</li>
            </ul>
            
            <h2>Setup Instructions</h2>
            <ol>
                <li>Open <code>index.html</code> in your browser</li>
                <li>Click "Sign in with Google"</li>
                <li>Authorize calendar access</li>
                <li>Start creating events with voice commands!</li>
            </ol>
        </body>
    </html>
    '''.format(
        'ok' if COQUI_AVAILABLE else 'warning',
        '✓' if COQUI_AVAILABLE else '⚠️',
        'Available' if COQUI_AVAILABLE else 'Not available (using browser TTS)',
        'ok' if os.path.exists(TOKEN_FILE) else 'warning',
        '✓' if os.path.exists(TOKEN_FILE) else '⚠️',
        'Signed in' if os.path.exists(TOKEN_FILE) else 'Not signed in'
    )


@app.route('/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'tts_available': COQUI_AVAILABLE,
        'authenticated': os.path.exists(TOKEN_FILE)
    })


# ============================================================================
# Error Handlers
# ============================================================================

@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def internal_error(e):
    return jsonify({'error': 'Internal server error'}), 500

# Existing imports and routes
from flask import Flask, request, jsonify, Response
from ics import Calendar, Event  # ✅ Add this if you're using ics.py

app = Flask(__name__)

# ... your existing routes like /, /signin, /oauth2callback, etc.

# ✅ Add this new route BELOW your other routes
@app.route('/calendar/<user_email>.ics')
def calendar_feed(user_email):
    events = get_user_events(user_email)  # You’ll define this function
    cal = Calendar()

    for e in events:
        event = Event()
        event.name = e['title']
        event.begin = e['start']
        event.end = e['end']
        event.description = e.get('description', '')
        event.location = e.get('location', '')
        cal.events.add(event)

    return Response(str(cal), mimetype='text/calendar')


# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == '__main__':
    print('=' * 60)
    print('🤖 MANTA-JARVIS Backend Server')
    print('=' * 60)
    print(f'TTS Available: {COQUI_AVAILABLE}')
    print(f'Credentials File: {os.path.exists(CREDENTIALS_FILE)}')
    print(f'User Token: {os.path.exists(TOKEN_FILE)}')
    print('=' * 60)
    print('Starting server on http://127.0.0.1:8080')
    print('Press Ctrl+C to stop')
    print('=' * 60)
    
    app.run(
        host='127.0.0.1',
        port=8080,
        debug=True
    )
@app.route('/whoami', methods=['GET'])
def whoami():
    email = request.args.get('email')
    creds = get_calendar_credentials(email)
    if creds:
        return jsonify({'email': email}), 200
    return jsonify({'error': 'No credentials found'}), 404

def get_user_events(user_email):
    """Retrieve user events from storage"""
    try:
        with open('user_events.json', 'r') as f:
            data = json.load(f)
        return data.get(user_email, [])
    except FileNotFoundError:
        return []


@app.route('/whoami', methods=['GET'])
def whoami():
    """Get current authenticated user email"""
    email = request.args.get('email')
    creds = get_calendar_credentials(email)
    if creds:
        return jsonify({'email': email}), 200
    return jsonify({'error': 'No credentials found'}), 404


@app.route('/calendar/<user_email>.ics')
def calendar_feed(user_email):
    """Generate iCalendar feed for user events"""
    events = get_user_events(user_email)
    cal = Calendar()

    for e in events:
        event = Event()
        event.name = e['title']
        event.begin = e['start']
        event.end = e['end']
        event.description = e.get('description', '')
        event.location = e.get('location', '')
        cal.events.add(event)

    return Response(str(cal), mimetype='text/calendar')


if __name__ == '__main__':
    print('=' * 60)
    print('🤖 MANTA-JARVIS Backend Server')
    print('=' * 60)
    print(f'TTS Available: {COQUI_AVAILABLE}')
    print(f'Credentials File: {os.path.exists(CREDENTIALS_FILE)}')
    print(f'User Token: {os.path.exists(TOKEN_FILE)}')
    print('=' * 60)
    print('Starting server on http://127.0.0.1:8080')
    print('Press Ctrl+C to stop')
    print('=' * 60)
    
    app.run(
        host='127.0.0.1',
        port=8080,
        debug=True
    )
