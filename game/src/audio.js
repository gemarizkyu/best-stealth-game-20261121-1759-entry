// All sound is synthesised with WebAudio: no audio files, no network. A tiny blip helper
// builds footsteps, pickups, the alarm sting and the win jingle out of plain oscillators.
export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (context === null) {
      try {
        const AudioContext = window.AudioContext ?? window.webkitAudioContext;
        context = new AudioContext();
      } catch {
        context = null;
      }
    }
    if (context !== null && context.state === 'suspended') context.resume().catch(() => {});
    return context;
  }

  function blip(frequency, seconds, type, gainValue, when = 0) {
    if (muted) return;
    const audio = ensure();
    if (audio === null) return;
    const start = audio.currentTime + when;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.02);
  }

  function footstep(sneaking) {
    blip(sneaking ? 140 : 190, 0.05, 'sine', sneaking ? 0.015 : 0.035);
  }

  function pickup() {
    blip(660, 0.09, 'triangle', 0.06);
    blip(990, 0.12, 'triangle', 0.06, 0.07);
  }

  function moonstone() {
    blip(523, 0.12, 'triangle', 0.07);
    blip(659, 0.12, 'triangle', 0.07, 0.1);
    blip(784, 0.2, 'triangle', 0.07, 0.2);
  }

  function alarm() {
    blip(220, 0.16, 'square', 0.05);
    blip(330, 0.16, 'square', 0.05, 0.16);
  }

  function caught() {
    blip(196, 0.25, 'sawtooth', 0.06);
    blip(131, 0.4, 'sawtooth', 0.06, 0.2);
  }

  function win() {
    [523, 659, 784, 1047].forEach((frequency, index) => blip(frequency, 0.18, 'triangle', 0.07, index * 0.12));
  }

  function toggleMute() {
    muted = !muted;
    return muted;
  }

  return { footstep, pickup, moonstone, alarm, caught, win, toggleMute };
}
