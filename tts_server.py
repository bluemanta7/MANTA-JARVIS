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
    from TTS.api import TTS
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
def synthesize():
    """
    Synthesize speech from text using Coqui TTS
    
    Request body:
    {
        "text": "Text to synthesize",
        "speaker": "speaker_name" (optional),
        "rate": 1.0 (optional)
    }
    
    Returns: WAV audio file
    """
    # Optional token authentication
    if SERVER_TOKEN:
        token = request.headers.get('X-TTS-TOKEN', '')
        if token != SERVER_TOKEN:
            return jsonify({'error': 'Unauthorized'}), 401

    # Parse request
    data = request.get_json(force=True)
    text = data.get('text', '').strip()
    
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
    """
    Handle OAuth callback from Google
    Exchanges authorization code for access token
    """
    try:
        # Verify credentials file exists
        if not os.path.exists(CREDENTIALS_FILE):
            return jsonify({
                'error': f'Missing {CREDENTIALS_FILE}. Please download from Google Cloud Console.'
            }), 500

        # Create OAuth flow
        flow = Flow.from_client_secrets_file(
            CREDENTIALS_FILE,
            scopes=SCOPES,
            redirect_uri='http://localhost:8080/oauth2callback'
        )
        
        # Exchange authorization code for credentials
        flow.fetch_token(authorization_response=request.url)
        creds = flow.credentials

        # Save credentials to file
        with open(TOKEN_FILE, 'w') as token_file:
            token_file.write(creds.to_json())

        print('✓ User authenticated successfully')
        
        # Return a simple HTML page that closes the window or redirects
        return '''
        <html>
            <head><title>Authentication Successful</title></head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h1>✓ Authentication Successful!</h1>
                <p>You can now close this window and return to MANTA-JARVIS.</p>
                <script>
                    // Automatically redirect back to main app
                    setTimeout(() => {
                        window.location.href = 'http://localhost:8080';
                    }, 2000);
                </script>
            </body>
        </html>
        '''
    
    except Exception as e:
        print(f'❌ OAuth callback failed: {e}')
        return jsonify({'error': str(e)}), 500


def get_calendar_credentials():
    """Load and refresh Google Calendar credentials"""
    if not os.path.exists(TOKEN_FILE):
        raise FileNotFoundError(
            'Not authenticated. Please sign in with Google first.'
        )
    
    creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    
    # Refresh if expired
    if creds.expired and creds.refresh_token:
        print('🔄 Refreshing expired credentials...')
        creds.refresh(Request())
        
        # Save refreshed credentials
        with open(TOKEN_FILE, 'w') as token_file:
            token_file.write(creds.to_json())
    
    return creds


# ============================================================================
# Google Calendar Event Creation
# ============================================================================

@app.route('/create_event', methods=['POST'])
def handle_create_event():
    """
    Create a Google Calendar event
    
    Request body:
    {
        "summary": "Event title",
        "start_time": "2025-10-15T14:00:00-04:00",
        "end_time": "2025-10-15T15:00:00-04:00",
        "description": "Optional description",
        "location": "Optional location"
    }
    
    Returns: Event details or error
    """
    # Parse request
    data = request.get_json(force=True)
    summary = data.get('summary')
    start_time = data.get('start_time')
    end_time = data.get('end_time')
    description = data.get('description', '')
    location = data.get('location', '')

    # Validate required fields
    if not summary or not start_time or not end_time:
        return jsonify({
            'error': 'Missing required fields: summary, start_time, end_time'
        }), 400

    try:
        # Get authenticated credentials
        creds = get_calendar_credentials()
        
        # Build Calendar API service
        service = build('calendar', 'v3', credentials=creds)
        
        # Create event object
        event = {
            'summary': summary,
            'start': {
                'dateTime': start_time,
                'timeZone': 'America/New_York'
            },
            'end': {
                'dateTime': end_time,
                'timeZone': 'America/New_York'
            }
        }
        
        # Add optional fields
        if description:
            event['description'] = description
        if location:
            event['location'] = location
        
        # Insert event into calendar
        print(f'📅 Creating event: {summary}')
        created_event = service.events().insert(
            calendarId='primary',
            body=event
        ).execute()
        
        print(f'✓ Event created: {created_event.get("htmlLink")}')
        
        return jsonify({
            'status': 'Event created successfully',
            'event_id': created_event.get('id'),
            'event_link': created_event.get('htmlLink'),
            'summary': summary,
            'start': start_time,
            'end': end_time
        }), 200
    
    except FileNotFoundError as e:
        return jsonify({'error': str(e)}), 401
    
    except Exception as e:
        print(f'❌ Failed to create event: {e}')
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
                h1 { color: #4285F4; }
                .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
                .ok { background: #d4edda; color: #155724; }
                .warning { background: #fff3cd; color: #856404; }
                code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
            </style>
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