/** Procedural music loops sequenced on the Tone.js Transport. */
import * as Tone from 'tone';
import { audio } from './engine';

export type TrackName = 'menu' | 'game';

interface Track {
  name: TrackName;
  gain: Tone.Gain;
  disposables: Array<{ dispose: () => void; stop?: (t?: number) => unknown }>;
}

const N = null;

/** Tone throws when two events land on one mono voice at the same time; never let that escape. */
function guard(fn: () => void): void {
  try {
    fn();
  } catch {
    /* ignore */
  }
}

function buildMenu(out: Tone.Gain, reverb: Tone.Reverb): Track['disposables'] {
  const send = new Tone.Gain(0.6).connect(reverb);
  const d: Track['disposables'] = [send];

  const pad = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 1.2, decay: 0.6, sustain: 0.7, release: 2.4 },
    volume: -20,
  });
  const padFilter = new Tone.Filter({ frequency: 1400, type: 'lowpass', Q: 0.5 });
  pad.connect(padFilter);
  padFilter.connect(out);
  padFilter.connect(send);
  d.push(pad, padFilter);

  const chords: Array<[string, string[]]> = [
    ['0:0:0', ['C3', 'E3', 'G3', 'B3']],
    ['1:0:0', ['A2', 'C3', 'E3', 'G3']],
    ['2:0:0', ['F2', 'A2', 'C3', 'E3']],
    ['3:0:0', ['G2', 'B2', 'D3', 'E3']],
  ];
  const chordPart = new Tone.Part(
    (time, value) => {
      guard(() => pad.triggerAttackRelease(value.notes, '1m', time, 0.8));
    },
    chords.map(([time, notes]) => ({ time, notes })),
  );
  chordPart.loop = true;
  chordPart.loopEnd = '4m';
  chordPart.start(0);
  d.push(chordPart);

  const box = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.005, decay: 0.5, sustain: 0, release: 0.4 },
    volume: -14,
  });
  const boxHi = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.005, decay: 0.3, sustain: 0, release: 0.2 },
    volume: -26,
  });
  box.connect(out);
  box.connect(send);
  boxHi.connect(out);
  boxHi.connect(send);
  d.push(box, boxHi);

  const melody = [
    'E5',
    N,
    'G5',
    N,
    'C6',
    N,
    'B5',
    N,
    'A5',
    N,
    N,
    N,
    'G5',
    N,
    'E5',
    N,
    'F5',
    N,
    'A5',
    N,
    'C6',
    N,
    'A5',
    N,
    'G5',
    N,
    N,
    N,
    'E5',
    N,
    'D5',
    N,
  ];
  const melSeq = new Tone.Sequence(
    (time, note) => {
      if (!note) return;
      guard(() => box.triggerAttackRelease(note, '8n', time, 0.9));
      guard(() =>
        boxHi.triggerAttackRelease(Tone.Frequency(note).transpose(12).toNote(), '16n', time, 0.6),
      );
    },
    melody,
    '8n',
  );
  melSeq.start(0);
  d.push(melSeq);

  const bass = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.02, decay: 0.4, sustain: 0.4, release: 0.6 },
    volume: -16,
  }).connect(out);
  d.push(bass);
  const bassSeq = new Tone.Sequence(
    (time, note) => {
      if (note) guard(() => bass.triggerAttackRelease(note, '4n', time, 0.8));
    },
    ['C2', N, 'G2', N, 'A2', N, 'E2', N, 'F2', N, 'C3', N, 'G2', N, 'D3', N],
    '4n',
  );
  bassSeq.start(0);
  d.push(bassSeq);

  // Gentle sparkles (own synth so it never collides with the melody voice).
  const sparkleSynth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.005, decay: 0.4, sustain: 0, release: 0.3 },
    volume: -28,
  });
  sparkleSynth.connect(out);
  sparkleSynth.connect(send);
  d.push(sparkleSynth);
  const sparkle = new Tone.Loop((time) => {
    if (Math.random() < 0.35) {
      const notes = ['C7', 'E7', 'G6', 'B6', 'D7'];
      guard(() =>
        sparkleSynth.triggerAttackRelease(
          notes[Math.floor(Math.random() * notes.length)]!,
          '16n',
          time + 0.01,
          0.35,
        ),
      );
    }
  }, '2n');
  sparkle.start(0);
  d.push(sparkle);

  return d;
}

function buildGame(out: Tone.Gain, reverb: Tone.Reverb): Track['disposables'] {
  const send = new Tone.Gain(0.4).connect(reverb);
  const d: Track['disposables'] = [send];

  const pluck = new Tone.PluckSynth({
    attackNoise: 0.6,
    dampening: 2600,
    resonance: 0.9,
    volume: -8,
  });
  pluck.connect(out);
  pluck.connect(send);
  d.push(pluck);

  const arp = [
    'A3',
    'C4',
    'E4',
    'A4',
    'E4',
    'C4',
    'A3',
    'C4',
    'F3',
    'A3',
    'C4',
    'F4',
    'C4',
    'A3',
    'F3',
    'A3',
    'C3',
    'E3',
    'G3',
    'C4',
    'G3',
    'E3',
    'C3',
    'E3',
    'G3',
    'B3',
    'D4',
    'G4',
    'D4',
    'B3',
    'G3',
    'B3',
  ];
  const arpSeq = new Tone.Sequence(
    (time, note) => {
      guard(() => pluck.triggerAttack(note, time));
    },
    arp,
    '8n',
  );
  arpSeq.start(0);
  d.push(arpSeq);

  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 5,
    envelope: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.1 },
    volume: -14,
  }).connect(out);
  d.push(kick);
  const kickSeq = new Tone.Sequence(
    (time, hit) => {
      if (hit) guard(() => kick.triggerAttackRelease('C1', '8n', time, hit));
    },
    [0.9, N, 0.6, N, 0.9, N, 0.6, 0.4],
    '4n',
  );
  kickSeq.start(0);
  d.push(kickSeq);

  const hatFilter = new Tone.Filter({ frequency: 6000, type: 'highpass' }).connect(out);
  const hat = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
    volume: -28,
  }).connect(hatFilter);
  d.push(hat, hatFilter);
  const hatSeq = new Tone.Sequence(
    (time, v) => {
      if (v) guard(() => hat.triggerAttackRelease('16n', time, v));
    },
    [N, 0.7, 0.3, 0.7, N, 0.7, 0.3, 0.9],
    '8n',
  );
  hatSeq.start(0);
  d.push(hatSeq);

  const pad = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.6, decay: 0.4, sustain: 0.6, release: 1.4 },
    volume: -24,
  });
  pad.connect(out);
  pad.connect(send);
  d.push(pad);
  const padPart = new Tone.Part(
    (time, value) => guard(() => pad.triggerAttackRelease(value.notes, '1m', time, 0.7)),
    [
      { time: '0:0:0', notes: ['A3', 'C4', 'E4'] },
      { time: '1:0:0', notes: ['F3', 'A3', 'C4'] },
      { time: '2:0:0', notes: ['C4', 'E4', 'G4'] },
      { time: '3:0:0', notes: ['G3', 'B3', 'D4'] },
    ],
  );
  padPart.loop = true;
  padPart.loopEnd = '4m';
  padPart.start(0);
  d.push(padPart);

  const lead = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.02, decay: 0.25, sustain: 0.2, release: 0.3 },
    volume: -18,
  });
  lead.connect(out);
  lead.connect(send);
  d.push(lead);
  const leadPart = new Tone.Part(
    (time, value) => guard(() => lead.triggerAttackRelease(value.n, value.d, time, 0.8)),
    [
      { time: '0:0:0', n: 'E5', d: '8n' },
      { time: '0:1:0', n: 'C5', d: '8n' },
      { time: '0:2:0', n: 'A4', d: '4n' },
      { time: '1:0:0', n: 'F5', d: '8n' },
      { time: '1:1:2', n: 'E5', d: '8n' },
      { time: '1:2:0', n: 'C5', d: '4n' },
      { time: '2:0:0', n: 'G5', d: '8n' },
      { time: '2:1:0', n: 'E5', d: '8n' },
      { time: '2:2:0', n: 'C5', d: '8n' },
      { time: '2:3:0', n: 'D5', d: '8n' },
      { time: '3:0:0', n: 'B4', d: '4n' },
      { time: '3:2:0', n: 'G4', d: '4n' },
      { time: '7:0:0', n: 'A5', d: '8n' },
      { time: '7:1:0', n: 'G5', d: '8n' },
      { time: '7:2:0', n: 'E5', d: '4n' },
    ],
  );
  leadPart.loop = true;
  leadPart.loopEnd = '8m';
  leadPart.start(0);
  d.push(leadPart);

  return d;
}

class MusicPlayer {
  private current: Track | null = null;
  private wanted: TrackName | null = null;

  play(name: TrackName): void {
    this.wanted = name;
    audio.whenReady(() => this.apply());
  }

  stop(): void {
    this.wanted = null;
    audio.whenReady(() => this.apply());
  }

  private apply(): void {
    const buses = audio.getBuses();
    if (!buses) return;
    if (this.current?.name === this.wanted) return;

    const transport = Tone.getTransport();
    const old = this.current;
    if (old) {
      old.gain.gain.rampTo(0, 0.7);
      const toDispose = old;
      setTimeout(() => {
        toDispose.disposables.forEach((x) => {
          try {
            x.stop?.();
          } catch {
            /* noop */
          }
          x.dispose();
        });
        toDispose.gain.dispose();
      }, 900);
      this.current = null;
    }

    if (!this.wanted) {
      if (transport.state === 'started') transport.stop();
      return;
    }

    const gain = new Tone.Gain(0).connect(buses.music);
    const name = this.wanted;
    transport.bpm.value = name === 'menu' ? 76 : 98;
    transport.stop();
    transport.position = 0;
    const disposables =
      name === 'menu' ? buildMenu(gain, buses.reverb) : buildGame(gain, buses.reverb);
    transport.start('+0.05');
    gain.gain.rampTo(1, 1.2);
    this.current = { name, gain, disposables };
  }
}

export const music = new MusicPlayer();
