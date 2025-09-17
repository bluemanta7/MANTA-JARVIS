// DOM Elements
const resizer = document.getElementById('resizer');
const voiceButton = document.getElementById('voiceButton');
const transcript = document.getElementById('transcript');
const hamburger = document.getElementById('hamburger');
const sidebar = document.getElementById('sidebar');
const chatThread = document.getElementById('chatThread');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');

// In-memory state for the most recent disambiguation results
let lastDisambiguationHits = null; // array of {title, snippet}
let lastDisambiguationTerm = null;

// Safety checks
if (!chatThread) console.warn('chatThread element not found');
if (!userInput || !sendBtn) console.warn('userInput or sendBtn not found; chat input disabled');

// Sidebar toggle
hamburger.onclick = () => {
  const isOpen = sidebar.classList.contains('open');
  sidebar.classList.toggle('open');
  sidebar.style.width = isOpen ? '300px' : sidebar.style.width;
  voiceButton.style.marginLeft = isOpen ? '350px' : voiceButton.style.marginLeft;
};

// Voice recognition setup
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'en-US';
recognition.continuous = false; // we'll restart onend when toggled so it effectively stays on

// Listening toggle state
let isListening = false;

function startListening() {
  if (isListening) return;
  isListening = true;
  voiceButton.classList.add('listening');
  try {
    recognition.start();
  } catch (e) {
    // some browsers throw if start called multiple times; ignore
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

// Restart/backoff state to avoid permission prompt loops
let restartDelayMs = 250;
let restartAttempts = 0;
const RESTART_MAX_DELAY = 5000;
const RESTART_MAX_ATTEMPTS = 6; // after many attempts, stop auto-restarting

function scheduleRestart() {
  if (!isListening) return;
  restartAttempts++;
  // if too many rapid restarts, escalate delay
  restartDelayMs = Math.min(RESTART_MAX_DELAY, 250 * Math.pow(2, Math.max(0, restartAttempts - 1)));
  if (restartAttempts > RESTART_MAX_ATTEMPTS) {
    // stop trying and inform the user
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


// Speech synthesis with configurable voice/personality via window.voiceConfig
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

// ensure we pick voice once voices load
speechSynthesis.onvoiceschanged = () => {
  _selectPreferredVoice();
};

function speak(text) {
  const cfg = window.voiceConfig || {};
  // If server TTS is enabled, send request to backend and play audio
  if (cfg.useServerTTS && cfg.serverUrl) {
    // show synthesizing message
    const busy = document.createElement('div');
    busy.className = 'message ai';
    busy.textContent = 'Synthesizing audio...';
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
        // fallback to browser TTS
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

// Add message to chat
function addMessage(text, sender) {
  const msg = document.createElement('div');
  msg.className = `message ${sender}`;
  msg.textContent = text;
  chatThread.appendChild(msg);
  chatThread.scrollTop = chatThread.scrollHeight;
}

// Wikipedia search
// Robust Wikipedia summary fetch with search fallback
// --- Simple localStorage cache with TTL ---
const CACHE_PREFIX = 'wiki_summary_v1:';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

function cacheSet(key, value) {
  try {
    const payload = { ts: Date.now(), v: value };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(payload));
  } catch (e) {
    // ignore quota errors
    console.warn('cacheSet failed', e);
  }
}

function cacheGet(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.ts) return null;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return parsed.v;
  } catch (e) {
    console.warn('cacheGet failed', e);
    return null;
  }
}

async function fetchWikipediaSummary(title) {
  // Normalize title (use underscores for spaces) and encode
  const normalized = title.replace(/\s+/g, '_');
  const safeTitle = encodeURIComponent(normalized);
  const cacheKey = `title:${normalized.toLowerCase()}`;

  // Return cached result if available
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

  // If it's a disambiguation or no extract, treat as not directly usable
  if (data.type && data.type.toLowerCase().includes('disambiguation')) {
    const err = new Error('disambiguation');
    throw err;
  }

  if (!data.extract) {
    const err = new Error('no-extract');
    throw err;
  }

  const out = { title: data.title, summary: data.extract };
  // cache successful summaries
  try { cacheSet(cacheKey, out); } catch (e) { /* ignore */ }
  return out;
}

async function searchWikipediaAndFetch(term) {
  // Use MediaWiki API search as fallback
  const qs = encodeURIComponent(term);
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${qs}&format=json&origin=*`;
  const res = await fetch(searchUrl);
  if (!res.ok) throw new Error('search-failed');
  const data = await res.json();
  const hits = data.query && data.query.search;
  if (!hits || hits.length === 0) throw new Error('no-results');
  // Return top hits (limit to 5)
  const topHits = hits.slice(0, 5).map(h => ({ title: h.title, snippet: h.snippet }));

  // If only one clear hit, fetch it
  if (topHits.length === 1) {
    const firstTitle = topHits[0].title;
    // cache by search term as well
    const cacheKey = `search:${term.toLowerCase()}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    const fetched = await fetchWikipediaSummary(firstTitle);
    try { cacheSet(cacheKey, fetched); } catch (e) { /* ignore */ }
    return fetched;
  }

  // Multiple hits: return the list so caller can decide
  return { disambiguation: true, term, hits: topHits };
}

// Helper to render disambiguation options into chat and wire up click handlers
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
      // emulate user selection
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

  // store hits so the next user reply can select one
  lastDisambiguationHits = hits;
  lastDisambiguationTerm = term;
}

// Parse user reply against the last disambiguation list. Returns selected title or null
function parseSelectionFromText(text) {
  if (!lastDisambiguationHits || !text) return null;
  const t = text.trim().toLowerCase();

  // cancel
  if (/^cancel$|^never mind$|^nevermind$/i.test(t)) {
    lastDisambiguationHits = null;
    lastDisambiguationTerm = null;
    return 'CANCELLED';
  }

  // direct numeric selection: "2" or "1"
  const numMatch = t.match(/^(\d+)$/);
  if (numMatch) {
    const idx = parseInt(numMatch[1], 10) - 1;
    if (idx >= 0 && idx < lastDisambiguationHits.length) return lastDisambiguationHits[idx].title;
    return null;
  }

  // ordinal words (first, second, third, fourth, fifth)
  const ordinals = { 'first':1, 'second':2, 'third':3, 'fourth':4, 'fifth':5 };
  const ordMatch = t.match(/\b(first|second|third|fourth|fifth)\b/);
  if (ordMatch) {
    const idx = (ordinals[ordMatch[1]] || 1) - 1;
    if (idx >= 0 && idx < lastDisambiguationHits.length) return lastDisambiguationHits[idx].title;
  }

  // If user typed a title or part of it, match case-insensitive
  for (const h of lastDisambiguationHits) {
    if (h.title.toLowerCase() === t) return h.title;
    if (h.title.toLowerCase().includes(t) || t.includes(h.title.toLowerCase())) return h.title;
  }

  // If nothing matched, return null
  return null;
}

// Parse definition-like queries to extract a clean title/term
function parseDefinitionQuery(text) {
  if (!text || typeof text !== 'string') return null;
  const t = text.trim();

  // If user used quotes: "quantum entanglement"
  let m = t.match(/["'“](.+?)["'”]/);
  if (m && m[1]) return sanitizeTerm(m[1]);

  // Common patterns that ask for a definition
  const patterns = [
    /(?:define|definition of|meaning of|what is|what's|whats|explain)\s+(?:the\s+word\s+)?(.+?)[\?\.!]?$/i,
    /(?:what does)\s+(.+?)\s+mean\??$/i,
    /(?:tell me about|who is|who was|give me information about)\s+(.+?)[\?\.!]?$/i
  ];

  for (const p of patterns) {
    m = t.match(p);
    if (m && m[1]) return sanitizeTerm(m[1]);
  }

  // As a last resort, if the input is short (<=3 words) assume it's the term itself
  const words = t.replace(/[\?\.!]/g, '').split(/\s+/).filter(Boolean);
  if (words.length <= 3) return sanitizeTerm(t);

  // Otherwise, try taking the last 1-3 words as a candidate (handles "define the word trumpery")
  const lastThree = words.slice(-3).join(' ');
  return sanitizeTerm(lastThree);
}

function sanitizeTerm(s) {
  let term = s.trim();
  // remove leading/trailing punctuation
  term = term.replace(/^[:;"'\s]+|[\s:;"'\.,!?]+$/g, '');
  // limit length to avoid malformed requests
  if (term.length > 100) term = term.slice(0, 100);
  return term;
}

// Voice input handler
voiceButton.onclick = () => {
  // Toggle listening state
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
  // reset restart backoff when recognition actually starts
  restartAttempts = 0;
  restartDelayMs = 250;
};

// When recognition ends (e.g., silence), if we're still in listening mode schedule a restart with backoff
recognition.onend = () => {
  if (isListening) {
    scheduleRestart();
  } else {
    voiceButton.classList.remove('listening');
  }
};

recognition.onerror = (err) => {
  console.warn('recognition error', err);
  // If the error indicates permission denied or not-allowed, stop attempting and inform the user
  const code = err && (err.error || err.message || err.type || '').toString().toLowerCase();
  if (code.includes('notallowed') || code.includes('permission') || code.includes('denied')) {
    isListening = false;
    voiceButton.classList.remove('listening');
    const msg = 'Microphone permission denied. Please allow microphone access and try again.';
    addMessage(msg, 'ai');
    speak(msg);
  }
};

// Text input handler
sendBtn.onclick = () => {
  const text = userInput.value.trim();
  if (text === "") return;

  sidebar.classList.add('open');
  addMessage(text, 'user');
  userInput.value = "";

  handleInput(text);
};

// Enter key sends message
if (userInput) {
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendBtn.click();
    }
  });
}

// Input processor
async function handleInput(text) {
  let response = "";

  const lower = (text || '').toLowerCase();

  if (lower.includes('poem')) {
    response = `In circuits deep and wires bright,\nI dream in code through day and night.\nYou speak, I listen, thoughts arise,\nTogether we explore the skies.`;
    addMessage(response, 'ai');
    speak(response);
    return;
  }

  // Detect definition-like queries
  // If we have pending disambiguation hits, check if this input selects one
  if (lastDisambiguationHits) {
    const selection = parseSelectionFromText(text);
    if (selection === 'CANCELLED') {
      addMessage('Okay, cancelled selection.', 'ai');
      lastDisambiguationHits = null;
      lastDisambiguationTerm = null;
      return;
    }

    if (selection) {
      // emulate the selection flow
      addMessage(selection, 'user');
      lastDisambiguationHits = null;
      const pickedTitle = selection;
      try {
        const res = await fetchWikipediaSummary(pickedTitle);
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
    // otherwise fall through and attempt to treat as a fresh query
  }

  if (/\bdefine\b|\bdefinition of\b|\bwhat is\b|\bwhat's\b|\bmeaning of\b|\bwhat does\b/i.test(text)) {
    const term = parseDefinitionQuery(text);
    if (!term) {
      const msg = "I couldn't determine the term to define. Could you rephrase?";
      addMessage(msg, 'ai');
      speak(msg);
      return;
    }

    addMessage(`Searching Wikipedia for "${term}"...`, 'ai');

    (async () => {
      try {
        // First try direct title fetch
        let result;
        try {
          result = await fetchWikipediaSummary(term);
        } catch (err) {
          // If direct fetch fails due to disambiguation or not found, use search fallback
          try {
            result = await searchWikipediaAndFetch(term);
          } catch (searchErr) {
            throw searchErr;
          }
        }

        // If the fallback returned a disambiguation object, present options
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
    })();

    return;
  }

  // Default reply for non-definition inputs
  response = `You said: "${text}". I'm thinking about that...`;
  addMessage(response, 'ai');
  speak(response);
}

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
function extractKeyword(text) {
  const match = text.match(/(?:define|what is)\s+(?:the word\s+)?("?)(\w+)\1/i);
  return match ? match[2] : text;
}
