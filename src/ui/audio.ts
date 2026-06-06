// Procedural audio: SFX + a gentle generative BGM loop via the Web Audio
// API (no asset files). Everything is gated behind the first user gesture
// to satisfy mobile autoplay policies, and respects the sound/music settings.
type Wave = OscillatorType;

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;

  private soundOn = true;
  private musicOn = true;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private step = 0;

  // A calm pentatonic arpeggio (Hz) that loops under the gameplay.
  private readonly pattern = [
    261.63, 329.63, 392.0, 440.0, 392.0, 329.63, 293.66, 349.23, 440.0, 392.0,
  ];

  resume(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.6;
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 1;
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.28;
      this.musicBus.connect(this.master);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    if (this.musicOn) this.startMusic();
  }

  setSound(on: boolean): void {
    this.soundOn = on;
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  private tone(
    bus: GainNode | null,
    freq: number,
    duration: number,
    type: Wave,
    gain: number,
    slideTo?: number
  ): void {
    if (!this.ctx || !bus) return;
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
    env.connect(bus);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private sfx(freq: number, duration: number, type: Wave, gain: number, slideTo?: number): void {
    if (!this.soundOn) return;
    this.tone(this.sfxBus, freq, duration, type, gain, slideTo);
  }

  // ---- SFX ----
  pick(): void {
    this.sfx(440, 0.06, "triangle", 0.14, 560);
  }
  place(): void {
    this.sfx(330, 0.08, "triangle", 0.2, 440);
  }
  invalid(): void {
    this.sfx(180, 0.12, "sawtooth", 0.16, 120);
  }
  clear(intensity: number): void {
    const base = 520 + Math.min(intensity, 14) * 55;
    this.sfx(base, 0.1, "square", 0.2, base * 1.4);
    this.sfx(base * 1.5, 0.12, "triangle", 0.14, base * 2);
  }
  over(): void {
    this.sfx(260, 0.5, "sawtooth", 0.28, 70);
  }
  levelUp(): void {
    this.sfx(523, 0.1, "triangle", 0.22, 659);
    this.sfx(659, 0.12, "triangle", 0.22, 784);
    this.sfx(784, 0.16, "triangle", 0.22, 1046);
  }
  ui(): void {
    this.sfx(600, 0.05, "sine", 0.12, 720);
  }
  start(): void {
    this.sfx(523, 0.12, "triangle", 0.22, 784);
  }

  // ---- BGM ----
  private startMusic(): void {
    if (this.musicTimer || !this.ctx || !this.musicOn) return;
    this.musicTimer = setInterval(() => {
      const f = this.pattern[this.step % this.pattern.length];
      this.step++;
      this.tone(this.musicBus, f, 0.45, "sine", 0.5);
      if (this.step % 4 === 0) this.tone(this.musicBus, f / 2, 0.6, "triangle", 0.35);
    }, 320);
  }

  private stopMusic(): void {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

export const audio = new AudioManager();
