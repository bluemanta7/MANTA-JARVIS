// ============================================================================
// MANTA-JARVIS - Voice Configuration
// ============================================================================

window.voiceConfig = {
  // Browser TTS settings
  lang: 'en-US',
  rate: 1.0,
  pitch: 1.0,
  
  // Preferred voice (optional)
  // Examples: 'Google US English', 'Microsoft David', 'Alex'
  preferredVoice: null,
  
  // Voice filter (matches partial name)
  voiceFilter: 'english',
  
  // Server TTS settings (if using Flask backend)
  useServerTTS: false,
  serverUrl: 'http://localhost:8080/synthesize',
  serverToken: null, // Optional authentication token
  
  // Speech recognition settings
  recognitionLang: 'en-US',
  continuousRecognition: false,
  interimResults: false
};

// Voice selection helper
function listAvailableVoices() {
  if ('speechSynthesis' in window) {
    const voices = speechSynthesis.getVoices();
    console.log('Available voices:');
    voices.forEach((voice, index) => {
      console.log(`${index}: ${voice.name} (${voice.lang})`);
    });
  }
}

// Call this in the browser console to see available voices
window.listAvailableVoices = listAvailableVoices;

// Load voices when they become available
if ('speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = () => {
    // Voices are now loaded
    console.log('Voices loaded. Call listAvailableVoices() to see them.');
  };
}