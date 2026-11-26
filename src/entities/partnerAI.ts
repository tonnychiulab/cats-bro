import { hasClosedGateBetween, isValidStandSpot } from '../core/physics';
import {
  CAT_CONFIG,
  CatState,
  Seconds,
  WorldEvent,
  WorldState,
  px,
  sec,
} from '../core/types';
import { stepCatPhysics } from './cat';

const MAX_BREADCRUMBS = 48;
const BREADCRUMB_SPACING = 8;
const FOLLOW_DEADZONE = 26;
const TELEPORT_DISTANCE = 180;
const STUCK_TELEPORT_TIME = 2.5;
const STUCK_MIN_DISTANCE = 48;

export function recordBreadcrumb(world: WorldState, activeCat: CatState, jumped: boolean): void {
  const list = world.breadcrumbs;
  const last = list[list.length - 1];
  const dist = last ? Math.hypot(activeCat.x - last.x, activeCat.y - last.y) : Infinity;
  if (jumped || dist >= BREADCRUMB_SPACING) {
    list.push({
      x: activeCat.x,
      y: activeCat.y,
      jumped,
      facing: activeCat.facing,
    });
    if (list.length > MAX_BREADCRUMBS) {
      list.shift();
    }
  }
}

export function findSafeSpotNear(world: WorldState, targetCat: CatState, partner: CatState): { x: number; y: number } {
  const pCfg = CAT_CONFIG[partner.id];
  const offsets = [-18 * targetCat.facing, 18 * targetCat.facing, -12, 12, 0];
  for (const dx of offsets) {
    const cx = px(targetCat.x + dx);
    const cy = px(targetCat.y + (CAT_CONFIG[targetCat.id].height - pCfg.height));
    if (isValidStandSpot(world.level, world.mechanics, cx, cy, pCfg.width, pCfg.height)) {
      return { x: cx, y: cy };
    }
  }
  return { x: targetCat.lastSafePos.x, y: targetCat.lastSafePos.y };
}

export function stepPartnerAI(
  world: WorldState,
  activeCat: CatState,
  partner: CatState,
  windActive: boolean,
  shelteredFromWind: boolean,
  dt: Seconds,
  events: WorldEvent[],
  extraBounds?: { x: number; y: number; w: number; h: number },
): void {
  const prevX = partner.x;
  const prevY = partner.y;

  // 若主控貓穿過未開啟之窄縫鐵捲門，自動將夥伴切為 STAY（杜絕瞬移穿牆破關）
  if (
    world.partnerMode === 'FOLLOW' &&
    hasClosedGateBetween(world.mechanics, activeCat.x, partner.x)
  ) {
    world.partnerMode = 'STAY';
  }

  if (world.partnerMode === 'STAY') {
    partner.vx = 0; // INV-AI-01
    world.partnerStuckTimer = sec(0);
    stepCatPhysics(
      partner,
      world.level,
      world.mechanics,
      {
        moveX: 0,
        jumpPressed: false,
        jumpBufferActive: false,
        skillPressed: false,
        isSitting: true,
      },
      windActive,
      shelteredFromWind,
      dt,
      events,
      extraBounds ? { x: px(extraBounds.x), y: px(extraBounds.y), w: px(extraBounds.w), h: px(extraBounds.h) } : undefined,
    );
    partner.vx = 0;
    return;
  }

  // FOLLOW 模式：追蹤 Breadcrumb 或主控貓位置
  const dxToActive = activeCat.x - partner.x;
  const dyToActive = activeCat.y - partner.y;
  const distToActive = Math.hypot(dxToActive, dyToActive);

  let targetX: number = activeCat.x;
  let targetY: number = activeCat.y;
  let wantJump = false;

  if (world.breadcrumbs.length > 0) {
    // 找離夥伴前方的第一個路標
    const crumb = world.breadcrumbs[Math.max(0, world.breadcrumbs.length - 4)] ?? world.breadcrumbs[0];
    if (crumb) {
      targetX = crumb.x;
      targetY = crumb.y;
      if (crumb.jumped && partner.grounded && Math.abs(partner.x - crumb.x) < 18) {
        wantJump = true;
      }
    }
  }

  let moveX: -1 | 0 | 1 = 0;
  if (Math.abs(dxToActive) > FOLLOW_DEADZONE) {
    moveX = targetX > partner.x + 4 ? 1 : targetX < partner.x - 4 ? -1 : 0;
  }
  if (!wantJump && targetY < partner.y - 14 && partner.grounded && Math.abs(dxToActive) < 120) {
    wantJump = true;
  }

  stepCatPhysics(
    partner,
    world.level,
    world.mechanics,
    {
      moveX,
      jumpPressed: wantJump,
      jumpBufferActive: false,
      skillPressed: false,
      isSitting: false,
    },
    windActive,
    shelteredFromWind,
    dt,
    events,
    extraBounds ? { x: px(extraBounds.x), y: px(extraBounds.y), w: px(extraBounds.w), h: px(extraBounds.h) } : undefined,
  );

  // 夥伴掉坑無傷瞬移回主控貓安全點（INV-AI-03）
  if (partner.y > world.level.heightPx + 24) {
    const safe = findSafeSpotNear(world, activeCat, partner);
    const from = { x: partner.x, y: partner.y };
    partner.x = px(safe.x);
    partner.y = px(safe.y);
    partner.vx = 0;
    partner.vy = 0;
    world.partnerStuckTimer = sec(0);
    events.push({
      type: 'partner_teleport',
      catId: partner.id,
      from,
      to: { x: partner.x, y: partner.y },
    });
    return;
  }

  // 卡死計時與安全瞬移（僅在無關閉 gate 阻隔時允許，INV-AI-02）
  const movedDist = Math.hypot(partner.x - prevX, partner.y - prevY);
  if (distToActive > STUCK_MIN_DISTANCE && movedDist < 0.2) {
    world.partnerStuckTimer = sec(world.partnerStuckTimer + dt);
  } else {
    world.partnerStuckTimer = sec(0);
  }

  const blockedByGate = hasClosedGateBetween(world.mechanics, activeCat.x, partner.x);
  if (
    !blockedByGate &&
    (distToActive > TELEPORT_DISTANCE || world.partnerStuckTimer >= STUCK_TELEPORT_TIME)
  ) {
    const safe = findSafeSpotNear(world, activeCat, partner);
    const from = { x: partner.x, y: partner.y };
    partner.x = px(safe.x);
    partner.y = px(safe.y);
    partner.vx = 0;
    partner.vy = 0;
    world.partnerStuckTimer = sec(0);
    events.push({
      type: 'partner_teleport',
      catId: partner.id,
      from,
      to: { x: partner.x, y: partner.y },
    });
    events.push({ type: 'particle', kind: 'dust', x: partner.x, y: partner.y });
  }
}
