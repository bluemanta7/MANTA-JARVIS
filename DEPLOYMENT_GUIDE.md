# 🚀 MANTA-JARVIS Deployment Guide

## Quick Start: Deploy to Render.com (FREE)

### Step 1: Prepare GitHub Repository
```bash
git init
git add .
git commit -m "Initial commit: MANTA-JARVIS calendar server"
git remote add origin https://github.com/YOUR_USERNAME/manta-jarvis-calendar.git
git push -u origin main
```

### Step 2: Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. Authorize access to your repository

### Step 3: Deploy via Render Dashboard
1. Click **New +** → **Web Service**
2. Connect your GitHub repo `manta-jarvis-calendar`
3. Fill in deployment settings:
   - **Name**: `manta-jarvis-calendar`
   - **Region**: `Oregon` (closest to you)
   - **Runtime**: `Python 3.11`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python serve_ics.py`
   - **Plan**: `Free`

4. Click **Create Web Service**
5. Wait for deployment (2-3 minutes)
6. You'll get a URL like: `https://manta-jarvis-xxxxx.onrender.com`

### Step 4: Update Frontend
In `app.js`, find the calendar link generation and update:

```javascript
// Change this:
const calendarUrl = `http://localhost:5000/calendar/${btoa(username)}.ics`;

// To this:
const calendarUrl = `https://manta-jarvis-xxxxx.onrender.com/calendar/${btoa(username)}.ics`;
```

### Step 5: Use in Google Calendar
1. Create events in MANTA-JARVIS
2. Click 📅 calendar button
3. Copy your calendar link
4. Open [Google Calendar](https://calendar.google.com)
5. Left sidebar → **Other calendars** → **+** → **From URL**
6. Paste your link
7. Click **Add calendar**
8. ✅ Your events will appear!

---

## Deployment Architecture

### How It Works
```
MANTA-JARVIS (Frontend)
        ↓
    index.html
        ↓
   app.js (Voice, Chat, Calendar UI)
        ↓
   POST /api/sync → serve_ics.py (Backend)
        ↓
   data/users/*.json (Storage)
        ↓
   GET /calendar/<username>.ics
        ↓
   Google Calendar (Subscription)
```

### Key Features
✅ Per-user calendar feeds  
✅ Automatic event sync  
✅ HTTPS support for Google Calendar  
✅ No database needed (JSON file storage)  
✅ Free hosting on Render  

---

## File Structure

```
manta-jarvis-calendar/
├── serve_ics.py           # Backend Flask server
├── requirements.txt       # Python dependencies
├── render.yaml            # Render deployment config
├── index.html            # Frontend
├── app.js                # Main app logic
├── calendar.js           # Calendar module
├── style.css             # Styling
├── calendar.css          # Calendar styling
└── data/
    └── users/            # User calendar files (auto-created)
        ├── dXNlcm5hbWU=.json
        └── ...
```

---

## Troubleshooting

### ❌ Google Calendar shows "Cannot access calendar"
**Problem**: The .ics link is unreachable  
**Solution**: 
- Verify the Render domain is correct
- Check that serve_ics.py is running
- Try accessing the link in a browser first

### ❌ Events don't appear in Google Calendar
**Problem**: Feed exists but events aren't showing  
**Solution**:
- Wait 5-10 minutes (Google caches feeds)
- Manually refresh: Right-click calendar → "Refresh"
- Check that events were created in MANTA-JARVIS
- Verify the .ics file has correct format (open in browser)

### ❌ "Build failed" on Render
**Problem**: Deployment error  
**Solution**:
- Check that `requirements.txt` has all dependencies
- Verify `serve_ics.py` has no syntax errors
- Check Render logs for specific error message

### ❌ "Address already in use" error
**Problem**: Port 5000 is in use locally  
**Solution**:
```bash
# Find process using port 5000
lsof -i :5000

# Kill it
kill -9 <PID>

# Or use different port
python serve_ics.py --port 5001
```

---

## Advanced: Custom Domain

To use your own domain instead of `*.onrender.com`:

1. In Render dashboard → Settings
2. Add custom domain
3. Update DNS records (Render will show instructions)
4. Update frontend calendar link

---

## Environment Variables

- `PORT`: Server port (default: 5000)
- `DEBUG`: Debug mode (true/false, default: true)
- `DATA_DIR`: Location of user data (default: ./data/users/)

---

## Monitoring

### Check Server Status
```bash
curl https://manta-jarvis-xxxxx.onrender.com/health
```

Response:
```json
{
  "status": "ok",
  "server": "MANTA-JARVIS Calendar Server",
  "users": 5,
  "data_dir": "/path/to/data/users"
}
```

### View Logs
In Render dashboard → Logs, you'll see:
```
✅ Synced 3 events for user: john_doe
📅 Serving calendar for john_doe with 3 events
```

---

## Cost Analysis

| Service | Cost | Notes |
|---------|------|-------|
| Render (Web) | FREE | 0.5 CPU, 512 MB RAM |
| Domain | $12/yr | Optional |
| Google Calendar | FREE | Unlimited subscriptions |
| **Total** | **FREE** | Everything works without paying! |

---

## Next Steps

1. ✅ Deploy to Render
2. ✅ Add to Google Calendar
3. 🎉 Share your calendar link with friends
4. 💬 Create events via voice commands
5. 🔄 Sync automatically every few hours

Happy calendaring! 🗓️✨
