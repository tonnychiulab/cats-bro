import { describe, expect, it } from 'vitest';
import { createEmptyInput } from '../src/core/input';
import { getGateSolidRect, isSolidTile, moveAndCollide, rectsOverlap } from '../src/core/physics';
import {
  StorageLike,
  createDefaultSave,
  isTrueEndingUnlocked,
  loadSave,
  persistSave,
  recordLevelClear,
} from '../src/core/storage';
import {
  ALL_LEVEL_IDS,
  CAT_CONFIG,
  FIXED_DT,
  MAX_LIVES,
  TILE_SIZE,
  WorldEvent,
  getBossPhase,
  px,
  sec,
} from '../src/core/types';
import { activateBoss, stepBossBadCat, stunBoss } from '../src/entities/bossBadCat';
import { createBlackCat, createOrangeCat, getCatRect, stepCatPhysics } from '../src/entities/cat';
import { createMechanicsRuntime, stepMechanics } from '../src/entities/mechanics';
import { applyPlayerDamage, createWorld, respawnAtCheckpoint, stepWorld } from '../src/entities/world';
import { ALL_LEVELS, getLevelById } from '../src/levels';

const DT = sec(FIXED_DT);

function makeMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

describe('《橘黑兄弟：九命歸途》SDD / CONTRACTS v2.1 驗收測試矩陣 (C-01 ~ C-09)', () => {
  it('C-01: 雙貓物理差異、14x14 vs 11x11 窄縫算術、防滑抗風與二段跳', () => {
    expect(CAT_CONFIG.orange.width).toBe(14);
    expect(CAT_CONFIG.orange.height).toBe(14);
    expect(CAT_CONFIG.black.width).toBe(11);
    expect(CAT_CONFIG.black.height).toBe(11);
    expect(CAT_CONFIG.orange.windImmune).toBe(true);
    expect(CAT_CONFIG.black.windImmune).toBe(false);
    expect(CAT_CONFIG.orange.slipperyDecel).toBeGreaterThan(CAT_CONFIG.black.slipperyDecel);

    // 驗證 1-2 的 12px 窄縫鐵捲門：黑貓 (11px) 可鑽過，橘貓 (14px) 嚴格阻擋
    const lvl12 = getLevelById('1-2');
    const mechs = createMechanicsRuntime(lvl12.mechanics);
    const gate = mechs.find((m) => m.spec.kind === 'gate')!;
    const solidGate = getGateSolidRect(gate)!;
    const floorY = gate.rect.y + gate.rect.h; // 地面上緣

    const orangeAtGate = {
      x: gate.rect.x,
      y: px(floorY - CAT_CONFIG.orange.height),
      w: CAT_CONFIG.orange.width,
      h: CAT_CONFIG.orange.height,
    };
    const blackAtGate = {
      x: gate.rect.x,
      y: px(floorY - CAT_CONFIG.black.height),
      w: CAT_CONFIG.black.width,
      h: CAT_CONFIG.black.height,
    };
    expect(rectsOverlap(orangeAtGate, solidGate)).toBe(true);
    expect(rectsOverlap(blackAtGate, solidGate)).toBe(false);

    // 驗證黑貓空中二段跳
    const lvl11 = getLevelById('1-1');
    const black = createBlackCat({ x: px(64), y: px(100) });
    black.grounded = false;
    black.coyoteTimer = sec(0);
    black.vy = 50;
    const evs: WorldEvent[] = [];
    stepCatPhysics(
      black,
      lvl11,
      [],
      { moveX: 0, jumpPressed: true, jumpBufferActive: false, skillPressed: false },
      false,
      false,
      DT,
      evs,
    );
    expect(black.vy).toBeLessThan(0);
    expect(black.doubleJumpAvailable).toBe(false);
  });

  it('C-02: 體力消耗與回復上限 100；黑貓暗影衝刺 vy===0 且無敵；橘貓猛擊 hitTargetIds 去重', () => {
    const lvl11 = getLevelById('1-1');
    const black = createBlackCat(lvl11.spawnBlack);
    const evs: WorldEvent[] = [];

    stepCatPhysics(
      black,
      lvl11,
      [],
      { moveX: 1, jumpPressed: false, jumpBufferActive: false, skillPressed: true },
      false,
      false,
      DT,
      evs,
    );
    expect(black.skill.kind).toBe('shadowDash');
    expect(black.vy).toBe(0);
    expect(black.stamina).toBe(100 - CAT_CONFIG.black.skillCost);

    // 跑 2 秒確認體力自動回復至 100 且不超上限
    for (let i = 0; i < 120; i++) {
      stepCatPhysics(
        black,
        lvl11,
        [],
        { moveX: 0, jumpPressed: false, jumpBufferActive: false, skillPressed: false },
        false,
        false,
        DT,
        evs,
      );
    }
    expect(black.stamina).toBe(100);
  });

  it('C-03: AI 待命不移動不瞬移；無門阻隔超距觸發 partner_teleport；有關閉門時禁止瞬移並自動切 STAY', () => {
    const lvl11 = getLevelById('1-1');
    const world = createWorld(lvl11, createDefaultSave());
    world.partnerMode = 'STAY';
    const startPartnerX = world.cats.black.x;

    // 橘貓右移，待命中的黑貓必須保持原地且不瞬移
    for (let i = 0; i < 40; i++) {
      const inp = createEmptyInput();
      inp.held.right = true;
      const evs = stepWorld(world, inp, DT);
      expect(evs.some((e) => e.type === 'partner_teleport')).toBe(false);
    }
    expect(Math.abs(world.cats.black.x - startPartnerX)).toBeLessThan(0.5);

    // 切回 FOLLOW 並拉開超過 180px（無關閉 gate 阻隔）→ 觸發 partner_teleport
    world.partnerMode = 'FOLLOW';
    world.cats.orange.x = px(world.cats.black.x + 220);
    const evs = stepWorld(world, createEmptyInput(), DT);
    expect(evs.some((e) => e.type === 'partner_teleport')).toBe(true);

    // 1-2 有關閉鐵捲門阻隔：不得瞬移穿門，並自動切為 STAY
    const w12 = createWorld(getLevelById('1-2'), createDefaultSave());
    w12.activeCatId = 'black';
    w12.partnerMode = 'FOLLOW';
    const gate = w12.mechanics.find((m) => m.spec.kind === 'gate')!;
    w12.cats.orange.x = px(gate.rect.x - 100);
    w12.cats.black.x = px(gate.rect.x + 150);
    const evs12 = stepWorld(w12, createEmptyInput(), DT);
    expect(evs12.some((e) => e.type === 'partner_teleport')).toBe(false);
    expect(w12.partnerMode).toBe('STAY');
  });

  it('C-04: 機關聯動（weight2 僅橘貓/推箱可壓、連環開門、脆紙箱僅橘貓猛擊撞碎、推箱掉坑重生）', () => {
    const lvl23 = getLevelById('2-3');
    const mechs = createMechanicsRuntime(lvl23.mechanics);
    const p1 = mechs.find((m) => m.spec.id === 't2_3_p1')!;
    const p2 = mechs.find((m) => m.spec.id === 't2_3_p2')!;
    const gate = mechs.find((m) => m.spec.id === 'g2_3_arch')!;
    const box = mechs.find((m) => m.spec.id === 'b2_3_box')!;
    const crate = mechs.find((m) => m.spec.id === 'c2_3_crate')!;

    const black = createBlackCat({ x: p1.rect.x, y: px(p1.rect.y - 10) });
    const orange = createOrangeCat({ x: px(0), y: px(0) });
    const evs: WorldEvent[] = [];

    // 黑貓踩 weight2 踏板無法壓動
    stepMechanics(lvl23, mechs, [orange, black], DT, evs);
    expect(p1.active).toBe(false);
    expect(gate.active).toBe(false);

    // 推箱壓 p1 ＋ 橘貓壓 p2 → 雙重連環鐵閘開啟
    box.rect.x = p1.rect.x;
    box.rect.y = px(p1.rect.y - box.rect.h + 2);
    orange.x = p2.rect.x;
    orange.y = px(p2.rect.y - 12);
    stepMechanics(lvl23, mechs, [orange, black], DT, evs);
    expect(p1.active).toBe(true);
    expect(p2.active).toBe(true);
    expect(gate.active).toBe(true);

    // 脆紙箱：橘貓猛擊撞碎
    orange.x = px(crate.rect.x - 12);
    orange.y = crate.rect.y;
    orange.skill = { kind: 'smash', remaining: sec(0.15), hitTargetIds: new Set() };
    stepMechanics(lvl23, mechs, [orange, black], DT, evs);
    expect(crate.broken).toBe(true);

    // 推箱掉坑自動於初始位置重生
    box.rect.y = px(lvl23.heightPx + 40);
    stepMechanics(lvl23, mechs, [orange, black], DT, evs);
    expect(box.rect.x).toBe(box.spec.rect.x);
    expect(box.rect.y).toBe(box.spec.rect.y);
  });

  it('C-05: 九命系統、10 小魚乾補 1 命（上限 9）、檢查點重生不復活小魚乾', () => {
    const lvl11 = getLevelById('1-1');
    const world = createWorld(lvl11, createDefaultSave());
    expect(world.lives).toBe(MAX_LIVES);

    // 扣 1 命並檢查 1.2s 無敵期間不重複扣血
    const evs: WorldEvent[] = [];
    applyPlayerDamage(world, false, evs);
    expect(world.lives).toBe(8);
    expect(world.hurtInvulnTimer).toBeGreaterThan(1.0);
    applyPlayerDamage(world, false, evs);
    expect(world.lives).toBe(8);

    // 撿 10 條不重複小魚乾 → 回復 1 命回 9 命
    world.fishBank = 9;
    const firstFish = lvl11.fishes[0]!;
    world.cats.orange.x = firstFish.pos.x;
    world.cats.orange.y = firstFish.pos.y;
    stepWorld(world, createEmptyInput(), DT);
    expect(world.collectedFishIds.has(firstFish.id)).toBe(true);
    expect(world.lives).toBe(9);

    // 檢查點重生後，已收集小魚乾仍保留（防刷魚）
    respawnAtCheckpoint(world, evs);
    expect(world.collectedFishIds.has(firstFish.id)).toBe(true);
    expect(world.lives).toBe(9);
  });

  it('C-06: 忠犬阿福方案 A 統一瀕死攔截（拉回 3 命 + 2.5s 金色護盾，每關限 1 次）', () => {
    const save = { ...createDefaultSave(), heroBonded: true };
    const world = createWorld(getLevelById('1-2'), save);
    world.lives = 1;
    const evs: WorldEvent[] = [];

    // 第一次致命傷：阿福攔截致死 → 拉回 3 命 + 2.5s 護盾
    applyPlayerDamage(world, false, evs);
    expect(world.heroRescueUsedInLevel).toBe(true);
    expect(world.lives).toBe(3);
    expect(world.heroShieldTimer).toBe(2.5);
    expect(world.scene.kind).toBe('PLAYING');
    expect(evs.some((e) => e.type === 'sfx' && e.id === 'hero_bark')).toBe(true);

    // 清除護盾與無敵後再次歸零：同關第二次不再觸發，正常進入 RESPAWN
    world.heroShieldTimer = sec(0);
    world.hurtInvulnTimer = sec(0);
    world.lives = 1;
    applyPlayerDamage(world, false, evs);
    expect(world.lives).toBe(0);
    expect(world.scene.kind).toBe('RESPAWN');
  });

  it('C-07: 疤面老大 Boss 戰（進房帶入夥伴、僅 STUNNED 受橘貓猛擊扣 1 HP 防秒殺、HP 3->2->1->0 開門）', () => {
    const lvl33 = getLevelById('3-3');
    const world = createWorld(lvl33, createDefaultSave());
    expect(world.boss?.status).toBe('dormant');

    // 主控貓踏入 Boss 競技場 → Boss 啟動且夥伴強制帶入競技場入口防門外軟鎖
    world.cats.orange.x = px(lvl33.bossArena!.x + 12);
    world.cats.orange.y = px(lvl33.bossArena!.y + 64);
    world.cats.black.x = px(32); // 原本遠在門外
    stepWorld(world, createEmptyInput(), DT);
    expect(world.boss?.status).toBe('active');
    expect(world.cats.black.x).toBeGreaterThanOrEqual(lvl33.bossArena!.x);

    const boss = activateBoss(world.boss!);
    world.boss = boss;
    const evs: WorldEvent[] = [];

    // 非 STUNNED 時橘貓猛擊無法造成傷害
    world.cats.orange.x = boss.x;
    world.cats.orange.y = boss.y;
    world.cats.orange.skill = { kind: 'smash', remaining: sec(0.15), hitTargetIds: new Set() };
    stepBossBadCat(boss, lvl33, world.mechanics, world.cats.orange, world.cats.orange, world.projectiles, DT, evs);
    expect(boss.status === 'active' && boss.hp).toBe(3);

    // STUNNED 後橘貓猛擊：連續 5 幀只扣 1 HP（杜絕多幀秒殺）並切至 Phase 2
    stunBoss(boss, sec(2.2), evs);
    world.cats.orange.skill = { kind: 'smash', remaining: sec(0.15), hitTargetIds: new Set() };
    for (let i = 0; i < 5; i++) {
      stepBossBadCat(boss, lvl33, world.mechanics, world.cats.orange, world.cats.orange, world.projectiles, DT, evs);
    }
    expect(boss.status === 'active' && boss.hp).toBe(2);
    expect(getBossPhase(2)).toBe(2);

    // 再兩輪破防至 HP = 0 → DEFEATED
    stunBoss(boss, sec(2.2), evs);
    world.cats.orange.x = boss.x;
    world.cats.orange.y = boss.y;
    world.cats.orange.skill = { kind: 'smash', remaining: sec(0.15), hitTargetIds: new Set() };
    stepBossBadCat(boss, lvl33, world.mechanics, world.cats.orange, world.cats.orange, world.projectiles, DT, evs);
    expect(boss.status === 'active' && boss.hp).toBe(1);
    expect(getBossPhase(1)).toBe(3);

    stunBoss(boss, sec(2.2), evs);
    world.cats.orange.x = boss.x;
    world.cats.orange.y = boss.y;
    world.cats.orange.skill = { kind: 'smash', remaining: sec(0.15), hitTargetIds: new Set() };
    stepBossBadCat(boss, lvl33, world.mechanics, world.cats.orange, world.cats.orange, world.projectiles, DT, evs);
    expect(boss.status === 'active' && boss.hp).toBe(0);
    expect(boss.status === 'active' && boss.behavior.kind).toBe('DEFEATED');
  });

  it('C-08: 九關靜態完整性不變量（INV-LVL-01~03：1-1~3-3、起點不卡磚、9 毛線球、阿福點、3-3 水閥）', () => {
    expect(ALL_LEVELS).toHaveLength(9);
    ALL_LEVELS.forEach((lvl, idx) => {
      expect(lvl.id).toBe(ALL_LEVEL_IDS[idx]);
      expect(lvl.index).toBe(idx);
      expect(lvl.tiles).toHaveLength(lvl.heightTiles);
      for (const row of lvl.tiles) {
        expect(row).toHaveLength(lvl.widthTiles);
      }
      // 檢查橘貓與黑貓起點不與實心磚重疊
      const checkFree = (x: number, y: number) => {
        const col = Math.floor(x / TILE_SIZE);
        const row = Math.floor(y / TILE_SIZE);
        expect(isSolidTile(lvl.tiles[row]![col]!)).toBe(false);
      };
      checkFree(lvl.spawnOrange.x, lvl.spawnOrange.y);
      checkFree(lvl.spawnBlack.x, lvl.spawnBlack.y);
      expect(lvl.yarnBall).toBeDefined();
    });

    // 1-2, 2-2, 3-2 必含阿福結緣點
    expect(getLevelById('1-2').heroDogSpot).toBeDefined();
    expect(getLevelById('2-2').heroDogSpot).toBeDefined();
    expect(getLevelById('3-2').heroDogSpot).toBeDefined();

    // 3-3 必含 Boss 戰與水塔水閥
    const l33 = getLevelById('3-3');
    expect(l33.bossEncounter).toBe('battle');
    expect(l33.bossArena).toBeDefined();
    expect(l33.bossSpawn).toBeDefined();
    expect(l33.mechanics.some((m) => m.kind === 'waterValve')).toBe(true);
  });

  it('C-09: SaveDataV1 存檔讀寫、損毀 JSON 安全回退與九毛線球 + 阿福真結局判定', () => {
    const mem = makeMemoryStorage();
    // 損毀 JSON 安全回退
    mem.setItem('cats_bro_save_v1', '{broken json!!!');
    expect(loadSave(mem)).toEqual(createDefaultSave());

    // 正常過關寫入與解鎖下一關
    let save = createDefaultSave();
    for (let i = 0; i < ALL_LEVEL_IDS.length; i++) {
      save = recordLevelClear(save, ALL_LEVEL_IDS[i]!, i, 1200, true, i === 1);
    }
    persistSave(save, mem);
    const reloaded = loadSave(mem);
    expect(reloaded.clearedLevels).toHaveLength(9);
    expect(reloaded.collectedYarns).toHaveLength(9);
    expect(reloaded.heroBonded).toBe(true);
    expect(reloaded.unlockedLevelIndex).toBe(8);
    expect(isTrueEndingUnlocked(reloaded)).toBe(true);

    // 確認物理邊界 helper 正常運作
    const lvl11 = getLevelById('1-1');
    const moveRes = moveAndCollide(lvl11, [], px(32), px(120), px(14), px(14), 0, 100, DT);
    expect(moveRes.y).toBeGreaterThanOrEqual(120);
  });

  it('C-10 (Code Review P0 回歸): 橘貓走路推箱、Boss 撞牆暈眩、3-3 擊敗 Boss 後可自由走向家門 G', () => {
    // 1. 橘貓普通行走（無需 smash）即可推動 pushBox
    const w12 = createWorld(getLevelById('1-2'), createDefaultSave());
    const box = w12.mechanics.find((m) => m.spec.kind === 'pushBox')!;
    const boxStartX = box.rect.x;
    w12.cats.orange.x = px(box.rect.x - CAT_CONFIG.orange.width);
    w12.cats.orange.y = box.rect.y;
    w12.cats.orange.facing = 1;
    for (let i = 0; i < 15; i++) {
      const inp = createEmptyInput();
      inp.held.right = true;
      stepWorld(w12, inp, DT);
    }
    expect(box.rect.x).toBeGreaterThan(boxStartX + 4);

    // 2. Boss 衝爪撞上競技場牆壁確實觸發 STUNNED
    const lvl33 = getLevelById('3-3');
    const w33 = createWorld(lvl33, createDefaultSave());
    const activeBoss = activateBoss(w33.boss!);
    w33.boss = activeBoss;
    activeBoss.x = px(activeBoss.arenaBounds.x + 8);
    activeBoss.y = px(110);
    activeBoss.vx = -200;
    activeBoss.facing = -1;
    activeBoss.behavior = { kind: 'CLAW_DASH', remaining: sec(0.9), dashesLeft: 1 };
    const evs: WorldEvent[] = [];
    for (let i = 0; i < 15; i++) {
      stepBossBadCat(activeBoss, lvl33, w33.mechanics, w33.cats.orange, w33.cats.orange, w33.projectiles, DT, evs);
      const kind: string = activeBoss.behavior.kind;
      if (kind === 'STUNNED') break;
    }
    expect(activeBoss.behavior.kind).toBe('STUNNED');

    // 3. 擊敗 Boss 後解除 bossBounds，雙貓可走出競技場抵達 3-3 家門 G 並通關
    activeBoss.hp = 0;
    activeBoss.behavior = { kind: 'DEFEATED' };
    w33.cats.orange.x = lvl33.goal.x;
    w33.cats.orange.y = px(lvl33.goal.y + 16);
    w33.cats.black.x = lvl33.goal.x;
    w33.cats.black.y = px(lvl33.goal.y + 16);
    stepWorld(w33, createEmptyInput(), DT);
    expect(w33.scene.kind).toBe('LEVEL_CLEAR');
  });
});
