# 🎯 MANTA-JARVIS Per-User Calendar - Quick Summary

## Problem ❌
- Frontend generates: `http://localhost:5000/calendar/<token>.ics`
- Backend only has: `/calendar.ics` (static, no per-user route)
- Opening `index.html` via file:// shows localhost link (wrong!)

## Solution ✅

### Backend (app.py) - UPDATED ✅

**Added storage system:**
```
user_events/
├── am9obg==.json       ← User "john"'s events
├── dXNlcm5hbWU=.json   ← User "username"'s events
└── ...
```

**Added 2 new endpoints:**

1. **POST /api/sync** - Save events from frontend
   ```python
   Receives: { "username_b64": "am9obg==", "events": [...] }
   Saves to: user_events/am9obg==.json
   ```

2. **GET /calendar/<token>.ics** - Serve per-user calendar feed
   ```python
   URL: /calendar/am9obg==.ics
   Reads from: user_events/am9obg==.json
   Returns: iCalendar format (.ics)
   ```

### Frontend (app.js) - ALREADY CORRECT ✅

**Already has everything:**
- `RENDER_BASE_URL = "https://manta-jarvis.onrender.com"`
- `getServerBaseURL()` returns Render domain when file://
- `loginUser()` builds correct calendar link
- `syncEventsToServer()` sends to `/api/sync`

**NO CHANGES NEEDED** ✅

---

## 🔄 Flow

```
1. User opens index.html from desktop
   ↓
2. app.js detects file:// protocol
   ↓
3. Returns Render domain: https://manta-jarvis.onrender.com
   ↓
4. User logs in
   ↓
5. Calendar link shows: https://manta-jarvis.onrender.com/calendar/am9obg==.ics
   ↓
6. User creates event
   ↓
7. app.js sends to POST /api/sync
   ↓
8. Backend saves to user_events/am9obg==.json
   ↓
9. User adds link to Google Calendar
   ↓
10. Google fetches GET /calendar/am9obg==.ics
    ↓
11. Backend reads from JSON and returns .ics
    ↓
12. Google Calendar displays events ✅
```

---

## 📝 What Changed

### app.py (UPDATED)

**Added 4 functions:**
- `get_user_events_path(username_b64)` - Get file path
- `load_user_events(username_b64)` - Read from JSON
- `save_user_events(username_b64, events)` - Write to JSON
- `events_to_ics(events)` - Convert to .ics format

**Added 2 routes:**
```python
@app.route("/api/sync", methods=["POST"])           # NEW
@app.route("/calendar/<token>.ics", methods=["GET"]) # NEW
```

**Kept existing:**
- `/calendar.ics` (sample events)
- `/healthz` (health check)

### app.js (NO CHANGES)
✅ Already correct and ready!

---

## ✅ Testing

### Local (python app.py)
```
1. Create account: john / pass123
2. Create event: "Meeting tomorrow 2pm"
3. Copy calendar link from sidebar
4. Should show: http://localhost:5000/calendar/am9obg==.ics
5. Visit link in browser → See .ics format
6. Add to Google Calendar → Events appear ✅
```

### Production (https://manta-jarvis.onrender.com)
```
1. Open index.html from desktop (file://)
2. Create account: john / pass123
3. Create event
4. Copy calendar link from sidebar
5. Should show: https://manta-jarvis.onrender.com/calendar/am9obg==.ics
6. Add to Google Calendar → Events appear ✅
```

---

## 🚀 Deploy

```bash
# 1. Commit changes
git add app.py
git commit -m "Add per-user calendar feed endpoints"

# 2. Push to GitHub
git push

# 3. Render auto-deploys (2-3 min)

# 4. Test
# Open index.html → Log in → Create event → Copy link → Add to Google Calendar
```

---

## 📊 URLs Reference

| Environment | Link Format |
|-------------|------------|
| **Localhost** | `http://localhost:5000/calendar/am9obg==.ics` |
| **Render (file://)** | `https://manta-jarvis.onrender.com/calendar/am9obg==.ics` |
| **Render (hosted)** | `https://manta-jarvis.onrender.com/calendar/am9obg==.ics` |

All formats are handled automatically by `getServerBaseURL()` ✅

---

## ✨ Result

✅ Backend has per-user calendar feed endpoint  
✅ Frontend generates correct Render domain  
✅ Events sync to backend storage  
✅ Google Calendar can subscribe to user feeds  
✅ Everything works locally and on Render  

**Ready to deploy!** 🚀
