from flask import Flask, request, send_file, jsonify
from io import BytesIO
import os

# Minimal Coqui TTS server example. This expects that Coqui TTS is installed
# in the environment and that a model is available. This file is a starting
# point — you may need to adapt imports if Coqui's API changes.

try:
    from TTS.api import TTS
    COQUI_AVAILABLE = True
except Exception as e:
    print('Coqui TTS import failed:', e)
    COQUI_AVAILABLE = False

app = Flask(__name__)

# Basic token check (optional) — set TTS_TOKEN env var to require a token
SERVER_TOKEN = os.environ.get('TTS_TOKEN', '')

# Initialize model lazily
_tts_model = None

def get_tts():
    global _tts_model
    if _tts_model is None:
        if not COQUI_AVAILABLE:
            raise RuntimeError('Coqui TTS not available in this environment')
        # Choose a default model name — adjust to a model you downloaded
        model_name = os.environ.get('TTS_MODEL', 'tts_models/en/ljspeech/tacotron2-DDC')
        _tts_model = TTS(model_name)
    return _tts_model

@app.route('/synthesize', methods=['POST'])
def synthesize():
    if SERVER_TOKEN:
        token = request.headers.get('X-TTS-TOKEN', '')
        if token != SERVER_TOKEN:
            return jsonify({'error': 'unauthorized'}), 401

    data = request.get_json(force=True)
    text = data.get('text', '')
    if not text:
        return jsonify({'error': 'no text provided'}), 400

    # Optional args
    speaker = data.get('speaker')
    speed = data.get('rate')

    try:
        tts = get_tts()
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    # Synthesize to numpy array or file; wrap into WAV in memory
    out_path = 'temp_out.wav'
    try:
        # Coqui TTS high-level API: tts.tts_to_file(text=text, file_path=out_path, speaker=speaker)
        tts.tts_to_file(text=text, file_path=out_path)
        bio = BytesIO()
        with open(out_path, 'rb') as f:
            bio.write(f.read())
        bio.seek(0)
        return send_file(bio, mimetype='audio/wav', as_attachment=False, download_name='speech.wav')
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
