import { ChapterId, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../core/types';
import { CHAPTER_PALETTES } from './palettes';

export function drawParallaxBackground(
  ctx: CanvasRenderingContext2D,
  chapter: ChapterId,
  cameraX: number,
  elapsed: number,
  hasRain: boolean,
): void {
  const pal = CHAPTER_PALETTES[chapter];

  // 1. 天空漸層（16-bit 色帶分層）
  const bands = [
    { y: 0, h: 56, color: pal.skyTop },
    { y: 56, h: 52, color: pal.skyMid },
    { y: 108, h: 72, color: pal.skyBot },
  ];
  for (const b of bands) {
    ctx.fillStyle = b.color;
    ctx.fillRect(0, b.y, LOGICAL_WIDTH, b.h);
  }

  // 天體／環境焦點
  if (chapter === 1) {
    // 夕陽落日
    ctx.fillStyle = '#ffd27d';
    ctx.fillRect(236, 36, 26, 26);
    ctx.fillStyle = '#ff9d5c';
    ctx.fillRect(238, 52, 22, 10);
  } else if (chapter === 2) {
    // 夜市星點與遠方高掛紅燈籠串
    ctx.fillStyle = '#fff5c2';
    for (let i = 0; i < 18; i++) {
      const sx = (i * 53 + 17) % LOGICAL_WIDTH;
      const sy = (i * 19 + 8) % 52;
      ctx.fillRect(sx, sy, 1, 1);
    }
  } else {
    // 深夜雨雲與偶發遠景閃電
    const flash = Math.sin(elapsed * 1.9) > 0.985;
    if (flash) {
      ctx.fillStyle = 'rgba(210, 235, 255, 0.28)';
      ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    }
    ctx.fillStyle = '#0c1529';
    for (let i = 0; i < 6; i++) {
      const cx = Math.floor(((i * 70 - cameraX * 0.08) % 420 + 420) % 420) - 50;
      ctx.fillRect(cx, 12 + (i % 2) * 8, 56, 14);
      ctx.fillRect(cx + 10, 6 + (i % 2) * 8, 34, 8);
    }
  }

  // 2. 遠景層（老式台灣公寓與鐵窗剪影，視差 0.2）
  const farScroll = Math.floor(cameraX * 0.2);
  for (let i = -1; i < 9; i++) {
    const bx = i * 48 - (farScroll % 48);
    const bh = 55 + ((i * 23) % 35);
    const by = LOGICAL_HEIGHT - bh - 26;
    ctx.fillStyle = pal.farBuilding;
    ctx.fillRect(bx, by, 42, bh + 26);
    // 頂樓水塔剪影
    if (i % 2 === 0) {
      ctx.fillRect(bx + 14, by - 10, 10, 10);
      ctx.fillRect(bx + 12, by - 12, 14, 2);
    }
    // 暖光窗戶
    ctx.fillStyle = pal.farWindow;
    for (let wy = by + 6; wy < LOGICAL_HEIGHT - 36; wy += 12) {
      for (let wx = bx + 6; wx < bx + 34; wx += 10) {
        if ((wx + wy + i) % 3 !== 0) {
          ctx.fillRect(wx, wy, 4, 5);
        }
      }
    }
  }

  // 3. 中景層（台灣街景特色：騎樓招牌 / 夜市霓虹燈籠 / 屋頂電線桿，視差 0.45）
  const midScroll = Math.floor(cameraX * 0.45);
  for (let i = -1; i < 8; i++) {
    const mx = i * 64 - (midScroll % 64);
    ctx.fillStyle = pal.midBuilding;
    ctx.fillRect(mx, 92, 56, 88);

    if (chapter === 1) {
      // 騎樓直式招牌（機車行／雜貨店色彩意象）
      ctx.fillStyle = i % 2 === 0 ? '#e65c4f' : '#3ca370';
      ctx.fillRect(mx + 44, 72, 10, 32);
      ctx.fillStyle = '#fff5db';
      ctx.fillRect(mx + 47, 76, 4, 4);
      ctx.fillRect(mx + 47, 83, 4, 4);
      ctx.fillRect(mx + 47, 90, 4, 4);
      // 冷氣室外機
      ctx.fillStyle = '#a89eb8';
      ctx.fillRect(mx + 8, 106, 12, 8);
      ctx.fillStyle = '#40394d';
      ctx.fillRect(mx + 10, 108, 4, 4);
    } else if (chapter === 2) {
      // 夜市霓虹招牌與紅燈籠串
      const neonColors = ['#ff4f8b', '#3cf2e6', '#ffd24c'];
      const blink = Math.floor(elapsed * 3 + i) % 4 !== 0;
      ctx.fillStyle = blink ? neonColors[Math.abs(i) % 3]! : '#422c5c';
      ctx.fillRect(mx + 8, 76, 36, 14);
      ctx.fillStyle = '#180f2e';
      ctx.fillRect(mx + 10, 78, 32, 10);
      ctx.fillStyle = neonColors[Math.abs(i + 1) % 3]!;
      ctx.fillRect(mx + 13, 81, 6, 4);
      ctx.fillRect(mx + 23, 81, 6, 4);
      ctx.fillRect(mx + 33, 81, 6, 4);
      // 燈籠串
      ctx.fillStyle = '#ff3b4e';
      for (let lx = mx; lx < mx + 64; lx += 16) {
        ctx.fillRect(lx + 4, 64 + (lx % 3), 5, 6);
        ctx.fillStyle = '#ffe278';
        ctx.fillRect(lx + 6, 66 + (lx % 3), 1, 2);
        ctx.fillStyle = '#ff3b4e';
      }
    } else {
      // 深夜屋頂電線與不鏽鋼水塔
      ctx.fillStyle = '#48607d';
      ctx.fillRect(mx + 12, 66, 16, 22);
      ctx.fillStyle = '#7b99ba';
      ctx.fillRect(mx + 14, 68, 4, 18);
      // 電線
      ctx.fillStyle = '#09111f';
      ctx.fillRect(mx, 60, 64, 1);
    }
  }

  // 深夜雨絲（背景層）
  if (hasRain) {
    ctx.fillStyle = 'rgba(170, 215, 255, 0.35)';
    const offset = Math.floor(elapsed * 220);
    for (let i = 0; i < 42; i++) {
      const rx = ((i * 29 - offset) % LOGICAL_WIDTH + LOGICAL_WIDTH) % LOGICAL_WIDTH;
      const ry = ((i * 41 + offset * 2) % LOGICAL_HEIGHT + LOGICAL_HEIGHT) % LOGICAL_HEIGHT;
      ctx.fillRect(rx, ry, 1, 6);
    }
  }
}
