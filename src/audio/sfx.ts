/** Synthesised sound effects. Every function is a safe no-op before audio unlock. */
import * as Tone from 'tone';
import { audio } from './engine';

interface Kit {
  noise: Tone.NoiseSynth;
  noiseFilter: Tone.Filter;
  thump: Tone.MembraneSynth;
  bell: Tone.PolySynth<Tone.Synth>;
  pluck: Tone.PluckSynth;
  fm: Tone.FMSynth;
  ui: Tone.Synth;
  metal: Tone.MetalSynth;
  chords: Tone.PolySynth<Tone.Synth>;
  bass: Tone.Synth;
}

let kit: Kit | null = null;

function build(): Kit | null {
  const buses = audio.getBuses();
  if (!buses) return null;
  const out = buses.sfx;
  const verb = new Tone.Gain(0.35).connect(buses.reverb);

  const noiseFilter = new Tone.Filter({ frequency: 1200, type: 'lowpass', Q: 0.7 }).connect(out);
  const noise = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.002, decay: 0.08, sustain: 0, release: 0.02 },
    volume: -14,
  }).connect(noiseFilter);

  const thump = new Tone.MembraneSynth({
    pitchDecay: 0.03,
    octaves: 4,
    envelope: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.05 },
    volume: -12,
  }).connect(out);

  const bell = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.004, decay: 0.35, sustain: 0.05, release: 0.6 },
    volume: -10,
  });
  bell.connect(out);
  bell.connect(verb);

  const pluck = new Tone.PluckSynth({
    attackNoise: 0.8,
    dampening: 3200,
    resonance: 0.92,
    volume: -6,
  });
  pluck.connect(out);
  pluck.connect(verb);

  const fm = new Tone.FMSynth({
    harmonicity: 2.5,
    modulationIndex: 14,
    oscillator: { type: 'sawtooth' },
    modulation: { type: 'square' },
    envelope: { attack: 0.005, decay: 0.14, sustain: 0, release: 0.05 },
    modulationEnvelope: { attack: 0.005, decay: 0.08, sustain: 0.1, release: 0.05 },
    volume: -14,
  }).connect(out);

  const ui = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.003, decay: 0.08, sustain: 0, release: 0.05 },
    volume: -16,
  }).connect(out);

  const metal = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.12, release: 0.05 },
    harmonicity: 5.1,
    modulationIndex: 24,
    resonance: 3200,
    octaves: 1.2,
    volume: -26,
  }).connect(out);

  const chords = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsawtooth', count: 3, spread: 18 } as Tone.OmniOscillatorOptions,
    envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.8 },
    volume: -18,
  });
  chords.connect(out);
  chords.connect(verb);

  const bass = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.3, release: 0.4 },
    volume: -12,
  }).connect(out);

  return { noise, noiseFilter, thump, bell, pluck, fm, ui, metal, chords, bass };
}

function k(): Kit | null {
  if (!audio.sfxOn) return null;
  if (!kit) kit = build();
  return kit;
}

const safe = (fn: () => void): void => {
  try {
    fn();
  } catch {
    /* ignore scheduling errors (e.g. timing collisions) */
  }
};

let stepToggle = false;

export const sfx = {
  step(): void {
    const s = k();
    if (!s) return;
    safe(() => {
      const t = Tone.now();
      stepToggle = !stepToggle;
      s.noiseFilter.frequency.setValueAtTime(stepToggle ? 900 : 1100, t);
      s.noise.envelope.decay = 0.06;
      s.noise.triggerAttackRelease(0.04, t);
      s.thump.triggerAttackRelease(stepToggle ? 'C2' : 'D2', 0.05, t, 0.25);
    });
  },

  push(): void {
    const s = k();
    if (!s) return;
    safe(() => {
      const t = Tone.now();
      s.noiseFilter.frequency.setValueAtTime(500, t);
      s.noiseFilter.frequency.linearRampToValueAtTime(260, t + 0.22);
      s.noise.envelope.decay = 0.22;
      s.noise.triggerAttackRelease(0.2, t, 0.9);
      s.thump.triggerAttackRelease('A1', 0.12, t, 0.5);
    });
  },

  bump(): void {
    const s = k();
    if (!s) return;
    safe(() => {
      const t = Tone.now();
      s.thump.triggerAttackRelease('E2', 0.08, t, 0.7);
      s.noiseFilter.frequency.setValueAtTime(700, t);
      s.noise.envelope.decay = 0.05;
      s.noise.triggerAttackRelease(0.03, t, 0.5);
    });
  },

  keyPickup(): void {
    const s = k();
    if (!s) return;
    safe(() => {
      const t = Tone.now();
      ['C5', 'E5', 'G5', 'C6'].forEach((n, i) =>
        s.bell.triggerAttackRelease(n, 0.3, t + i * 0.07, 0.7),
      );
    });
  },

  unlock(): void {
    const s = k();
    if (!s) return;
    safe(() => {
      const t = Tone.now();
      s.metal.triggerAttackRelease('C4', 0.08, t, 0.8);
      s.metal.triggerAttackRelease('G4', 0.06, t + 0.09, 0.6);
      ['G5', 'B5', 'D6', 'G6'].forEach((n, i) =>
        s.bell.triggerAttackRelease(n, 0.4, t + 0.16 + i * 0.06, 0.55),
      );
    });
  },

  locked(): void {
    const s = k();
    if (!s) return;
    safe(() => {
      const t = Tone.now();
      s.metal.triggerAttackRelease('C3', 0.05, t, 0.6);
      s.thump.triggerAttackRelease('F1', 0.1, t, 0.5);
    });
  },

  buttonPress(): void {
    const s = k();
    if (!s) return;
    safe(() => {
      const t = Tone.now();
      s.ui.triggerAttackRelease('E4', 0.05, t, 0.9);
      s.ui.triggerAttackRelease('C4', 0.08, t + 0.06, 0.9);
      s.thump.triggerAttackRelease('C2', 0.06, t, 0.3);
    });
  },

  buttonRelease(): void {
    const s = k();
    if (!s) return;
    safe(() => {
      const t = Tone.now();
      s.ui.triggerAttackRelease('C4', 0.05, t, 0.6);
      s.ui.triggerAttackRelease('E4', 0.06, t + 0.06, 0.6);
    });
  },

  doorOpen(): void {
    const s = k();
    if (!s) return;
    safe(() => {
      const t = Tone.now();
      s.noiseFilter.frequency.setValueAtTime(300, t);
      s.noiseFilter.frequency.exponentialRampToValueAtTime(2400, t + 0.35);
      s.noise.envelope.decay = 0.32;
      s.noise.triggerAttackRelease(0.3, t, 0.7);
      s.bell.triggerAttackRelease('E5', 0.25, t + 0.28, 0.4);
      s.bell.triggerAttackRelease('B5', 0.25, t + 0.34, 0.4);
    });
  },

  doorClose(): void {
    const s = k();
    if (!s) return;
    safe(() => {
      const t = Tone.now();
      s.noiseFilter.frequency.setValueAtTime(2000, t);
      s.noiseFilter.frequency.exponentialRampToValueAtTime(300, t + 0.25);
      s.noise.envelope.decay = 0.24;
      s.noise.triggerAttackRelease(0.22, t, 0.7);
      s.thump.triggerAttackRelease('G1', 0.1, t + 0.22, 0.6);
    });
  },

  treat(): void {
    const s = k();
    if (!s) return;
    safe(() => {
      const t = Tone.now();
      s.pluck.triggerAttack('A5', t);
      s.pluck.triggerAttack('E6', t + 0.08);
      s.bell.triggerAttackRelease('A6', 0.2, t + 0.12, 0.3);
    });
  },

  bark(): void {
    const s = k();
    if (!s) return;
    safe(() => {
      const t = Tone.now();
      s.fm.triggerAttackRelease('A3', 0.11, t, 0.9);
      s.fm.triggerAttackRelease('G3', 0.09, t + 0.13, 0.7);
    });
  },

  undo(): void {
    const s = k();
    if (!s) return;
    safe(() => {
      const t = Tone.now();
      s.ui.triggerAttackRelease('G4', 0.05, t, 0.8);
      s.ui.triggerAttackRelease('D4', 0.08, t + 0.06, 0.8);
    });
  },

  uiClick(): void {
    const s = k();
    if (!s) return;
    safe(() => {
      const t = Tone.now();
      s.ui.triggerAttackRelease('C6', 0.04, t, 0.7);
    });
  },

  uiBack(): void {
    const s = k();
    if (!s) return;
    safe(() => {
      const t = Tone.now();
      s.ui.triggerAttackRelease('G5', 0.04, t, 0.7);
      s.ui.triggerAttackRelease('C5', 0.06, t + 0.05, 0.7);
    });
  },

  star(index: number): void {
    const s = k();
    if (!s) return;
    safe(() => {
      const notes = ['C6', 'E6', 'G6'];
      s.bell.triggerAttackRelease(notes[index % 3]!, 0.5, Tone.now(), 0.8);
    });
  },

  win(): void {
    const s = k();
    if (!s) return;
    safe(() => {
      const t = Tone.now();
      const seq: Array<[string[], string, number]> = [
        [['C4', 'E4', 'G4'], 'C2', 0],
        [['F4', 'A4', 'C5'], 'F2', 0.22],
        [['G4', 'B4', 'D5'], 'G2', 0.44],
        [['C5', 'E5', 'G5', 'C6'], 'C3', 0.66],
      ];
      for (const [chord, bassNote, dt] of seq) {
        s.chords.triggerAttackRelease(chord, dt === 0.66 ? 1.2 : 0.25, t + dt, 0.8);
        s.bass.triggerAttackRelease(bassNote, dt === 0.66 ? 1.0 : 0.22, t + dt, 0.8);
      }
      ['C6', 'E6', 'G6', 'C7'].forEach((n, i) =>
        s.bell.triggerAttackRelease(n, 0.5, t + 0.7 + i * 0.08, 0.6),
      );
    });
  },

  fail(): void {
    const s = k();
    if (!s) return;
    safe(() => {
      const t = Tone.now();
      s.chords.triggerAttackRelease(['C4', 'Eb4', 'Gb4'], 0.5, t, 0.6);
    });
  },
};
