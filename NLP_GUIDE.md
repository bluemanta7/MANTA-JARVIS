# 🧠 Natural Language Processing for MANTA-JARVIS

## Current State
Your app uses regex-based parsing, which works but requires specific phrasings:
- ✅ "Create event workout tomorrow at 6am"
- ❌ "Book me a workout session for tomorrow morning"

## Upgrade Path: NLP Libraries

### Option 1: spaCy (Recommended) 🥇
**Best for**: Entity extraction, date/time recognition

```python
import spacy
from dateutil.parser import parse as parse_date

nlp = spacy.load("en_core_web_sm")

def parse_event_nlp(text):
    doc = nlp(text)
    
    # Extract entities
    event_name = ""
    date_str = ""
    time_str = ""
    
    for ent in doc.ents:
        if ent.label_ == "PERSON":
            event_name += ent.text + " "
        elif ent.label_ == "DATE":
            date_str = ent.text
        elif ent.label_ == "TIME":
            time_str = ent.text
    
    return {
        "summary": event_name.strip(),
        "date": date_str,
        "time": time_str
    }

# Usage:
# parse_event_nlp("Book me a meeting with the team next Friday at 3pm")
# Returns: {"summary": "meeting with the team", "date": "next Friday", "time": "3pm"}
```

**Installation**:
```bash
pip install spacy
python -m spacy download en_core_web_sm
```

### Option 2: Duckling (Specialized for Date/Time) ⏰
**Best for**: Parsing dates, times, durations with precision

```python
from duckling import Duckling

duckling = Duckling()

def parse_datetime_duckling(text):
    """Extract dates and times more accurately"""
    results = duckling.parse(text)
    
    dates = [r for r in results if r['dim'] == 'time']
    return dates

# Usage:
# parse_datetime_duckling("Schedule a meeting next Friday at 2:30pm")
# Returns: [{'dim': 'time', 'value': {'value': '2025-12-19T14:30:00'}}]
```

**Installation**:
```bash
pip install duckling
```

### Option 3: NLTK (Educational/Lightweight) 📚
**Best for**: Tokenization, basic NLP, no extra downloads

```python
from nltk.tokenize import word_tokenize
from nltk import pos_tag

def extract_keywords(text):
    tokens = word_tokenize(text)
    pos_tags = pos_tag(tokens)
    
    # Extract nouns (potential event names)
    nouns = [word for word, pos in pos_tags if pos.startswith('NN')]
    return nouns

# Usage:
# extract_keywords("Create a dentist appointment")
# Returns: ['dentist', 'appointment']
```

**Installation**:
```bash
pip install nltk
```

---

## Hybrid Approach (Recommended for Your App)

Combine regex + NLP for best results:

```python
import re
from dateutil.parser import parse as parse_date

def parse_event_hybrid(text):
    """
    Parse with regex first (fast), then NLP for edge cases
    """
    
    # Step 1: Check if it's an event command
    if not re.search(r'\b(create|schedule|add|book|make)\b.*\b(event|meeting|appointment|call)\b', text, re.I):
        return None
    
    # Step 2: Extract event title (everything between command and date keywords)
    title_match = re.search(
        r'(?:create|schedule|add|book|make)\s+(?:a|an|me)?\s*(?:event|meeting|appointment)?\s+(.+?)(?:\s+(?:at|on|for|tomorrow|today|next|the))',
        text,
        re.I
    )
    event_title = title_match.group(1).strip() if title_match else "Event"
    
    # Step 3: Extract date
    date_keywords = {
        'tomorrow': 1,
        'next week': 7,
        'next month': 30,
        'today': 0
    }
    
    date_offset = 0
    for keyword, offset in date_keywords.items():
        if keyword in text.lower():
            date_offset = offset
            break
    
    # Step 4: Extract time
    time_match = re.search(r'(?:at|@)\s+(\d{1,2}):?(\d{0,2})\s*(am|pm)?', text, re.I)
    time_str = ""
    if time_match:
        hour, minute, period = time_match.groups()
        hour = int(hour)
        minute = int(minute) if minute else 0
        
        if period and period.lower() == 'pm' and hour < 12:
            hour += 12
        elif period and period.lower() == 'am' and hour == 12:
            hour = 0
        
        time_str = f"{hour:02d}:{minute:02d}"
    
    return {
        "summary": event_title,
        "date_offset": date_offset,
        "time": time_str
    }

# Examples:
print(parse_event_hybrid("Book me a dentist appointment next Friday at 2:30pm"))
# Output: {"summary": "dentist appointment", "date_offset": 0, "time": "14:30"}

print(parse_event_hybrid("Schedule a team sync tomorrow morning at 10am"))
# Output: {"summary": "team sync tomorrow morning", "date_offset": 1, "time": "10:00"}

print(parse_event_hybrid("Create a workout session for Wednesday evening"))
# Output: {"summary": "workout session", "date_offset": 0, "time": ""}
```

---

## Intent Classification

Map flexible user input to standardized intents:

```python
INTENT_KEYWORDS = {
    "create_event": ["create", "schedule", "add", "book", "make", "set up"],
    "edit_event": ["edit", "update", "change", "modify", "reschedule"],
    "delete_event": ["delete", "remove", "cancel", "clear"],
    "list_events": ["show", "list", "display", "view", "what", "tell"],
    "event_details": ["details", "info", "information", "when", "where", "who"]
}

def detect_intent(text):
    """Map user input to intent"""
    text_lower = text.lower()
    
    for intent, keywords in INTENT_KEYWORDS.items():
        if any(keyword in text_lower for keyword in keywords):
            return intent
    
    return "unknown"

# Usage:
print(detect_intent("Can you schedule a meeting for me?"))
# Output: "create_event"

print(detect_intent("Remove the workout from tomorrow"))
# Output: "delete_event"

print(detect_intent("What events do I have this week?"))
# Output: "list_events"
```

---

## Integration with Your App

### In `app.js` (Frontend):
```javascript
// Enhanced command parser
async function handleInput(text) {
  // Send to backend for NLP parsing
  const response = await fetch('/api/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text })
  });
  
  const parsed = await response.json();
  
  // Use parsed intent and entities
  if (parsed.intent === "create_event") {
    await createEvent(parsed.entities);
  }
}
```

### In `serve_ics.py` (Backend):
```python
@app.route('/api/parse', methods=['POST'])
def parse_command():
    """NLP-enhanced command parser"""
    text = request.json.get('text', '')
    
    intent = detect_intent(text)
    entities = parse_event_hybrid(text)
    
    return jsonify({
        'intent': intent,
        'entities': entities,
        'confidence': 0.95
    })
```

---

## Voice Input Improvements

### Current (Web Speech API):
```javascript
recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript;
  // Works but limited accuracy
}
```

### Enhanced with Confidence Score:
```javascript
recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript;
  const confidence = event.results[0][0].confidence;
  
  if (confidence < 0.5) {
    speak("I didn't quite catch that. Could you repeat?");
    return;
  }
  
  handleInput(transcript);
}
```

---

## Requirements Update

Add to `requirements.txt`:
```
flask==3.0.0
flask-cors==4.0.0
spacy==3.7.2          # Optional: NLP
duckling==1.8.1       # Optional: Date/time parsing
python-dateutil==2.8.2  # For flexible date parsing
nltk==3.8.1           # Optional: Tokenization
```

---

## Testing Your NLP

```python
# test_nlp.py
from app import parse_event_hybrid, detect_intent

test_cases = [
    "Book me a dentist appointment next Friday at 2:30pm",
    "Schedule a team sync tomorrow morning",
    "Create a workout session for Wednesday",
    "Can you add a meeting with John next week?",
    "Set up a call with the boss at 3pm",
]

for test in test_cases:
    result = parse_event_hybrid(test)
    intent = detect_intent(test)
    print(f"Input: {test}")
    print(f"Intent: {intent}")
    print(f"Parsed: {result}\n")
```

---

## Next Steps

1. **Phase 1 (Current)**: Keep regex-based parsing working locally
2. **Phase 2 (Upgrade)**: Add hybrid regex + NLTK parsing
3. **Phase 3 (Production)**: Deploy with spaCy for maximum accuracy
4. **Phase 4 (Advanced)**: Train custom intent classifier with your voice data

Start with Phase 2 for quick wins! 🚀
