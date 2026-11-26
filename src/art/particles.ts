export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  gravity: number;
}

const MAX_PARTICLES = 120;

export class ParticlePool {
  private readonly items: Particle[] = [];

  constructor() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.items.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        color: '#fff',
        size: 2,
        gravity: 0,
      });
    }
  }

  public emit(
    kind: 'dust' | 'crate' | 'dash' | 'heart' | 'gold' | 'stun' | 'splash',
    x: number,
    y: number,
  ): void {
    const count = kind === 'crate' || kind === 'gold' ? 10 : 6;
    const paletteMap: Record<typeof kind, string[]> = {
      dust: ['#e8dec8', '#bfa98a'],
      crate: ['#c98744', '#8f5222', '#f0be7a'],
      dash: ['#72f0ff', '#4b7bec', '#d4f7ff'],
      heart: ['#ff5e7e', '#ff9eb5'],
      gold: ['#ffe85c', '#ffb830', '#ffffff'],
      stun: ['#ffe44d', '#b56bff'],
      splash: ['#80d8ff', '#e0f7fa'],
    };
    const colors = paletteMap[kind];

    let spawned = 0;
    for (const p of this.items) {
      if (p.active) continue;
      const angle = (Math.PI * 2 * spawned) / count + (Math.random() - 0.5) * 0.5;
      const speed = kind === 'heart' ? 24 : 36 + Math.random() * 55;
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = kind === 'heart' ? -35 - Math.random() * 20 : Math.sin(angle) * speed - 25;
      p.maxLife = kind === 'crate' ? 0.55 : 0.4;
      p.life = p.maxLife;
      p.color = colors[spawned % colors.length]!;
      p.size = kind === 'crate' ? 3 : 2;
      p.gravity = kind === 'heart' ? -15 : 240;
      spawned += 1;
      if (spawned >= count) break;
    }
  }

  public update(dt: number): void {
    for (const p of this.items) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  public draw(ctx: CanvasRenderingContext2D, cameraX: number): void {
    for (const p of this.items) {
      if (!p.active) continue;
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - cameraX), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
}
