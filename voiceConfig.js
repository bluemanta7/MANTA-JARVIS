/**
 * MANTA-JARVIS Voice Configuration
 * 
 * Configure TTS (Text-to-Speech) settings here
 */

window.voiceConfig = {
  // Server TTS (Coqui) settings
  useServerTTS: false,  // Set to true if you have Coqui TTS installed on the server
  serverUrl: 'http://127.0.0.1:8080/synthesize',
  serverToken: '',  // Optional: set if you configured TTS_TOKEN environment variable
  
  // Browser TTS fallback settings
  lang: 'en-US',
  rate: 1.0,      // Speed: 0.1 to 10 (1.0 is normal)
  pitch: 1.0,     // Pitch: 0 to 2 (1.0 is normal)
  
  // Voice selection (optional)
  preferredVoice: 'Google US English',  // Preferred voice name
  voiceFilter: 'en-US'  // Filter voices by language code
};

// Log available voices (for debugging)
if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.onvoiceschanged = () => {
    const voices = speechSynthesis.getVoices();
    console.log('Available voices:', voices.map(v => v.name));
  };
}