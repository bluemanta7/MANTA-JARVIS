const voiceButton = document.getElementById('voiceButton');
const transcript = document.getElementById('transcript');

// Speech Recognition setup
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'en-US';
recognition.continuous = false;

// Text-to-Speech setup
function speak(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  speechSynthesis.speak(utterance);
}

voiceButton.onclick = () => {
  recognition.start();
  speak("Hello");
};

recognition.onresult = (event) => {
  const text = event.results[0][0].transcript;
  transcript.textContent = `You said: "${text}"`;
};
