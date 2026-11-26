import { rectsOverlap } from '../core/physics';
import {
  ALL_LEVEL_IDS,
  EnemyRuntime,
  FISH_PER_EXTRA_LIFE,
  HERO_RESCUE_LIVES,
  HERO_SHIELD_DURATION,
  HURT_INVULN_DURATION,
  InputSnapshot,
  LOGICAL_WIDTH,
  LevelData,
  LevelId,
  MAX_LIVES,
  Rect,
  SWITCH_GRACE_DURATION,
  SaveDataV1,
  Seconds,
  WorldEvent,
  WorldState,
  px,
  sec,
} from '../core/types';
import {
  activateBoss,
  createDormantBoss,
  getBossWindActive,
  stepBossBadCat,
  stunBoss,
} from './bossBadCat';
import {
  createBlackCat,
  createOrangeCat,
  extractPlayerControls,
  getCatRect,
  isCatShadowDashing,
  stepCatPhysics,
} from './cat';
import {
  createMechanicsRuntime,
  isShelteredFromWind,
  stepMechanics,
} from './mechanics';
import { recordBreadcrumb, stepPartnerAI } from './partnerAI';

export function createEnemiesRuntime(level: LevelData): EnemyRuntime[] {
  return level.enemies.map((spec) => ({
    spec,
    x: spec.startPos.x,
    y: spec.startPos.y,
    vx: spec.speed,
    w: px(spec.variant === 'guardDog' ? 20 : 16),
    h: px(spec.variant === 'guardDog' ? 14 : 12),
    facing: 1,
    stunTimer: sec(0),
  }));
}

export function createWorld(level: LevelData, save: SaveDataV1): WorldState {
  return {
    scene: { kind: 'PLAYING' },
    level,
    activeCatId: 'orange',
    partnerMode: 'FOLLOW',
    cats: {
      orange: createOrangeCat(level.spawnOrange),
      black: createBlackCat(level.spawnBlack),
    },
    breadcrumbs: [],
    partnerStuckTimer: sec(0),
    lives: MAX_LIVES,
    score: 0,
    fishBank: 0,
    collectedFishIds: new Set(),
    yarnCollectedInLevel: false,
    checkpointReached: false,
    hurtInvulnTimer: sec(0),
    heroShieldTimer: sec(0),
    switchGraceTimer: sec(0),
    hitStopTimer: sec(0),
    windTimer: sec(0),
    windActive: false,
    windWarning: false,
    heroBonded: save.heroBonded,
    heroRescueUsedInLevel: false,
    heroRescueAnim: { active: false, timer: sec(0), x: px(0), y: px(0) },
    tauntTriggered: false,
    boss: createDormantBoss(level),
    mechanics: createMechanicsRuntime(level.mechanics),
    enemies: createEnemiesRuntime(level),
    projectiles: [],
    cameraX: px(0),
    elapsed: sec(0),
    switchRipple: null,
    goalWaitingHintTimer: sec(0),
  };
}

export function respawnAtCheckpoint(world: WorldState, events: WorldEvent[]): void {
  const anchor = world.checkpointReached ? world.level.checkpoint : world.level.spawnOrange;
  const orangePos = { x: anchor.x, y: anchor.y };
  const blackPos = { x: px(Math.max(8, anchor.x - 16)), y: anchor.y };

  world.lives = MAX_LIVES;
  world.cats.orange = createOrangeCat(orangePos);
  world.cats.black = createBlackCat(blackPos);
  world.breadcrumbs = [];
  world.partnerMode = 'FOLLOW';
  world.partnerStuckTimer = sec(0);
  world.hurtInvulnTimer = sec(0.6);
  world.heroShieldTimer = sec(0);
  world.switchGraceTimer = sec(0);
  world.projectiles = [];
  // 重生矩陣：推箱、脆紙箱、開關、水閥與 Boss 重置；已拾取小魚乾、毛線球、heroRescueUsedInLevel 保留
  world.mechanics = createMechanicsRuntime(world.level.mechanics);
  world.enemies = createEnemiesRuntime(world.level);
  world.boss = createDormantBoss(world.level);
  world.scene = { kind: 'PLAYING' };
  events.push({ type: 'bgm', track: `ch${world.level.chapter}` });
}

export function isPlayerImmuneToContact(world: WorldState): boolean {
  const activeCat = world.cats[world.activeCatId];
  return (
    world.hurtInvulnTimer > 0 ||
    world.heroShieldTimer > 0 ||
    world.switchGraceTimer > 0 ||
    isCatShadowDashing(activeCat)
  );
}

export function applyPlayerDamage(
  world: WorldState,
  isPit: boolean,
  events: WorldEvent[],
): void {
  if (!isPit && isPlayerImmuneToContact(world)) return;

  const activeCat = world.cats[world.activeCatId];
  const nextLives = world.lives - 1;

  // 方案 A（全 9 關統一無特例）：瀕死時若已與忠犬阿福結緣且本關尚未救援，攔截致死！
  if (nextLives <= 0 && world.heroBonded && !world.heroRescueUsedInLevel) {
    world.heroRescueUsedInLevel = true;
    world.lives = HERO_RESCUE_LIVES;
    world.heroShieldTimer = HERO_SHIELD_DURATION;
    world.hitStopTimer = sec(0.25);
    world.heroRescueAnim = {
      active: true,
      timer: sec(1.3),
      x: px(activeCat.x - 40),
      y: activeCat.y,
    };
    if (isPit) {
      activeCat.x = activeCat.lastSafePos.x;
      activeCat.y = activeCat.lastSafePos.y;
      activeCat.vx = 0;
      activeCat.vy = 0;
    }
    // 撞飛畫面內巡邏野狗
    for (const enemy of world.enemies) {
      if (Math.abs(enemy.x - activeCat.x) < 160) {
        enemy.stunTimer = sec(3.0);
      }
    }
    // 若 3-3 Boss 存活，直接撞暈 2.5s 創造破防空檔
    if (world.boss && world.boss.status === 'active') {
      stunBoss(world.boss, sec(2.5), events);
    }
    events.push({ type: 'sfx', id: 'hero_bark' });
    events.push({ type: 'particle', kind: 'gold', x: activeCat.x, y: activeCat.y });
    events.push({ type: 'screen_shake', intensity: 4, duration: sec(0.3) });
    return;
  }

  world.lives = Math.max(0, nextLives);
  events.push({ type: 'sfx', id: 'hurt' });
  events.push({ type: 'screen_shake', intensity: 3, duration: sec(0.18) });

  if (isPit) {
    activeCat.x = activeCat.lastSafePos.x;
    activeCat.y = activeCat.lastSafePos.y;
    activeCat.vx = 0;
    activeCat.vy = 0;
  } else {
    world.hurtInvulnTimer = HURT_INVULN_DURATION;
    activeCat.vy = -120;
    activeCat.vx = -activeCat.facing * 70;
  }

  if (world.lives <= 0) {
    world.scene = { kind: 'RESPAWN', remaining: sec(1.1) };
  }
}

export function stepWorld(
  world: WorldState,
  input: InputSnapshot,
  dt: Seconds,
): WorldEvent[] {
  const events: WorldEvent[] = [];

  // 對話框狀態處理（含 minLockTimer 0.25s 防 Space 誤跳）
  if (world.scene.kind === 'DIALOGUE') {
    const rem = Math.max(0, world.scene.minLockTimer - dt);
    if (rem > 0) {
      world.scene = { ...world.scene, minLockTimer: sec(rem) };
    } else if (input.justPressed.confirm) {
      world.scene = { kind: 'PLAYING' };
      input.jumpBufferTimer = sec(0);
    }
    return events;
  }

  // 重生過場
  if (world.scene.kind === 'RESPAWN') {
    const rem = world.scene.remaining - dt;
    if (rem <= 0) {
      respawnAtCheckpoint(world, events);
    } else {
      world.scene = { kind: 'RESPAWN', remaining: sec(rem) };
    }
    return events;
  }

  if (world.scene.kind !== 'PLAYING') {
    return events;
  }

  // Hit-stop 凍結幀（阿福登場瞬間）
  if (world.hitStopTimer > 0) {
    world.hitStopTimer = sec(Math.max(0, world.hitStopTimer - dt));
    return events;
  }

  world.elapsed = sec(world.elapsed + dt);
  if (world.hurtInvulnTimer > 0) world.hurtInvulnTimer = sec(Math.max(0, world.hurtInvulnTimer - dt));
  if (world.heroShieldTimer > 0) world.heroShieldTimer = sec(Math.max(0, world.heroShieldTimer - dt));
  if (world.switchGraceTimer > 0) world.switchGraceTimer = sec(Math.max(0, world.switchGraceTimer - dt));
  if (world.goalWaitingHintTimer > 0) world.goalWaitingHintTimer = sec(Math.max(0, world.goalWaitingHintTimer - dt));
  if (world.switchRipple) {
    const t = world.switchRipple.timer - dt;
    world.switchRipple = t > 0 ? { ...world.switchRipple, timer: sec(t) } : null;
  }
  if (world.heroRescueAnim.active) {
    const t = world.heroRescueAnim.timer - dt;
    world.heroRescueAnim.x = px(world.heroRescueAnim.x + 210 * dt);
    if (t <= 0) {
      world.heroRescueAnim.active = false;
      world.heroRescueAnim.timer = sec(0);
    } else {
      world.heroRescueAnim.timer = sec(t);
    }
  }

  // 1. 切換主控貓與待命模式
  if (input.justPressed.switchCat) {
    world.activeCatId = world.activeCatId === 'orange' ? 'black' : 'orange';
    world.switchGraceTimer = SWITCH_GRACE_DURATION;
    if (world.partnerMode === 'STAY') {
      // 切到原本待命的貓時，自動讓新夥伴進入跟隨或保持由玩家決定：解除原待命貓鎖定
      world.partnerMode = 'FOLLOW';
    }
    const nowActive = world.cats[world.activeCatId];
    world.switchRipple = {
      timer: sec(0.32),
      x: px(nowActive.x + 6),
      y: px(nowActive.y + 6),
      catId: world.activeCatId,
    };
    events.push({ type: 'sfx', id: world.activeCatId === 'orange' ? 'meow_orange' : 'meow_black' });
  }

  if (input.justPressed.toggleStay) {
    world.partnerMode = world.partnerMode === 'FOLLOW' ? 'STAY' : 'FOLLOW';
    events.push({ type: 'sfx', id: 'switch' });
  }

  // 2. 陣風單點衍生（PSTACK Round 2 守則 #2）
  const bossWind = getBossWindActive(world.boss);
  if (world.level.hasWind) {
    const wt = (world.windTimer + dt) % 5.0;
    world.windTimer = sec(wt);
    world.windWarning = wt >= 2.0 && wt < 2.5;
    world.windActive = wt >= 2.5 || bossWind;
  } else {
    world.windWarning = false;
    world.windActive = bossWind;
  }

  const activeCat = world.cats[world.activeCatId];
  const partnerCat = world.cats[world.activeCatId === 'orange' ? 'black' : 'orange'];
  const bossBounds = world.boss && world.boss.status === 'active' ? world.boss.arenaBounds : undefined;

  // 3. 步進主控貓與夥伴貓
  const controls = extractPlayerControls(input);
  const { consumedJumpBuffer } = stepCatPhysics(
    activeCat,
    world.level,
    world.mechanics,
    controls,
    world.windActive,
    isShelteredFromWind(activeCat, world.mechanics),
    dt,
    events,
    bossBounds,
  );
  if (consumedJumpBuffer) {
    input.jumpBufferTimer = sec(0);
  }
  recordBreadcrumb(world, activeCat, consumedJumpBuffer);

  stepPartnerAI(
    world,
    activeCat,
    partnerCat,
    world.windActive,
    isShelteredFromWind(partnerCat, world.mechanics),
    dt,
    events,
    bossBounds,
  );

  // 4. 步進機關（含水閥淋水暈眩 Boss）
  stepMechanics(
    world.level,
    world.mechanics,
    [world.cats.orange, world.cats.black],
    dt,
    events,
    () => {
      if (world.boss && world.boss.status === 'active') {
        stunBoss(world.boss, sec(2.5), events);
      }
    },
  );

  // 5. 深坑判定（主控貓）
  if (activeCat.y > world.level.heightPx + 24) {
    applyPlayerDamage(world, true, events);
  }

  // 6. 巡邏野狗與危險陷阱接觸判定（僅傷主控貓，INV-AI-03）
  const activeRect = getCatRect(activeCat);
  for (const enemy of world.enemies) {
    if (enemy.stunTimer > 0) {
      enemy.stunTimer = sec(Math.max(0, enemy.stunTimer - dt));
      continue;
    }
    enemy.x = px(enemy.x + enemy.vx * dt);
    if (enemy.x <= enemy.spec.patrolMinX) {
      enemy.x = enemy.spec.patrolMinX;
      enemy.vx = Math.abs(enemy.spec.speed);
      enemy.facing = 1;
    } else if (enemy.x + enemy.w >= enemy.spec.patrolMaxX) {
      enemy.x = px(enemy.spec.patrolMaxX - enemy.w);
      enemy.vx = -Math.abs(enemy.spec.speed);
      enemy.facing = -1;
    }
    const eRect: Rect = { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h };
    if (rectsOverlap(activeRect, eRect)) {
      applyPlayerDamage(world, false, events);
    }
  }

  for (const m of world.mechanics) {
    if (m.spec.kind === 'hazard' && m.active && rectsOverlap(activeRect, m.rect)) {
      applyPlayerDamage(world, false, events);
    }
  }

  // 7. 投射物更新（Boss 魚罐頭與落雷）
  for (let i = world.projectiles.length - 1; i >= 0; i--) {
    const p = world.projectiles[i]!;
    p.timer = sec(p.timer - dt);
    if (p.kind === 'fishCan') {
      p.vy += 420 * dt;
      p.x = px(p.x + p.vx * dt);
      p.y = px(p.y + p.vy * dt);
      // 碰到推箱被擋下
      let blocked = false;
      const pRect: Rect = { x: p.x, y: p.y, w: p.w, h: p.h };
      for (const m of world.mechanics) {
        if (m.spec.kind === 'pushBox' && rectsOverlap(pRect, m.rect)) {
          blocked = true;
          events.push({ type: 'particle', kind: 'dust', x: p.x, y: p.y });
          break;
        }
      }
      if (blocked || p.timer <= 0 || p.y > world.level.heightPx + 16) {
        world.projectiles.splice(i, 1);
        continue;
      }
      if (rectsOverlap(activeRect, pRect)) {
        applyPlayerDamage(world, false, events);
        world.projectiles.splice(i, 1);
      }
    } else if (p.kind === 'bossLightning') {
      p.active = p.timer <= 0.28;
      if (p.active && rectsOverlap(activeRect, { x: p.x, y: p.y, w: p.w, h: p.h })) {
        applyPlayerDamage(world, false, events);
      }
      if (p.timer <= 0) {
        world.projectiles.splice(i, 1);
      }
    }
  }

  // 8. 收集小魚乾（每 10 條補 1 命，上限 9；滿血 +200）
  for (const fish of world.level.fishes) {
    if (world.collectedFishIds.has(fish.id)) continue;
    const fRect: Rect = { x: fish.pos.x, y: fish.pos.y, w: px(10), h: px(8) };
    if (rectsOverlap(getCatRect(world.cats.orange), fRect) || rectsOverlap(getCatRect(world.cats.black), fRect)) {
      world.collectedFishIds.add(fish.id);
      world.fishBank += 1;
      world.score += 50;
      events.push({ type: 'sfx', id: 'fish' });
      events.push({ type: 'particle', kind: 'gold', x: fish.pos.x, y: fish.pos.y });
      if (world.fishBank % FISH_PER_EXTRA_LIFE === 0) {
        if (world.lives < MAX_LIVES) {
          world.lives += 1;
          events.push({ type: 'sfx', id: 'heal' });
          events.push({ type: 'particle', kind: 'heart', x: activeCat.x, y: activeCat.y });
        } else {
          world.score += 200;
        }
      }
    }
  }

  // 9. 收集毛線球（每關 1 顆，通關寫入存檔）
  if (!world.yarnCollectedInLevel) {
    const yRect: Rect = { x: world.level.yarnBall.x, y: world.level.yarnBall.y, w: px(12), h: px(12) };
    if (rectsOverlap(getCatRect(world.cats.orange), yRect) || rectsOverlap(getCatRect(world.cats.black), yRect)) {
      world.yarnCollectedInLevel = true;
      world.score += 500;
      events.push({ type: 'sfx', id: 'yarn' });
      events.push({ type: 'particle', kind: 'gold', x: world.level.yarnBall.x, y: world.level.yarnBall.y });
    }
  }

  // 10. 檢查點
  if (!world.checkpointReached) {
    const cpRect: Rect = { x: px(world.level.checkpoint.x - 6), y: px(world.level.checkpoint.y - 16), w: px(16), h: px(32) };
    if (rectsOverlap(getCatRect(world.cats.orange), cpRect) || rectsOverlap(getCatRect(world.cats.black), cpRect)) {
      world.checkpointReached = true;
      events.push({ type: 'sfx', id: 'checkpoint' });
      events.push({ type: 'particle', kind: 'heart', x: world.level.checkpoint.x, y: world.level.checkpoint.y });
    }
  }

  // 11. 隱藏英雄「忠犬阿福」結緣互動（1-2 / 2-2 / 3-2）
  if (world.level.heroDogSpot && !world.heroBonded) {
    const hRect: Rect = {
      x: px(world.level.heroDogSpot.x - 10),
      y: px(world.level.heroDogSpot.y - 8),
      w: px(32),
      h: px(24),
    };
    if (rectsOverlap(activeRect, hRect)) {
      world.heroBonded = true;
      world.score += 300;
      events.push({ type: 'sfx', id: 'hero_bark' });
      events.push({ type: 'particle', kind: 'heart', x: world.level.heroDogSpot.x, y: world.level.heroDogSpot.y });
      events.push({ type: 'save_dirty' });
      world.scene = {
        kind: 'DIALOGUE',
        speaker: '阿福',
        text: '汪！別怕，我是阿福！前面野狗跟那隻壞貓很兇，萬分危急時我一定衝出來罩你們兄弟！',
        minLockTimer: sec(0.25),
      };
      return events;
    }
  }

  // 12. 1-3 / 2-3 疤面老大尾聲挑釁
  if (world.level.bossEncounter === 'taunt' && !world.tauntTriggered) {
    if (activeCat.x >= world.level.goal.x - 96) {
      world.tauntTriggered = true;
      events.push({ type: 'sfx', id: 'boss_roar' });
      const text =
        world.level.id === '1-3'
          ? '哼，兩隻迷路的家貓還想回家？這條街歸我疤面老大管，別想活著走出夜市！'
          : '居然躲過我的湯鍋陣…有種就上雨夜屋頂，我親自送你們回老家！';
      world.scene = {
        kind: 'DIALOGUE',
        speaker: '疤面老大',
        text,
        minLockTimer: sec(0.25),
      };
      return events;
    }
  }

  // 13. 3-3 疤面老大正式 Boss 戰
  if (world.boss) {
    if (world.boss.status === 'dormant' && rectsOverlap(activeRect, world.boss.arenaBounds)) {
      world.boss = activateBoss(world.boss);
      // 強制將夥伴貓一同帶入競技場入口，防門外軟鎖（INV-BOSS-02）
      partnerCat.x = px(world.boss.arenaBounds.x + 18);
      partnerCat.y = activeCat.y;
      partnerCat.vx = 0;
      partnerCat.vy = 0;
      world.partnerMode = 'FOLLOW';
      events.push({ type: 'bgm', track: 'boss' });
      events.push({ type: 'sfx', id: 'boss_roar' });
      world.scene = {
        kind: 'DIALOGUE',
        speaker: '疤面老大',
        text: '終於來了！看我怎麼把你們掃下屋頂——除非你們能讓我暈頭轉向，再讓那隻胖橘撞過來！',
        minLockTimer: sec(0.25),
      };
      return events;
    } else if (world.boss.status === 'active') {
      const { bossContactDamage } = stepBossBadCat(
        world.boss,
        world.level,
        world.mechanics,
        activeCat,
        world.cats.orange,
        world.projectiles,
        dt,
        events,
      );
      if (bossContactDamage) {
        applyPlayerDamage(world, false, events);
      }
      // 檢查是否有 Boss 擊敗對話事件
      const bossDlg = events.find((e) => e.type === 'dialogue');
      if (bossDlg && bossDlg.type === 'dialogue') {
        world.scene = {
          kind: 'DIALOGUE',
          speaker: bossDlg.speaker,
          text: bossDlg.text,
          minLockTimer: sec(0.25),
        };
        return events;
      }
    }
  }

  // 14. 終點門判定（橘貓與黑貓皆抵達；3-3 須先擊敗 Boss）
  const bossBlocksGoal =
    world.boss !== null &&
    (world.boss.status === 'dormant' || world.boss.behavior.kind !== 'DEFEATED');
  if (!bossBlocksGoal) {
    const orangeAtGoal = rectsOverlap(getCatRect(world.cats.orange), world.level.goal);
    const blackAtGoal = rectsOverlap(getCatRect(world.cats.black), world.level.goal);
    if (orangeAtGoal && blackAtGoal) {
      const nextIdx = world.level.index + 1;
      const nextLevelId: LevelId | null = ALL_LEVEL_IDS[nextIdx] ?? null;
      world.scene = { kind: 'LEVEL_CLEAR', nextLevelId };
      events.push({ type: 'sfx', id: 'clear' });
      events.push({ type: 'save_dirty' });
      return events;
    } else if (orangeAtGoal || blackAtGoal) {
      world.goalWaitingHintTimer = sec(0.2);
    }
  }

  // 15. 平滑鏡頭追蹤
  const targetCamX = Math.max(
    0,
    Math.min(world.level.widthPx - LOGICAL_WIDTH, activeCat.x - LOGICAL_WIDTH * 0.42),
  );
  world.cameraX = px(world.cameraX + (targetCamX - world.cameraX) * Math.min(1, dt * 8));

  return events;
}
