import {
  CAT_CONFIG,
  CatState,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  TILE_SIZE,
  WorldState,
} from '../core/types';
import { CHAPTER_PALETTES } from './palettes';
import { drawParallaxBackground } from './parallax';
import { ParticlePool } from './particles';
import { SpriteBakery, SpriteKey } from './spriteBakery';

export class WorldRenderer {
  private shakeTimer = 0;
  private shakeIntensity = 0;

  constructor(
    private readonly bakery: SpriteBakery,
    public readonly particles: ParticlePool,
  ) {}

  public triggerShake(intensity: number, duration: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTimer = Math.max(this.shakeTimer, duration);
  }

  public updateEffects(dt: number): void {
    this.particles.update(dt);
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
      if (this.shakeTimer === 0) this.shakeIntensity = 0;
    }
  }

  public render(ctx: CanvasRenderingContext2D, world: WorldState): void {
    ctx.imageSmoothingEnabled = false;
    const camX = Math.round(world.cameraX);
    const sx = this.shakeTimer > 0 ? Math.round((Math.random() - 0.5) * 2 * this.shakeIntensity) : 0;
    const sy = this.shakeTimer > 0 ? Math.round((Math.random() - 0.5) * 2 * this.shakeIntensity) : 0;

    ctx.save();
    ctx.translate(sx, sy);

    // 1. 視差背景
    drawParallaxBackground(ctx, world.level.chapter, camX, world.elapsed, world.level.hasRain);

    // 2. 磚塊地圖
    this.drawTiles(ctx, world, camX);

    // 3. 檢查點路燈、忠犬阿福隱藏點、終點溫暖家門
    this.drawLandmarks(ctx, world, camX);

    // 4. 機關
    this.drawMechanics(ctx, world, camX);

    // 5. 收集物（小魚乾、毛線球）
    this.drawCollectibles(ctx, world, camX);

    // 6. 敵人與 Boss
    this.drawEnemies(ctx, world, camX);
    this.drawBoss(ctx, world, camX);
    this.drawProjectiles(ctx, world, camX);

    // 7. 雙貓與場上視覺引導（頭頂箭頭、待命腳印、切換波紋、護盾圈）
    const activeCat = world.cats[world.activeCatId];
    const partnerCat = world.cats[world.activeCatId === 'orange' ? 'black' : 'orange'];
    this.drawCat(ctx, partnerCat, world, camX, false);
    this.drawCat(ctx, activeCat, world, camX, true);

    // 8. 阿福英勇護主衝鋒演出
    if (world.heroRescueAnim.active) {
      const dog = this.bakery.get('hero_dog_run');
      const dx = Math.round(world.heroRescueAnim.x - camX);
      const dy = Math.round(world.heroRescueAnim.y - 2);
      ctx.fillStyle = 'rgba(255, 232, 100, 0.35)';
      ctx.fillRect(dx - 6, dy - 2, dog.w + 10, dog.h + 4);
      ctx.drawImage(dog.right, dx, dy);
    }

    // 9. 微粒與陣風線
    this.particles.draw(ctx, camX);
    if (world.windActive || world.windWarning) {
      this.drawWindLines(ctx, world.elapsed, world.windActive);
    }

    ctx.restore();
  }

  private drawTiles(ctx: CanvasRenderingContext2D, world: WorldState, camX: number): void {
    const pal = CHAPTER_PALETTES[world.level.chapter];
    const startCol = Math.max(0, Math.floor(camX / TILE_SIZE) - 1);
    const endCol = Math.min(
      world.level.widthTiles - 1,
      Math.ceil((camX + LOGICAL_WIDTH) / TILE_SIZE) + 1,
    );

    for (let r = 0; r < world.level.heightTiles; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const t = world.level.tiles[r]?.[c] ?? 0;
        if (t === 0) continue;
        const x = c * TILE_SIZE - camX;
        const y = r * TILE_SIZE;

        if (t === 1) {
          ctx.fillStyle = pal.tileMain;
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = pal.tileTop;
          ctx.fillRect(x, y, TILE_SIZE, 3);
          ctx.fillStyle = pal.tileDark;
          ctx.fillRect(x, y + 8, TILE_SIZE, 1);
          ctx.fillRect(x + ((r % 2) * 8), y + 3, 1, 5);
          ctx.fillRect(x + (((r + 1) % 2) * 8), y + 9, 1, 7);
        } else if (t === 2) {
          // 單向平台（騎樓機車坐墊 / 夜市棚架 / 曬衣繩）
          ctx.fillStyle = pal.platformMain;
          ctx.fillRect(x, y, TILE_SIZE, 5);
          ctx.fillStyle = pal.platformAccent;
          ctx.fillRect(x, y, TILE_SIZE, 2);
          ctx.fillStyle = '#1b1626';
          ctx.fillRect(x + 2, y + 5, 2, 3);
          ctx.fillRect(x + 12, y + 5, 2, 3);
        } else if (t === 3) {
          // 濕滑鐵皮屋頂（反光波浪）
          ctx.fillStyle = '#4c6d85';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#9fd8f5';
          ctx.fillRect(x, y, TILE_SIZE, 3);
          ctx.fillStyle = '#2d4559';
          for (let sx = 2; sx < TILE_SIZE; sx += 4) {
            ctx.fillRect(x + sx, y + 3, 2, TILE_SIZE - 3);
          }
        } else if (t === 4) {
          // 淺水窪
          ctx.fillStyle = 'rgba(92, 198, 255, 0.72)';
          ctx.fillRect(x, y + 11, TILE_SIZE, 5);
          const wave = Math.floor(world.elapsed * 4 + c) % 4;
          ctx.fillStyle = '#e0f7ff';
          ctx.fillRect(x + 2 + wave, y + 12, 5, 1);
        } else if (t === 5) {
          // 可攀爬牆面（鐵窗／水塔爬梯）
          ctx.fillStyle = pal.climbWall;
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = pal.climbRung;
          ctx.fillRect(x + 2, y, 2, TILE_SIZE);
          ctx.fillRect(x + 12, y, 2, TILE_SIZE);
          ctx.fillRect(x + 2, y + 4, 12, 2);
          ctx.fillRect(x + 2, y + 11, 12, 2);
        }
      }
    }
  }

  private drawLandmarks(ctx: CanvasRenderingContext2D, world: WorldState, camX: number): void {
    // 檢查點（台灣巷口暖黃路燈）
    const cpx = Math.round(world.level.checkpoint.x - camX);
    const cpy = Math.round(world.level.checkpoint.y);
    ctx.fillStyle = '#4a4e69';
    ctx.fillRect(cpx + 5, cpy - 16, 3, 30);
    ctx.fillStyle = world.checkpointReached ? '#ffe678' : '#7b8299';
    ctx.fillRect(cpx + 2, cpy - 20, 9, 5);
    if (world.checkpointReached) {
      ctx.fillStyle = 'rgba(255, 230, 120, 0.25)';
      ctx.fillRect(cpx - 4, cpy - 22, 21, 24);
    }

    // 隱藏英雄「忠犬阿福」支線點＋溫馨音符與紅領巾微光線索
    if (world.level.heroDogSpot) {
      const hx = Math.round(world.level.heroDogSpot.x - camX);
      const hy = Math.round(world.level.heroDogSpot.y + 2);
      const spr = this.bakery.get('hero_dog_sit');
      ctx.drawImage(spr.right, hx, hy);
      // 溫馨閃光與「♪」線索
      const bob = Math.round(Math.sin(world.elapsed * 4) * 2);
      ctx.fillStyle = world.heroBonded ? '#ff7aa2' : '#ff4d6d';
      ctx.fillRect(hx + 7, hy - 7 + bob, 3, 3);
      ctx.fillStyle = '#ffe875';
      ctx.fillRect(hx + 12, hy - 10 - bob, 2, 4);
      ctx.fillRect(hx + 12, hy - 10 - bob, 4, 1);
    }

    // 終點門／3-3 溫暖家門
    const gx = Math.round(world.level.goal.x - camX);
    const gy = Math.round(world.level.goal.y);
    const locked =
      world.boss !== null &&
      (world.boss.status === 'dormant' || world.boss.behavior.kind !== 'DEFEATED');
    ctx.fillStyle = locked ? '#3e3a4d' : '#7a4424';
    ctx.fillRect(gx + 2, gy + 2, 28, 30);
    ctx.fillStyle = locked ? '#605a73' : '#ffd875';
    ctx.fillRect(gx + 6, gy + 6, 20, 24);
    if (!locked) {
      ctx.fillStyle = 'rgba(255, 224, 125, 0.28)';
      ctx.fillRect(gx - 4, gy - 4, 40, 38);
      // 屋頂三角與溫馨窗框
      ctx.fillStyle = '#c94c38';
      ctx.fillRect(gx, gy, 32, 4);
      ctx.fillStyle = '#8c4f2b';
      ctx.fillRect(gx + 15, gy + 6, 2, 24);
      ctx.fillRect(gx + 6, gy + 16, 20, 2);
    }
  }

  private drawMechanics(ctx: CanvasRenderingContext2D, world: WorldState, camX: number): void {
    for (const m of world.mechanics) {
      const x = Math.round(m.rect.x - camX);
      const y = Math.round(m.rect.y);
      const w = Math.round(m.rect.w);
      const h = Math.round(m.rect.h);

      if (m.spec.kind === 'crate' && !m.broken) {
        ctx.fillStyle = '#c98a4b';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#8c5323';
        ctx.fillRect(x, y, w, 2);
        ctx.fillRect(x, y + h - 2, w, 2);
        ctx.fillRect(x + 6, y + 2, 4, h - 4);
      } else if (m.spec.kind === 'pushBox') {
        ctx.fillStyle = m.spec.blocksWind ? '#6c7c8c' : '#a86934';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = m.spec.blocksWind ? '#b5c7d9' : '#e0a96d';
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        ctx.fillStyle = '#3b281a';
        ctx.fillRect(x + 3, y + 7, w - 6, 2);
      } else if (m.spec.kind === 'trigger') {
        ctx.fillStyle = m.active ? '#4ce088' : '#e64c4c';
        const pressOffset = m.active && m.spec.activation !== 'wallSwitch' ? 2 : 0;
        ctx.fillRect(x, y + pressOffset, w, h - pressOffset);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 2, y + 1 + pressOffset, w - 4, 1);
      } else if (m.spec.kind === 'gate') {
        if (m.active) {
          // 已升起的鐵捲門頂框
          ctx.fillStyle = '#6c758a';
          ctx.fillRect(x, y, w, 5);
        } else {
          const solidH = h - m.spec.bottomGapPx;
          ctx.fillStyle = '#5c667d';
          ctx.fillRect(x, y, w, solidH);
          ctx.fillStyle = '#8b96b0';
          for (let gy = y + 2; gy < y + solidH; gy += 5) {
            ctx.fillRect(x + 1, gy, w - 2, 2);
          }
          // 底部窄縫提示微光（暗示黑貓可鑽過）
          if (m.spec.bottomGapPx > 0) {
            ctx.fillStyle = 'rgba(114, 240, 255, 0.35)';
            ctx.fillRect(x, y + solidH, w, 2);
          }
        }
      } else if (m.spec.kind === 'movingPlatform') {
        ctx.fillStyle = m.active ? '#f2a649' : '#635c73';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = m.active ? '#ffe89e' : '#8a829e';
        ctx.fillRect(x + 2, y + 1, w - 4, 2);
      } else if (m.spec.kind === 'spring') {
        // 夜市彈跳紅白遮雨棚
        const compress = m.timer > 0 ? 2 : 0;
        for (let sx = 0; sx < w; sx += 4) {
          ctx.fillStyle = (sx / 4) % 2 === 0 ? '#e63946' : '#fff3e0';
          ctx.fillRect(x + sx, y + compress, 4, h - compress);
        }
      } else if (m.spec.kind === 'hazard') {
        if (m.spec.style === 'steam') {
          ctx.fillStyle = '#4f5666';
          ctx.fillRect(x, y + h - 5, w, 5);
          if (m.warning) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
            ctx.fillRect(x + 2, y + h - 10, w - 4, 4);
          } else if (m.active) {
            ctx.fillStyle = 'rgba(240, 248, 255, 0.85)';
            ctx.fillRect(x + 1, y, w - 2, h - 5);
          }
        } else {
          // 落雷積水
          if (m.warning) {
            ctx.fillStyle = 'rgba(255, 232, 92, 0.45)';
            ctx.fillRect(x + 3, y, w - 6, h);
          } else if (m.active) {
            ctx.fillStyle = '#fff59d';
            ctx.fillRect(x + 1, y, w - 2, h);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x + 4, y, Math.max(2, w - 8), h);
          }
        }
      } else if (m.spec.kind === 'waterValve') {
        ctx.fillStyle = m.timer > 0 ? '#556e85' : '#38b6ff';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 4, y + 2, 4, 8);
        ctx.fillRect(x + 2, y + 4, 8, 4);
        if (m.active) {
          // 潑水沖落特效
          ctx.fillStyle = 'rgba(110, 220, 255, 0.72)';
          ctx.fillRect(x - 10, y + h, 36, 96);
        }
      }
    }
  }

  private drawCollectibles(ctx: CanvasRenderingContext2D, world: WorldState, camX: number): void {
    const bob = Math.round(Math.sin(world.elapsed * 5) * 1.5);
    const fishSpr = this.bakery.get('fish');
    for (const fish of world.level.fishes) {
      if (world.collectedFishIds.has(fish.id)) continue;
      const fx = Math.round(fish.pos.x - camX);
      const fy = Math.round(fish.pos.y + bob);
      ctx.drawImage(fishSpr.right, fx, fy);
    }

    if (!world.yarnCollectedInLevel) {
      const yarnSpr = this.bakery.get('yarn');
      const yx = Math.round(world.level.yarnBall.x - camX);
      const yy = Math.round(world.level.yarnBall.y + bob);
      ctx.fillStyle = 'rgba(255, 110, 160, 0.28)';
      ctx.fillRect(yx - 2, yy - 2, yarnSpr.w + 4, yarnSpr.h + 4);
      ctx.drawImage(yarnSpr.right, yx, yy);
    }
  }

  private drawEnemies(ctx: CanvasRenderingContext2D, world: WorldState, camX: number): void {
    for (const e of world.enemies) {
      const spr = this.bakery.get(e.spec.variant === 'guardDog' ? 'guard_dog' : 'stray_dog');
      const img = e.facing === 1 ? spr.right : spr.left;
      const ex = Math.round(e.x - camX);
      const ey = Math.round(e.y);
      if (e.stunTimer > 0) {
        ctx.globalAlpha = 0.65;
      }
      ctx.drawImage(img, ex, ey);
      ctx.globalAlpha = 1;
      if (e.stunTimer > 0) {
        ctx.fillStyle = '#ffe85c';
        ctx.fillRect(ex + 4, ey - 4, 3, 2);
        ctx.fillRect(ex + 10, ey - 6, 3, 2);
      }
    }
  }

  private drawBoss(ctx: CanvasRenderingContext2D, world: WorldState, camX: number): void {
    const boss = world.boss;
    if (!boss || boss.status !== 'active') return;
    const bx = Math.round(boss.x - camX);
    const by = Math.round(boss.y);

    // 衝爪紅線預警
    if (boss.behavior.kind === 'TELEGRAPH_CLAW') {
      ctx.fillStyle = 'rgba(255, 64, 96, 0.55)';
      ctx.fillRect(
        Math.round(boss.arenaBounds.x - camX),
        by + 10,
        Math.round(boss.arenaBounds.w),
        3,
      );
    }

    let key: SpriteKey = 'boss_idle';
    if (boss.behavior.kind === 'CLAW_DASH') key = 'boss_dash';
    else if (boss.behavior.kind === 'STUNNED') key = 'boss_stun';

    const spr = this.bakery.get(key);
    const img = boss.facing === 1 ? spr.right : spr.left;
    if (boss.behavior.kind === 'HURT' && Math.floor(world.elapsed * 20) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }
    if (boss.behavior.kind === 'DEFEATED') {
      ctx.globalAlpha = 0.35;
    }
    ctx.drawImage(img, bx, by + 6);
    ctx.globalAlpha = 1;
  }

  private drawProjectiles(ctx: CanvasRenderingContext2D, world: WorldState, camX: number): void {
    for (const p of world.projectiles) {
      const pxPos = Math.round(p.x - camX);
      const pyPos = Math.round(p.y);
      if (p.kind === 'fishCan') {
        ctx.fillStyle = '#c4cfd9';
        ctx.fillRect(pxPos, pyPos, p.w, p.h);
        ctx.fillStyle = '#d9534f';
        ctx.fillRect(pxPos + 1, pyPos + 2, p.w - 2, 3);
      } else {
        ctx.fillStyle = p.active ? '#fff59d' : 'rgba(255, 224, 92, 0.38)';
        ctx.fillRect(pxPos, pyPos, p.w, p.h);
      }
    }
  }

  private drawCat(
    ctx: CanvasRenderingContext2D,
    cat: CatState,
    world: WorldState,
    camX: number,
    isActive: boolean,
  ): void {
    const cfg = CAT_CONFIG[cat.id];
    const x = Math.round(cat.x - camX);
    const y = Math.round(cat.y);

    // 受傷無敵閃爍
    if (isActive && world.hurtInvulnTimer > 0 && Math.floor(world.elapsed * 18) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    }

    let key: SpriteKey;
    if (cat.id === 'orange') {
      if (cat.animState === 'skill') key = 'orange_smash';
      else if (cat.animState === 'sit') key = 'orange_sit';
      else if (cat.animState === 'jump' || cat.animState === 'fall') key = 'orange_jump';
      else if (cat.animState === 'run') {
        key = Math.floor(cat.animTimer * 10) % 2 === 0 ? 'orange_run1' : 'orange_run2';
      } else key = 'orange_idle';
    } else {
      if (cat.animState === 'skill') key = 'black_dash';
      else if (cat.animState === 'sit') key = 'black_sit';
      else if (cat.animState === 'jump' || cat.animState === 'fall' || cat.animState === 'wallSlide') {
        key = 'black_jump';
      } else if (cat.animState === 'run') {
        key = Math.floor(cat.animTimer * 12) % 2 === 0 ? 'black_run1' : 'black_run2';
      } else key = 'black_idle';
    }

    const spr = this.bakery.get(key);
    const img = cat.facing === 1 ? spr.right : spr.left;
    ctx.drawImage(img, x, y);
    ctx.globalAlpha = 1;

    // 忠犬阿福金色無敵護盾圈
    if (isActive && world.heroShieldTimer > 0) {
      ctx.strokeStyle = '#ffe85c';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 2, y - 2, cfg.width + 4, cfg.height + 4);
    }

    // 場上視覺引導：主控貓頭頂小黃箭頭 ▼ / 待命貓鎖定腳印
    if (isActive) {
      const bob = Math.round(Math.sin(world.elapsed * 7) * 1.5);
      const ax = x + Math.floor(cfg.width / 2);
      const ay = y - 6 + bob;
      ctx.fillStyle = '#ffe85c';
      ctx.fillRect(ax - 2, ay, 5, 1);
      ctx.fillRect(ax - 1, ay + 1, 3, 1);
      ctx.fillRect(ax, ay + 2, 1, 1);
    } else if (world.partnerMode === 'STAY') {
      ctx.fillStyle = '#72f0ff';
      ctx.fillRect(x + 3, y - 6, 5, 4);
      ctx.fillStyle = '#181426';
      ctx.fillRect(x + 5, y - 5, 1, 2);
    }

    // 切換貓咪波紋
    if (world.switchRipple && world.switchRipple.catId === cat.id) {
      const r = Math.round((0.32 - world.switchRipple.timer) * 42);
      ctx.strokeStyle = cat.id === 'orange' ? '#ffb347' : '#72f0ff';
      ctx.strokeRect(x - r / 2, y - r / 2, cfg.width + r, cfg.height + r);
    }
  }

  private drawWindLines(ctx: CanvasRenderingContext2D, elapsed: number, strong: boolean): void {
    ctx.fillStyle = strong ? 'rgba(235, 248, 255, 0.72)' : 'rgba(200, 230, 255, 0.35)';
    const speed = strong ? 340 : 160;
    const count = strong ? 16 : 7;
    for (let i = 0; i < count; i++) {
      const wx = ((LOGICAL_WIDTH - ((elapsed * speed + i * 57) % (LOGICAL_WIDTH + 40))) | 0);
      const wy = (i * 23 + 14) % (LOGICAL_HEIGHT - 20);
      ctx.fillRect(wx, wy, strong ? 24 : 12, 1);
    }
  }
}
