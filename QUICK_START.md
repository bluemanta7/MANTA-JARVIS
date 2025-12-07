# MANTA-JARVIS Quick Start Guide

## 🚀 Getting Started

### Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run the server
python calendar_server.py

# Open in browser
http://localhost:5000
# Or just open index.html directly (frontend)
```

## 👤 Authentication

1. **Create Account**: Enter username and password (local storage)
2. **Login**: Same credentials
3. **Calendar Link Appears**: Automatically in sidebar after login

## 🎙️ Voice Commands

### Calendar Events

```
"Create event workout Wednesday at 6am"
"Schedule meeting tomorrow at 2pm"
"Add reminder dentist appointment next Friday"
```

### Deletions & Edits

```
"Delete event"
"Edit event"
```

### Information Queries

```
"What is quantum computing?" → Wikipedia search
"Tell me about the trolley problem" → Philosophy
"Poem" → I'll compose one
```

### Greetings

```
"Hello"       → "👋 Hello! I'm Jarvis..."
"Hi"          → Natural conversation
"How are you?" → Friendly response
```

## 📅 Google Calendar Integration

### Local Testing

1. Create events in MANTA-JARVIS
2. Copy calendar link from sidebar
3. Add to Google Calendar → "Other calendars" → "From URL"
4. ⚠️ **Won't work with localhost** - Google can't access local URLs

### Deployed (Public)

1. Deploy to Render.com (see `RENDER_DEPLOYMENT.md`)
2. Update calendar link in sidebar (automatic with deployed frontend)
3. Copy public HTTPS URL
4. Add to Google Calendar
5. ✅ Events sync automatically!

## 📋 File Structure

```
MANTA-JARVIS/
├── calendar_server.py      # Main Flask backend (consolidated)
├── app.js                   # Frontend logic & voice recognition
├── index.html               # Main UI
├── style.css                # Underwater theme styling
├── calendar.css             # Calendar-specific styles
├── voiceConfig.js           # Speech recognition config
├── calendar.js              # Calendar rendering
├── requirements.txt         # Python dependencies
├── calendar_data/           # User events (created on first sync)
├── RENDER_DEPLOYMENT.md     # Deploy to production
└── NLP_GUIDE.md            # Natural language processing tips
```

## 🔧 Troubleshooting

### "Events aren't showing in Google Calendar"

**Checklist**:
- [ ] Backend is running (`/health` endpoint returns 200)
- [ ] Events were created in MANTA-JARVIS
- [ ] Calendar link is public HTTPS URL (not localhost)
- [ ] Added URL to "From URL" field in Google Calendar
- [ ] Waited a few seconds for sync

### "Backend not responding"

```bash
# Check if Python is installed
python --version

# Install dependencies if missing
pip install Flask Flask-CORS

# Run server explicitly
python calendar_server.py
```

### "Port 5000 already in use"

```bash
# Windows PowerShell
Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process -Force

# macOS/Linux
lsof -ti:5000 | xargs kill -9
```

### "Events sync failed" (console warning)

**This is OK!** Frontend works entirely locally. Backend sync is optional - enables Google Calendar integration.

## 🎨 Customizing Greetings

Edit `app.js` in the `handleInput()` function:

```javascript
const greetingPatterns = [
  { pattern: /^(hello|hi|hey)[\s!.]*$/i, response: "Your custom response here" },
  // Add more patterns...
];
```

## 🔑 Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/sync` | Save events to backend |
| GET | `/calendar/<token>.ics` | Get calendar feed (iCalendar format) |
| GET | `/health` | Server status check |
| GET | `/` | Server homepage & info |

## 🌊 Theme Colors

```css
#00bcd4 - Cyan (primary buttons, highlights)
#00ffff - Bright cyan (text, borders, glow)
#0a1929 - Deep ocean (background)
#1a5f7a - Ocean blue (cards, sidebars)
#7dd3fc - Light sky blue (secondary text)
```

## 📦 Dependencies

```
Flask==3.0.0              # Web framework
Flask-CORS==4.0.0         # Cross-origin requests
gunicorn==21.2.0          # Production server
Werkzeug==3.0.1           # WSGI utilities
```

## 🚢 Deployment

### Render.com (Recommended)

1. Push to GitHub
2. Connect repository in Render
3. Set start command: `gunicorn calendar_server:app`
4. Deploy!

[Full instructions](./RENDER_DEPLOYMENT.md)

### Other Platforms

- **Heroku**: Use `Procfile: web: gunicorn calendar_server:app`
- **AWS**: Deploy to Lambda or EC2
- **DigitalOcean**: Run on a droplet

## 🐛 Debug Mode

Enable detailed logging:

```bash
# Unix/Mac
export DEBUG=True
python calendar_server.py

# Windows PowerShell
$env:DEBUG="True"
python calendar_server.py
```

## 📝 Example Event Data

Events stored as JSON:

```json
{
  "username_b64": "dXNlcm5hbWU=",
  "events": [
    {
      "id": "1702000000000",
      "summary": "Morning Workout",
      "start": "2025-12-10T06:00:00.000Z",
      "end": "2025-12-10T07:00:00.000Z",
      "description": "",
      "location": "",
      "created": "2025-12-10T05:30:00.000Z"
    }
  ],
  "last_updated": "2025-12-10T05:30:15.000Z"
}
```

## 💡 Pro Tips

1. **Use exact times**: "at 6am" is better than "around 6"
2. **Full dates work**: "December 15" or "12/15" (defaults to next occurrence)
3. **Copy link after login**: Calendar link only appears after authentication
4. **Multi-calendar**: Each username gets a unique calendar feed
5. **Auto-refresh**: Google Calendar checks feed every 24 hours (or manually refresh)

## 🔄 Event Sync Flow

```
User creates event in MANTA-JARVIS
         ↓
App.js saves to local storage
         ↓
Async fetch POST to /api/sync
         ↓
calendar_server.py saves to JSON file
         ↓
Google Calendar requests /calendar/<token>.ics
         ↓
Server generates iCalendar from JSON
         ↓
Google Calendar displays events
```

## 📞 Need Help?

- **Server not starting**: Check Python version (3.6+)
- **Events not syncing**: Check console (F12) for errors
- **Frontend not loading**: Clear browser cache (Ctrl+Shift+Del)
- **Port issues**: Try `PORT=5001 python calendar_server.py`

## 🔐 Security Notes

- ⚠️ Passwords stored as base64 (NOT SECURE) - for demo only
- 🔒 For production, use hashed passwords & HTTPS
- 🗝️ Use environment variables for sensitive data
- 📊 Monitor Render logs for suspicious activity

## 🚀 Next Steps

1. **Deploy**: Follow `RENDER_DEPLOYMENT.md`
2. **Enhance**: Check `NLP_GUIDE.md` for better parsing
3. **Customize**: Edit colors, greetings, help text
4. **Monitor**: Keep an eye on server logs

---

**Version**: 2.0 (Unified Backend)  
**Last Updated**: December 2025
