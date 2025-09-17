// voiceConfig.js — basic voice/personality configuration for MANTA-JARVIS
// This file exposes `window.voiceConfig` with simple TTS tuning options.

window.voiceConfig = {
  // preferredVoice: a substring to match against available voice names
  // Example: 'Samantha' or 'Google US English'
  preferredVoice: '',

  // voiceFilter: fallback filter if preferredVoice not found
  voiceFilter: 'en',

  // language tag
  lang: 'en-US',

  // basic speaking parameters
  rate: 1.0,
  pitch: 1.0,

  // Personality placeholders (not functional in browser TTS yet).
  // We provide fields so future integrations (neural voices or SSML) can use them.
  personality: {
    friendliness: 0.8, // 0..1
    sarcasm: 0.0,      // 0..1
    energy: 0.5        // 0..1
  }
};

// Usage: edit these fields to tweak voice behavior.
// For advanced neural TTS (external APIs), you'd replace speak() to send text+personality to the service.
