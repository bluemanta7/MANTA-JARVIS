from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import os
import json
import base64
from datetime import datetime
import re

app = Flask(__name__)
CORS(app)

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data', 'users')
os.makedirs(DATA_DIR, exist_ok=True)


def format_dt_for_ics(dt_str):
    """Convert ISO datetime string to iCalendar format"""
    try:
        dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        return dt.strftime('%Y%m%dT%H%M%SZ')
    except Exception as e:
        print(f"⚠️ Date format error: {e}")
        return datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')


def generate_ics_from_events(events):
    """Generate iCalendar format from events list"""
    lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//MANTA-JARVIS//Calendar Feed//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:MANTA-JARVIS Calendar',
        'X-WR-TIMEZONE:UTC'
    ]
    
    for ev in events:
        uid = ev.get('id', str(datetime.utcnow().timestamp()))
        summary = ev.get('summary', ev.get('title', 'Untitled Event'))
        start = ev.get('start')
        end = ev.get('end')
        description = ev.get('description', '')
        location = ev.get('location', '')
        
        if not start:
            print(f"⚠️ Skipping event without start time: {summary}")
            continue
        
        try:
            dtstart = format_dt_for_ics(start)
            dtend = format_dt_for_ics(end) if end else dtstart
            dtstamp = format_dt_for_ics(datetime.utcnow().isoformat())
            
            lines.extend([
                'BEGIN:VEVENT',
                f'UID:{uid}@manta-jarvis.local',
                f'DTSTAMP:{dtstamp}',
                f'DTSTART:{dtstart}',
                f'DTEND:{dtend}',
                f'SUMMARY:{summary}',
            ])
            
            if description:
                lines.append(f'DESCRIPTION:{description}')
            if location:
                lines.append(f'LOCATION:{location}')
            
            lines.append('STATUS:CONFIRMED')
            lines.append('SEQUENCE:0')
            lines.append('END:VEVENT')
            
        except Exception as e:
            print(f"❌ Error processing event '{summary}': {e}")
            continue
    
    lines.append('END:VCALENDAR')
    return '\r\n'.join(lines) + '\r\n'


@app.route('/api/sync', methods=['POST'])
def sync_calendar():
    """
    Sync events from frontend to backend storage
    
    Request body:
    {
        "username_b64": "dXNlcm5hbWU=",
        "events": [...]
    }
    """
    try:
        payload = request.get_json()
        username_b64 = payload.get('username_b64')
        events = payload.get('events', [])
        
        if not username_b64:
            return jsonify({'error': 'username_b64 required'}), 400
        
        # Decode username
        try:
            username = base64.b64decode(username_b64).decode('utf-8')
        except Exception as e:
            return jsonify({'error': f'Invalid base64 encoding: {e}'}), 400
        
        # Save to file
        filename = f'{username_b64}.json'
        filepath = os.path.join(DATA_DIR, filename)
        
        data = {
            'username': username,
            'events': events,
            'last_updated': datetime.utcnow().isoformat()
        }
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f'✅ Synced {len(events)} events for user: {username}')
        
        return jsonify({
            'status': 'ok',
            'username': username,
            'events_count': len(events),
            'calendar_url': f'/calendar/{username_b64}.ics',
            'note': 'Use full domain when deployed (e.g., https://manta-jarvis.onrender.com/calendar/{}.ics)'.format(username_b64)
        }), 200
        
    except Exception as e:
        print(f'❌ Sync error: {e}')
        return jsonify({'error': str(e)}), 500


@app.route('/calendar/<username_b64>.ics', methods=['GET'])
def serve_calendar(username_b64):
    """
    Serve iCalendar feed for a specific user
    
    URL: /calendar/<base64_encoded_username>.ics
    """
    try:
        # Decode username
        try:
            username = base64.b64decode(username_b64).decode('utf-8')
        except Exception:
            return jsonify({'error': 'Invalid username encoding'}), 400
        
        filename = f'{username_b64}.json'
        filepath = os.path.join(DATA_DIR, filename)
        
        # If file doesn't exist, return empty calendar
        if not os.path.exists(filepath):
            print(f'⚠️ No calendar data found for user: {username}')
            empty_cal = (
                'BEGIN:VCALENDAR\r\n'
                'VERSION:2.0\r\n'
                'PRODID:-//MANTA-JARVIS//Calendar Feed//EN\r\n'
                'CALSCALE:GREGORIAN\r\n'
                'X-WR-CALNAME:MANTA-JARVIS Calendar\r\n'
                'END:VCALENDAR\r\n'
            )
            return Response(empty_cal, mimetype='text/calendar')
        
        # Load events from file
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        events = data.get('events', [])
        print(f'📅 Serving calendar for {username} with {len(events)} events')
        
        # Generate iCalendar format
        ics_content = generate_ics_from_events(events)
        
        # Return with proper headers for calendar subscription
        response = Response(ics_content, mimetype='text/calendar')
        response.headers['Content-Disposition'] = f'inline; filename="{username}.ics"'
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        
        return response
        
    except Exception as e:
        print(f'❌ Calendar feed error: {e}')
        return jsonify({'error': str(e)}), 500


@app.route('/')
def index():
    """Health check and info page"""
    return '''
    <html>
        <head>
            <title>MANTA-JARVIS Calendar Server</title>
            <style>
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    max-width: 900px; 
                    margin: 30px auto; 
                    padding: 20px;
                    background: linear-gradient(135deg, #0a1929 0%, #1a4d6d 50%, #0d3b5c 100%);
                    color: white;
                }
                .container {
                    background: rgba(10, 57, 84, 0.95);
                    padding: 30px;
                    border-radius: 10px;
                    box-shadow: 0 2px 20px rgba(0, 188, 212, 0.2);
                    border: 2px solid rgba(0, 188, 212, 0.3);
                }
                h1 { color: #00bcd4; margin-top: 0; }
                h2 { color: #7dd3fc; border-bottom: 2px solid #00bcd4; padding-bottom: 10px; }
                .status { 
                    padding: 15px; 
                    margin: 15px 0; 
                    border-radius: 5px;
                    border-left: 4px solid;
                }
                .ok { 
                    background: rgba(0, 188, 212, 0.1); 
                    color: #00ffff;
                    border-color: #00bcd4;
                }
                code { 
                    background: rgba(0, 0, 0, 0.3); 
                    padding: 3px 8px; 
                    border-radius: 3px;
                    font-family: 'Courier New', monospace;
                    color: #00ffff;
                }
                ul { line-height: 1.8; }
                .endpoint {
                    background: rgba(0, 0, 0, 0.2);
                    padding: 12px;
                    margin: 8px 0;
                    border-radius: 5px;
                    font-family: monospace;
                    border-left: 3px solid #00bcd4;
                    color: #7dd3fc;
                }
                .deployment-warning {
                    background: rgba(255, 193, 7, 0.1);
                    border: 1px solid #ffc107;
                    padding: 15px;
                    border-radius: 5px;
                    margin: 15px 0;
                }
                .deployment-warning strong {
                    color: #ffeb3b;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🗓️ MANTA-JARVIS Calendar Server</h1>
                
                <div class="status ok">
                    ✅ Server is running successfully!
                </div>
                
                <div class="deployment-warning">
                    <strong>📢 Deployment Note:</strong><br>
                    This server is running locally. To use calendar links in Google Calendar, 
                    deploy to a public service (Render, Railway, Heroku) with HTTPS.
                </div>
                
                <h2>📡 Available Endpoints</h2>
                
                <div class="endpoint">
                    <strong>POST</strong> /api/sync<br>
                    <small>Sync events from frontend to backend storage</small>
                </div>
                
                <div class="endpoint">
                    <strong>GET</strong> /calendar/&lt;username_b64&gt;.ics<br>
                    <small>Serve iCalendar feed for Google Calendar subscription</small>
                </div>
                
                <h2>🚀 Deployment to Render (FREE)</h2>
                <ol>
                    <li>Push your code to GitHub:
                        <ul>
                            <li>Create repo with serve_ics.py, requirements.txt</li>
                            <li>Commit and push</li>
                        </ul>
                    </li>
                    <li>Go to <code>render.com</code> → New Web Service</li>
                    <li>Connect GitHub repo and configure:
                        <ul>
                            <li><strong>Build:</strong> <code>pip install -r requirements.txt</code></li>
                            <li><strong>Start:</strong> <code>python serve_ics.py</code></li>
                            <li><strong>Port:</strong> Use $PORT env var (already configured)</li>
                        </ul>
                    </li>
                    <li>Get your public domain: <code>https://manta-jarvis-xxxxx.onrender.com</code></li>
                    <li>Update frontend to use public domain for calendar links</li>
                </ol>
                
                <h2>📋 Local Setup Instructions</h2>
                <ol>
                    <li>Run: <code>python serve_ics.py</code></li>
                    <li>Open <code>index.html</code> in your browser</li>
                    <li>Create an account and login</li>
                    <li>Create events via voice or text</li>
                    <li>View calendar and copy link (for local testing only)</li>
                </ol>
                
                <h2>🔧 How It Works</h2>
                <ul>
                    <li>✅ Per-user storage in <code>data/users/</code></li>
                    <li>✅ Automatic .ics generation from JSON events</li>
                    <li>✅ Live feed endpoint for calendar subscriptions</li>
                    <li>✅ Changes sync within minutes</li>
                    <li>✅ HTTPS support for Google Calendar integration</li>
                </ul>
                
                <h2>💡 Voice Commands</h2>
                <ul>
                    <li>"Create event workout Wednesday at 6am"</li>
                    <li>"Schedule dentist appointment next Friday at 2:30"</li>
                    <li>"Book me a meeting with the team Tuesday at 3pm"</li>
                    <li>"Add team sync tomorrow at 10:00"</li>
                </ul>
            </div>
        </body>
    </html>
    '''


@app.route('/health')
def health():
    """Health check endpoint"""
    user_count = len([f for f in os.listdir(DATA_DIR) if f.endswith('.json')])
    return jsonify({
        'status': 'ok',
        'server': 'MANTA-JARVIS Calendar Server',
        'users': user_count,
        'data_dir': DATA_DIR
    })


if __name__ == '__main__':
    print('=' * 60)
    print('🗓️  MANTA-JARVIS Calendar Server')
    print('=' * 60)
    print(f'📁 Data directory: {DATA_DIR}')
    
    # Support Render.com deployment with PORT environment variable
    port = int(os.environ.get("PORT", 5000))
    debug_mode = os.environ.get("DEBUG", "True").lower() == "true"
    
    print(f'🌐 Server starting on http://0.0.0.0:{port}')
    print('=' * 60)
    print('✨ Calendar feeds will be available at:')
    print(f'   http://localhost:{port}/calendar/<username>.ics')
    print('   (or your public domain when deployed)')
    print('=' * 60)
    print('Press Ctrl+C to stop')
    print('=' * 60)
    
    app.run(host='0.0.0.0', port=port, debug=debug_mode)