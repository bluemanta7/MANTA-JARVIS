# 🧪 TESTING GUIDE - Per-User Calendar Feeds

## Test 1: Local Backend (Python)

### Setup
```bash
cd c:\Users\wyang5\OneDrive\ -\ Babson\ College\Desktop\Ai\MANTA-JARVIS
python app.py
```

Output should show:
```
 * Running on http://127.0.0.1:5000
```

### Test Step 1: Health Check
```bash
# In browser or curl
http://localhost:5000/healthz

Expected: "OK" ✅
```

### Test Step 2: Default Calendar Feed
```bash
# In browser
http://localhost:5000/calendar.ics

Expected: iCalendar format with sample events ✅
```

### Test Step 3: Open Frontend
```bash
# Double-click index.html to open from file://
# OR
http://localhost:5000  # if serving from there
```

### Test Step 4: Create Account
```
Username: testuser
Password: test123
Click: Create Account
```

Expected:
- Auth section disappears
- User info shows "👤 testuser"
- Calendar link appears in sidebar

### Test Step 5: Check Calendar Link
```
Look at sidebar → Calendar link shows:
http://localhost:5000/calendar/dGVzdHVzZXI=.ics

(dGVzdHVzZXI= is base64 of "testuser")
```

**Verify:**
```bash
# In browser
echo dGVzdHVzZXI= | base64 -d
# Output: testuser ✅
```

### Test Step 6: Visit Empty Calendar Feed
```bash
# In browser
http://localhost:5000/calendar/dGVzdHVzZXI=.ics

Expected: Empty iCalendar (no events yet)
```

### Test Step 7: Create an Event
```
In chat or voice:
"Create event meeting tomorrow at 2pm"
```

Expected:
- Event appears in calendar sidebar
- Console shows "✅ Events synced to calendar server"
- File created: user_events/dGVzdHVzZXI=.json

### Test Step 8: Check Event Storage
```bash
# Open file: user_events/dGVzdHVzZXI=.json
# Should contain:
{
  "username_b64": "dGVzdHVzZXI=",
  "events": [
    {
      "summary": "meeting",
      "start": "2025-12-11T14:00:00.000Z",
      "end": "2025-12-11T15:00:00.000Z",
      ...
    }
  ]
}
```

✅ File exists with event data

### Test Step 9: Visit Calendar Feed Again
```bash
# In browser
http://localhost:5000/calendar/dGVzdHVzZXI=.ics

Expected: iCalendar format with "meeting" event ✅
```

Content should look like:
```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//MANTA JARVIS//Calendar Feed//EN
...
BEGIN:VEVENT
SUMMARY:meeting
DTSTART:20251211T140000Z
DTEND:20251211T150000Z
...
END:VEVENT
END:VCALENDAR
```

### Test Step 10: Add to Google Calendar (Optional)
```
1. Open Google Calendar
2. Other calendars → Add calendar → From URL
3. Paste: http://localhost:5000/calendar/dGVzdHVzZXI=.ics
4. Click: Add calendar

Expected: "meeting" event appears in Google Calendar ✅
```

---

## Test 2: Production Backend (Render)

### Prerequisites
```bash
# Make sure app.py is on GitHub
git add app.py
git commit -m "Add per-user calendar endpoints"
git push origin main

# Wait for Render to auto-deploy (2-3 min)
# Check: https://manta-jarvis.onrender.com/healthz
```

### Test Step 1: Health Check
```bash
# In browser
https://manta-jarvis.onrender.com/healthz

Expected: "OK" ✅
```

### Test Step 2: Open Frontend from Desktop
```bash
# Double-click index.html
# It should open with file:// protocol
```

Browser shows:
```
file:///C:/Users/wyang5/OneDrive%20-%20Babson%20College/Desktop/Ai/MANTA-JARVIS/index.html
```

### Test Step 3: Open Browser Console
```bash
# F12 → Console
# Should see no errors
```

### Test Step 4: Create Account
```
Username: produser
Password: prod123
Click: Create Account
```

### Test Step 5: Check Calendar Link
```
Look at sidebar → Calendar link shows:
https://manta-jarvis.onrender.com/calendar/cHJvZHVzZXI=.ics

(NOT localhost!) ✅
```

**Verify it's base64:**
```bash
echo cHJvZHVzZXI= | base64 -d
# Output: produser ✅
```

### Test Step 6: Create Event
```
"Create event presentation Thursday at 10am"
```

Expected:
- Event in sidebar
- Console: "✅ Events synced to calendar server"
- File created on Render server

### Test Step 7: Visit Calendar Feed
```bash
# In browser
https://manta-jarvis.onrender.com/calendar/cHJvZHVzZXI=.ics

Expected: iCalendar with "presentation" event ✅
```

### Test Step 8: Add to Google Calendar
```
1. Copy link from sidebar
2. Google Calendar → Add calendar → From URL
3. Paste: https://manta-jarvis.onrender.com/calendar/cHJvZHVzZXI=.ics
4. Click: Add calendar

Expected: "presentation" event appears ✅
```

### Test Step 9: Create Another Event
```
"Add event standup tomorrow at 9am"
```

Wait a few seconds, then check Google Calendar.

Expected: Both events visible ("presentation" + "standup") ✅

---

## Test 3: Browser Console Debugging

### Open Console (F12)

```javascript
// Test 1: Check RENDER_BASE_URL is defined
console.log(RENDER_BASE_URL)
// Output: "https://manta-jarvis.onrender.com"

// Test 2: Check getServerBaseURL() function
await getServerBaseURL()
// Output when file://: "https://manta-jarvis.onrender.com"
// Output when localhost: "http://localhost:5000"

// Test 3: Check current user
console.log(currentUser)
// Output: "produser" (if logged in)

// Test 4: Check events in storage
localStorage.getItem('user:produser')
// Output: JSON string with user data
```

---

## Test 4: API Endpoints

### Test /api/sync (POST)

```bash
curl -X POST http://localhost:5000/api/sync \
  -H "Content-Type: application/json" \
  -d '{
    "username_b64": "am9obg==",
    "events": [
      {
        "summary": "Test Event",
        "start": "2025-12-10T14:00:00.000Z",
        "end": "2025-12-10T15:00:00.000Z"
      }
    ]
  }'

Expected response:
{
  "status": "success",
  "message": "Saved 1 events"
}
```

### Test /calendar/<token>.ics (GET)

```bash
# Verify file was created
ls user_events/am9obg==.json

# Fetch calendar
curl http://localhost:5000/calendar/am9obg==.ics

Expected: iCalendar format with "Test Event"
```

---

## Test 5: File Storage Verification

### Local Storage
```bash
# Navigate to project folder
cd user_events

# List files
dir  # Windows
# OR
ls   # Unix

Expected files:
- dGVzdHVzZXI=.json (testuser)
- cHJvZHVzZXI=.json (produser)
- am9obg==.json (john)
```

### Inspect a File
```bash
# Windows
type user_events\dGVzdHVzZXI=.json

# Unix
cat user_events/dGVzdHVzZXI=.json

Expected:
{
  "username_b64": "dGVzdHVzZXI=",
  "events": [
    { event data... }
  ]
}
```

---

## Troubleshooting

### Issue: Calendar link shows localhost
**When:** Opening index.html from file://  
**Cause:** getServerBaseURL() not returning Render domain  
**Check:** 
```javascript
console.log(window.location.protocol)  // Should be "file:"
await getServerBaseURL()  // Should return Render domain
```

### Issue: POST /api/sync fails
**When:** Creating event  
**Check:**
1. Is backend running?
2. Is Render deployed?
3. Check Network tab (F12) for response
4. Check backend logs for errors

### Issue: Calendar feed is empty
**When:** Visit /calendar/{token}.ics  
**Check:**
1. Did events sync? (Check console)
2. Does user_events/{token}.json exist?
3. Does JSON have events array?

### Issue: Google Calendar can't access feed
**When:** Adding calendar URL to Google Calendar  
**Reason:** Must use HTTPS, must be public URL (not localhost)  
**Solution:**
- Deploy to Render first
- Use https://manta-jarvis.onrender.com/calendar/{token}.ics
- NOT http://localhost:5000/...

---

## Verification Checklist

- [ ] Local backend starts without errors
- [ ] /healthz returns "OK"
- [ ] /calendar.ics returns sample events
- [ ] index.html opens from file://
- [ ] Calendar link shows Render domain
- [ ] Events sync successfully
- [ ] Event storage JSON created
- [ ] /calendar/{token}.ics returns user's events
- [ ] Google Calendar can subscribe to feed
- [ ] Events appear in Google Calendar
- [ ] New events sync to Google Calendar
- [ ] Multiple users work independently
- [ ] Render deployment works

---

## Expected Results

### After Creating Account
```
✅ Auth section hides
✅ User display shows "👤 username"
✅ Calendar link appears in sidebar
✅ Link format: https://manta-jarvis.onrender.com/calendar/{token}.ics
```

### After Creating Event
```
✅ Event appears in calendar
✅ Console: "✅ Events synced to calendar server"
✅ File created: user_events/{token}.json
✅ File contains event data
```

### After Visiting Calendar Link
```
✅ Returns iCalendar format
✅ Contains all user's events
✅ Content-Type: text/calendar
✅ Valid RFC 5545 format
```

### After Adding to Google Calendar
```
✅ Google Calendar accepts feed
✅ Events appear in calendar
✅ New events sync automatically
✅ Multiple users don't see each other's events
```

---

## Success Criteria

All of these should be ✅:

1. ✅ Backend has /api/sync endpoint
2. ✅ Backend has /calendar/<token>.ics endpoint
3. ✅ Frontend builds Render domain URL for file://
4. ✅ Events sync from frontend to backend
5. ✅ Events stored in JSON per user
6. ✅ Calendar feed returns iCalendar format
7. ✅ Google Calendar can subscribe
8. ✅ Events visible in Google Calendar
9. ✅ Works locally and on Render
10. ✅ Multiple users work independently

**If all ✅, implementation is complete!** 🎉

