# MANTA-JARVIS Setup Instructions

## 🚀 Quick Start

### 1. Install Python Dependencies

```bash
pip install flask flask-cors
```

### 2. Start the Calendar Server

```bash
python calendar_server.py
```

You should see:
```
🗓️  MANTA-JARVIS Calendar Server
Server starting on http://localhost:5000
```

### 3. Open the Web App

Simply open `index.html` in your browser (Chrome, Edge, or Firefox recommended).

---

## ✨ New Features

### 1. Voice Commands for Edit/Delete

**Delete an event:**
```
"delete event"
```
The bot will list all your events and ask you to choose which one.

**Edit an event:**
```
"edit event"
```
The bot will list all your events and ask you to choose which one.

### 2. Advanced Date Parsing

Now supports:
- **Days of the week:** "Wednesday", "Friday", "Monday"
- **Specific dates:** "the 12th", "15th", "the 20th"
- **Relative dates:** "tomorrow", "today", "next week"

**Examples:**
```
"create event workout Wednesday at 6am"
"schedule meeting on the 15th at 2pm"
"add appointment dentist Friday at 10am"
"create event birthday party the 20th"
```

### 3. Google Calendar Integration

The calendar feed link now **actually works**!

**How to add to Google Calendar:**

1. Create events in MANTA-JARVIS
2. Click the 📅 calendar icon to open the calendar sidebar
3. Click "Copy" next to your calendar feed link
4. Open Google Calendar (calendar.google.com)
5. Click the "+" next to "Other calendars" (left sidebar)
6. Select "From URL"
7. Paste your calendar link
8. Click "Add calendar"

Your events will now appear in Google Calendar! ✅

---

## 🧪 Testing the Date Parser

Try these commands:

```
✅ "create event workout Wednesday at 6am"
   → Creates event for next Wednesday at 6am

✅ "schedule meeting team sync the 15th at 10am"
   → Creates event for the 15th of this month at 10am

✅ "add event birthday party Friday"
   → Creates event for next Friday at 10am (default time)

✅ "create appointment dentist tomorrow at 2:30pm"
   → Creates event for tomorrow at 2:30pm

✅ "make event lunch meeting today at 1pm"
   → Creates event for today at 1pm
```

---

## 📁 File Structure

```
MANTA-JARVIS/
├── index.html              # Main web page
├── style.css               # Main styles
├── calendar.css            # Calendar-specific styles
├── app.js                  # Main application logic
├── calendar.js             # Calendar management
├── voiceConfig.js          # Voice settings
├── calendar_server.py      # Backend server for calendar feeds
└── calendar_data/          # (Auto-created) Stores user events
```

---

## 🐛 Troubleshooting

### Events not showing in Google Calendar?

1. Make sure `calendar_server.py` is running
2. Check the browser console (F12) for sync errors
3. The calendar link should start with `http://localhost:5000/calendar/...`
4. Google Calendar may take a few minutes to refresh

### Date parsing not working?

Open the browser console (F12) and look for:
```
✅ Event parsed: {summary: "...", start: "...", end: "..."}
```

This shows exactly how the bot interpreted your command.

### Voice recognition not working?

- Make sure you're using Chrome, Edge, or Safari
- Allow microphone permissions when prompted
- Firefox has limited speech recognition support

---

## 🎯 Next Steps

1. **Start the server:** `python calendar_server.py`
2. **Open index.html** in your browser
3. **Create an account**
4. **Try creating events** with voice or text
5. **Copy your calendar link** and add to Google Calendar

Enjoy your AI calendar assistant! 🤖📅