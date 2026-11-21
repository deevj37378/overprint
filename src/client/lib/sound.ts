// Synthesised print-shop sounds (Web Audio, no files). Muted until the player turns sound on;
// suspended whenever the page is hidden.

type Listener = (on: boolean) => void;

let ctx: AudioContext | null = null;
let enabled = false;
const listeners = new Set<Listener>();

const audio = (): AudioContext | null => {
  if (!enabled) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
};

document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) void ctx.suspend();
  else if (enabled) void ctx.resume();
});

export const soundOn = (): boolean => enabled;

export const setSound = (on: boolean): void => {
  enabled = on;
  if (!on && ctx) void ctx.suspend();
  listeners.forEach((l) => l(on));
  if (on) thunk(0.5);
};

export const onSoundChange = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const noiseBurst = (
  ac: AudioContext,
  at: number,
  duration: number,
  freq: number,
  gain: number
) => {
  const frames = Math.floor(ac.sampleRate * duration);
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++)
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 3;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = freq;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(ac.destination);
  src.start(at);
};

const pop = (
  ac: AudioContext,
  at: number,
  from: number,
  to: number,
  gain: number,
  duration: number
) => {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(to, at + duration);
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(at);
  osc.stop(at + duration + 0.02);
};

/** A soft rubber-stamp thunk. */
export const thunk = (volume = 1): void => {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  noiseBurst(ac, t, 0.09, 900, 0.35 * volume);
  pop(ac, t, 140, 60, 0.5 * volume, 0.12);
};

/** A tiny paper tick for pick-up / rotate. */
export const tick = (): void => {
  const ac = audio();
  if (!ac) return;
  noiseBurst(ac, ac.currentTime, 0.025, 4000, 0.12);
};

/** The press "ka-chunk" on a win. */
export const kaChunk = (): void => {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  noiseBurst(ac, t, 0.06, 2500, 0.25);
  pop(ac, t, 320, 180, 0.25, 0.07);
  noiseBurst(ac, t + 0.16, 0.14, 700, 0.5);
  pop(ac, t + 0.16, 110, 45, 0.7, 0.22);
};
