/**
 * Tone.js bootstrap. The AudioContext can only start after a user gesture,
 * so scenes call `audio.unlock()` from the first pointer/keyboard event.
 */
import * as Tone from 'tone';
import { loadSave, setAudioSettings } from '../save';

export interface Buses {
  master: Tone.Limiter;
  compressor: Tone.Compressor;
  music: Tone.Volume;
  sfx: Tone.Volume;
  reverb: Tone.Reverb;
}

class AudioEngine {
  private buses: Buses | null = null;
  private starting: Promise<void> | null = null;
  musicOn = true;
  sfxOn = true;
  private readonly listeners = new Set<() => void>();

  constructor() {
    const save = loadSave();
    this.musicOn = save.musicOn;
    this.sfxOn = save.sfxOn;
  }

  get ready(): boolean {
    return this.buses !== null;
  }

  /** Called on the first user gesture. Safe to call repeatedly. */
  unlock(): Promise<void> {
    if (this.buses) return Promise.resolve();
    if (this.starting) return this.starting;
    this.starting = (async () => {
      try {
        await Tone.start();
      } catch {
        /* context may already be running */
      }
      const master = new Tone.Limiter(-1).toDestination();
      const compressor = new Tone.Compressor({
        threshold: -18,
        ratio: 3,
        attack: 0.01,
        release: 0.2,
      });
      compressor.connect(master);
      const reverb = new Tone.Reverb({ decay: 2.6, preDelay: 0.02, wet: 1 });
      reverb.connect(compressor);
      const music = new Tone.Volume(this.musicOn ? -8 : -Infinity);
      music.connect(compressor);
      const sfx = new Tone.Volume(this.sfxOn ? -4 : -Infinity);
      sfx.connect(compressor);
      this.buses = { master, compressor, music, sfx, reverb };
      // Reverb impulse generation is async; generate in the background.
      void reverb.ready.catch(() => undefined);
      this.listeners.forEach((fn) => fn());
      this.listeners.clear();
    })();
    return this.starting;
  }

  /** Run a callback once the engine is ready (immediately if it already is). */
  whenReady(fn: () => void): void {
    if (this.buses) fn();
    else this.listeners.add(fn);
  }

  getBuses(): Buses | null {
    return this.buses;
  }

  setMusicOn(on: boolean): void {
    this.musicOn = on;
    setAudioSettings({ musicOn: on });
    if (this.buses) this.buses.music.volume.rampTo(on ? -8 : -Infinity, 0.25);
  }

  setSfxOn(on: boolean): void {
    this.sfxOn = on;
    setAudioSettings({ sfxOn: on });
    if (this.buses) this.buses.sfx.volume.value = on ? -4 : -Infinity;
  }

  /** Duck / restore the music bus (e.g. while the page is hidden). */
  setSuspended(suspended: boolean): void {
    if (!this.buses) return;
    const target = suspended ? -Infinity : this.musicOn ? -8 : -Infinity;
    this.buses.music.volume.rampTo(target, 0.2);
    if (suspended) Tone.getTransport().pause();
    else if (Tone.getTransport().state !== 'started') Tone.getTransport().start();
  }

  now(): number {
    return Tone.now();
  }
}

export const audio = new AudioEngine();

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    audio.setSuspended(document.hidden);
  });
}
