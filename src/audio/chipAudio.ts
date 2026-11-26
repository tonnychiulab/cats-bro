import { SfxId, TrackId } from '../core/types';

// MIDI 音高轉頻率（0 表示休止符）
function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

interface TrackSpec {
  bpm: number;
  lead: readonly number[];
  harmony: readonly number[];
  bass: readonly number[];
  drums: readonly number[]; // 0=無, 1=kick, 2=snare, 3=hihat
}

// 6 首原創 16-bit 晶片樂譜（每步為 1/8 拍）
const TRACKS: Record<TrackId, TrackSpec> = {
  title: {
    bpm: 108,
    lead:    [72, 0, 76, 79, 76, 0, 74, 72, 69, 0, 72, 76, 74, 0, 0, 0],
    harmony: [64, 0, 67, 0, 64, 0, 62, 0, 60, 0, 64, 0, 62, 0, 67, 0],
    bass:    [48, 0, 48, 0, 52, 0, 52, 0, 45, 0, 45, 0, 43, 0, 43, 0],
    drums:   [1, 0, 3, 0, 2, 0, 3, 0, 1, 0, 3, 0, 2, 0, 3, 3],
  },
  ch1: {
    // 黃昏騎樓：輕快溫暖散步風
    bpm: 116,
    lead:    [76, 79, 81, 0, 79, 76, 74, 0, 72, 74, 76, 79, 74, 0, 72, 0],
    harmony: [67, 0, 72, 0, 67, 0, 65, 0, 64, 0, 67, 0, 65, 0, 64, 0],
    bass:    [48, 0, 55, 0, 50, 0, 55, 0, 45, 0, 52, 0, 43, 0, 50, 0],
    drums:   [1, 3, 2, 3, 1, 3, 2, 3, 1, 3, 2, 3, 1, 1, 2, 3],
  },
  ch2: {
    // 霓虹夜市：活潑五聲調性台灣祭典感
    bpm: 134,
    lead:    [74, 76, 79, 81, 79, 0, 76, 74, 72, 74, 76, 0, 79, 81, 86, 0],
    harmony: [62, 0, 67, 0, 69, 0, 67, 0, 60, 0, 64, 0, 67, 0, 74, 0],
    bass:    [50, 50, 0, 55, 57, 0, 55, 0, 48, 48, 0, 52, 55, 0, 50, 0],
    drums:   [1, 3, 2, 1, 3, 2, 1, 3, 1, 3, 2, 1, 3, 2, 2, 3],
  },
  ch3: {
    // 深夜雨屋頂：略帶緊湊與溫柔希望的小調
    bpm: 124,
    lead:    [69, 0, 72, 76, 74, 72, 71, 0, 69, 71, 72, 76, 79, 0, 76, 0],
    harmony: [60, 0, 64, 0, 62, 0, 59, 0, 60, 0, 64, 0, 67, 0, 64, 0],
    bass:    [45, 0, 45, 48, 50, 0, 47, 0, 45, 0, 48, 0, 43, 0, 47, 0],
    drums:   [1, 3, 3, 2, 1, 3, 2, 3, 1, 3, 3, 2, 1, 2, 3, 3],
  },
  boss: {
    // 屋頂宿敵疤面老大：高速熱血決戰曲
    bpm: 152,
    lead:    [69, 72, 75, 76, 75, 72, 71, 69, 76, 79, 81, 79, 76, 75, 74, 71],
    harmony: [57, 60, 63, 64, 63, 60, 59, 57, 64, 67, 69, 67, 64, 63, 62, 59],
    bass:    [45, 45, 48, 45, 50, 45, 47, 45, 45, 45, 48, 50, 52, 50, 48, 47],
    drums:   [1, 3, 2, 1, 1, 3, 2, 3, 1, 3, 2, 1, 2, 2, 1, 2],
  },
  ending: {
    // 回家結局：溫馨搖籃曲
    bpm: 96,
    lead:    [72, 0, 76, 0, 79, 0, 84, 0, 81, 0, 79, 76, 74, 0, 72, 0],
    harmony: [64, 0, 67, 0, 72, 0, 76, 0, 72, 0, 71, 0, 69, 0, 67, 0],
    bass:    [48, 0, 0, 0, 52, 0, 0, 0, 53, 0, 0, 0, 55, 0, 48, 0],
    drums:   [0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 3, 0],
  },
};

export class ChipAudioEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private currentTrack: TrackId | null = null;
  private stepIndex = 0;
  private timerId: number | null = null;
  private muted = false;

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    if (this.currentTrack && this.timerId === null) {
      this.startSequencer(this.currentTrack);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  public playBgm(track: TrackId): void {
    if (this.currentTrack === track && this.timerId !== null) return;
    this.currentTrack = track;
    this.stepIndex = 0;
    if (this.ctx) {
      this.startSequencer(track);
    }
  }

  public stopBgm(): void {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private startSequencer(track: TrackId): void {
    this.stopBgm();
    const spec = TRACKS[track];
    const stepMs = Math.round((60 / spec.bpm / 2) * 1000);
    this.timerId = window.setInterval(() => {
      if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      const dur = stepMs / 1000;
      const i = this.stepIndex % spec.lead.length;
      const lead = spec.lead[i] ?? 0;
      const harm = spec.harmony[i] ?? 0;
      const bass = spec.bass[i] ?? 0;
      const drum = spec.drums[i] ?? 0;

      if (lead > 0) this.playTone('square', midiToFreq(lead), now, dur * 0.85, 0.048);
      if (harm > 0) this.playTone('square', midiToFreq(harm), now, dur * 0.75, 0.024);
      if (bass > 0) this.playTone('triangle', midiToFreq(bass), now, dur * 0.9, 0.065);
      if (drum === 1) this.playTone('triangle', 110, now, 0.07, 0.07, 45);
      else if (drum === 2) this.playNoise(now, 0.065, 0.04, 1600);
      else if (drum === 3) this.playNoise(now, 0.03, 0.02, 5500);

      this.stepIndex += 1;
    }, stepMs);
  }

  public playSfx(id: SfxId): void {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    switch (id) {
      case 'meow_orange':
        this.playTone('triangle', 380, now, 0.14, 0.12, 290);
        break;
      case 'meow_black':
        this.playTone('square', 580, now, 0.11, 0.08, 760);
        break;
      case 'jump':
        this.playTone('square', 240, now, 0.1, 0.07, 520);
        break;
      case 'double_jump':
        this.playTone('square', 380, now, 0.11, 0.07, 780);
        break;
      case 'dash':
        this.playNoise(now, 0.12, 0.08, 2400);
        this.playTone('sawtooth', 520, now, 0.1, 0.05, 180);
        break;
      case 'smash':
        this.playNoise(now, 0.12, 0.09, 900);
        this.playTone('triangle', 180, now, 0.12, 0.12, 70);
        break;
      case 'crate_break':
        this.playNoise(now, 0.16, 0.12, 650);
        this.playTone('square', 140, now, 0.1, 0.07, 60);
        break;
      case 'switch':
        this.playTone('square', 440, now, 0.05, 0.07);
        this.playTone('square', 660, now + 0.05, 0.07, 0.07);
        break;
      case 'bounce':
        this.playTone('triangle', 220, now, 0.18, 0.12, 680);
        break;
      case 'fish':
        this.playTone('square', 784, now, 0.05, 0.06);
        this.playTone('square', 1046, now + 0.05, 0.08, 0.06);
        break;
      case 'yarn':
        this.playTone('square', 523, now, 0.08, 0.08);
        this.playTone('square', 659, now + 0.08, 0.08, 0.08);
        this.playTone('square', 784, now + 0.16, 0.08, 0.08);
        this.playTone('square', 1046, now + 0.24, 0.18, 0.09);
        break;
      case 'heal':
        this.playTone('triangle', 523, now, 0.09, 0.1);
        this.playTone('triangle', 659, now + 0.09, 0.09, 0.1);
        this.playTone('triangle', 1046, now + 0.18, 0.15, 0.1);
        break;
      case 'hurt':
        this.playTone('sawtooth', 260, now, 0.18, 0.11, 90);
        this.playNoise(now, 0.12, 0.08, 700);
        break;
      case 'checkpoint':
        this.playTone('square', 440, now, 0.08, 0.07);
        this.playTone('square', 554, now + 0.08, 0.08, 0.07);
        this.playTone('square', 659, now + 0.16, 0.16, 0.08);
        break;
      case 'hero_bark':
        // 忠犬阿福友善英勇犬吠！
        this.playTone('sawtooth', 240, now, 0.09, 0.12, 420);
        this.playTone('sawtooth', 280, now + 0.11, 0.11, 0.12, 490);
        this.playTone('triangle', 660, now + 0.22, 0.18, 0.09, 880);
        break;
      case 'boss_roar':
        this.playTone('sawtooth', 210, now, 0.26, 0.12, 95);
        break;
      case 'boss_stun':
        this.playNoise(now, 0.2, 0.12, 800);
        this.playTone('square', 600, now + 0.05, 0.12, 0.08, 300);
        break;
      case 'boss_hit':
        this.playNoise(now, 0.18, 0.14, 1100);
        this.playTone('square', 320, now, 0.15, 0.12, 120);
        break;
      case 'clear':
        [523, 659, 784, 1046].forEach((f, idx) => {
          this.playTone('square', f, now + idx * 0.1, 0.14, 0.08);
        });
        break;
    }
  }

  private playTone(
    type: OscillatorType,
    freq: number,
    start: number,
    dur: number,
    vol: number,
    endFreq?: number,
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + dur);
    }
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.0008, start + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.01);
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private playNoise(start: number, dur: number, vol: number, filterFreq: number): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFreq, start);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(start);
    src.stop(start + dur + 0.01);
  }
}
