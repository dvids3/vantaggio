import type { SimEvent } from '../sim/types.ts';

/**
 * Todo el sonido se genera con WebAudio: cero archivos, arranque instantáneo.
 * Nada de comentarista, como quedó decidido: silbato, golpes, red y público.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;

    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.02);
    }
  }

  play(ev: SimEvent): void {
    if (!this.ctx || !this.master || this.muted) return;
    switch (ev.type) {
      case 'kick':
        this.thump(90 + ev.level * 22, 0.16);
        this.burst(0.06, 0.22, 1600, 5200, 0.9);
        break;
      case 'header':
        this.thump(180, 0.1);
        this.burst(0.05, 0.16, 900, 2600, 1.4);
        break;
      case 'bounce':
        this.thump(65, 0.05 + ev.power * 0.06);
        break;
      case 'land':
        this.thump(60, 0.05 + ev.power * 0.05);
        break;
      case 'dash':
        this.burst(0.16, 0.14, 500, 3400, 0.7);
        break;
      case 'post':
        this.clang();
        break;
      case 'goal':
        this.goal();
        break;
      case 'whistle':
        this.whistle();
        break;
    }
  }

  // ---------------------------------------------------------------- sintesis

  private tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    dur: number,
    gain: number,
    delay = 0,
  ): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master!);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private burst(dur: number, gain: number, f0: number, f1: number, q: number, delay = 0): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf!;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = q;
    filter.frequency.setValueAtTime(f0, t0);
    filter.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(g).connect(this.master!);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  private thump(freq: number, gain: number): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.45, t0 + 0.12);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    osc.connect(g).connect(this.master!);
    osc.start(t0);
    osc.stop(t0 + 0.18);
  }

  private clang(): void {
    this.tone('triangle', 1420, 1280, 0.5, 0.16);
    this.tone('triangle', 2130, 1980, 0.4, 0.1);
    this.burst(0.04, 0.2, 3000, 6000, 1.2);
  }

  private goal(): void {
    // coro del estadio
    this.burst(1.5, 0.3, 420, 1100, 0.4);
    this.burst(1.2, 0.16, 900, 2200, 0.5);
    // acorde ascendente
    this.tone('triangle', 392, 392, 0.5, 0.12);
    this.tone('triangle', 523, 523, 0.5, 0.1, 0.07);
    this.tone('triangle', 659, 659, 0.6, 0.1, 0.14);
  }

  private whistle(): void {
    this.tone('square', 2050, 2150, 0.13, 0.055);
    this.tone('square', 2050, 2120, 0.09, 0.05, 0.16);
  }
}
