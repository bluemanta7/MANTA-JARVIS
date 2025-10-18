// ============================================================================
// MANTA JARVIS - Voice Assistant with Google Calendar Integration
// ============================================================================

// Configuration
const CONFIG = {
  CLIENT_ID: '1031943830579-h57ffduintve8o0t4kt567klobu0ibeg.apps.googleusercontent.com',
  REDIRECT_URI: 'http://localhost:8080/oauth2callback',
  FLASK_BASE_URL: 'http://localhost:8080',
  TTS_ENDPOINT: 'http://localhost:8080/synthesize'
};

// ============================================================================
// Authentication & State Management
// ============================================================================

let authState = {
  isAuthenticated: false,
  accessToken: null
};

// Handle OAuth callback (extract code from URL)
function handleOAuthCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const error = urlParams.get('error');

  if (error) {
    console.error('OAuth error:', error);
    addMessage(`Authentication failed: ${error}`, 'ai');
    speak('Authentication failed. Please try signing in again.');
    return;
  }

  if (code) {
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
    
    // Show success message
    addMessage('Google authentication successful! You can now create calendar events.', 'ai');
    speak('Authentication successful. You can now create calendar events using voice commands.');
    
    authState.isAuthenticated = true;
    updateSignInButton();
  }
}

// Update sign-in button appearance
function updateSignInButton() {
  const signInBtn = document.getElementById('signin');
  if (signInBtn) {
    if (authState.isAuthenticated) {
      signInBtn.textContent = 'Signed In ✓';
      signInBtn.style.backgroundColor = '#34A853';
      signInBtn.disabled = true;
    } else {
      signInBtn.textContent = 'Sign in with Google';
      signInBtn.style.backgroundColor = '#4285F4';
      signInBtn.disabled = false;
    }
  }
}

// Trigger Google OAuth flow
document.getElementById('signin').addEventListener('click', () => {
  const params = new URLSearchParams({
    client_id: CONFIG.CLIENT_ID,
    redirect_uri: CONFIG.REDIRECT_URI,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.events',
    access_type: 'offline',
    prompt: 'consent'
  });
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
});

// ============================================================================
// DOM Elements
// ============================================================================

const resizer = document.getElementById('resizer');
const voiceButton = document.getElementById('voiceButton');
const transcript = document.getElementById('transcript');
const hamburger = document.getElementById('hamburger');
const sidebar = document.getElementById('sidebar');
const chatThread = document.getElementById('chatThread');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');

// Safety checks
if (!chatThread) console.warn('chatThread element not found');
if (!userInput || !sendBtn) console.warn('userInput or sendBtn not found');

// ============================================================================
// In-Memory Cache (replaces localStorage)
// ============================================================================

const memoryCache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

function cacheSet(key, value) {
  memoryCache.set(key, { ts: Date.now(), v: value });
}

function cacheGet(key) {
  const cached = memoryCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.ts > CACHE_TTL_MS) {
    memoryCache.delete(key);
    return null;
  }
  return cached.v;
}

// ============================================================================
// Disambiguation State
// ============================================================================

let lastDisambiguationHits = null;
let lastDisambiguationTerm = null;

// ============================================================================
// UI Controls
// ============================================================================

// Sidebar toggle
hamburger.onclick = () => {
  const isOpen = sidebar.classList.contains('open');
  sidebar.classList.toggle('open');
  sidebar.style.width = isOpen ? '300px' : sidebar.style.width;
  voiceButton.style.marginLeft = isOpen ? '350px' : voiceButton.style.marginLeft;
};

// Sidebar resizer
let isResizing = false;

resizer.addEventListener('mousedown', () => {
  isResizing = true;
  document.body.style.cursor = 'ew-resize';
});

document.addEventListener('mousemove', (e) => {
  if (!isResizing) return;
  let newWidth = e.clientX;
  newWidth = Math.max(250, Math.min(600, newWidth));
  sidebar.style.width = `${newWidth}px`;
  voiceButton.style.marginLeft = `${newWidth + 50}px`;
});

document.addEventListener('mouseup', () => {
  isResizing = false;
  document.body.style.cursor = 'default';
});

// ============================================================================
// Speech Recognition Setup
// ============================================================================

const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'en-US';
recognition.continuous = false;

let isListening = false;
let restartDelayMs = 250;
let restartAttempts = 0;
const RESTART_MAX_DELAY = 5000;
const RESTART_MAX_ATTEMPTS = 6;

function startListening() {
  if (isListening) return;
  isListening = true;
  voiceButton.classList.add('listening');
  try {
    recognition.start();
  } catch (e) {
    console.warn('recognition.start failed', e);
  }
}

function stopListening() {
  if (!isListening) return;
  isListening = false;
  try {
    recognition.stop();
  } catch (e) {
    console.warn('recognition.stop failed', e);
  }
  voiceButton.classList.remove('listening');
}

function scheduleRestart() {
  if (!isListening) return;
  restartAttempts++;
  restartDelayMs = Math.min(RESTART_MAX_DELAY, 250 * Math.pow(2, Math.max(0, restartAttempts - 1)));
  
  if (restartAttempts > RESTART_MAX_ATTEMPTS) {
    isListening = false;
    voiceButton.classList.remove('listening');
    const msg = 'Microphone repeatedly failed. Please check browser permissions and click the mic to try again.';
    addMessage(msg, 'ai');
    speak(msg);
    return;
  }

  setTimeout(() => {
    if (!isListening) return;
    try {
      recognition.start();
    } catch (e) {
      console.warn('recognition.restart failed', e);
    }
  }, restartDelayMs);
}

voiceButton.onclick = () => {
  if (isListening) {
    stopListening();
    speak('Stopped listening');
  } else {
    startListening();
    speak('Listening');
  }
};

recognition.onresult = (event) => {
  const text = event.results[0][0].transcript;
  transcript.textContent = `You said: "${text}"`;
  sidebar.classList.add('open');
  addMessage(text, 'user');
  handleInput(text);
};

recognition.onstart = () => {
  restartAttempts = 0;
  restartDelayMs = 250;
};

recognition.onend = () => {
  if (isListening) {
    scheduleRestart();
  } else {
    voiceButton.classList.remove('listening');
  }
};

recognition.onerror = (err) => {
  console.warn('recognition error', err);
  const code = err && (err.error || err.message || err.type || '').toString().toLowerCase();
  if (code.includes('notallowed') || code.includes('permission') || code.includes('denied')) {
    isListening = false;
    voiceButton.classList.remove('listening');
    const msg = 'Microphone permission denied. Please allow microphone access and try again.';
    addMessage(msg, 'ai');
    speak(msg);
  }
};

// ============================================================================
// Speech Synthesis (TTS)
// ============================================================================

function _selectPreferredVoice() {
  try {
    const cfg = window.voiceConfig || {};
    const voices = speechSynthesis.getVoices() || [];
    let selected = null;
    
    if (cfg.preferredVoice) {
      selected = voices.find(v => v.name && v.name.toLowerCase().includes(cfg.preferredVoice.toLowerCase()));
    }
    if (!selected && cfg.voiceFilter) {
      selected = voices.find(v => v.name && v.name.toLowerCase().includes(cfg.voiceFilter.toLowerCase()));
    }
    if (!selected && voices.length) selected = voices[0];
    
    window._preferredVoice = selected || null;
  } catch (e) {
    console.warn('selectPreferredVoice failed', e);
  }
}

speechSynthesis.onvoiceschanged = () => {
  _selectPreferredVoice();
};

function speak(text) {
  const cfg = window.voiceConfig || {};
  
  // Server TTS (Coqui)
  if (cfg.useServerTTS && cfg.serverUrl) {
    const busy = document.createElement('div');
    busy.className = 'message ai';
    busy.textContent = '🔊 Synthesizing audio...';
    chatThread.appendChild(busy);
    chatThread.scrollTop = chatThread.scrollHeight;

    const payload = { text };
    const headers = { 'Content-Type': 'application/json' };
    if (cfg.serverToken) headers['X-TTS-TOKEN'] = cfg.serverToken;

    fetch(cfg.serverUrl, { method: 'POST', headers, body: JSON.stringify(payload) })
      .then(r => {
        if (!r.ok) throw new Error('TTS server error');
        return r.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => { URL.revokeObjectURL(url); busy.remove(); };
        audio.onerror = () => { URL.revokeObjectURL(url); busy.remove(); console.error('Audio playback error'); };
        audio.play();
      })
      .catch(err => {
        console.error('Server TTS failed', err);
        busy.textContent = 'Server TTS failed, falling back to browser TTS.';
        setTimeout(() => { try { busy.remove(); } catch(e){} }, 2000);
        
        // Fallback to browser TTS
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = cfg.lang || 'en-US';
        utterance.rate = cfg.rate || 1;
        utterance.pitch = cfg.pitch || 1;
        if (!window._preferredVoice) _selectPreferredVoice();
        if (window._preferredVoice) utterance.voice = window._preferredVoice;
        speechSynthesis.speak(utterance);
      });
    return;
  }

  // Browser TTS fallback
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = cfg.lang || 'en-US';
  utterance.rate = cfg.rate || 1;
  utterance.pitch = cfg.pitch || 1;
  if (!window._preferredVoice) _selectPreferredVoice();
  if (window._preferredVoice) utterance.voice = window._preferredVoice;
  speechSynthesis.speak(utterance);
}

// ============================================================================
// Chat UI
// ============================================================================

function addMessage(text, sender) {
  const msg = document.createElement('div');
  msg.className = `message ${sender}`;
  msg.textContent = text;
  chatThread.appendChild(msg);
  chatThread.scrollTop = chatThread.scrollHeight;
}

// ============================================================================
// Google Calendar Event Creation
// ============================================================================

async function createCalendarEvent(eventData) {
  if (!authState.isAuthenticated) {
    const msg = 'Please sign in with Google first to create calendar events.';
    addMessage(msg, 'ai');
    speak(msg);
    return null;
  }

  try {
    addMessage('📅 Creating calendar event...', 'ai');
    
    const response = await fetch(`${CONFIG.FLASK_BASE_URL}/create_event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    
    const successMsg = `✓ Event "${eventData.summary}" created successfully!`;
    addMessage(successMsg, 'ai');
    speak(`Event ${eventData.summary} has been added to your calendar.`);
    
    return data;
  } catch (err) {
    console.error('Failed to create event:', err);
    const errorMsg = `Failed to create event: ${err.message}`;
    addMessage(errorMsg, 'ai');
    speak('Sorry, I could not create the calendar event. Please try again.');
    return null;
  }
}

// Parse natural language into event data
function parseEventCommand(text) {
  const lower = text.toLowerCase();
  
  // Check if it's an event creation command
  if (!/\b(create|schedule|add|make|set up|book)\b.*\b(event|meeting|appointment|calendar)\b/i.test(text)) {
    return null;
  }

  // Extract event title/summary
  let summary = 'New Event';
  const titleMatch = text.match(/(?:create|schedule|add|make|set up|book)\s+(?:a|an)?\s*(?:event|meeting|appointment)?\s+(?:called|named|titled)?\s*["']?([^"']+?)["']?\s+(?:on|at|for)/i);
  if (titleMatch) {
    summary = titleMatch[1].trim();
  } else {
    const simpleMatch = text.match(/(?:create|schedule|add)\s+["']?([^"']+?)["']?\s+(?:event|meeting)/i);
    if (simpleMatch) summary = simpleMatch[1].trim();
  }

  // Extract date/time (simplified - you'd want more robust parsing)
  const now = new Date();
  let startTime = new Date(now.getTime() + 60 * 60 * 1000); // Default: 1 hour from now
  let endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // Default: 1 hour duration

  // Look for "tomorrow"
  if (/\btomorrow\b/i.test(text)) {
    startTime = new Date(now);
    startTime.setDate(startTime.getDate() + 1);
    startTime.setHours(10, 0, 0, 0); // 10 AM
    endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
  }

  // Look for specific times like "at 3pm" or "at 15:00"
  const timeMatch = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const meridiem = timeMatch[3] ? timeMatch[3].toLowerCase() : null;
    
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    
    startTime.setHours(hours, minutes, 0, 0);
    endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
  }

  // Format as ISO 8601 with timezone
  const formatDateTime = (date) => {
    const offset = -date.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const pad = (num) => String(Math.abs(num)).padStart(2, '0');
    
    return date.getFullYear() + '-' +
           pad(date.getMonth() + 1) + '-' +
           pad(date.getDate()) + 'T' +
           pad(date.getHours()) + ':' +
           pad(date.getMinutes()) + ':' +
           pad(date.getSeconds()) +
           sign + pad(Math.floor(Math.abs(offset) / 60)) + ':' + pad(Math.abs(offset) % 60);
  };

  return {
    summary: summary,
    start_time: formatDateTime(startTime),
    end_time: formatDateTime(endTime)
  };
}

// ============================================================================
// Wikipedia Integration
// ============================================================================

async function fetchWikipediaSummary(title) {
  const normalized = title.replace(/\s+/g, '_');
  const safeTitle = encodeURIComponent(normalized);
  const cacheKey = `title:${normalized.toLowerCase()}`;

  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${safeTitle}`;
  const res = await fetch(url);
  
  if (!res.ok) {
    const err = new Error('not-found');
    err.status = res.status;
    throw err;
  }

  const data = await res.json();

  if (data.type && data.type.toLowerCase().includes('disambiguation')) {
    throw new Error('disambiguation');
  }

  if (!data.extract) {
    throw new Error('no-extract');
  }

  const out = { title: data.title, summary: data.extract };
  cacheSet(cacheKey, out);
  return out;
}

async function searchWikipediaAndFetch(term) {
  const qs = encodeURIComponent(term);
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${qs}&format=json&origin=*`;
  const res = await fetch(searchUrl);
  
  if (!res.ok) throw new Error('search-failed');
  
  const data = await res.json();
  const hits = data.query && data.query.search;
  
  if (!hits || hits.length === 0) throw new Error('no-results');
  
  const topHits = hits.slice(0, 5).map(h => ({ title: h.title, snippet: h.snippet }));

  if (topHits.length === 1) {
    const cacheKey = `search:${term.toLowerCase()}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    const fetched = await fetchWikipediaSummary(topHits[0].title);
    cacheSet(cacheKey, fetched);
    return fetched;
  }

  return { disambiguation: true, term, hits: topHits };
}

function presentDisambiguation(term, hits) {
  const wrapper = document.createElement('div');
  wrapper.className = 'message ai disamb';

  const header = document.createElement('div');
  header.textContent = `I found multiple meanings for "${term}". Which one did you mean?`;
  header.style.marginBottom = '8px';
  wrapper.appendChild(header);

  const list = document.createElement('ol');
  list.style.paddingLeft = '20px';
  
  hits.forEach((h, i) => {
    const li = document.createElement('li');
    li.style.cursor = 'pointer';
    li.style.marginBottom = '6px';
    li.textContent = h.title;
    li.dataset.title = h.title;
    li.dataset.index = i + 1;
    
    li.onclick = () => {
      addMessage(h.title, 'user');
      fetchWikipediaSummary(h.title)
        .then(res => {
          const out = `${res.title}: ${res.summary}`;
          addMessage(out, 'ai');
          speak(res.summary);
        })
        .catch(err => {
          console.error('Failed to fetch selected title', err);
          addMessage("Failed to fetch that article.", 'ai');
          speak("Failed to fetch that article.");
        });
    };
    
    list.appendChild(li);
  });

  wrapper.appendChild(list);

  const note = document.createElement('div');
  note.textContent = 'You can reply with the number (e.g. "2") or say/type the exact title.';
  note.style.fontSize = '0.9em';
  note.style.marginTop = '6px';
  wrapper.appendChild(note);

  chatThread.appendChild(wrapper);
  chatThread.scrollTop = chatThread.scrollHeight;

  lastDisambiguationHits = hits;
  lastDisambiguationTerm = term;
}

function parseSelectionFromText(text) {
  if (!lastDisambiguationHits || !text) return null;
  const t = text.trim().toLowerCase();

  if (/^cancel$|^never mind$|^nevermind$/i.test(t)) {
    lastDisambiguationHits = null;
    lastDisambiguationTerm = null;
    return 'CANCELLED';
  }

  const numMatch = t.match(/^(\d+)$/);
  if (numMatch) {
    const idx = parseInt(numMatch[1], 10) - 1;
    if (idx >= 0 && idx < lastDisambiguationHits.length) return lastDisambiguationHits[idx].title;
    return null;
  }

  const ordinals = { 'first':1, 'second':2, 'third':3, 'fourth':4, 'fifth':5 };
  const ordMatch = t.match(/\b(first|second|third|fourth|fifth)\b/);
  if (ordMatch) {
    const idx = (ordinals[ordMatch[1]] || 1) - 1;
    if (idx >= 0 && idx < lastDisambiguationHits.length) return lastDisambiguationHits[idx].title;
  }

  for (const h of lastDisambiguationHits) {
    if (h.title.toLowerCase() === t) return h.title;
    if (h.title.toLowerCase().includes(t) || t.includes(h.title.toLowerCase())) return h.title;
  }

  return null;
}

function parseDefinitionQuery(text) {
  if (!text || typeof text !== 'string') return null;
  const t = text.trim();

  let m = t.match(/["'"](.+?)["'"]/);
  if (m && m[1]) return sanitizeTerm(m[1]);

  const patterns = [
    /(?:define|definition of|meaning of|what is|what's|whats|explain)\s+(?:the\s+word\s+)?(.+?)[\?\.!]?$/i,
    /(?:what does)\s+(.+?)\s+mean\??$/i,
    /(?:tell me about|who is|who was|give me information about)\s+(.+?)[\?\.!]?$/i
  ];

  for (const p of patterns) {
    m = t.match(p);
    if (m && m[1]) return sanitizeTerm(m[1]);
  }

  const words = t.replace(/[\?\.!]/g, '').split(/\s+/).filter(Boolean);
  if (words.length <= 3) return sanitizeTerm(t);

  const lastThree = words.slice(-3).join(' ');
  return sanitizeTerm(lastThree);
}

function sanitizeTerm(s) {
  let term = s.trim();
  term = term.replace(/^[:;"'\s]+|[\s:;"'\.,!?]+$/g, '');
  if (term.length > 100) term = term.slice(0, 100);
  return term;
}

// ============================================================================
// Input Handler (Main Logic)
// ============================================================================

async function handleInput(text) {
  const lower = (text || '').toLowerCase();

  // Handle disambiguation selection
  if (lastDisambiguationHits) {
    const selection = parseSelectionFromText(text);
    
    if (selection === 'CANCELLED') {
      addMessage('Okay, cancelled selection.', 'ai');
      lastDisambiguationHits = null;
      lastDisambiguationTerm = null;
      return;
    }

    if (selection) {
      addMessage(selection, 'user');
      lastDisambiguationHits = null;
      
      try {
        const res = await fetchWikipediaSummary(selection);
        const out = `${res.title}: ${res.summary}`;
        addMessage(out, 'ai');
        speak(res.summary);
      } catch (err) {
        console.error('Failed to fetch selected title', err);
        addMessage("Failed to fetch that article.", 'ai');
        speak("Failed to fetch that article.");
      }
      return;
    }
  }

  // Check for calendar event creation
  const eventData = parseEventCommand(text);
  if (eventData) {
    await createCalendarEvent(eventData);
    return;
  }

  // Handle poem request
  if (lower.includes('poem')) {
    const response = `In circuits deep and wires bright,\nI dream in code through day and night.\nYou speak, I listen, thoughts arise,\nTogether we explore the skies.`;
    addMessage(response, 'ai');
    speak(response);
    return;
  }

  // Handle definition queries
  if (/\bdefine\b|\bdefinition of\b|\bwhat is\b|\bwhat's\b|\bmeaning of\b|\bwhat does\b/i.test(text)) {
    const term = parseDefinitionQuery(text);
    
    if (!term) {
      const msg = "I couldn't determine the term to define. Could you rephrase?";
      addMessage(msg, 'ai');
      speak(msg);
      return;
    }

    addMessage(`Searching Wikipedia for "${term}"...`, 'ai');

    try {
      let result;
      try {
        result = await fetchWikipediaSummary(term);
      } catch (err) {
        result = await searchWikipediaAndFetch(term);
      }

      if (result && result.disambiguation && Array.isArray(result.hits)) {
        presentDisambiguation(result.term, result.hits);
        return;
      }

      const summary = result.summary;
      const title = result.title || term;
      const out = `${title}: ${summary}`;
      addMessage(out, 'ai');
      speak(summary);
    } catch (err) {
      console.error('Wikipedia lookup failed', err);
      const fallback = "I couldn't find a good Wikipedia summary for that term. Try a shorter or different query.";
      addMessage(fallback, 'ai');
      speak(fallback);
    }
    return;
  }

  // Default response
  const response = `You said: "${text}". I'm thinking about that...`;
  addMessage(response, 'ai');
  speak(response);
}

// ============================================================================
// Text Input Handlers
// ============================================================================

sendBtn.onclick = () => {
  const text = userInput.value.trim();
  if (text === "") return;

  sidebar.classList.add('open');
  addMessage(text, 'user');
  userInput.value = "";

  handleInput(text);
};

if (userInput) {
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendBtn.click();
    }
  });
}

// ============================================================================
// Initialization
// ============================================================================

// Check for OAuth callback on page load
handleOAuthCallback();
updateSignInButton();