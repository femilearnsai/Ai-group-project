# Audio Playback Controls Guide

## Features

The AI response voice playback now includes full audio playback controls:

### Controls

| Icon | Action | Description |
|------|--------|-------------|
| ▶️ Play | Click to start playback | Plays the AI response or resumes from pause |
| ⏸️ Pause | Click while playing | Pauses the audio without stopping (shows when playing) |
| ⏹️ Stop | Click while playing/paused | Stops and resets to beginning (shows when playing/paused) |

### Progress Bar

- **Visual Progress**: Shows current playback position in green
- **Time Display**: Shows `current / total` duration (e.g., `0:15 / 1:30`)
- **Seekable**: Click anywhere on the progress bar to jump to that position
- **Hover Effect**: Bar highlights when hovering to indicate it's clickable

### States

1. **Idle** (no audio loaded):
   - Only Play button visible
   - Progress bar hidden

2. **Playing**:
   - Play button disabled (grayed out)
   - Pause button visible
   - Stop button visible (red)
   - Progress bar visible and updating in real-time

3. **Paused**:
   - Play button enabled (for resume)
   - Pause button hidden
   - Stop button visible
   - Progress bar visible (frozen at pause position)
   - Shows "Resume" tooltip on Play button

4. **Error**:
   - Error icon (alert circle) shown
   - Red text error message displayed
   - Play button disabled with error tooltip

## Usage Examples

### Play audio
1. Click the Play ▶️ button
2. Audio begins playing automatically
3. Progress bar shows current position

### Pause and resume
1. Click Pause ⏸️ while audio is playing
2. Audio pauses at current position
3. Click Play ▶️ to resume from pause point

### Stop and restart
1. Click Stop ⏹️ while playing or paused
2. Audio stops and resets to beginning
3. Click Play ▶️ to start from beginning

### Seek to specific time
1. Click anywhere on the progress bar
2. Audio jumps to that position
3. Continues playing if it was playing

### Keyboard shortcuts (future enhancement)
- Spacebar: Play/Pause toggle
- Escape: Stop

## Dark Mode

All controls support dark mode:
- Light mode: White background, dark text/icons
- Dark mode: Dark slate background, light text/icons
- Hover states adapt to theme

## Accessibility

- All buttons have title tooltips for screen readers
- Time display shows MM:SS format
- Progress bar is keyboard accessible (click-only in current version)
- Error messages displayed clearly in red

## Technical Details

### State Management

```javascript
const [isPlaying, setIsPlaying] = useState(false);  // Audio currently playing
const [isPaused, setIsPaused] = useState(false);    // Audio paused (not playing)
const [currentTime, setCurrentTime] = useState(0);  // Current playback position
const [duration, setDuration] = useState(0);        // Total audio duration
const [ttsError, setTtsError] = useState(null);     // Error message if any
```

### Audio Events

- `ontimeupdate`: Updates current time as audio plays
- `onloadedmetadata`: Gets total duration when audio loads
- `onplay`: Sets isPlaying when playback starts
- `onpause`: Sets isPaused when paused
- `onended`: Resets state when audio finishes
- `onerror`: Sets error state if audio fails

### Progress Bar Interaction

```javascript
// Click handler for seeking
onClick={(e) => {
  const percent = (e.clientX - rect.left) / rect.width;
  audioRef.current.currentTime = percent * duration;
}}
```

## Troubleshooting

### Audio won't start
- Check browser volume isn't muted
- Verify backend is running and API key is set
- Check browser console (F12) for errors

### Progress bar not updating
- Ensure audio is actually playing (look for timer)
- Check network tab to verify audio is streaming correctly

### Seek not working
- Audio must be fully loaded before seeking
- Wait a moment after clicking Play before seeking

### Button appears stuck
- Refresh the page
- Check browser console for JavaScript errors

## Future Enhancements

- [ ] Keyboard shortcuts (Spacebar, arrows)
- [ ] Volume slider
- [ ] Playback speed control (0.5x, 1x, 1.5x, 2x)
- [ ] Loop/repeat options
- [ ] Download audio button
- [ ] Fullscreen video mode (if video support added)
- [ ] Playlist support

---

Last Updated: January 13, 2026
