import { moveAndCollide, rectsOverlap } from '../core/physics';
import {
  CAT_CONFIG,
  CatState,
  LevelData,
  MechanicRuntime,
  MechanicSpec,
  Rect,
  Seconds,
  TriggerId,
  WorldEvent,
  px,
  sec,
} from '../core/types';
import { getCatRect, isCatSmashing } from './cat';

export function createMechanicsRuntime(specs: readonly MechanicSpec[]): MechanicRuntime[] {
  return specs.map((spec) => ({
    spec,
    rect: { x: spec.rect.x, y: spec.rect.y, w: spec.rect.w, h: spec.rect.h },
    prevX: spec.rect.x,
    prevY: spec.rect.y,
    vy: 0,
    broken: false,
    active: false,
    warning: false,
    progress: 0,
    direction: 1,
    timer: spec.kind === 'hazard' ? spec.phaseOffset : sec(0),
  }));
}

export function isShelteredFromWind(
  cat: CatState,
  mechanics: readonly MechanicRuntime[],
): boolean {
  const cRect = getCatRect(cat);
  for (const m of mechanics) {
    if (m.spec.kind === 'pushBox' && m.spec.blocksWind) {
      // 陣風向左吹（-X），因此躲在木箱左側 28px 內且垂直重疊即受保護
      const shelterZone: Rect = {
        x: px(m.rect.x - 28),
        y: px(m.rect.y - 4),
        w: px(28 + m.rect.w),
        h: px(m.rect.h + 4),
      };
      if (rectsOverlap(cRect, shelterZone)) {
        return true;
      }
    }
  }
  return false;
}

export function stepMechanics(
  level: LevelData,
  mechanics: MechanicRuntime[],
  cats: readonly CatState[],
  dt: Seconds,
  events: WorldEvent[],
  onWaterValveTriggered?: () => void,
): void {
  const activeTriggers = new Set<TriggerId>();

  // 1. 脆紙箱（僅橘貓猛擊可撞碎）與推箱（橘貓可推動、重力落地、掉坑重生）
  for (const m of mechanics) {
    m.prevX = m.rect.x;
    m.prevY = m.rect.y;

    if (m.spec.kind === 'crate' && !m.broken) {
      for (const cat of cats) {
        if (cat.id === 'orange' && isCatSmashing(cat) && cat.skill.kind === 'smash') {
          if (cat.skill.hitTargetIds.has(m.spec.id)) continue;
          const probe = getCatRect(cat);
          const expanded: Rect = {
            x: px(probe.x - 3),
            y: px(probe.y - 1),
            w: px(probe.w + 6),
            h: px(probe.h + 2),
          };
          if (rectsOverlap(expanded, m.rect)) {
            cat.skill.hitTargetIds.add(m.spec.id);
            m.broken = true;
            events.push({ type: 'sfx', id: 'crate_break' });
            events.push({
              type: 'particle',
              kind: 'crate',
              x: px(m.rect.x + m.rect.w / 2),
              y: px(m.rect.y + m.rect.h / 2),
            });
            events.push({ type: 'screen_shake', intensity: 2, duration: sec(0.12) });
            break;
          }
        }
      }
    } else if (m.spec.kind === 'pushBox') {
      let pushVx = 0;
      for (const cat of cats) {
        if (cat.id !== 'orange') continue;
        const cRect = getCatRect(cat);
        const touchRight =
          cRect.x + cRect.w >= m.rect.x - 2 &&
          cRect.x + cRect.w <= m.rect.x + 5 &&
          cRect.y + cRect.h > m.rect.y + 2 &&
          cRect.y < m.rect.y + m.rect.h - 2 &&
          cat.vx >= 0 &&
          cat.facing === 1;
        const touchLeft =
          cRect.x <= m.rect.x + m.rect.w + 2 &&
          cRect.x >= m.rect.x + m.rect.w - 5 &&
          cRect.y + cRect.h > m.rect.y + 2 &&
          cRect.y < m.rect.y + m.rect.h - 2 &&
          cat.vx <= 0 &&
          cat.facing === -1;

        if (touchRight && (Math.abs(cat.vx) > 5 || isCatSmashing(cat))) {
          pushVx = isCatSmashing(cat) ? 80 : 48;
        } else if (touchLeft && (Math.abs(cat.vx) > 5 || isCatSmashing(cat))) {
          pushVx = isCatSmashing(cat) ? -80 : -48;
        }
      }

      m.vy = Math.min(360, m.vy + 680 * dt);
      const moved = moveAndCollide(
        level,
        mechanics,
        m.rect.x,
        m.rect.y,
        m.rect.w,
        m.rect.h,
        pushVx,
        m.vy,
        dt,
        m.spec.id,
      );
      m.rect.x = moved.x;
      m.rect.y = moved.y;
      m.vy = moved.vy;

      // 木箱掉坑立即於初始座標重生（防推箱軟鎖）
      if (m.rect.y > level.heightPx + 24) {
        m.rect.x = m.spec.rect.x;
        m.rect.y = m.spec.rect.y;
        m.vy = 0;
        events.push({ type: 'particle', kind: 'dust', x: m.rect.x, y: m.rect.y });
      }
    }
  }

  // 2. 觸發器（重壓踏板 / 觸碰開關 / 牆面拉桿）
  for (const m of mechanics) {
    if (m.spec.kind !== 'trigger') continue;
    const wasActive = m.active;
    let triggeredNow = m.spec.latched && m.active;

    if (!triggeredNow) {
      const zone: Rect = {
        x: px(m.rect.x - 1),
        y: px(m.rect.y - 3),
        w: px(m.rect.w + 2),
        h: px(m.rect.h + 4),
      };
      if (m.spec.activation === 'weight2') {
        // 僅橘貓（weight=2）或 pushBox 可壓下
        for (const cat of cats) {
          if (CAT_CONFIG[cat.id].weight >= 2 && rectsOverlap(getCatRect(cat), zone)) {
            triggeredNow = true;
            break;
          }
        }
        if (!triggeredNow) {
          for (const other of mechanics) {
            if (other.spec.kind === 'pushBox' && rectsOverlap(other.rect, zone)) {
              triggeredNow = true;
              break;
            }
          }
        }
      } else {
        for (const cat of cats) {
          if (rectsOverlap(getCatRect(cat), zone)) {
            triggeredNow = true;
            break;
          }
        }
      }
    }

    m.active = triggeredNow;
    if (m.active && !wasActive) {
      events.push({ type: 'sfx', id: 'switch' });
    }
    if (m.active) {
      activeTriggers.add(m.spec.id);
    }
  }

  // 3. 鐵捲門（多 TriggerId 聯動）
  for (const m of mechanics) {
    if (m.spec.kind !== 'gate') continue;
    const wasOpen = m.active;
    const allMet = m.spec.requiredTriggerIds.every((id) => activeTriggers.has(id));
    m.active = allMet;
    if (m.active && !wasOpen) {
      events.push({ type: 'sfx', id: 'switch' });
      events.push({ type: 'particle', kind: 'dust', x: m.rect.x, y: m.rect.y });
    }
  }

  // 4. 移動平台與電源升降梯（同步帶動站立於上方的雙貓與推箱）
  for (const m of mechanics) {
    if (m.spec.kind !== 'movingPlatform') continue;
    const enabled =
      !m.spec.requiredTriggerIds ||
      m.spec.requiredTriggerIds.every((id) => activeTriggers.has(id));
    m.active = enabled;
    if (!enabled) continue;

    const startX = m.spec.rect.x;
    const startY = m.spec.rect.y;
    const dist = Math.hypot(m.spec.endPos.x - startX, m.spec.endPos.y - startY);
    if (dist > 0.1) {
      m.progress += (m.spec.speed * dt * m.direction) / dist;
      if (m.progress >= 1) {
        m.progress = 1;
        m.direction = -1;
      } else if (m.progress <= 0) {
        m.progress = 0;
        m.direction = 1;
      }
      const nextX = px(startX + (m.spec.endPos.x - startX) * m.progress);
      const nextY = px(startY + (m.spec.endPos.y - startY) * m.progress);
      const dx = nextX - m.rect.x;
      const dy = nextY - m.rect.y;
      m.rect.x = nextX;
      m.rect.y = nextY;

      // 載客位移（PSTACK Round 2 守則 #1）
      for (const cat of cats) {
        const cRect = getCatRect(cat);
        const onTop =
          cat.grounded &&
          cRect.x + cRect.w > m.prevX + 1 &&
          cRect.x < m.prevX + m.rect.w - 1 &&
          Math.abs(cRect.y + cRect.h - m.prevY) <= 3;
        if (onTop) {
          cat.x = px(cat.x + dx);
          cat.y = px(cat.y + dy);
        }
      }
      for (const other of mechanics) {
        if (other.spec.kind !== 'pushBox') continue;
        const onTop =
          other.rect.x + other.rect.w > m.prevX + 1 &&
          other.rect.x < m.prevX + m.rect.w - 1 &&
          Math.abs(other.rect.y + other.rect.h - m.prevY) <= 3;
        if (onTop) {
          other.rect.x = px(other.rect.x + dx);
          other.rect.y = px(other.rect.y + dy);
        }
      }
    }
  }

  // 5. 彈跳遮雨棚（spring）
  for (const m of mechanics) {
    if (m.spec.kind !== 'spring') continue;
    if (m.timer > 0) m.timer = sec(Math.max(0, m.timer - dt));
    for (const cat of cats) {
      const cRect = getCatRect(cat);
      if (cat.vy >= 0 && rectsOverlap(cRect, m.rect)) {
        cat.vy = m.spec.launchVy;
        cat.grounded = false;
        if (cat.id === 'black') cat.doubleJumpAvailable = true;
        m.timer = sec(0.22);
        events.push({ type: 'sfx', id: 'bounce' });
        events.push({ type: 'particle', kind: 'dust', x: px(m.rect.x + m.rect.w / 2), y: m.rect.y });
      }
    }
  }

  // 6. 週期危險陷阱（湯鍋蒸氣 / 積水落雷）
  for (const m of mechanics) {
    if (m.spec.kind !== 'hazard') continue;
    const t = ((m.timer + dt) % m.spec.period + m.spec.period) % m.spec.period;
    m.timer = sec(t);
    const activeStart = m.spec.period - m.spec.activeDuration;
    const warnStart = Math.max(0, activeStart - m.spec.warnDuration);
    m.active = t >= activeStart;
    m.warning = t >= warnStart && t < activeStart;
  }

  // 7. 水塔水閥（3-3 Boss 戰）
  for (const m of mechanics) {
    if (m.spec.kind !== 'waterValve') continue;
    if (m.timer > 0) {
      m.timer = sec(Math.max(0, m.timer - dt));
      m.active = m.timer > m.spec.cooldown - 0.8;
      continue;
    }
    m.active = false;
    for (const cat of cats) {
      if (rectsOverlap(getCatRect(cat), m.rect)) {
        m.timer = m.spec.cooldown;
        m.active = true;
        events.push({ type: 'sfx', id: 'switch' });
        events.push({ type: 'particle', kind: 'splash', x: m.rect.x, y: px(m.rect.y + 12) });
        onWaterValveTriggered?.();
        break;
      }
    }
  }
}
