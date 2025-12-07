MANTA-JARVIS 🚀
Your AI-powered voice and text assistant with live calendar sync

🎯 Purpose
MANTA‑JARVIS is designed to be a personal assistant that understands natural language, manages your schedule, and syncs seamlessly with external calendars. The key achievement is that every user gets their own live calendar feed link which can be added to Google Calendar (or any calendar app that supports .ics feeds). Once subscribed, events created or edited in MANTA‑JARVIS automatically appear in your external calendar.

✅ Core Features
🧠 Natural Language Event Creation
Parse flexible commands like:

“create event workout Wednesday at 6am”

“schedule meeting the 12th at 2pm”

“add dentist appointment tomorrow at 10am”

Supports days of week, specific dates, and relative dates (“today”, “tomorrow”).

✏️ Conversational Editing & Deletion
Edit or delete events by typing:

“edit event” → choose from numbered list → rename

“delete event” → choose from numbered list → remove

📅 Google Calendar Integration
Each user account has a unique .ics feed:

Code
http://localhost:5000/calendar/<username>.ics
Add this feed to Google Calendar (Other calendars → From URL)

Google Calendar fetches updates automatically (refresh interval every few hours).

Result: Your MANTA‑JARVIS events appear in Google Calendar without manual export/import.

🎤 Voice Commands
Create, edit, delete, and cancel events using speech recognition.

Flexible phrasing supported (e.g., “schedule a workout Wednesday morning”).

🔄 Sync & Storage
Events stored per user in data/users/<username>.json.

Backend (serve_ics.py) converts JSON → .ics format on demand.

Frontend and backend stay in sync automatically.

🚀 Setup Instructions
Install dependencies

bash
pip install flask flask-cors
Run the calendar server

bash
python serve_ics.py
Server starts at http://localhost:5000

Open the web app

Launch index.html in your browser

Create an account and login

Start creating events

Connect to Google Calendar

Copy your feed link from the calendar sidebar

In Google Calendar → Other calendars → From URL → paste link

Your events will sync automatically

📁 File Structure
Code
MANTA-JARVIS/
├── index.html              # Main web page
├── style.css               # Styles
├── calendar.css            # Calendar styles
├── app.js                  # Main application logic
├── calendar.js             # Calendar management
├── voiceConfig.js          # Voice settings
├── serve_ics.py            # Backend calendar server
├── data/users/             # Per-user event JSON storage
└── README.md               # Documentation
🧪 Testing
Date parsing: Try “create event test Friday at 3pm” → should parse correctly.

Edit/delete: Type “edit event” or “delete event” → choose from numbered list.

Google Calendar sync: Add feed URL to Google Calendar → wait 2–5 minutes → events appear.

🔮 Roadmap
[ ] Recurring events (weekly, monthly)

[ ] Event reminders/notifications

[ ] Categories & color coding

[ ] Multiple calendar support

[ ] Mobile app version

🧠 Key Achievement
MANTA‑JARVIS isn’t just a local calendar — it’s a live calendar feed system. Each user account generates a unique .ics link that can be subscribed to in Google Calendar. This makes it behave like a college or corporate calendar feed: once subscribed, your external calendar stays in sync with whatever you do inside MANTA‑JARVIS.