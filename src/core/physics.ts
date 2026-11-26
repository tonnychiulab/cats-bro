import {
  LevelData,
  MechanicRuntime,
  Px,
  Rect,
  TILE_SIZE,
  TileType,
  px,
} from './types';

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export function getTileAt(level: LevelData, col: number, row: number): TileType {
  if (col < 0 || col >= level.widthTiles) return 1;
  if (row < 0) return 0;
  if (row >= level.heightTiles) return 0; // 底部開放以便深坑判定
  return level.tiles[row]?.[col] ?? 0;
}

export function isSolidTile(t: TileType): boolean {
  return t === 1 || t === 3 || t === 5;
}

export function getGateSolidRect(m: MechanicRuntime): Rect | null {
  if (m.spec.kind !== 'gate' || m.active) return null;
  const h = m.rect.h - m.spec.bottomGapPx;
  if (h <= 0) return null;
  return {
    x: m.rect.x,
    y: m.rect.y,
    w: m.rect.w,
    h: px(h),
  };
}

export function collectSolidColliders(
  mechanics: readonly MechanicRuntime[],
  excludeId?: string,
): Rect[] {
  const solids: Rect[] = [];
  for (const m of mechanics) {
    if (excludeId && m.spec.id === excludeId) continue;
    if (m.spec.kind === 'crate' && !m.broken) {
      solids.push(m.rect);
    } else if (m.spec.kind === 'pushBox') {
      solids.push(m.rect);
    } else if (m.spec.kind === 'gate') {
      const gateRect = getGateSolidRect(m);
      if (gateRect) solids.push(gateRect);
    }
  }
  return solids;
}

export interface MoveResult {
  x: Px;
  y: Px;
  vx: number;
  vy: number;
  grounded: boolean;
  onMovingPlatform: boolean;
  onSlippery: boolean;
  inPuddle: boolean;
  hitWallDir: -1 | 0 | 1;
  touchingClimbableWallDir: -1 | 0 | 1;
}

export function moveAndCollide(
  level: LevelData,
  mechanics: readonly MechanicRuntime[],
  x: Px,
  y: Px,
  w: Px,
  h: Px,
  vx: number,
  vy: number,
  dt: number,
  excludeMechanicId?: string,
  extraBounds?: Rect,
): MoveResult {
  const solids = collectSolidColliders(mechanics, excludeMechanicId);
  let nx: number = x + vx * dt;
  let ny: number = y;
  let nvx = vx;
  let nvy = vy;
  let hitWallDir: -1 | 0 | 1 = 0;
  let touchingClimbableWallDir: -1 | 0 | 1 = 0;

  // --- X 軸解算 ---
  if (extraBounds) {
    if (nx < extraBounds.x) {
      nx = extraBounds.x;
      nvx = 0;
      hitWallDir = -1;
    } else if (nx + w > extraBounds.x + extraBounds.w) {
      nx = extraBounds.x + extraBounds.w - w;
      nvx = 0;
      hitWallDir = 1;
    }
  }

  const topRowX = Math.floor((ny + 1) / TILE_SIZE);
  const botRowX = Math.floor((ny + h - 1) / TILE_SIZE);
  if (nvx > 0) {
    const rightCol = Math.floor((nx + w) / TILE_SIZE);
    for (let r = topRowX; r <= botRowX; r++) {
      const t = getTileAt(level, rightCol, r);
      if (isSolidTile(t)) {
        nx = rightCol * TILE_SIZE - w - 0.001;
        nvx = 0;
        hitWallDir = 1;
        if (t === 5) touchingClimbableWallDir = 1;
        break;
      }
    }
  } else if (nvx < 0) {
    const leftCol = Math.floor(nx / TILE_SIZE);
    for (let r = topRowX; r <= botRowX; r++) {
      const t = getTileAt(level, leftCol, r);
      if (isSolidTile(t)) {
        nx = (leftCol + 1) * TILE_SIZE + 0.001;
        nvx = 0;
        hitWallDir = -1;
        if (t === 5) touchingClimbableWallDir = -1;
        break;
      }
    }
  }

  // 即使水平速度為 0，也偵測左右緊貼的可攀爬牆面
  if (touchingClimbableWallDir === 0) {
    const rCol = Math.floor((nx + w + 1) / TILE_SIZE);
    const lCol = Math.floor((nx - 1) / TILE_SIZE);
    for (let r = topRowX; r <= botRowX; r++) {
      if (getTileAt(level, rCol, r) === 5) {
        touchingClimbableWallDir = 1;
        break;
      }
      if (getTileAt(level, lCol, r) === 5) {
        touchingClimbableWallDir = -1;
        break;
      }
    }
  }

  // 動態實心機關（木箱／脆紙箱／鐵捲門）X 軸碰撞
  const rectX: Rect = { x: px(nx), y: px(ny), w, h };
  for (const s of solids) {
    if (rectsOverlap(rectX, s)) {
      if (vx > 0) {
        nx = s.x - w - 0.001;
        nvx = 0;
        hitWallDir = 1;
      } else if (vx < 0) {
        nx = s.x + s.w + 0.001;
        nvx = 0;
        hitWallDir = -1;
      }
      rectX.x = px(nx);
    }
  }

  // --- Y 軸解算 ---
  const prevBottom = ny + h;
  ny = ny + nvy * dt;
  let grounded = false;
  let onMovingPlatform = false;
  let onSlippery = false;

  const leftColY = Math.floor((nx + 1) / TILE_SIZE);
  const rightColY = Math.floor((nx + w - 1) / TILE_SIZE);

  if (nvy >= 0) {
    const botRow = Math.floor((ny + h) / TILE_SIZE);
    for (let c = leftColY; c <= rightColY; c++) {
      const t = getTileAt(level, c, botRow);
      const tileTop = botRow * TILE_SIZE;
      if (isSolidTile(t)) {
        ny = tileTop - h;
        nvy = 0;
        grounded = true;
        if (t === 3) onSlippery = true;
        break;
      }
      if (t === 2 && prevBottom <= tileTop + 2.5) {
        ny = tileTop - h;
        nvy = 0;
        grounded = true;
        break;
      }
    }
  } else if (nvy < 0) {
    const topRow = Math.floor(ny / TILE_SIZE);
    for (let c = leftColY; c <= rightColY; c++) {
      const t = getTileAt(level, c, topRow);
      if (isSolidTile(t)) {
        ny = (topRow + 1) * TILE_SIZE + 0.001;
        nvy = 0;
        break;
      }
    }
  }

  // 動態實心機關 Y 軸碰撞
  const rectY: Rect = { x: px(nx), y: px(ny), w, h };
  for (const s of solids) {
    if (rectsOverlap(rectY, s)) {
      if (nvy >= 0) {
        ny = s.y - h;
        nvy = 0;
        grounded = true;
      } else {
        ny = s.y + s.h + 0.001;
        nvy = 0;
      }
      rectY.y = px(ny);
    }
  }

  // 移動平台（單向承載）
  for (const m of mechanics) {
    if (m.spec.kind !== 'movingPlatform') continue;
    const plat = m.rect;
    const horizOverlap = nx + w > plat.x + 1 && nx < plat.x + plat.w - 1;
    if (horizOverlap && nvy >= 0 && prevBottom <= plat.y + 4 && ny + h >= plat.y) {
      ny = plat.y - h;
      nvy = 0;
      grounded = true;
      onMovingPlatform = true;
    }
  }

  // 偵測淺水窪（TileType 4）
  let inPuddle = false;
  const centerCol = Math.floor((nx + w / 2) / TILE_SIZE);
  const footRow = Math.floor((ny + h - 2) / TILE_SIZE);
  if (getTileAt(level, centerCol, footRow) === 4) {
    inPuddle = true;
  }

  return {
    x: px(nx),
    y: px(ny),
    vx: nvx,
    vy: nvy,
    grounded,
    onMovingPlatform,
    onSlippery,
    inPuddle,
    hitWallDir,
    touchingClimbableWallDir,
  };
}

export function isValidStandSpot(
  level: LevelData,
  mechanics: readonly MechanicRuntime[],
  x: Px,
  y: Px,
  w: Px,
  h: Px,
): boolean {
  if (x < 0 || x + w > level.widthPx || y < 0 || y + h > level.heightPx) return false;
  const leftCol = Math.floor((x + 1) / TILE_SIZE);
  const rightCol = Math.floor((x + w - 1) / TILE_SIZE);
  const topRow = Math.floor((y + 1) / TILE_SIZE);
  const botRow = Math.floor((y + h - 1) / TILE_SIZE);
  for (let r = topRow; r <= botRow; r++) {
    for (let c = leftCol; c <= rightCol; c++) {
      if (isSolidTile(getTileAt(level, c, r))) return false;
    }
  }
  const probe: Rect = { x, y, w, h };
  for (const s of collectSolidColliders(mechanics)) {
    if (rectsOverlap(probe, s)) return false;
  }
  // 確認腳下 2px 有實心磚或單向平台
  const belowRow = Math.floor((y + h + 2) / TILE_SIZE);
  for (let c = leftCol; c <= rightCol; c++) {
    const t = getTileAt(level, c, belowRow);
    if (isSolidTile(t) || t === 2) return true;
  }
  return false;
}

export function hasClosedGateBetween(
  mechanics: readonly MechanicRuntime[],
  ax: Px,
  bx: Px,
): boolean {
  const minX = Math.min(ax, bx);
  const maxX = Math.max(ax, bx);
  for (const m of mechanics) {
    if (m.spec.kind === 'gate' && !m.active) {
      const gx = m.rect.x + m.rect.w / 2;
      if (gx >= minX && gx <= maxX) {
        return true;
      }
    }
  }
  return false;
}
