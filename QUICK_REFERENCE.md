# 🎯 MANTA-JARVIS Quick Reference

## 🚀 Deploy in 5 Minutes

```bash
# 1. Push to GitHub
git init && git add . && git commit -m "Deploy MANTA-JARVIS"
git remote add origin https://github.com/YOUR_USERNAME/manta-jarvis.git
git push -u origin main

# 2. Go to render.com → New Web Service → Select GitHub repo
# 3. Deploy (automatic!)
# 4. Get URL: https://manta-jarvis-xxxxx.onrender.com
# 5. Update app.js with public URL
# 6. Add to Google Calendar (Other calendars → From URL)
```

---

## 🎤 Voice Commands

```
"Create event workout tomorrow at 6am"
"Schedule a meeting with the team Friday at 3pm"
"Book a dentist appointment next week"
"Add team sync Tuesday morning"
"Set up a call at 2:30pm"
```

---

## 📱 Usage Flow

1. **Create Account**
   - Enter username + password
   - Click "Create Account"

2. **Create Event**
   - Speak or type command
   - App parses and creates event
   - Appears in calendar

3. **Get Calendar Link**
   - Click 📅 calendar button
   - View your events
   - Click "Copy" to get link

4. **Add to Google Calendar**
   - Google Calendar → Other calendars → From URL
   - Paste your link
   - ✅ Done! Auto-syncs every few hours

---

## 🔧 Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/` | Info page |
| GET | `/health` | Server status |
| POST | `/api/sync` | Save events |
| GET | `/calendar/<user>.ics` | Calendar feed |

---

## 📂 File Reference

| File | Purpose |
|------|---------|
| `serve_ics.py` | Backend server |
| `app.js` | Main app logic |
| `calendar.js` | Calendar module |
| `index.html` | UI |
| `requirements.txt` | Dependencies |
| `render.yaml` | Deployment config |

---

## 🐛 Common Issues

**Google Calendar won't show events?**
- Use public Render URL, not localhost
- Wait 5-10 minutes for Google to refresh
- Verify calendar link works in browser

**Port already in use?**
```bash
lsof -i :5000
kill -9 <PID>
```

**Deploy fails?**
- Check Render logs
- Verify requirements.txt is complete
- Ensure serve_ics.py has no syntax errors

---

## 📚 Documentation

- `DEPLOYMENT_GUIDE.md` → Full deployment walkthrough
- `NLP_GUIDE.md` → Improve voice command parsing
- `README_ENHANCED.md` → Feature overview

---

## 💾 Data Backup

Your calendar data is stored in:
```
data/users/<username_base64>.json
```

Back it up before re-deploying:
```bash
cp -r data/users ~/Desktop/calendar-backup
```

---

## 🌐 Public URL Format

Once deployed:
```
https://manta-jarvis-xxxxx.onrender.com/calendar/USERNAME_BASE64.ics
```

Example:
```
https://manta-jarvis-abc123.onrender.com/calendar/am9obl9kb2U=.ics
```

Username "john_doe" encoded as "am9obl9kb2U=" (base64)

---

## ⚙️ Environment Variables

```bash
PORT=5000           # Server port
DEBUG=false         # Debug mode (false in production)
DATA_DIR=./data/users  # Storage location
```

---

## 📞 Support

**Something broken?**
1. Check browser console (F12)
2. Check server logs (Render dashboard)
3. Verify calendar link in browser
4. Restart server: `python serve_ics.py`

**Deploy issue?**
1. Check Render logs
2. Verify GitHub repo is connected
3. Re-deploy from Render dashboard

---

## 🎓 Learning Highlights

✅ Full-stack app (frontend + backend)  
✅ REST API design  
✅ Calendar feed format (iCalendar/ICS)  
✅ Voice recognition (Web Speech API)  
✅ Cloud deployment (Render.com)  
✅ Event-driven architecture  
✅ Multi-user system  
✅ Data persistence (JSON)  

---

**Ready to deploy? Start with DEPLOYMENT_GUIDE.md! 🚀**
