import { moveAndCollide, rectsOverlap } from '../core/physics';
import {
  BOSS_MAX_HP,
  BossBadCatState,
  CatState,
  LevelData,
  MechanicRuntime,
  ProjectileState,
  Rect,
  Seconds,
  WorldEvent,
  entityId,
  getBossPhase,
  px,
  sec,
} from '../core/types';
import { getCatRect, isCatSmashing } from './cat';

let projectileSeq = 0;

export function createDormantBoss(level: LevelData): BossBadCatState | null {
  if (level.bossEncounter !== 'battle' || !level.bossArena || !level.bossSpawn) {
    return null;
  }
  return {
    status: 'dormant',
    arenaBounds: level.bossArena,
    spawnPos: level.bossSpawn,
  };
}

export type ActiveBossState = Extract<BossBadCatState, { status: 'active' }>;

export function activateBoss(boss: BossBadCatState): ActiveBossState {
  if (boss.status === 'active') return boss;
  return {
    status: 'active',
    id: entityId('boss_scarface'),
    x: boss.spawnPos.x,
    y: boss.spawnPos.y,
    vx: 0,
    vy: 0,
    w: px(24),
    h: px(22),
    facing: -1,
    hp: BOSS_MAX_HP,
    behavior: { kind: 'IDLE', remaining: sec(1.0) },
    arenaBounds: boss.arenaBounds,
    spawnPos: boss.spawnPos,
  };
}

export function stunBoss(boss: BossBadCatState, duration: Seconds, events: WorldEvent[]): void {
  if (boss.status !== 'active' || boss.behavior.kind === 'DEFEATED') return;
  boss.vx = 0;
  boss.behavior = { kind: 'STUNNED', remaining: duration };
  events.push({ type: 'sfx', id: 'boss_stun' });
  events.push({ type: 'particle', kind: 'stun', x: px(boss.x + boss.w / 2), y: boss.y });
  events.push({ type: 'screen_shake', intensity: 3, duration: sec(0.2) });
}

export function getBossWindActive(boss: BossBadCatState | null): boolean {
  return (
    boss !== null &&
    boss.status === 'active' &&
    boss.behavior.kind === 'THROW_CANS' &&
    boss.behavior.windActive
  );
}

export function stepBossBadCat(
  boss: BossBadCatState,
  level: LevelData,
  mechanics: readonly MechanicRuntime[],
  activeCat: CatState,
  orangeCat: CatState,
  projectiles: ProjectileState[],
  dt: Seconds,
  events: WorldEvent[],
): { bossContactDamage: boolean } {
  if (boss.status !== 'active') return { bossContactDamage: false };
  if (boss.behavior.kind === 'DEFEATED') return { bossContactDamage: false };

  const phase = getBossPhase(boss.hp);
  const arena = boss.arenaBounds;
  const bossRect: Rect = { x: boss.x, y: boss.y, w: boss.w, h: boss.h };

  // 1. 檢查橘貓猛擊破防（僅 STUNNED 狀態有效，並由 hitTargetIds 去重，INV-BOSS-01）
  if (boss.behavior.kind === 'STUNNED' && orangeCat.id === 'orange' && isCatSmashing(orangeCat) && orangeCat.skill.kind === 'smash') {
    if (!orangeCat.skill.hitTargetIds.has(boss.id)) {
      const oRect = getCatRect(orangeCat);
      if (rectsOverlap(oRect, bossRect)) {
        orangeCat.skill.hitTargetIds.add(boss.id);
        const nextHp = Math.max(0, boss.hp - 1) as 0 | 1 | 2 | 3;
        boss.hp = nextHp;
        events.push({ type: 'sfx', id: 'boss_hit' });
        events.push({ type: 'screen_shake', intensity: 4, duration: sec(0.25) });
        events.push({ type: 'particle', kind: 'gold', x: px(boss.x + boss.w / 2), y: px(boss.y + boss.h / 2) });
        if (nextHp === 0) {
          boss.vx = 0;
          boss.vy = 0;
          boss.behavior = { kind: 'DEFEATED' };
          events.push({ type: 'sfx', id: 'clear' });
          events.push({
            type: 'dialogue',
            speaker: '疤面老大',
            text: '可惡…居然敗給兩隻家貓和一隻土狗！這屋頂讓你們過就是了！',
          });
        } else {
          boss.vx = -boss.facing * 90;
          boss.vy = -120;
          boss.behavior = { kind: 'HURT', remaining: sec(0.8) };
        }
        return { bossContactDamage: false };
      }
    }
  }

  // 2. 行為狀態機推進
  const b = boss.behavior;
  if (b.kind === 'IDLE') {
    boss.vx *= 0.85;
    const rem = b.remaining - dt;
    if (rem <= 0) {
      boss.facing = activeCat.x < boss.x ? -1 : 1;
      if (phase === 2 && Math.abs(boss.y - (arena.y + 36)) > 20) {
        boss.behavior = {
          kind: 'JUMP_PERCH',
          targetPos: { x: px(arena.x + arena.w - 48), y: px(arena.y + 36) },
        };
        boss.vy = -260;
      } else if (phase === 3) {
        boss.behavior = {
          kind: 'TELEGRAPH_CLAW',
          remaining: sec(0.55),
          targetX: activeCat.x,
          dashesLeft: 2,
        };
        events.push({ type: 'sfx', id: 'boss_roar' });
      } else {
        boss.behavior = {
          kind: 'TELEGRAPH_CLAW',
          remaining: sec(0.65),
          targetX: activeCat.x,
          dashesLeft: 1,
        };
        events.push({ type: 'sfx', id: 'boss_roar' });
      }
    } else {
      boss.behavior = { kind: 'IDLE', remaining: sec(rem) };
    }
  } else if (b.kind === 'TELEGRAPH_CLAW') {
    boss.vx = 0;
    boss.facing = b.targetX < boss.x ? -1 : 1;
    const rem = b.remaining - dt;
    if (rem <= 0) {
      boss.vx = boss.facing * (phase === 3 ? 215 : 185);
      boss.behavior = { kind: 'CLAW_DASH', remaining: sec(0.95), dashesLeft: b.dashesLeft };
    } else {
      boss.behavior = { ...b, remaining: sec(rem) };
    }
  } else if (b.kind === 'CLAW_DASH') {
    const rem = b.remaining - dt;
    const hitLeftWall = boss.x <= arena.x + 4 && boss.vx < 0;
    const hitRightWall = boss.x + boss.w >= arena.x + arena.w - 4 && boss.vx > 0;
    if (hitLeftWall || hitRightWall) {
      // 撞上水塔牆壁進入暈眩！
      stunBoss(boss, sec(2.2), events);
      boss.vx = -boss.facing * 40;
      boss.vy = -80;
    } else if (rem <= 0) {
      if (b.dashesLeft > 1) {
        boss.behavior = {
          kind: 'CALL_LIGHTNING',
          remaining: sec(0.9),
          strikeX: activeCat.x,
        };
        projectiles.push({
          id: entityId(`boss_bolt_${++projectileSeq}`),
          kind: 'bossLightning',
          x: activeCat.x,
          y: arena.y,
          vx: 0,
          vy: 0,
          w: px(16),
          h: arena.h,
          timer: sec(0.85),
          active: false,
        });
      } else {
        boss.behavior = { kind: 'IDLE', remaining: sec(0.8) };
      }
    } else {
      boss.behavior = { ...b, remaining: sec(rem) };
    }
  } else if (b.kind === 'JUMP_PERCH') {
    const dx = b.targetPos.x - boss.x;
    boss.vx = Math.max(-130, Math.min(130, dx * 3));
    if (Math.abs(dx) < 12 && boss.y <= b.targetPos.y + 18) {
      boss.vx = 0;
      boss.vy = 0;
      boss.facing = -1;
      boss.behavior = {
        kind: 'THROW_CANS',
        remaining: sec(0.55),
        cansRemaining: 3,
        windActive: true,
      };
    }
  } else if (b.kind === 'THROW_CANS') {
    boss.vx = 0;
    boss.vy = 0; // 停在高台
    const rem = b.remaining - dt;
    if (rem <= 0) {
      if (b.cansRemaining > 0) {
        projectiles.push({
          id: entityId(`fish_can_${++projectileSeq}`),
          kind: 'fishCan',
          x: px(boss.x),
          y: px(boss.y + 6),
          vx: -115 - (3 - b.cansRemaining) * 28,
          vy: -135,
          w: px(8),
          h: px(8),
          timer: sec(3.0),
          active: true,
        });
        boss.behavior = {
          kind: 'THROW_CANS',
          remaining: sec(0.75),
          cansRemaining: b.cansRemaining - 1,
          windActive: true,
        };
      } else {
        boss.behavior = { kind: 'IDLE', remaining: sec(0.9) };
      }
    } else {
      boss.behavior = { ...b, remaining: sec(rem) };
    }
  } else if (b.kind === 'CALL_LIGHTNING') {
    boss.vx = 0;
    const rem = b.remaining - dt;
    if (rem <= 0) {
      boss.behavior = {
        kind: 'TELEGRAPH_CLAW',
        remaining: sec(0.5),
        targetX: activeCat.x,
        dashesLeft: 1,
      };
    } else {
      boss.behavior = { ...b, remaining: sec(rem) };
    }
  } else if (b.kind === 'STUNNED') {
    boss.vx *= 0.85;
    const rem = b.remaining - dt;
    if (rem <= 0) {
      boss.behavior = { kind: 'IDLE', remaining: sec(0.6) };
    } else {
      boss.behavior = { kind: 'STUNNED', remaining: sec(rem) };
    }
  } else if (b.kind === 'HURT') {
    boss.vx *= 0.9;
    const rem = b.remaining - dt;
    if (rem <= 0) {
      boss.behavior = { kind: 'IDLE', remaining: sec(0.7) };
    } else {
      boss.behavior = { kind: 'HURT', remaining: sec(rem) };
    }
  }

  // 3. 物理移動（高台投罐頭期間懸停不墜落）
  if (boss.behavior.kind !== 'THROW_CANS') {
    boss.vy = Math.min(380, boss.vy + 640 * dt);
    const res = moveAndCollide(
      level,
      mechanics,
      boss.x,
      boss.y,
      boss.w,
      boss.h,
      boss.vx,
      boss.vy,
      dt,
      undefined,
      arena,
    );
    boss.x = res.x;
    boss.y = res.y;
    boss.vx = res.vx;
    boss.vy = res.vy;
  }

  // 4. 接觸傷害判定（STUNNED / HURT / DEFEATED 不傷人）
  const dangerous =
    boss.behavior.kind !== 'STUNNED' &&
    boss.behavior.kind !== 'HURT';
  const hitActiveCat = dangerous && rectsOverlap(getCatRect(activeCat), { x: boss.x, y: boss.y, w: boss.w, h: boss.h });

  return { bossContactDamage: hitActiveCat };
}
