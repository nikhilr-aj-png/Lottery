/**
 * ============================================================================
 * WEB AUDIO PROCEDURAL SOUND ENGINE — EARNFLOW.IN (FOUR-DIGIT LOTTERY)
 * ============================================================================
 * 100% pure procedural Web Audio API synthesis.
 * Zero external .mp3/.wav asset downloads, 0 latency, offline-ready.
 * Implements lottery tactile audio: dial ticks, digit stops, ticket purchase,
 * and jackpot win fanfares.
 */

const STORAGE_KEY_ENABLED = 'ef_sound_enabled';
const STORAGE_KEY_VOLUME = 'ef_sound_volume';

export interface SoundFXEvent {
  enabled: boolean;
  volume: number;
}

export class SoundFXService {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  subscribers: Set<(state: SoundFXEvent) => void> = new Set();
  enabled: boolean;
  volume: number;

  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.subscribers = new Set();

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
  }

  private initContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return null;
      try {
        this.ctx = new AudioCtxClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      } catch (e) {
        console.warn('Web Audio API initialization failed:', e);
        return null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getVolume(): number {
    return this.volume;
  }

  toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  setEnabled(val: boolean): void {
    this.enabled = Boolean(val);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY_ENABLED, String(this.enabled));
      } catch (e) {}
    }
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime);
    }
    this.notify();
  }

  setVolume(val: number | string): void {
    const num = Math.max(0, Math.min(1, parseFloat(String(val)) || 0));
    this.volume = num;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY_VOLUME, String(this.volume));
      } catch (e) {}
    }
    if (this.ctx && this.masterGain && this.enabled) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
    this.notify();
  }

  subscribe(callback: (state: SoundFXEvent) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify(): void {
    const payload: SoundFXEvent = { enabled: this.enabled, volume: this.volume };
    this.subscribers.forEach(cb => {
      try { cb(payload); } catch (e) {}
    });
  }

  playClick(): void {
    if (!this.enabled) return;
    const ctx = this.initContext();
    if (!ctx || !this.masterGain) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {}
  }

  playDialTick(): void {
    if (!this.enabled) return;
    const ctx = this.initContext();
    if (!ctx || !this.masterGain) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(700, now + 0.03);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.03);
    } catch (e) {}
  }

  playDialStop(idx = 0): void {
    if (!this.enabled) return;
    const ctx = this.initContext();
    if (!ctx || !this.masterGain) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      const baseFreq = 523.25 * Math.pow(1.12, idx % 4);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {}
  }

  playChipBet(): void {
    if (!this.enabled) return;
    const ctx = this.initContext();
    if (!ctx || !this.masterGain) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.exponentialRampToValueAtTime(1100, now + 0.08);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch (e) {}
  }

  playWinFanfare(tier: 'standard' | 'big' | 'jackpot' = 'standard'): void {
    if (!this.enabled) return;
    const ctx = this.initContext();
    if (!ctx || !this.masterGain) return;

    try {
      const chords = [523.25, 659.25, 783.99, 1046.50];
      const now = ctx.currentTime;

      chords.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.08;
        const dur = tier === 'jackpot' ? 0.6 : 0.35;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.35, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

        osc.connect(gain);
        gain.connect(this.masterGain!);

        osc.start(start);
        osc.stop(start + dur);
      });
    } catch (e) {}
  }
}

export const soundFX = new SoundFXService();
