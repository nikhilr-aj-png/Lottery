/**
 * ============================================================================
 * WEB AUDIO PROCEDURAL SOUND ENGINE — EARNFLOW.IN
 * ============================================================================
 * 100% pure procedural Web Audio API synthesis.
 * Zero external .mp3/.wav asset downloads, 0 latency, offline-ready.
 * Implements casino tactile audio: coin clinks, card slides, dice rolls,
 * mechanical reels, roulette friction, plinko pegs, rocket hum, and win fanfares.
 */

const STORAGE_KEY_ENABLED = 'ef_sound_enabled';
const STORAGE_KEY_VOLUME = 'ef_sound_volume';

export class SoundFXService {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.subscribers = new Set();
    this.crashHumOsc = null;
    this.crashHumGain = null;

    // Load persisted settings
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const storedEnabled = window.localStorage.getItem(STORAGE_KEY_ENABLED);
        this.enabled = storedEnabled !== null ? storedEnabled === 'true' : true;
        const storedVolume = window.localStorage.getItem(STORAGE_KEY_VOLUME);
        this.volume = storedVolume !== null ? Math.max(0, Math.min(1, parseFloat(storedVolume))) : 0.5;
      } catch (e) {
        this.enabled = true;
        this.volume = 0.5;
      }
    } else {
      this.enabled = true;
      this.volume = 0.5;
    }

    // Auto-bind user interaction to unlock suspended AudioContext
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      const unlockAudio = () => {
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
      };
      window.addEventListener('click', unlockAudio, { once: true, passive: true });
      window.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
      window.addEventListener('keydown', unlockAudio, { once: true, passive: true });
    }
  }

  /**
   * Lazy-initializes AudioContext and Master Gain
   */
  initContext() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    if (typeof window === 'undefined') return null;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    try {
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn('[SoundFX] Failed to initialize AudioContext:', e);
      return null;
    }

    return this.ctx;
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify() {
    this.subscribers.forEach(fn => {
      try {
        fn({
          enabled: this.enabled,
          volume: this.volume
        });
      } catch (err) {
        console.error('[SoundFX] Listener error:', err);
      }
    });
  }

  isEnabled() {
    return this.enabled;
  }

  setEnabled(val) {
    this.enabled = Boolean(val);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY_ENABLED, String(this.enabled));
      } catch (e) {}
    }

    if (this.ctx && this.masterGain) {
      const t = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(t);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, t);
      this.masterGain.gain.linearRampToValueAtTime(this.enabled ? this.volume : 0, t + 0.05);
    }

    this.notify();
  }

  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  getVolume() {
    return this.volume;
  }

  setVolume(newVol) {
    const clamped = Math.max(0, Math.min(1, parseFloat(newVol) || 0));
    this.volume = clamped;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY_VOLUME, String(this.volume));
      } catch (e) {}
    }

    if (this.ctx && this.masterGain && this.enabled) {
      const t = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(t);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, t);
      this.masterGain.gain.linearRampToValueAtTime(this.volume, t + 0.05);
    }

    this.notify();
  }

  /**
   * Helper: creates a white noise buffer
   */
  _createNoiseBuffer(duration = 0.5) {
    if (!this.ctx) return null;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // ==========================================================================
  // PROCEDURAL SOUND SYNTHESIZERS
  // ==========================================================================

  /**
   * 1. Crisp UI Button Click (Sine blip)
   */
  playClick() {
    if (!this.enabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(950, t);
      osc.frequency.exponentialRampToValueAtTime(450, t + 0.035);

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.035);
    } catch (e) {}
  }

  /**
   * 2. Flow Coin Chip Clink (Felt tap + metallic resonance)
   */
  playChipBet() {
    if (!this.enabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;

      // Layer 1: Filtered noise transient (felt tap)
      const noiseBuffer = this._createNoiseBuffer(0.03);
      if (noiseBuffer) {
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2800, t);
        filter.Q.setValueAtTime(3.0, t);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        noise.start(t);
        noise.stop(t + 0.03);
      }

      // Layer 2: High metallic ping (chip clack)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1650, t);
      osc.frequency.exponentialRampToValueAtTime(1400, t + 0.04);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.045);
    } catch (e) {}
  }

  /**
   * 3. Win Fanfare (Standard, Big Win, Jackpot)
   * Major chord arpeggios with bright harmonics and shimmer
   */
  playWinFanfare(tier = 'standard') {
    if (!this.enabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;

      let notes = [];
      let noteDuration = 0.12;
      let waveType = 'triangle';

      if (tier === 'jackpot') {
        // Multi-octave celebratory sequence: C5, E5, G5, C6, E6, G6, C7
        notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00];
        noteDuration = 0.15;
      } else if (tier === 'big') {
        // 5 notes: G4, C5, E5, G5, C6
        notes = [392.00, 523.25, 659.25, 783.99, 1046.50];
        noteDuration = 0.13;
      } else {
        // Standard: C5, E5, G5, C6
        notes = [523.25, 659.25, 783.99, 1046.50];
        noteDuration = 0.11;
      }

      notes.forEach((freq, idx) => {
        const start = t + (idx * noteDuration * 0.8);
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = waveType;
        osc.frequency.setValueAtTime(freq, start);

        // Harmonics shimmer (slight detune)
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 2.01, start);

        const decay = idx === notes.length - 1 ? 0.6 : 0.25;

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(0.35, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + decay);

        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(this.masterGain);

        osc.start(start);
        osc2.start(start);
        osc.stop(start + decay);
        osc2.stop(start + decay);
      });
    } catch (e) {}
  }

  /**
   * 4. Realistic Card Slide / Flip on Baize Felt
   * Filtered noise sweep from 1200Hz to 600Hz
   */
  playCardFlip() {
    if (!this.enabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const noiseBuffer = this._createNoiseBuffer(0.09);
      if (!noiseBuffer) return;

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, t);
      filter.frequency.exponentialRampToValueAtTime(650, t + 0.08);
      filter.Q.setValueAtTime(1.8, t);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.085);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      noise.start(t);
      noise.stop(t + 0.09);
    } catch (e) {}
  }

  /**
   * 5. Dice Roll Tumbler (3 to 4 rapid wooden micro-impacts with pitch jitter)
   */
  playDiceRoll() {
    if (!this.enabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const hits = [0, 0.035, 0.075, 0.12];

      hits.forEach((offset) => {
        const start = t + offset;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        const baseFreq = 420 + Math.random() * 220;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(baseFreq, start);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.6, start + 0.025);

        gain.gain.setValueAtTime(0.35, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.03);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(start);
        osc.stop(start + 0.035);
      });
    } catch (e) {}
  }

  /**
   * 6. Plinko Metallic Peg Ping (Pitch ascends with row depth)
   */
  playPlinkoBounce(row = 0) {
    if (!this.enabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const baseFreq = 400 + Math.min(row * 35, 650);

      const osc = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, t);

      overtone.type = 'sine';
      overtone.frequency.setValueAtTime(baseFreq * 2.76, t); // Brass pin chime harmonic

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

      osc.connect(gain);
      overtone.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      overtone.start(t);
      osc.stop(t + 0.075);
      overtone.stop(t + 0.075);
    } catch (e) {}
  }

  /**
   * 7. Plinko Bucket Land Ding
   */
  playPlinkoSlot(multiplier = 1) {
    if (!this.enabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      if (multiplier >= 1) {
        // Bright winning two-tone
        [1046.50, 1318.51].forEach((freq, idx) => {
          const start = t + idx * 0.08;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, start);

          gain.gain.setValueAtTime(0.3, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);

          osc.connect(gain);
          gain.connect(this.masterGain);

          osc.start(start);
          osc.stop(start + 0.25);
        });
      } else {
        // Soft wooden pocket drop
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(280, t);
        osc.frequency.exponentialRampToValueAtTime(140, t + 0.06);

        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(t);
        osc.stop(t + 0.065);
      }
    } catch (e) {}
  }

  /**
   * 8. Coinflip High Spinning Whistle / Flutter
   */
  playCoinflipToss() {
    if (!this.enabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const duration = 0.55;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';

      // Ringing high bell frequencies
      osc1.frequency.setValueAtTime(1920, t);
      osc2.frequency.setValueAtTime(2380, t);

      // Tremolo spin flutter (LFO effect)
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(22, t); // 22 revolutions per sec
      lfoGain.gain.setValueAtTime(140, t);
      lfo.connect(lfoGain);
      lfoGain.connect(osc1.frequency);
      lfoGain.connect(osc2.frequency);

      gain.gain.setValueAtTime(0.01, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.masterGain);

      lfo.start(t);
      osc1.start(t);
      osc2.start(t);

      lfo.stop(t + duration);
      osc1.stop(t + duration);
      osc2.stop(t + duration);
    } catch (e) {}
  }

  /**
   * 9. Coinflip Landing Impact (Snap + Win/Loss tone)
   */
  playCoinflipLand(isWin = true) {
    if (!this.enabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      // Landing tap
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1800, t);
      osc.frequency.exponentialRampToValueAtTime(900, t + 0.04);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.045);

      if (isWin) {
        // Triumphant ding
        const ding = ctx.createOscillator();
        const dingGain = ctx.createGain();
        ding.type = 'triangle';
        ding.frequency.setValueAtTime(1174.66, t + 0.05); // D6
        dingGain.gain.setValueAtTime(0.3, t + 0.05);
        dingGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

        ding.connect(dingGain);
        dingGain.connect(this.masterGain);
        ding.start(t + 0.05);
        ding.stop(t + 0.35);
      }
    } catch (e) {}
  }

  /**
   * 10. Crash Rocket Engine Thrust Hum
   * Modulates frequency upwards with current multiplier
   */
  playCrashHum(multiplier = 1.0) {
    if (!this.enabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const baseFreq = 70 + Math.min((multiplier - 1.0) * 45, 380);
      const t = ctx.currentTime;

      if (!this.crashHumOsc) {
        this.crashHumOsc = ctx.createOscillator();
        this.crashHumGain = ctx.createGain();

        this.crashHumOsc.type = 'sawtooth';
        this.crashHumOsc.frequency.setValueAtTime(baseFreq, t);

        // Lowpass filter to muffle harsh harmonics
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450, t);

        this.crashHumGain.gain.setValueAtTime(0.001, t);
        this.crashHumGain.gain.linearRampToValueAtTime(0.18, t + 0.1);

        this.crashHumOsc.connect(filter);
        filter.connect(this.crashHumGain);
        this.crashHumGain.connect(this.masterGain);

        this.crashHumOsc.start(t);
      } else {
        this.crashHumOsc.frequency.linearRampToValueAtTime(baseFreq, t + 0.05);
      }
    } catch (e) {}
  }

  /**
   * Stop Crash Rocket Engine Thrust Hum
   */
  stopCrashHum() {
    if (this.crashHumOsc && this.crashHumGain && this.ctx) {
      try {
        const t = this.ctx.currentTime;
        this.crashHumGain.gain.cancelScheduledValues(t);
        this.crashHumGain.gain.setValueAtTime(this.crashHumGain.gain.value, t);
        this.crashHumGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);

        setTimeout(() => {
          if (this.crashHumOsc) {
            try {
              this.crashHumOsc.stop();
              this.crashHumOsc.disconnect();
            } catch (err) {}
            this.crashHumOsc = null;
            this.crashHumGain = null;
          }
        }, 100);
      } catch (e) {
        this.crashHumOsc = null;
        this.crashHumGain = null;
      }
    }
  }

  /**
   * 11. Crash Rocket Explosion (Sub-bass drop + low-pass noise rumble)
   */
  playCrashExplosion() {
    this.stopCrashHum();
    if (!this.enabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;

      // Sub-bass thump (80Hz to 25Hz)
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(95, t);
      osc.frequency.exponentialRampToValueAtTime(25, t + 0.4);

      oscGain.gain.setValueAtTime(0.5, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

      osc.connect(oscGain);
      oscGain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.45);

      // Distorted noise burst
      const noiseBuffer = this._createNoiseBuffer(0.4);
      if (noiseBuffer) {
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, t);
        filter.frequency.exponentialRampToValueAtTime(120, t + 0.35);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        noise.start(t);
        noise.stop(t + 0.4);
      }
    } catch (e) {}
  }

  /**
   * 12. Crash Cashout / Cash Register Sparkle
   */
  playCrashCashout() {
    if (!this.enabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      [987.77, 1318.51, 1567.98].forEach((freq, idx) => {
        const start = t + idx * 0.05;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.3, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(start);
        osc.stop(start + 0.28);
      });
    } catch (e) {}
  }

  /**
   * 13. Slot Machine Spinning Ratchet Click
   */
  playSlotSpin() {
    if (!this.enabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const clicks = [0, 0.04, 0.08, 0.12];

      clicks.forEach(offset => {
        const start = t + offset;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(700 + Math.random() * 150, start);
        osc.frequency.exponentialRampToValueAtTime(250, start + 0.02);

        gain.gain.setValueAtTime(0.18, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.02);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(start);
        osc.stop(start + 0.025);
      });
    } catch (e) {}
  }

  /**
   * 14. Slot Machine Reel Stop Notch (Mechanical thump)
   */
  playSlotReelStop(reelIndex = 0) {
    if (!this.enabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const baseFreq = 280 - Math.min(reelIndex * 30, 80);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, t);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.4, t + 0.05);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.065);
    } catch (e) {}
  }

  /**
   * 15. Roulette Wheel Friction Spin
   */
  playRouletteSpin() {
    if (!this.enabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const ticks = [0, 0.03, 0.065, 0.105, 0.155, 0.215];

      ticks.forEach(offset => {
        const start = t + offset;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(850, start);
        osc.frequency.exponentialRampToValueAtTime(450, start + 0.015);

        gain.gain.setValueAtTime(0.2, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.015);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(start);
        osc.stop(start + 0.02);
      });
    } catch (e) {}
  }

  /**
   * 16. Roulette Pocket Drop (Ball landing in fret)
   */
  playRoulettePocket(number = null) {
    if (!this.enabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      // Double wooden tap
      [0, 0.06].forEach((offset, idx) => {
        const start = t + offset;
        const freq = idx === 0 ? 560 : 430;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, start + 0.035);

        gain.gain.setValueAtTime(idx === 0 ? 0.35 : 0.25, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.04);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(start);
        osc.stop(start + 0.045);
      });
    } catch (e) {}
  }

  /**
   * 17. Mines Tile Reveal (Crystalline sparkle if gem, boom if mine)
   */
  playMinesReveal(isGem = true) {
    if (!this.enabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;

      if (isGem) {
        // High sparkling crystalline chime
        const osc = ctx.createOscillator();
        const shimmer = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, t);
        osc.frequency.exponentialRampToValueAtTime(1950, t + 0.08);

        shimmer.type = 'triangle';
        shimmer.frequency.setValueAtTime(2800, t);

        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

        osc.connect(gain);
        shimmer.connect(gain);
        gain.connect(this.masterGain);

        osc.start(t);
        shimmer.start(t);
        osc.stop(t + 0.16);
        shimmer.stop(t + 0.16);
      } else {
        // Mine explosion boom
        this.playCrashExplosion();
      }
    } catch (e) {}
  }

  /**
   * 18. Limbo Fast Counter Tick
   */
  playLimboTick() {
    if (!this.enabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(500, t + 0.02);

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.025);
    } catch (e) {}
  }

  /**
   * 19. Keno Number Pick / Ball Pop
   */
  playKenoPick() {
    if (!this.enabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(350, t);
      osc.frequency.exponentialRampToValueAtTime(750, t + 0.04);

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.05);
    } catch (e) {}
  }

  /**
   * 20. Mechanical Lottery Dial Ratchet Tick
   */
  playDialTick() {
    if (!this.enabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(1100, t);
      osc.frequency.exponentialRampToValueAtTime(450, t + 0.015);

      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.015);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.02);
    } catch (e) {}
  }

  /**
   * 21. Mechanical Lottery Dial Locking Notch Stop
   */
  playDialStop(dialIndex = 0) {
    if (!this.enabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      // Heavy solenoid clamp
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(620 - dialIndex * 50, t);
      osc1.frequency.exponentialRampToValueAtTime(220, t + 0.04);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(180, t);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.masterGain);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.065);
      osc2.stop(t + 0.065);
    } catch (e) {}
  }
}

// Global Singleton Instance
export const soundFX = new SoundFXService();

