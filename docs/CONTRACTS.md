# 《橘黑兄弟：九命歸途》介面與資料契約（Contracts v2.1）

本文件為核心模組間的唯一型別與不變量契約（已整合 PSTACK Round 1/2 審查與第二次 `/grill-me` 體驗複查）。實作須嚴格遵循，任何介面變更皆須同步更新本文件與對應測試。

---

## 1. 品牌化原語、幾何與輸入契約（`src/core/types.ts`, `src/core/input.ts`）

```ts
export const TILE_SIZE = 16;
export const FIXED_DT = 1 / 60;
export const LOGICAL_WIDTH = 320;
export const LOGICAL_HEIGHT = 180;
export const UI_OVERLAY_SCALE = 3; // 960 x 540 雙層畫布高解析 UI 覆蓋層

export type Px = number & { readonly __brand: 'Px' };
export type TileIndex = number & { readonly __brand: 'TileIndex' };
export type Seconds = number & { readonly __brand: 'Seconds' };
export type EntityId = string & { readonly __brand: 'EntityId' };
export type TriggerId = string & { readonly __brand: 'TriggerId' };

export const px = (n: number): Px => n as Px;
export const sec = (n: number): Seconds => n as Seconds;

export interface Vec2 {
  x: Px;
  y: Px;
}

export interface Rect {
  x: Px;
  y: Px;
  w: Px;
  h: Px;
}

export type Facing = 1 | -1;

export type InputAction =
  | 'left'
  | 'right'
  | 'jump'
  | 'skill'
  | 'switchCat'
  | 'toggleStay'
  | 'pause'
  | 'mute'
  | 'confirm';

export interface InputSnapshot {
  held: Record<InputAction, boolean>;
  justPressed: Record<InputAction, boolean>;
  jumpBufferTimer: Seconds; // 0 ~ 0.10s
}
```

### 按鍵綁定契約
- `left`: `ArrowLeft` | `KeyA`
- `right`: `ArrowRight` | `KeyD`
- `jump`: `Space` | `ArrowUp` | `KeyW` | `KeyZ`
- `skill`: `KeyJ` | `KeyX` | `ShiftLeft` | `ShiftRight`
- `switchCat`: `KeyQ` | `Tab` | `KeyC`
- `toggleStay`: `KeyE` | `KeyK`
- `pause`: `KeyP` | `Escape`
- `mute`: `KeyM`
- `confirm`: `Enter` | `Space`（進入 `DIALOGUE` 時鎖定 `0.25s`，離場清零 `jumpBufferTimer`）

---

## 2. 雙貓角色與 AI 契約（`src/entities/cat.ts`, `src/entities/partnerAI.ts`）

### 2.1 靜態物理常數（唯一尺寸真相來源）
```ts
export type CatId = 'orange' | 'black';
export type PartnerAIMode = 'FOLLOW' | 'STAY';

export interface CatPhysicsConfig {
  readonly id: CatId;
  readonly width: Px;              // orange: 14, black: 11
  readonly height: Px;             // orange: 14, black: 11 (鐵捲門窄縫 = 12px)
  readonly moveSpeed: number;      // orange: 78, black: 102
  readonly groundAccel: number;    // 720 px/s²
  readonly groundDecel: number;    // 900 px/s²
  readonly slipperyDecel: number;  // orange: 900 (防滑), black: 120 (濕滑)
  readonly puddleSpeedMult: number;// orange: 0.90, black: 0.65
  readonly jumpVelocity: number;   // orange: -210, black: -235
  readonly doubleJumpVelocity: number | null; // orange: null, black: -205
  readonly gravity: number;        // orange: 680, black: 610
  readonly weight: 1 | 2;          // orange: 2, black: 1
  readonly windImmune: boolean;    // orange: true, black: false
  readonly canWallJump: boolean;   // orange: false, black: true
  readonly skillCost: number;      // orange: 40, black: 45
  readonly staminaRegenDelay: Seconds; // orange: 0.6, black: 0.5
  readonly staminaRegenRate: number;   // orange: 45, black: 55
}
```

### 2.2 Discriminated Union 角色狀態（非法狀態不可表示）
```ts
export type CatAnimState =
  | 'idle' | 'run' | 'jump' | 'fall' | 'wallSlide' | 'skill' | 'sit' | 'hurt';

export interface CatBaseState {
  readonly id: CatId;
  x: Px;
  y: Px;
  vx: number;
  vy: number;
  facing: Facing;
  grounded: boolean;
  onSlippery: boolean;
  inPuddle: boolean;
  coyoteTimer: Seconds;
  stamina: number;            // 0 ~ 100
  staminaRegenTimer: Seconds;
  lastSafePos: Vec2;
  animState: CatAnimState;
  animTimer: Seconds;
}

export type OrangeSkillState =
  | { readonly kind: 'none' }
  | { readonly kind: 'smash'; remaining: Seconds; hitTargetIds: Set<EntityId> };

export type BlackSkillState =
  | { readonly kind: 'none' }
  | { readonly kind: 'shadowDash'; remaining: Seconds }; // 存在即保證無敵且 vy === 0

export interface OrangeCatState extends CatBaseState {
  readonly id: 'orange';
  skill: OrangeSkillState;
}

export interface BlackCatState extends CatBaseState {
  readonly id: 'black';
  wallSlideDir: -1 | 0 | 1;
  doubleJumpAvailable: boolean;
  skill: BlackSkillState;
}

export type CatState = OrangeCatState | BlackCatState;

export interface BreadcrumbPoint {
  x: Px;
  y: Px;
  jumped: boolean;
  facing: Facing;
}
```

### 角色與 AI 不變量
- `INV-CAT-01`：`0 <= cat.stamina <= 100`。
- `INV-CAT-02`：黑貓 `skill.kind === 'shadowDash'` 期間 `vy === 0` 且完全免疫接觸傷害。
- `INV-CAT-03`：橘貓 `skill.kind === 'smash'` 期間，對同一 `EntityId`（脆紙箱或 Boss）至多命中一次（由 `hitTargetIds` 保證）。
- `INV-AI-01`：當 `partnerMode === 'STAY'` 時，夥伴貓 `vx === 0` 且不觸發安全瞬移。
- `INV-AI-02`：當 `partnerMode === 'FOLLOW'` 且雙貓之間**無關閉中之 `gate` 阻隔**，若距離 `> 180px` 或卡住 `>= 2.5s`（且距離 `> 48px`），必須瞬移至主控貓附近合法地面並發出 `partner_teleport` 事件；若主控貓穿過未開啟之 `gate(bottomGapPx > 0)`，自動將夥伴切為 `STAY`。
- `INV-AI-03`：非主控夥伴貓免疫所有敵人／陷阱／Boss 接觸傷害；切換主控時設定 `switchGraceTimer = 0.25s`。

---

## 3. 九命系統與反轉角色契約（`src/entities/heroDog.ts`, `src/entities/bossBadCat.ts`）

```ts
export const MAX_LIVES = 9;
export const FISH_PER_EXTRA_LIFE = 10;
export const HURT_INVULN_DURATION = sec(1.2);
export const HERO_RESCUE_LIVES = 3;
export const HERO_SHIELD_DURATION = sec(2.5);
export const SWITCH_GRACE_DURATION = sec(0.25);
export const BOSS_MAX_HP = 3;

export type BossPhase = 1 | 2 | 3;

// 純函式推導，禁止獨立儲存 phase 欄位
export function getBossPhase(hp: number): BossPhase {
  if (hp <= 1) return 3;
  if (hp <= 2) return 2;
  return 1;
}

export type BossBehavior =
  | { readonly kind: 'IDLE'; remaining: Seconds }
  | { readonly kind: 'TELEGRAPH_CLAW'; remaining: Seconds; targetX: Px; dashesLeft: number }
  | { readonly kind: 'CLAW_DASH'; remaining: Seconds; dashesLeft: number }
  | { readonly kind: 'JUMP_PERCH'; targetPos: Vec2 }
  | { readonly kind: 'THROW_CANS'; remaining: Seconds; cansRemaining: number; windActive: boolean }
  | { readonly kind: 'CALL_LIGHTNING'; remaining: Seconds; strikeX: Px }
  | { readonly kind: 'STUNNED'; remaining: Seconds }
  | { readonly kind: 'HURT'; remaining: Seconds }
  | { readonly kind: 'DEFEATED' };

export type BossBadCatState =
  | { readonly status: 'dormant'; readonly arenaBounds: Rect; readonly spawnPos: Vec2 }
  | {
      readonly status: 'active';
      readonly id: EntityId;
      x: Px;
      y: Px;
      vx: number;
      vy: number;
      readonly w: Px; // 24
      readonly h: Px; // 22
      facing: Facing;
      hp: 0 | 1 | 2 | 3;
      behavior: BossBehavior;
      readonly arenaBounds: Rect;
      readonly spawnPos: Vec2;
    };

export interface ProjectileState {
  readonly id: EntityId;
  readonly kind: 'fishCan' | 'bossLightning';
  x: Px;
  y: Px;
  vx: number;
  vy: number;
  w: Px;
  h: Px;
  timer: Seconds;
  active: boolean; // bossLightning 預警期為 false，落雷期為 true
}
```

### 九命與反轉角色不變量
- `INV-LIFE-01`：`0 <= world.lives <= 9`；每累計 `10` 條不重複小魚乾，若 `lives < 9` 則 `lives += 1`，否則 `score += 200`。
- `INV-HERO-01`（方案 A・全 9 關統一無特例）：唯一真相來源為 `world.heroBonded` 與 `world.heroRescueUsedInLevel`。當 `world.heroBonded && !world.heroRescueUsedInLevel` 且本次傷害使 `lives - 1 <= 0` 時，**攔截死亡**：`heroRescueUsedInLevel = true`、`lives = 3`、`heroShieldTimer = 2.5s`、`hitStopTimer = 0.25s`；若 3-3 Boss 為 `active` 且未 `DEFEATED`，強制令其進入 `STUNNED (2.5s)`。
- `INV-BOSS-01`：疤面老大僅於 `status === 'active' && behavior.kind === 'STUNNED'` 時可被橘貓 `smash` 扣 `1` HP（且受 `hitTargetIds` 去重），受擊後立即轉為 `HURT (0.8s)`（若 `hp === 0` 轉為 `DEFEATED` 並解鎖 3-3 家門）。
- `INV-BOSS-02`：踏入 `arenaBounds` 啟動 Boss 戰時，強制將夥伴貓一同傳送至競技場入口安全點，禁止門外軟鎖。

---

## 4. 正交機關、敵人與九關資料契約（`src/levels/`）

```ts
export type ChapterId = 1 | 2 | 3;
export type LevelId =
  | '1-1' | '1-2' | '1-3'
  | '2-1' | '2-2' | '2-3'
  | '3-1' | '3-2' | '3-3';

export type TileType = 0 | 1 | 2 | 3 | 4 | 5;

export type MechanicSpec =
  | { readonly kind: 'crate'; readonly id: EntityId; readonly rect: Rect }
  | { readonly kind: 'pushBox'; readonly id: EntityId; readonly rect: Rect; readonly blocksWind: boolean }
  | {
      readonly kind: 'trigger';
      readonly id: TriggerId;
      readonly rect: Rect;
      readonly activation: 'weight2' | 'touch' | 'wallSwitch';
      readonly latched: boolean;
    }
  | {
      readonly kind: 'gate';
      readonly id: EntityId;
      readonly rect: Rect;
      readonly requiredTriggerIds: readonly TriggerId[];
      readonly bottomGapPx: Px; // 0 = 全閉, 12 = 僅黑貓 (11px) 可鑽
    }
  | {
      readonly kind: 'movingPlatform';
      readonly id: EntityId;
      readonly rect: Rect;
      readonly endPos: Vec2;
      readonly speed: number;
      readonly requiredTriggerIds?: readonly TriggerId[];
    }
  | { readonly kind: 'spring'; readonly id: EntityId; readonly rect: Rect; readonly launchVy: number }
  | {
      readonly kind: 'hazard';
      readonly id: EntityId;
      readonly style: 'steam' | 'lightning';
      readonly rect: Rect;
      readonly period: Seconds;
      readonly activeDuration: Seconds;
      readonly warnDuration: Seconds;
      readonly phaseOffset: Seconds;
    }
  | { readonly kind: 'waterValve'; readonly id: TriggerId; readonly rect: Rect; readonly cooldown: Seconds };

export type EnemySpec = {
  readonly kind: 'strayDog';
  readonly id: EntityId;
  readonly variant: 'normal' | 'guardDog';
  readonly startPos: Vec2;
  readonly patrolMinX: Px;
  readonly patrolMaxX: Px;
  readonly speed: number;
};

export interface MechanicRuntime {
  readonly spec: MechanicSpec;
  rect: Rect;
  broken: boolean;       // crate
  active: boolean;       // trigger / gate / hazard
  warning: boolean;      // hazard 預警期
  progress: number;      // movingPlatform 0~1
  direction: 1 | -1;     // movingPlatform
  timer: Seconds;        // hazard / waterValve cooldown / spring bounce anim
}

export interface EnemyRuntime {
  readonly spec: EnemySpec;
  x: Px;
  y: Px;
  vx: number;
  w: Px;
  h: Px;
  facing: Facing;
  stunTimer: Seconds;    // 被阿福撞飛時短暫暈眩
}

export interface LevelData {
  readonly id: LevelId;
  readonly index: number;      // 0 ~ 8
  readonly chapter: ChapterId;
  readonly name: string;
  readonly widthTiles: number;
  readonly heightTiles: number;
  readonly widthPx: Px;
  readonly heightPx: Px;
  readonly hasWind: boolean;
  readonly hasRain: boolean;
  readonly spawnOrange: Vec2;
  readonly spawnBlack: Vec2;
  readonly checkpoint: Vec2;
  readonly goal: Rect;
  readonly yarnBall: Vec2;
  readonly fishes: readonly { readonly id: EntityId; readonly pos: Vec2 }[];
  readonly heroDogSpot?: Vec2;
  readonly bossEncounter?: 'taunt' | 'battle';
  readonly bossArena?: Rect;
  readonly bossSpawn?: Vec2;
  readonly tiles: readonly (readonly TileType[])[];
  readonly mechanics: readonly MechanicSpec[];
  readonly enemies: readonly EnemySpec[];
}
```

### 九關靜態完整性不變量（`INV-LVL`）
- `INV-LVL-01`：總關卡數嚴格等於 `9`（`1-1`~`3-3`），`index` 為 `0..8` 連續不重複。
- `INV-LVL-02`：每關皆由 `parseLevel()` 驗證：`tiles` 維度與 `widthTiles/heightTiles` 一致、雙貓起點不與實心磚重疊、具備合法檢查點、1 顆毛線球與終點門。
- `INV-LVL-03`：全 9 關毛線球總數等於 `9`；`1-2`、`2-2`、`3-2` 必含 `heroDogSpot`；`3-3` 必含 `bossEncounter: 'battle'`、`bossArena`、`bossSpawn` 與至少 1 個 `waterValve`。

---

## 5. `WorldState`、`GameScene`、事件與存檔契約

```ts
export type DialogueSpeaker = '阿福' | '疤面老大' | '橘貓' | '黑貓' | '系統';

export type GameScene =
  | { readonly kind: 'TITLE' }
  | { readonly kind: 'LEVEL_SELECT'; selectedIndex: number }
  | { readonly kind: 'PLAYING' }
  | { readonly kind: 'PAUSED'; selectedOption: 'resume' | 'retryCheckpoint' | 'restartLevel' | 'levelSelect' }
  | { readonly kind: 'DIALOGUE'; speaker: DialogueSpeaker; text: string; minLockTimer: Seconds }
  | { readonly kind: 'RESPAWN'; remaining: Seconds }
  | { readonly kind: 'LEVEL_CLEAR'; nextLevelId: LevelId | null }
  | { readonly kind: 'ENDING'; endingType: 'normal' | 'true' };

export interface WorldState {
  scene: GameScene;
  level: LevelData;
  activeCatId: CatId;
  partnerMode: PartnerAIMode;
  cats: { orange: OrangeCatState; black: BlackCatState };
  breadcrumbs: BreadcrumbPoint[];
  partnerStuckTimer: Seconds;
  lives: number;                        // 0 ~ 9
  score: number;
  fishBank: number;
  collectedFishIds: Set<EntityId>;      // RESPAWN 保留，防刷魚
  yarnCollectedInLevel: boolean;        // LEVEL_CLEAR 寫入存檔
  checkpointReached: boolean;
  hurtInvulnTimer: Seconds;             // 1.2s
  heroShieldTimer: Seconds;             // 2.5s（獨立不覆蓋）
  switchGraceTimer: Seconds;            // 0.25s
  hitStopTimer: Seconds;
  windTimer: Seconds;
  windActive: boolean;
  windWarning: boolean;
  heroBonded: boolean;                  // 唯一真相來源（與 SaveDataV1 同步）
  heroRescueUsedInLevel: boolean;       // 唯一真相來源（每關限 1 次）
  heroRescueAnim: { active: boolean; timer: Seconds; x: Px; y: Px };
  tauntTriggered: boolean;              // 1-3 / 2-3 疤面老大挑釁旗標
  boss: BossBadCatState | null;
  mechanics: MechanicRuntime[];
  enemies: EnemyRuntime[];
  projectiles: ProjectileState[];
  cameraX: Px;
  elapsed: Seconds;
}

export type TrackId = 'title' | 'ch1' | 'ch2' | 'ch3' | 'boss' | 'ending';
export type SfxId =
  | 'meow_orange' | 'meow_black' | 'jump' | 'double_jump' | 'dash'
  | 'smash' | 'crate_break' | 'switch' | 'bounce' | 'fish' | 'yarn'
  | 'heal' | 'hurt' | 'checkpoint' | 'hero_bark' | 'boss_roar'
  | 'boss_stun' | 'boss_hit' | 'clear';

export type WorldEvent =
  | { type: 'sfx'; id: SfxId }
  | { type: 'bgm'; track: TrackId }
  | { type: 'particle'; kind: 'dust' | 'crate' | 'dash' | 'heart' | 'gold' | 'stun' | 'splash'; x: Px; y: Px }
  | { type: 'partner_teleport'; catId: CatId; from: Vec2; to: Vec2 }
  | { type: 'dialogue'; speaker: DialogueSpeaker; text: string }
  | { type: 'screen_shake'; intensity: number; duration: Seconds }
  | { type: 'save_dirty' };

// 模擬主入口簽名（固定步進 dt = 1/60）
export type StepWorldFn = (world: WorldState, input: InputSnapshot, dt: Seconds) => WorldEvent[];
```

### 存檔契約（`src/core/storage.ts`）
```ts
export const SAVE_STORAGE_KEY = 'cats_bro_save_v1';

export interface SaveDataV1 {
  version: 1;
  unlockedLevelIndex: number;        // 0 ~ 8
  allUnlockedPreview: boolean;       // 選關試玩開關（不覆寫真實 clearedLevels / collectedYarns）
  clearedLevels: LevelId[];
  collectedYarns: LevelId[];         // 通關時寫入；集滿 9 關 + heroBonded 觸發真結局
  heroBonded: boolean;
  bestScores: Partial<Record<LevelId, number>>;
  muted: boolean;
}
```

---

## 6. 契約驗收測試矩陣（Vitest）

| 測試編號 | 對應契約 / 不變量 | 驗證內容 |
| :--- | :--- | :--- |
| `C-01` | `CatPhysicsConfig` | 橘貓抗滑抗風與 `14×14` 無法穿過 `12px` 窄縫；黑貓 `11×11` 可鑽窄縫＋二段跳＋攀牆跳 |
| `C-02` | `INV-CAT-01~03` | 體力消耗／回復上限 `100`；黑貓 `shadowDash` `vy === 0` 且無敵；橘貓 `smash` 對同目標僅命中一次 |
| `C-03` | `INV-AI-01~03` | `STAY` 不移動不瞬移；無門阻隔超距觸發 `partner_teleport`；有關閉門時禁止瞬移並自動切 `STAY`；非主控免疫傷害 |
| `C-04` | `MechanicSpec` | `weight2` 踏板僅橘貓或 `pushBox` 可壓；多 `requiredTriggerIds` 連環開門；`crate` 僅橘貓猛擊撞碎；推箱掉坑重生 |
| `C-05` | `INV-LIFE-01` | 初始 `9` 命、獨立三層無敵計時互不覆蓋、滿 `10` 不重複小魚乾補 `1` 命（上限 `9`）、檢查點重生不復活小魚乾 |
| `C-06` | `INV-HERO-01` | 方案 A 統一規則：結緣後僅於 `lives - 1 <= 0` 攔截致死 → `lives = 3`＋`heroShieldTimer = 2.5s`（同關第二次歸零正常重生） |
| `C-07` | `INV-BOSS-01/02` | 進 Boss 房自動帶入夥伴防軟鎖；疤面老大僅 `STUNNED` 受橘貓猛擊扣 `1` HP（不連扣）並轉 `HURT`，HP `3→2→1→0` 開啟家門 |
| `C-08` | `INV-LVL-01~03` | `parseLevel()` 靜態驗證 `1-1`~`3-3` 全 9 關維度、合法起點、檢查點、9 毛線球、阿福點與 3-3 Boss/水閥 |
| `C-09` | `SaveDataV1` | 正常讀寫、損毀 JSON 安全回退、毛線球僅通關入檔、9 毛線球 + `heroBonded` 觸發 `ENDING(true)` |
