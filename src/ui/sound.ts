/**
 * Tiny synthesised sound effects (no audio files to download).
 * Browsers only allow sound after a tap, which is exactly when these play.
 */

type AudioCtor = typeof AudioContext;
let context: AudioContext | null = null;

const audio = (): AudioContext | null => {
  if (context) return context;
  const Ctor: AudioCtor | undefined = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    return null;
  }
  return context;
};

const SOUND_KEY = "darty-golf:sound";

export const soundEnabled = (): boolean => {
  try {
    return window.localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
};

export const setSoundEnabled = (on: boolean): void => {
  try {
    window.localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // Not remembered, but still applies for this visit via the caller's state.
  }
};

/** A short noise burst through a low filter: the "thock" of a dart into sisal. */
const thock = (ctx: AudioContext, at: number, volume: number, pitch: number) => {
  const length = Math.floor(ctx.sampleRate * 0.09);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 4);
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = pitch;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  // Not chained: on iOS 12 Safari, connect() returns undefined.
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(at);
};

const tone = (ctx: AudioContext, at: number, frequency: number, duration: number, volume: number) => {
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = frequency;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(at);
  osc.stop(at + duration + 0.05);
};

export type ThrowSound = "hit" | "ace" | "bounce";

export const playThrow = (kind: ThrowSound): void => {
  if (!soundEnabled()) return;
  const ctx = audio();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  const now = ctx.currentTime;
  if (kind === "bounce") {
    thock(ctx, now, 0.5, 2400);
    thock(ctx, now + 0.12, 0.25, 1800);
    tone(ctx, now + 0.05, 220, 0.25, 0.08);
    return;
  }
  thock(ctx, now, 0.9, 900);
  if (kind === "ace") [523, 659, 784, 1047].forEach((note, i) => tone(ctx, now + 0.12 + i * 0.09, note, 0.35, 0.12));
};
