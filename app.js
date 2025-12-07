// ============================================================================
// MANTA-JARVIS - Main Application Script
// ============================================================================

// ============================================================================
// State Management
// ============================================================================
let currentUser = null;
let isListening = false;
let recognition = null;

// ============================================================================
// In-Memory Storage (Fallback since window.storage may not be available)
// ============================================================================
const memoryStorage = {
  data: {},
  
  async set(key, value) {
    this.data[key] = value;
    // Try to use localStorage as backup
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('localStorage not available, using memory only');
    }
    return { key, value };
  },
  
  async get(key) {
    // Try localStorage first
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        this.data[key] = stored;
        return { value: stored };
      }
    } catch (e) {
      console.warn('localStorage not available');
    }
    
    // Fall back to memory
    if (this.data[key]) {
      return { value: this.data[key] };
    }
    return null;
  }
};

// Use memory storage if window.storage isn't available
const storage = window.storage || memoryStorage;

// ============================================================================
// Persistent Storage Functions
// ============================================================================
async function saveUserData(username, data) {
  try {
    await storage.set(`user:${username}`, JSON.stringify(data));
    console.log('User data saved:', username);
    return true;
  } catch (error) {
    console.error('Failed to save user data:', error);
    return false;
  }
}

async function loadUserData(username) {
  try {
    const result = await storage.get(`user:${username}`);
    if (result && result.value) {
      return JSON.parse(result.value);
    }
    return null;
  } catch (error) {
    console.error('Failed to load user data:', error);
    return null;
  }
}

async function saveEvent(username, event) {
  const userData = await loadUserData(username) || { events: [] };
  userData.events = userData.events || [];
  event.id = event.id || Date.now().toString();
  event.created = event.created || new Date().toISOString();
  userData.events.push(event);
  await saveUserData(username, userData);
  console.log('Event saved:', event);
  
  // Sync with backend server for calendar feed
  await syncEventsToServer(username, userData.events);
  
  if (window.CalendarManager) {
    window.CalendarManager.renderCalendar();
    window.CalendarManager.loadEvents();
  }
  return event;
}

async function updateEvent(username, eventId, updates) {
  const userData = await loadUserData(username);
  if (!userData || !userData.events) return false;
  
  const eventIndex = userData.events.findIndex(e => e.id === eventId);
  if (eventIndex === -1) return false;
  
  userData.events[eventIndex] = { ...userData.events[eventIndex], ...updates };
  await saveUserData(username, userData);
  
  // Sync with backend server
  await syncEventsToServer(username, userData.events);
  
  if (window.CalendarManager) {
    window.CalendarManager.renderCalendar();
    window.CalendarManager.loadEvents();
  }
  return true;
}

async function deleteEvent(username, eventId) {
  const userData = await loadUserData(username);
  if (!userData || !userData.events) return false;
  
  userData.events = userData.events.filter(e => e.id !== eventId);
  await saveUserData(username, userData);
  
  // Sync with backend server
  await syncEventsToServer(username, userData.events);
  
  if (window.CalendarManager) {
    window.CalendarManager.renderCalendar();
    window.CalendarManager.loadEvents();
  }
  return true;
}

async function getServerBaseURL() {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  } else {
    // Always point to your deployed backend
    return 'https://manta-jarvis.onrender.com';
  }
}


async function syncEventsToServer(username, events) {
  try {
    const username_b64 = btoa(username);
    const baseURL = await getServerBaseURL();
    const response = await fetch(`${baseURL}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username_b64: username_b64,
        events: events
      })
    });
    
    if (response.ok) {
      console.log('✅ Events synced to calendar server');
    } else {
      console.warn('⚠️ Failed to sync with calendar server (this is optional)');
    }
  } catch (error) {
    console.warn('⚠️ Calendar server not available (this is optional):', error.message);
  }
}

async function getUserEvents(username) {
  const userData = await loadUserData(username);
  return userData?.events || [];
}

// Export for use in other scripts
window.getUserEvents = getUserEvents;
window.saveEvent = saveEvent;
window.updateEvent = updateEvent;
window.deleteEvent = deleteEvent;
window.getCurrentUser = () => currentUser;

// ============================================================================
// Authentication
// ============================================================================
document.getElementById('createAccountBtn').addEventListener('click', async () => {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (!username || !password) {
    alert('Please enter both username and password');
    return;
  }

  try {
    const existing = await loadUserData(username);
    if (existing) {
      alert('Username already exists. Please login instead.');
      return;
    }

    await saveUserData(username, {
      username,
      password: btoa(password),
      created: new Date().toISOString(),
      events: []
    });

    loginUser(username);
  } catch (error) {
    alert('Failed to create account: ' + error.message);
  }
});

document.getElementById('loginBtn').addEventListener('click', async () => {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (!username || !password) {
    alert('Please enter both username and password');
    return;
  }

  try {
    const userData = await loadUserData(username);
    if (!userData || userData.password !== btoa(password)) {
      alert('Invalid username or password');
      return;
    }

    loginUser(username);
  } catch (error) {
    alert('Login failed: ' + error.message);
  }
});

function loginUser(username) {
  currentUser = username;
  
  document.getElementById('authSection').classList.add('hidden');
  document.getElementById('userInfoSection').classList.add('visible');
  document.getElementById('logoutBtn').classList.add('visible');
  
  document.getElementById('userDisplay').textContent = `👤 ${username}`;
  
  // Show calendar link section in calendar sidebar with dynamic URL
  const calendarLinkSection = document.getElementById('calendarLinkSection');
  if (calendarLinkSection) {
    calendarLinkSection.style.display = 'block';
    const username_b64 = btoa(username);
    
    // Get dynamic base URL
    getServerBaseURL().then(baseURL => {
  const calendarUrl = `${baseURL}/calendar/${username_b64}.ics`;
  document.getElementById('calendarLink').value = calendarUrl;
});

  }
  
  addMessage(`👋 Welcome, ${username}! I'm Jarvis, here to help with your calendar.`, 'ai');
  
  if (window.CalendarManager) {
    window.CalendarManager.renderCalendar();
    window.CalendarManager.loadEvents();
  }
}

document.getElementById('logoutBtn').addEventListener('click', () => {
  currentUser = null;
  document.getElementById('authSection').classList.remove('hidden');
  document.getElementById('userInfoSection').classList.remove('visible');
  document.getElementById('logoutBtn').classList.remove('visible');
  
  // Hide calendar link section
  const calendarLinkSection = document.getElementById('calendarLinkSection');
  if (calendarLinkSection) {
    calendarLinkSection.style.display = 'none';
  }
  
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  document.getElementById('chatThread').innerHTML = '';
  document.getElementById('eventList').innerHTML = '';
  addWelcomeMessage();
});

document.getElementById('copyLinkBtn').addEventListener('click', () => {
  const linkInput = document.getElementById('calendarLink');
  linkInput.select();
  document.execCommand('copy');
  addMessage('📋 Calendar link copied!', 'ai');
  speak('Calendar link copied');
});

// ============================================================================
// UI Controls
// ============================================================================
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

document.getElementById('calendarToggle').addEventListener('click', () => {
  document.getElementById('calendarSidebar').classList.toggle('open');
});

// ============================================================================
// Speech Recognition
// ============================================================================
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    isListening = true;
    document.getElementById('voiceButton').classList.add('listening');
    document.getElementById('transcript').textContent = 'Listening...';
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    document.getElementById('transcript').textContent = `You said: "${transcript}"`;
    document.getElementById('sidebar').classList.add('open');
    addMessage(transcript, 'user');
    handleInput(transcript);
  };

  recognition.onend = () => {
    isListening = false;
    document.getElementById('voiceButton').classList.remove('listening');
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    document.getElementById('transcript').textContent = 'Error: ' + event.error;
  };
}

document.getElementById('voiceButton').addEventListener('click', () => {
  if (!currentUser) {
    addMessage('Please create an account or login first!', 'ai');
    document.getElementById('sidebar').classList.add('open');
    return;
  }

  if (recognition) {
    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  }
});

// ============================================================================
// Chat Functions
// ============================================================================
document.getElementById('sendBtn').addEventListener('click', sendMessage);
document.getElementById('userInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
  const input = document.getElementById('userInput');
  const message = input.value.trim();
  
  if (!message) return;
  
  if (!currentUser) {
    addMessage('Please create an account or login first!', 'ai');
    return;
  }

  addMessage(message, 'user');
  input.value = '';
  handleInput(message);
}

function addMessage(text, sender) {
  const chatThread = document.getElementById('chatThread');
  const message = document.createElement('div');
  message.className = `message ${sender}`;
  message.innerHTML = text;
  chatThread.appendChild(message);
  chatThread.scrollTop = chatThread.scrollHeight;
}

function addWelcomeMessage() {
  const welcomeMsg = `<strong>👋 Welcome to MANTA-JARVIS!</strong><br><br>
    Create an account to start managing your calendar with AI assistance!`;
  addMessage(welcomeMsg, 'ai welcome');
}

function speak(text) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    speechSynthesis.speak(utterance);
  }
}

// ============================================================================
// ADVANCED Date Parsing - Handles days of week, dates, etc.
// ============================================================================
function parseDate(text) {
  const lower = text.toLowerCase();
  const now = new Date();
  
  // Check for "tomorrow"
  if (/\btomorrow\b/i.test(text)) {
    const date = new Date(now);
    date.setDate(date.getDate() + 1);
    return date;
  }
  
  // Check for "today"
  if (/\btoday\b/i.test(text)) {
    return new Date(now);
  }
  
  // Check for days of the week
  const daysOfWeek = {
    'sunday': 0, 'sun': 0,
    'monday': 1, 'mon': 1,
    'tuesday': 2, 'tue': 2, 'tues': 2,
    'wednesday': 3, 'wed': 3,
    'thursday': 4, 'thu': 4, 'thur': 4, 'thurs': 4,
    'friday': 5, 'fri': 5,
    'saturday': 6, 'sat': 6
  };
  
  for (const [day, dayNum] of Object.entries(daysOfWeek)) {
    if (lower.includes(day)) {
      const targetDate = new Date(now);
      const currentDay = targetDate.getDay();
      let daysToAdd = dayNum - currentDay;
      
      // If the day has passed this week, schedule for next week
      if (daysToAdd <= 0) {
        daysToAdd += 7;
      }
      
      targetDate.setDate(targetDate.getDate() + daysToAdd);
      return targetDate;
    }
  }
  
  // Check for specific date like "the 12th", "the 15th", "12th", "15th"
  const dateMatch = text.match(/\b(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/i);
  if (dateMatch) {
    const day = parseInt(dateMatch[1]);
    if (day >= 1 && day <= 31) {
      const targetDate = new Date(now);
      targetDate.setDate(day);
      
      // If the date has passed this month, schedule for next month
      if (targetDate < now) {
        targetDate.setMonth(targetDate.getMonth() + 1);
      }
      
      return targetDate;
    }
  }
  
  // Check for "next week", "next month"
  if (lower.includes('next week')) {
    const date = new Date(now);
    date.setDate(date.getDate() + 7);
    return date;
  }
  
  if (lower.includes('next month')) {
    const date = new Date(now);
    date.setMonth(date.getMonth() + 1);
    return date;
  }
  
  // Default to today + 1 hour
  return null;
}

function parseTime(text) {
  // Parse time like "at 3pm", "at 15:00", "at 3:30pm"
  const timeMatch = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const meridiem = timeMatch[3] ? timeMatch[3].toLowerCase() : null;
    
    // Convert to 24-hour format
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    
    return { hours, minutes, hasTime: true };
  }
  
  return { hours: null, minutes: null, hasTime: false };
}

// ============================================================================
// STRICT Event Parsing - Only creates events with proper info
// ============================================================================
function parseEventCommand(text) {
  const lower = text.toLowerCase();
  
  // Must have BOTH a trigger word AND event-related word
  const eventTriggers = ['create', 'schedule', 'add', 'make', 'set up', 'book', 'plan'];
  const eventWords = ['event', 'meeting', 'appointment', 'reminder'];
  
  const hasTrigger = eventTriggers.some(trigger => lower.includes(trigger));
  const hasEventWord = eventWords.some(word => lower.includes(word));
  
  // Must have trigger word OR event word (not necessarily both now for flexibility)
  if (!hasTrigger && !hasEventWord) {
    return null;
  }

  // Extract event title
  let summary = null;
  
  // Method 1: Look for "called X" or "named X"
  const calledMatch = text.match(/(?:called|named|titled)\s+["']?([^"']+?)["']?(?:\s+(?:tomorrow|today|at|on|for|monday|tuesday|wednesday|thursday|friday|saturday|sunday|the)|$)/i);
  if (calledMatch) {
    summary = calledMatch[1].trim();
  }
  
  // Method 2: Look for quoted text
  if (!summary) {
    const quoteMatch = text.match(/["']([^"']+)["']/);
    if (quoteMatch) {
      summary = quoteMatch[1].trim();
    }
  }
  
  // Method 3: Extract text between trigger and date/time words
  if (!summary) {
    const dateTimeKeywords = ['tomorrow', 'today', 'next week', 'at ', 'on ', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'the '];
    
    let titleStart = -1;
    for (const trigger of [...eventTriggers, ...eventWords]) {
      const idx = lower.indexOf(trigger);
      if (idx !== -1) {
        titleStart = idx + trigger.length;
        break;
      }
    }
    
    if (titleStart !== -1) {
      let titleEnd = text.length;
      for (const keyword of dateTimeKeywords) {
        const idx = lower.indexOf(keyword, titleStart);
        if (idx !== -1 && idx > titleStart && idx < titleEnd) {
          titleEnd = idx;
        }
      }
      
      let extracted = text.substring(titleStart, titleEnd).trim();
      
      // Clean up common filler words
      const fillers = ['please', 'can you', 'could you', 'a ', 'an ', 'the ', 'for me'];
      fillers.forEach(filler => {
        extracted = extracted.replace(new RegExp(`\\b${filler}\\b`, 'gi'), ' ');
      });
      
      extracted = extracted.replace(/\s+/g, ' ').trim();
      
      if (extracted && extracted.length > 2) {
        summary = extracted;
      }
    }
  }
  
  // STRICT CHECK: Must have a meaningful title (at least 2 characters)
  if (!summary || summary.length < 2) {
    console.log('❌ Event rejected: No valid title found');
    return null;
  }

  // Parse date using advanced date parser
  let startTime = parseDate(text);
  if (!startTime) {
    // Default to 1 hour from now if no date specified
    startTime = new Date();
    startTime.setHours(startTime.getHours() + 1, 0, 0, 0);
  }
  
  // Parse time
  const timeInfo = parseTime(text);
  if (timeInfo.hasTime) {
    startTime.setHours(timeInfo.hours, timeInfo.minutes, 0, 0);
  } else {
    // If no time specified, default to 10 AM if it's a future date, or +1 hour if today
    const now = new Date();
    if (startTime.toDateString() === now.toDateString()) {
      startTime.setHours(now.getHours() + 1, 0, 0, 0);
    } else {
      startTime.setHours(10, 0, 0, 0);
    }
  }

  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

  console.log('✅ Event parsed:', { 
    summary, 
    start: startTime.toLocaleString(), 
    end: endTime.toLocaleString()
  });

  return {
    summary: summary,
    start: startTime.toISOString(),
    end: endTime.toISOString()
  };
}

async function createEvent(eventData) {
  if (!currentUser) {
    addMessage('Please login first to create events', 'ai');
    speak('Please login first');
    return;
  }

  try {
    const saved = await saveEvent(currentUser, eventData);
    console.log('Event created and saved:', saved);
    
    const startDate = new Date(eventData.start);
    const msg = `✅ Event "${eventData.summary}" created for ${startDate.toLocaleDateString()} at ${startDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`;
    addMessage(msg, 'ai');
    speak(`Event ${eventData.summary} has been added to your calendar.`);
    
    // Open calendar sidebar to show the event
    document.getElementById('calendarSidebar').classList.add('open');
  } catch (error) {
    console.error('Failed to create event:', error);
    addMessage('Failed to create event: ' + error.message, 'ai');
    speak('Failed to create event');
  }
}

// ============================================================================
// Wikipedia Integration
// ============================================================================
async function fetchWikipediaSummary(title) {
  const normalized = title.replace(/\s+/g, '_');
  const safeTitle = encodeURIComponent(normalized);
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${safeTitle}`;
  const res = await fetch(url);
  
  if (!res.ok) throw new Error('not-found');
  
  const data = await res.json();
  if (!data.extract) throw new Error('no-extract');
  
  return { title: data.title, summary: data.extract };
}

// ============================================================================
// Event Management Commands (Edit/Delete)
// ============================================================================
async function handleDeleteEvent(text) {
  const events = await getUserEvents(currentUser);
  if (events.length === 0) {
    addMessage('You have no events to delete.', 'ai');
    speak('You have no events to delete');
    return;
  }

  // Show list of events to delete
  let message = '🗑️ Which event would you like to delete? Reply with the number:<br><br>';
  events.forEach((event, index) => {
    const startDate = new Date(event.start);
    message += `${index + 1}. <strong>${event.summary}</strong> - ${startDate.toLocaleDateString()} at ${startDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}<br>`;
  });
  
  addMessage(message, 'ai');
  speak('Which event would you like to delete? Reply with the number.');
  
  // Store state for next input
  window.pendingAction = { type: 'delete', events };
}

async function handleEditEvent(text) {
  const events = await getUserEvents(currentUser);
  if (events.length === 0) {
    addMessage('You have no events to edit.', 'ai');
    speak('You have no events to edit');
    return;
  }

  // Show list of events to edit
  let message = '✏️ Which event would you like to edit? Reply with the number:<br><br>';
  events.forEach((event, index) => {
    const startDate = new Date(event.start);
    message += `${index + 1}. <strong>${event.summary}</strong> - ${startDate.toLocaleDateString()} at ${startDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}<br>`;
  });
  
  addMessage(message, 'ai');
  speak('Which event would you like to edit? Reply with the number.');
  
  // Store state for next input
  window.pendingAction = { type: 'edit', events };
}

async function handlePendingAction(text) {
  if (!window.pendingAction) return false;

  const action = window.pendingAction;
  const num = parseInt(text.trim());
  
  // Check if user provided a valid number
  if (isNaN(num) || num < 1 || num > action.events.length) {
    addMessage('❌ Invalid number. Please try again or say "cancel".', 'ai');
    return true;
  }

  const event = action.events[num - 1];
  
  if (action.type === 'delete') {
    if (confirm(`Are you sure you want to delete "${event.summary}"?`)) {
      await deleteEvent(currentUser, event.id);
      addMessage(`✅ Event "${event.summary}" has been deleted.`, 'ai');
      speak(`Event ${event.summary} deleted`);
    }
    window.pendingAction = null;
    return true;
  }
  
  if (action.type === 'edit') {
    const newTitle = prompt(`Edit event title for "${event.summary}":`, event.summary);
    if (newTitle && newTitle !== event.summary) {
      await updateEvent(currentUser, event.id, { summary: newTitle });
      addMessage(`✅ Event renamed to "${newTitle}".`, 'ai');
      speak(`Event renamed to ${newTitle}`);
    }
    window.pendingAction = null;
    return true;
  }
  
  return false;
}

// ============================================================================
// Input Handler
// ============================================================================
async function handleInput(text) {
  const lower = text.toLowerCase();

  // =========================================================================
  // GREETING LAYER - Respond naturally to greetings
  // =========================================================================
  const greetingPatterns = [
    { pattern: /^(hello|hi|hey|greetings|welcome)[\s!.]*$/i, response: "👋 Hello! I'm Jarvis, your personal calendar assistant. What can I help you with?" },
    { pattern: /^(how are you|how's it going|what's up)[\s!.]*$/i, response: "⚡ I'm running great! Ready to help you manage your calendar or answer questions." },
    { pattern: /^(good morning|good afternoon|good evening)[\s!.]*$/i, response: "☀️ Good day! Let me help you with your calendar events." },
    { pattern: /^(thank you|thanks|appreciate it)[\s!.]*$/i, response: "😊 Happy to help! Anything else you need?" }
  ];

  for (const { pattern, response } of greetingPatterns) {
    if (pattern.test(text)) {
      addMessage(response, 'ai');
      speak(response.replace(/[^a-zA-Z\s]/g, ''));
      return;
    }
  }

  // =========================================================================
  // Regular input handling continues
  // =========================================================================

  // Check if user is responding to a pending action
  if (window.pendingAction) {
    // Allow cancel
    if (lower.includes('cancel') || lower.includes('nevermind')) {
      window.pendingAction = null;
      addMessage('Action cancelled.', 'ai');
      speak('Cancelled');
      return;
    }
    
    const handled = await handlePendingAction(text);
    if (handled) return;
  }

  // Check for delete command
  if (lower.includes('delete') && (lower.includes('event') || lower.includes('meeting') || lower.includes('appointment'))) {
    await handleDeleteEvent(text);
    return;
  }

  // Check for edit command
  if (lower.includes('edit') && (lower.includes('event') || lower.includes('meeting') || lower.includes('appointment'))) {
    await handleEditEvent(text);
    return;
  }

  // Check for calendar event creation - STRICT validation
  const eventData = parseEventCommand(text);
  if (eventData) {
    await createEvent(eventData);
    return;
  }

  // If it looks like they tried to create an event but failed
  const eventAttempt = ['create', 'schedule', 'add', 'make'].some(word => lower.includes(word)) &&
                       ['event', 'meeting', 'appointment'].some(word => lower.includes(word));
  
  if (eventAttempt) {
    addMessage('⚠️ I couldn\'t create that event. Please include:\n• Event name (e.g., "workout")\n• Time (optional): "at 3pm"\n• Date (optional): "tomorrow", "Wednesday", "the 12th"\n\nExample: "create event workout Wednesday at 6am"', 'ai');
    speak('I need more information to create the event. Please include the event name and optionally the time and date.');
    return;
  }

  // Handle poem request
  if (lower.includes('poem')) {
    const response = `In circuits deep and wires bright,\nI dream in code through day and night.\nYou speak, I listen, thoughts arise,\nTogether we explore the skies.`;
    addMessage(response, 'ai');
    speak(response);
    return;
  }

  // Handle Wikipedia queries
  if (/\b(what is|who is|tell me about|define)\b/i.test(text)) {
    const term = text.replace(/\b(what is|who is|tell me about|define)\b/gi, '').trim().replace(/\?/g, '');
    
    if (term) {
      addMessage(`Searching Wikipedia for "${term}"...`, 'ai');
      
      try {
        const result = await fetchWikipediaSummary(term);
        const msg = `${result.title}: ${result.summary}`;
        addMessage(msg, 'ai');
        speak(result.summary.substring(0, 200));
      } catch (error) {
        addMessage("I couldn't find information about that.", 'ai');
        speak("I couldn't find information about that.");
      }
      return;
    }
  }

  // Philosophical questions
  if (lower.includes('trolley problem')) {
    const response = "The trolley problem is a thought experiment in ethics. It asks whether you would pull a lever to divert a runaway trolley onto a track with one person instead of five. This explores the tension between utilitarian ethics and deontological ethics.";
    addMessage(response, 'ai');
    speak(response);
    return;
  }

  if (lower.includes('consciousness')) {
    const response = "Consciousness is the state of being aware of and able to think about one's own existence, thoughts, and surroundings. It remains one of the greatest mysteries in philosophy and neuroscience.";
    addMessage(response, 'ai');
    speak(response);
    return;
  }

  // Default response
  const response = `You said: "${text}". I'm processing that with my AI reasoning capabilities.`;
  addMessage(response, 'ai');
  speak("I'm thinking about that");
}

// ============================================================================
// Initialization
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
  addWelcomeMessage();
  
  // Hide calendar link section initially
  const calendarLinkSection = document.getElementById('calendarLinkSection');
  if (calendarLinkSection) {
    calendarLinkSection.style.display = 'none';
  }
  
  // Initialize calendar if available
  if (window.CalendarManager) {
    window.CalendarManager.init();
  }
});