// Procedural sound effects via the Web Audio API — no asset files needed.
// All synthesis is lazy and gated behind the first user gesture so it
// satisfies mobile autoplay policies.
import { getMuted, setMuted } from "./storage";

type Wave = OscillatorType;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = getMuted();

  /** Must be called from within a user-gesture handler. */
  resume(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    setMuted(this.muted);
    return this.muted;
  }

  private tone(
    freq: number,
    duration: number,
    type: Wave = "sine",
    gain = 0.3,
    slideTo?: number
  ): void {
    if (this.muted || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(env);
    env.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  pick(): void {
    this.tone(440, 0.06, "triangle", 0.14, 560);
  }

  place(): void {
    this.tone(330, 0.08, "triangle", 0.2, 440);
  }

  invalid(): void {
    this.tone(180, 0.12, "sawtooth", 0.16, 120);
  }

  clear(intensity: number): void {
    // Rising arpeggio that climbs with combo + streak intensity.
    const base = 520 + Math.min(intensity, 14) * 55;
    this.tone(base, 0.1, "square", 0.2, base * 1.4);
    this.tone(base * 1.5, 0.12, "triangle", 0.14, base * 2);
  }

  over(): void {
    this.tone(260, 0.5, "sawtooth", 0.28, 70);
  }

  start(): void {
    this.tone(523, 0.12, "triangle", 0.22, 784);
  }

  levelUp(): void {
    // Quick ascending triad.
    this.tone(523, 0.1, "triangle", 0.22, 659);
    this.tone(659, 0.12, "triangle", 0.22, 784);
    this.tone(784, 0.16, "triangle", 0.22, 1046);
  }

  ui(): void {
    this.tone(600, 0.05, "sine", 0.12, 720);
  }
}

export const audio = new AudioEngine();
