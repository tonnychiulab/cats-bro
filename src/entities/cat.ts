import { moveAndCollide } from '../core/physics';
import {
  BlackCatState,
  CAT_CONFIG,
  CatState,
  EntityId,
  InputSnapshot,
  LevelData,
  MechanicRuntime,
  OrangeCatState,
  Rect,
  Seconds,
  Vec2,
  WorldEvent,
  px,
  sec,
} from '../core/types';

export const COYOTE_DURATION = 0.1;
export const ORANGE_SMASH_DURATION = 0.18;
export const ORANGE_SMASH_SPEED = 165;
export const BLACK_DASH_DURATION = 0.16;
export const BLACK_DASH_SPEED = 262.5; // 42px / 0.16s
export const WALL_SLIDE_MAX_FALL = 48;
export const WIND_ACCEL_X = -165;

export function createOrangeCat(spawn: Vec2): OrangeCatState {
  return {
    id: 'orange',
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: false,
    onSlippery: false,
    inPuddle: false,
    coyoteTimer: sec(0),
    stamina: 100,
    staminaRegenTimer: sec(0),
    lastSafePos: { x: spawn.x, y: spawn.y },
    animState: 'idle',
    animTimer: sec(0),
    skill: { kind: 'none' },
  };
}

export function createBlackCat(spawn: Vec2): BlackCatState {
  return {
    id: 'black',
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: false,
    onSlippery: false,
    inPuddle: false,
    coyoteTimer: sec(0),
    stamina: 100,
    staminaRegenTimer: sec(0),
    lastSafePos: { x: spawn.x, y: spawn.y },
    animState: 'idle',
    animTimer: sec(0),
    wallSlideDir: 0,
    doubleJumpAvailable: true,
    skill: { kind: 'none' },
  };
}

export function getCatRect(cat: CatState): Rect {
  const cfg = CAT_CONFIG[cat.id];
  return {
    x: cat.x,
    y: cat.y,
    w: cfg.width,
    h: cfg.height,
  };
}

export function isCatShadowDashing(cat: CatState): boolean {
  return cat.id === 'black' && cat.skill.kind === 'shadowDash';
}

export function isCatSmashing(cat: CatState): boolean {
  return cat.id === 'orange' && cat.skill.kind === 'smash';
}

export function stepCatPhysics(
  cat: CatState,
  level: LevelData,
  mechanics: readonly MechanicRuntime[],
  controls: {
    moveX: -1 | 0 | 1;
    jumpPressed: boolean;
    jumpBufferActive: boolean;
    skillPressed: boolean;
    isSitting?: boolean;
  },
  windActive: boolean,
  shelteredFromWind: boolean,
  dt: Seconds,
  events: WorldEvent[],
  extraBounds?: Rect,
): { consumedJumpBuffer: boolean } {
  const cfg = CAT_CONFIG[cat.id];
  let consumedJumpBuffer = false;

  // 1. 體力自動回復
  if (cat.staminaRegenTimer > 0) {
    cat.staminaRegenTimer = sec(Math.max(0, cat.staminaRegenTimer - dt));
  } else if (cat.skill.kind === 'none' && cat.stamina < 100) {
    cat.stamina = Math.min(100, cat.stamina + cfg.staminaRegenRate * dt);
  }

  // 2. 專屬技能啟動
  if (controls.skillPressed && cat.skill.kind === 'none' && cat.stamina >= cfg.skillCost) {
    cat.stamina = Math.max(0, cat.stamina - cfg.skillCost);
    cat.staminaRegenTimer = cfg.staminaRegenDelay;
    if (cat.id === 'orange') {
      cat.skill = {
        kind: 'smash',
        remaining: sec(ORANGE_SMASH_DURATION),
        hitTargetIds: new Set<EntityId>(),
      };
      cat.vx = cat.facing * ORANGE_SMASH_SPEED;
      events.push({ type: 'sfx', id: 'smash' });
      events.push({ type: 'particle', kind: 'dust', x: px(cat.x + cfg.width / 2), y: px(cat.y + cfg.height) });
    } else {
      cat.skill = {
        kind: 'shadowDash',
        remaining: sec(BLACK_DASH_DURATION),
      };
      cat.vx = cat.facing * BLACK_DASH_SPEED;
      cat.vy = 0;
      events.push({ type: 'sfx', id: 'dash' });
      events.push({ type: 'particle', kind: 'dash', x: px(cat.x + cfg.width / 2), y: px(cat.y + cfg.height / 2) });
    }
  }

  // 3. 水平速度與技能狀態更新
  if (cat.id === 'black' && cat.skill.kind === 'shadowDash') {
    cat.vy = 0; // INV-CAT-02
    cat.vx = cat.facing * BLACK_DASH_SPEED;
    const rem = cat.skill.remaining - dt;
    if (rem <= 0) {
      cat.skill = { kind: 'none' };
      cat.vx *= 0.45;
    } else {
      cat.skill = { kind: 'shadowDash', remaining: sec(rem) };
    }
  } else if (cat.id === 'orange' && cat.skill.kind === 'smash') {
    cat.vx = cat.facing * ORANGE_SMASH_SPEED;
    const rem = cat.skill.remaining - dt;
    if (rem <= 0) {
      cat.skill = { kind: 'none' };
      cat.vx *= 0.3;
    } else {
      cat.skill = {
        kind: 'smash',
        remaining: sec(rem),
        hitTargetIds: cat.skill.hitTargetIds,
      };
    }
  } else {
    const speedMult = cat.inPuddle ? cfg.puddleSpeedMult : 1;
    const targetVx = controls.moveX * cfg.moveSpeed * speedMult;
    if (controls.moveX !== 0) {
      cat.facing = controls.moveX;
      const accel = cat.onSlippery && !cfg.windImmune ? cfg.groundAccel * 0.45 : cfg.groundAccel;
      if (cat.vx < targetVx) {
        cat.vx = Math.min(targetVx, cat.vx + accel * dt);
      } else if (cat.vx > targetVx) {
        cat.vx = Math.max(targetVx, cat.vx - accel * dt);
      }
    } else {
      const decel = cat.onSlippery ? cfg.slipperyDecel : cfg.groundDecel;
      if (cat.vx > 0) {
        cat.vx = Math.max(0, cat.vx - decel * dt);
      } else if (cat.vx < 0) {
        cat.vx = Math.min(0, cat.vx + decel * dt);
      }
    }

    // 陣風推力（橘貓抗風免疫；躲在推箱後方免疫）
    if (windActive && !cfg.windImmune && !shelteredFromWind) {
      cat.vx += WIND_ACCEL_X * dt;
      if (cat.vx < -cfg.moveSpeed * 1.45) {
        cat.vx = -cfg.moveSpeed * 1.45;
      }
    }
  }

  // 4. 跳躍（一段跳 / Coyote / Jump Buffer / 攀牆跳 / 黑貓二段跳）
  const wantsJump = controls.jumpPressed || controls.jumpBufferActive;
  const isDashing = isCatShadowDashing(cat);

  if (!isDashing) {
    if (wantsJump && (cat.grounded || cat.coyoteTimer > 0)) {
      cat.vy = cfg.jumpVelocity;
      cat.grounded = false;
      cat.coyoteTimer = sec(0);
      consumedJumpBuffer = true;
      events.push({ type: 'sfx', id: 'jump' });
      events.push({ type: 'particle', kind: 'dust', x: px(cat.x + cfg.width / 2), y: px(cat.y + cfg.height) });
    } else if (
      controls.jumpPressed &&
      cat.id === 'black' &&
      !cat.grounded &&
      cat.wallSlideDir !== 0
    ) {
      // 黑貓攀牆跳
      cat.vy = cfg.jumpVelocity * 0.94;
      cat.vx = -cat.wallSlideDir * cfg.moveSpeed * 1.15;
      cat.facing = (cat.wallSlideDir === 1 ? -1 : 1);
      cat.wallSlideDir = 0;
      consumedJumpBuffer = true;
      events.push({ type: 'sfx', id: 'jump' });
      events.push({ type: 'particle', kind: 'dust', x: px(cat.x + cfg.width / 2), y: px(cat.y + cfg.height / 2) });
    } else if (
      controls.jumpPressed &&
      cat.id === 'black' &&
      !cat.grounded &&
      cat.doubleJumpAvailable &&
      cfg.doubleJumpVelocity !== null
    ) {
      // 黑貓二段跳
      cat.vy = cfg.doubleJumpVelocity;
      cat.doubleJumpAvailable = false;
      consumedJumpBuffer = true;
      events.push({ type: 'sfx', id: 'double_jump' });
      events.push({ type: 'particle', kind: 'dash', x: px(cat.x + cfg.width / 2), y: px(cat.y + cfg.height) });
    }

    // 重力
    cat.vy += cfg.gravity * dt;
    if (cat.id === 'black' && cat.wallSlideDir !== 0 && cat.vy > WALL_SLIDE_MAX_FALL) {
      cat.vy = WALL_SLIDE_MAX_FALL;
    }
    if (cat.vy > 420) cat.vy = 420;
  }

  // 5. 移動與磚塊／機關碰撞
  const res = moveAndCollide(
    level,
    mechanics,
    cat.x,
    cat.y,
    cfg.width,
    cfg.height,
    cat.vx,
    cat.vy,
    dt,
    undefined,
    extraBounds,
  );

  cat.x = res.x;
  cat.y = res.y;
  cat.vx = res.vx;
  cat.vy = res.vy;
  cat.grounded = res.grounded;
  cat.onSlippery = res.onSlippery;
  cat.inPuddle = res.inPuddle;

  if (cat.grounded) {
    cat.coyoteTimer = sec(COYOTE_DURATION);
    cat.lastSafePos = { x: cat.x, y: cat.y };
    if (cat.id === 'black') {
      cat.doubleJumpAvailable = true;
      cat.wallSlideDir = 0;
    }
  } else {
    cat.coyoteTimer = sec(Math.max(0, cat.coyoteTimer - dt));
    if (cat.id === 'black') {
      cat.wallSlideDir =
        cfg.canWallJump && res.touchingClimbableWallDir !== 0 && cat.vy >= 0
          ? res.touchingClimbableWallDir
          : 0;
    }
  }

  // 6. 動畫狀態更新
  cat.animTimer = sec(cat.animTimer + dt);
  if (cat.skill.kind !== 'none') {
    cat.animState = 'skill';
  } else if (controls.isSitting && cat.grounded) {
    cat.animState = 'sit';
  } else if (!cat.grounded) {
    if (cat.id === 'black' && cat.wallSlideDir !== 0) {
      cat.animState = 'wallSlide';
    } else {
      cat.animState = cat.vy < 0 ? 'jump' : 'fall';
    }
  } else if (Math.abs(cat.vx) > 6) {
    cat.animState = 'run';
  } else {
    cat.animState = 'idle';
  }

  return { consumedJumpBuffer };
}

export function extractPlayerControls(input: InputSnapshot): {
  moveX: -1 | 0 | 1;
  jumpPressed: boolean;
  jumpBufferActive: boolean;
  skillPressed: boolean;
} {
  let moveX: -1 | 0 | 1 = 0;
  if (input.held.left && !input.held.right) moveX = -1;
  else if (input.held.right && !input.held.left) moveX = 1;
  return {
    moveX,
    jumpPressed: input.justPressed.jump,
    jumpBufferActive: input.jumpBufferTimer > 0,
    skillPressed: input.justPressed.skill,
  };
}
