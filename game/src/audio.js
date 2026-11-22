// Sound, all synthesized with WebAudio — no audio files, no network. A
// small helper plays short oscillator bleeps; the game calls it for
// pickups, alerts, the bust, the getaway and the lockpick ticks.

export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (!context) {
      try {
        const Ctor = window.AudioContext ?? window.webkitAudioContext;
        context = new Ctor();
      } catch {
        context = null;
      }
    }
    if (context && context.state === 'suspended') context.resume().catch(() => {});
    return context;
  }

  function tone(freq, seconds, type, gainValue, when = 0) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(gainValue, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.05);
  }

  return {
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    /** Call from any user gesture so the browser unlocks audio. */
    unlock() {
      ensure();
    },
    click() {
      tone(660, 0.07, 'square', 0.05);
    },
    pickup() {
      tone(880, 0.1, 'sine', 0.09);
      tone(1318, 0.14, 'sine', 0.07, 0.07);
    },
    lockTick() {
      tone(1200, 0.04, 'square', 0.04);
    },
    lockDone() {
      tone(523, 0.1, 'sine', 0.09);
      tone(784, 0.12, 'sine', 0.09, 0.08);
      tone(1046, 0.18, 'sine', 0.09, 0.16);
    },
    noise() {
      tone(320, 0.12, 'triangle', 0.08);
      tone(240, 0.14, 'triangle', 0.06, 0.08);
    },
    emp() {
      tone(1500, 0.25, 'sawtooth', 0.05);
      tone(700, 0.3, 'sawtooth', 0.05, 0.1);
    },
    spotted() {
      tone(220, 0.22, 'sawtooth', 0.09);
      tone(311, 0.26, 'sawtooth', 0.09, 0.12);
    },
    laser() {
      tone(1800, 0.08, 'square', 0.06);
    },
    caught() {
      tone(160, 0.4, 'sawtooth', 0.12);
      tone(110, 0.5, 'sawtooth', 0.12, 0.2);
    },
    win() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'sine', 0.09, i * 0.1));
    },
    levelClear() {
      [392, 523, 659].forEach((f, i) => tone(f, 0.15, 'sine', 0.08, i * 0.09));
    },
  };
}
