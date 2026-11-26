export const TILE_SIZE = 16;
export const FIXED_DT = 1 / 60;
export const LOGICAL_WIDTH = 320;
export const LOGICAL_HEIGHT = 180;
export const UI_OVERLAY_SCALE = 3; // 960 x 540

export type Px = number & { readonly __brand: 'Px' };
export type TileIndex = number & { readonly __brand: 'TileIndex' };
export type Seconds = number & { readonly __brand: 'Seconds' };
export type EntityId = string & { readonly __brand: 'EntityId' };
export type TriggerId = string & { readonly __brand: 'TriggerId' };

export const px = (n: number): Px => n as Px;
export const tileIdx = (n: number): TileIndex => n as TileIndex;
export const sec = (n: number): Seconds => n as Seconds;
export const entityId = (s: string): EntityId => s as EntityId;
export const triggerId = (s: string): TriggerId => s as TriggerId;

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
  | 'up'
  | 'down'
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
  jumpBufferTimer: Seconds;
}

export type CatId = 'orange' | 'black';
export type PartnerAIMode = 'FOLLOW' | 'STAY';

export interface CatPhysicsConfig {
  readonly id: CatId;
  readonly width: Px;
  readonly height: Px;
  readonly moveSpeed: number;
  readonly groundAccel: number;
  readonly groundDecel: number;
  readonly slipperyDecel: number;
  readonly puddleSpeedMult: number;
  readonly jumpVelocity: number;
  readonly doubleJumpVelocity: number | null;
  readonly gravity: number;
  readonly weight: 1 | 2;
  readonly windImmune: boolean;
  readonly canWallJump: boolean;
  readonly skillCost: number;
  readonly staminaRegenDelay: Seconds;
  readonly staminaRegenRate: number;
}

export const CAT_CONFIG: Record<CatId, CatPhysicsConfig> = {
  orange: {
    id: 'orange',
    width: px(14),
    height: px(14),
    moveSpeed: 78,
    groundAccel: 720,
    groundDecel: 900,
    slipperyDecel: 900, // 防滑
    puddleSpeedMult: 0.9,
    jumpVelocity: -210,
    doubleJumpVelocity: null,
    gravity: 680,
    weight: 2,
    windImmune: true,
    canWallJump: false,
    skillCost: 40,
    staminaRegenDelay: sec(0.6),
    staminaRegenRate: 45,
  },
  black: {
    id: 'black',
    width: px(11),
    height: px(11),
    moveSpeed: 102,
    groundAccel: 720,
    groundDecel: 900,
    slipperyDecel: 120, // 濕滑
    puddleSpeedMult: 0.65,
    jumpVelocity: -235,
    doubleJumpVelocity: -205,
    gravity: 610,
    weight: 1,
    windImmune: false,
    canWallJump: true,
    skillCost: 45,
    staminaRegenDelay: sec(0.5),
    staminaRegenRate: 55,
  },
};

export type CatAnimState =
  | 'idle'
  | 'run'
  | 'jump'
  | 'fall'
  | 'wallSlide'
  | 'skill'
  | 'sit'
  | 'hurt';

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
  stamina: number;
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
  | { readonly kind: 'shadowDash'; remaining: Seconds };

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

export const MAX_LIVES = 9;
export const FISH_PER_EXTRA_LIFE = 10;
export const HURT_INVULN_DURATION = sec(1.2);
export const HERO_RESCUE_LIVES = 3;
export const HERO_SHIELD_DURATION = sec(2.5);
export const SWITCH_GRACE_DURATION = sec(0.25);
export const BOSS_MAX_HP = 3;

export type BossPhase = 1 | 2 | 3;

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
      readonly w: Px;
      readonly h: Px;
      facing: Facing;
      hp: 0 | 1 | 2 | 3;
      behavior: BossBehavior;
      projectileSeq: number;
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
  active: boolean;
}

export type ChapterId = 1 | 2 | 3;
export type LevelId =
  | '1-1'
  | '1-2'
  | '1-3'
  | '2-1'
  | '2-2'
  | '2-3'
  | '3-1'
  | '3-2'
  | '3-3';

export const ALL_LEVEL_IDS: readonly LevelId[] = [
  '1-1', '1-2', '1-3',
  '2-1', '2-2', '2-3',
  '3-1', '3-2', '3-3',
] as const;

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
      readonly openOnAnyTrigger?: boolean;
      readonly bottomGapPx: Px;
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

export interface EnemySpec {
  readonly kind: 'strayDog';
  readonly id: EntityId;
  readonly variant: 'normal' | 'guardDog';
  readonly startPos: Vec2;
  readonly patrolMinX: Px;
  readonly patrolMaxX: Px;
  readonly speed: number;
}

export interface MechanicRuntime {
  readonly spec: MechanicSpec;
  rect: Rect;
  prevX: Px;
  prevY: Px;
  vy: number;
  broken: boolean;
  active: boolean;
  warning: boolean;
  progress: number;
  direction: 1 | -1;
  timer: Seconds;
}

export interface EnemyRuntime {
  readonly spec: EnemySpec;
  x: Px;
  y: Px;
  vx: number;
  w: Px;
  h: Px;
  facing: Facing;
  stunTimer: Seconds;
}

export interface LevelData {
  readonly id: LevelId;
  readonly index: number;
  readonly chapter: ChapterId;
  readonly name: string;
  readonly subtitle: string;
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

export type DialogueSpeaker = '阿福' | '疤面老大' | '橘貓' | '黑貓' | '系統';

export type PauseOption = 'resume' | 'retryCheckpoint' | 'restartLevel' | 'levelSelect';

export type GameScene =
  | { readonly kind: 'TITLE' }
  | { readonly kind: 'LEVEL_SELECT'; selectedIndex: number }
  | { readonly kind: 'PLAYING' }
  | { readonly kind: 'PAUSED'; selectedOption: PauseOption }
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
  lives: number;
  score: number;
  fishBank: number;
  collectedFishIds: Set<EntityId>;
  yarnCollectedInLevel: boolean;
  checkpointReached: boolean;
  hurtInvulnTimer: Seconds;
  heroShieldTimer: Seconds;
  switchGraceTimer: Seconds;
  hitStopTimer: Seconds;
  windTimer: Seconds;
  windActive: boolean;
  windWarning: boolean;
  heroBonded: boolean;
  heroRescueUsedInLevel: boolean;
  heroRescueAnim: { active: boolean; timer: Seconds; x: Px; y: Px };
  tauntTriggered: boolean;
  boss: BossBadCatState | null;
  mechanics: MechanicRuntime[];
  enemies: EnemyRuntime[];
  projectiles: ProjectileState[];
  cameraX: Px;
  elapsed: Seconds;
  switchRipple: { timer: Seconds; x: Px; y: Px; catId: CatId } | null;
  goalWaitingHintTimer: Seconds;
}

export type TrackId = 'title' | 'ch1' | 'ch2' | 'ch3' | 'boss' | 'ending';

export type SfxId =
  | 'meow_orange'
  | 'meow_black'
  | 'jump'
  | 'double_jump'
  | 'dash'
  | 'smash'
  | 'crate_break'
  | 'switch'
  | 'bounce'
  | 'fish'
  | 'yarn'
  | 'heal'
  | 'hurt'
  | 'checkpoint'
  | 'hero_bark'
  | 'boss_roar'
  | 'boss_stun'
  | 'boss_hit'
  | 'clear';

export type WorldEvent =
  | { type: 'sfx'; id: SfxId }
  | { type: 'bgm'; track: TrackId }
  | { type: 'particle'; kind: 'dust' | 'crate' | 'dash' | 'heart' | 'gold' | 'stun' | 'splash'; x: Px; y: Px }
  | { type: 'partner_teleport'; catId: CatId; from: Vec2; to: Vec2 }
  | { type: 'dialogue'; speaker: DialogueSpeaker; text: string }
  | { type: 'screen_shake'; intensity: number; duration: Seconds }
  | { type: 'save_dirty' };

export type StepWorldFn = (world: WorldState, input: InputSnapshot, dt: Seconds) => WorldEvent[];

export const SAVE_STORAGE_KEY = 'cats_bro_save_v1';

export interface SaveDataV1 {
  version: 1;
  unlockedLevelIndex: number;
  allUnlockedPreview: boolean;
  clearedLevels: LevelId[];
  collectedYarns: LevelId[];
  heroBonded: boolean;
  bestScores: Partial<Record<LevelId, number>>;
  muted: boolean;
}
