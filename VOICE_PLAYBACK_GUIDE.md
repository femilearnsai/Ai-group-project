# Voice Playback Troubleshooting Guide

## Overview
The AI response voice playback feature converts assistant responses to speech using OpenAI's TTS API and plays them through the browser's audio element.

## Setup Requirements

### Backend (.env or environment variables)
```bash
OPENAI_API_KEY=your_openai_api_key_here
```

### Frontend (.env or .env.local)
```bash
VITE_API_URL=http://localhost:8000
```

## How Voice Playback Works

### Flow
1. **User clicks speaker icon** on AI message
2. **Frontend sends request** to `POST /tts` with message text
3. **Backend generates audio** using OpenAI TTS API (tts-1 model)
4. **Audio streams back** as MP3 blob
5. **Browser plays audio** automatically
6. **Volume icon toggles** while playing (Volume2 → VolumeX)

### File Structure
```
frontend/
├── config.js                          # API configuration (NEW)
├── components/
│   └── MessageBubble.jsx              # Voice playback logic (UPDATED)
└── .env.example                       # Environment template (NEW)

backend/
└── main.py
    └── @app.post("/tts")              # TTS endpoint (UPDATED)
```

## Common Issues & Solutions

### ❌ Issue: "Voice playback failed" or error message appears

**Cause**: Backend not reachable or API key missing

**Solutions**:
1. Ensure backend is running:
   ```bash
   cd backend
   uvicorn main:app --reload
   ```
2. Check OPENAI_API_KEY is set:
   ```bash
   echo $OPENAI_API_KEY  # Linux/Mac
   echo %OPENAI_API_KEY%  # Windows
   ```
3. Verify API URL in frontend is correct:
   - Dev: `http://localhost:8000`
   - Production: Set `VITE_API_URL` environment variable

### ❌ Issue: Audio plays but no sound

**Cause**: Browser audio muted or volume is 0

**Solutions**:
1. Check browser volume/mute state
2. Try clicking the speaker icon again
3. Check browser console for errors: `F12 → Console`

### ❌ Issue: CORS error in console

**Cause**: CORS headers missing from TTS response

**Solution**: Already fixed in updated `main.py` with proper CORS headers:
```python
headers={
    "Content-Disposition": "inline; filename=speech.mp3",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
}
```

### ❌ Issue: "Error generating speech: ..."

**Cause**: OpenAI API error

**Solutions**:
1. Verify API key is valid and has credits
2. Check text isn't empty
3. Check text length (max 4096 chars)
4. Look at backend logs for detailed error message

### ❌ Issue: Button appears disabled/not clickable

**Cause**: `disabled` attribute on button when playing

**Solution**: Wait for playback to finish or click the stop icon (VolumeX)

## Testing

### Manual Test Steps
1. Start backend: `uvicorn backend.main:app --reload`
2. Start frontend: `npm run dev`
3. Navigate to chat and ask a question
4. Click speaker icon 🔊 on AI response
5. Listen for audio playback

### Test via cURL (Backend only)
```bash
curl -X POST http://localhost:8000/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello, this is a test","voice":"alloy"}' \
  --output test.mp3

# Play the audio
# On Mac: open test.mp3
# On Linux: mpv test.mp3
# On Windows: start test.mp3
```

## Configuration

### Voice Options
Available voices: `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`

Change in `MessageBubble.jsx`:
```javascript
body: JSON.stringify({ text: content, voice: 'nova' })  // Change 'alloy' to desired voice
```

### API Endpoint Configuration

**Development** (`frontend/config.js`):
```javascript
const API_BASE_URL = isDev 
  ? import.meta.env.VITE_API_URL || 'http://localhost:8000'
  : import.meta.env.VITE_API_URL || '/api';
```

**Set via environment**:
```bash
# .env.local or .env
VITE_API_URL=http://localhost:8000
```

## Debugging

### Enable Console Logging
The following messages appear in browser console:

```javascript
// Request starts
console.log('Requesting TTS from:', config.endpoints.tts);

// Error occurs
console.error('Voice playback error:', error);
console.error('Audio play error:', err);
```

### Check Network Tab
1. Open DevTools (F12)
2. Click Network tab
3. Trigger voice playback
4. Look for `POST /tts` request
   - Status should be 200 OK
   - Response type should be `audio/mpeg`
   - Response size should match MP3 file size

### Backend Logs
```bash
# Shows TTS request details
Generating TTS for voice 'alloy' with text length 245 chars

# Shows errors
TTS Error: Invalid API key
```

## Performance Tips

1. **Limit text length**: Max 4096 characters (automatically truncated)
2. **Use lighter voice model**: `tts-1` (faster) vs `tts-1-hd` (higher quality)
3. **Cache audio**: Consider caching frequently-used responses
4. **Error handling**: User sees tooltip on speaker icon if error occurs

## Production Deployment

### Before Going Live
1. Remove hardcoded localhost URLs ✅ (done via config.js)
2. Set proper OPENAI_API_KEY in production environment
3. Update VITE_API_URL to production backend URL
4. Test CORS headers in production domain
5. Monitor OpenAI API quota and costs

### Environment Variables
```bash
# .env (backend)
OPENAI_API_KEY=sk-...

# .env.local or CI/CD (frontend)
VITE_API_URL=https://api.yourdomain.com
```

## API Reference

### TTS Endpoint
```
POST /tts
Content-Type: application/json

{
  "text": "The message content to convert to speech",
  "voice": "alloy"  // Optional, defaults to "alloy"
}

Response:
- Status: 200 OK
- Content-Type: audio/mpeg
- Body: MP3 audio bytes
```

### Response Headers
```
Access-Control-Allow-Origin: *
Content-Type: audio/mpeg
Content-Disposition: inline; filename=speech.mp3
```

## Related Components

- **MessageBubble.jsx**: Handles voice playback UI and logic
- **config.js**: Centralized API endpoint configuration
- **main.py**: FastAPI TTS endpoint implementation
- **ThemeToggle.jsx**: UI theme switching (separate feature)

---

Last Updated: January 13, 2026
