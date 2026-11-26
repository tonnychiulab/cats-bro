import {
  ChapterId,
  EnemySpec,
  LevelData,
  LevelId,
  MechanicSpec,
  Rect,
  TILE_SIZE,
  TileType,
  Vec2,
  entityId,
  px,
  sec,
  triggerId,
} from '../core/types';

export type RawMechanic =
  | { kind: 'crate'; id: string; col: number; row: number }
  | { kind: 'pushBox'; id: string; col: number; row: number; blocksWind?: boolean }
  | {
      kind: 'trigger';
      id: string;
      col: number;
      row: number;
      activation: 'weight2' | 'touch' | 'wallSwitch';
      latched: boolean;
    }
  | {
      kind: 'gate';
      id: string;
      col: number;
      row: number;
      heightTiles: number;
      requiredTriggerIds: string[];
      openOnAnyTrigger?: boolean;
      bottomGapPx: number;
    }
  | {
      kind: 'movingPlatform';
      id: string;
      col: number;
      row: number;
      widthTiles: number;
      endCol: number;
      endRow: number;
      speed: number;
      requiredTriggerIds?: string[];
    }
  | { kind: 'spring'; id: string; col: number; row: number; launchVy?: number }
  | {
      kind: 'hazard';
      id: string;
      style: 'steam' | 'lightning';
      col: number;
      row: number;
      widthTiles?: number;
      heightTiles?: number;
      period: number;
      activeDuration: number;
      warnDuration: number;
      phaseOffset?: number;
    }
  | { kind: 'waterValve'; id: string; col: number; row: number; cooldown?: number };

export interface RawEnemy {
  id: string;
  variant: 'normal' | 'guardDog';
  col: number;
  row: number;
  minCol: number;
  maxCol: number;
  speed: number;
}

export interface LevelRawSpec {
  id: LevelId;
  index: number;
  chapter: ChapterId;
  name: string;
  subtitle: string;
  hasWind: boolean;
  hasRain: boolean;
  bossEncounter?: 'taunt' | 'battle';
  bossArenaTiles?: { col: number; row: number; w: number; h: number };
  bossSpawnTile?: { col: number; row: number };
  ascii: readonly string[];
  mechanics: readonly RawMechanic[];
  enemies: readonly RawEnemy[];
}

export function parseLevel(raw: LevelRawSpec): LevelData {
  const heightTiles = raw.ascii.length;
  if (heightTiles === 0) {
    throw new Error(`Level ${raw.id}: empty ascii map`);
  }
  const widthTiles = raw.ascii[0]!.length;

  const tiles: TileType[][] = [];
  let spawnOrange: Vec2 | null = null;
  let spawnBlack: Vec2 | null = null;
  let checkpoint: Vec2 | null = null;
  let goal: Rect | null = null;
  let yarnBall: Vec2 | null = null;
  let yarnCount = 0;
  let heroDogSpot: Vec2 | undefined;
  const fishes: { id: ReturnType<typeof entityId>; pos: Vec2 }[] = [];

  for (let r = 0; r < heightTiles; r++) {
    const line = raw.ascii[r]!;
    if (line.length !== widthTiles) {
      throw new Error(
        `Level ${raw.id}: row ${r} length ${line.length} !== expected ${widthTiles}`,
      );
    }
    const rowArr: TileType[] = [];
    for (let c = 0; c < widthTiles; c++) {
      const ch = line[c]!;
      const xPx = px(c * TILE_SIZE);
      const yPx = px(r * TILE_SIZE);

      switch (ch) {
        case '#':
          rowArr.push(1);
          break;
        case '=':
          rowArr.push(2);
          break;
        case '~':
          rowArr.push(3);
          break;
        case 'w':
          rowArr.push(4);
          break;
        case '|':
          rowArr.push(5);
          break;
        case 'O':
          rowArr.push(0);
          spawnOrange = { x: px(c * TILE_SIZE + 1), y: px(r * TILE_SIZE + 2) };
          break;
        case 'B':
          rowArr.push(0);
          spawnBlack = { x: px(c * TILE_SIZE + 2), y: px(r * TILE_SIZE + 5) };
          break;
        case 'C':
          rowArr.push(0);
          checkpoint = { x: px(c * TILE_SIZE + 2), y: px(r * TILE_SIZE + 2) };
          break;
        case 'G':
          rowArr.push(0);
          goal = {
            x: px(c * TILE_SIZE),
            y: px((r - 1) * TILE_SIZE),
            w: px(TILE_SIZE * 2),
            h: px(TILE_SIZE * 2),
          };
          break;
        case 'Y':
          rowArr.push(0);
          yarnBall = { x: px(c * TILE_SIZE + 2), y: px(r * TILE_SIZE + 2) };
          yarnCount += 1;
          break;
        case 'F':
          rowArr.push(0);
          fishes.push({
            id: entityId(`${raw.id}_fish_${c}_${r}`),
            pos: { x: px(c * TILE_SIZE + 3), y: px(r * TILE_SIZE + 4) },
          });
          break;
        case 'H':
          rowArr.push(0);
          heroDogSpot = { x: xPx, y: yPx };
          break;
        default:
          rowArr.push(0);
          break;
      }
    }
    tiles.push(rowArr);
  }

  if (!spawnOrange || !spawnBlack) {
    throw new Error(`Level ${raw.id}: missing O or B spawn`);
  }
  if (!checkpoint) {
    throw new Error(`Level ${raw.id}: missing C checkpoint`);
  }
  if (!goal) {
    throw new Error(`Level ${raw.id}: missing G goal`);
  }
  if (!yarnBall || yarnCount !== 1) {
    throw new Error(`Level ${raw.id}: must have exactly 1 Y yarn ball (got ${yarnCount})`);
  }

  const mechanics: MechanicSpec[] = raw.mechanics.map((m) => {
    switch (m.kind) {
      case 'crate':
        return {
          kind: 'crate',
          id: entityId(m.id),
          rect: {
            x: px(m.col * TILE_SIZE),
            y: px(m.row * TILE_SIZE),
            w: px(TILE_SIZE),
            h: px(TILE_SIZE),
          },
        };
      case 'pushBox':
        return {
          kind: 'pushBox',
          id: entityId(m.id),
          rect: {
            x: px(m.col * TILE_SIZE),
            y: px(m.row * TILE_SIZE + 1),
            w: px(15),
            h: px(15),
          },
          blocksWind: Boolean(m.blocksWind),
        };
      case 'trigger':
        return {
          kind: 'trigger',
          id: triggerId(m.id),
          rect:
            m.activation === 'wallSwitch'
              ? {
                  x: px(m.col * TILE_SIZE + 2),
                  y: px(m.row * TILE_SIZE + 2),
                  w: px(12),
                  h: px(12),
                }
              : {
                  x: px(m.col * TILE_SIZE + 1),
                  y: px(m.row * TILE_SIZE + 11),
                  w: px(14),
                  h: px(5),
                },
          activation: m.activation,
          latched: m.latched,
        };
      case 'gate':
        return {
          kind: 'gate',
          id: entityId(m.id),
          rect: {
            x: px(m.col * TILE_SIZE + 2),
            y: px(m.row * TILE_SIZE),
            w: px(12),
            h: px(m.heightTiles * TILE_SIZE),
          },
          requiredTriggerIds: m.requiredTriggerIds.map(triggerId),
          openOnAnyTrigger: m.openOnAnyTrigger,
          bottomGapPx: px(m.bottomGapPx),
        };
      case 'movingPlatform':
        return {
          kind: 'movingPlatform',
          id: entityId(m.id),
          rect: {
            x: px(m.col * TILE_SIZE),
            y: px(m.row * TILE_SIZE),
            w: px(m.widthTiles * TILE_SIZE),
            h: px(6),
          },
          endPos: { x: px(m.endCol * TILE_SIZE), y: px(m.endRow * TILE_SIZE) },
          speed: m.speed,
          requiredTriggerIds: m.requiredTriggerIds?.map(triggerId),
        };
      case 'spring':
        return {
          kind: 'spring',
          id: entityId(m.id),
          rect: {
            x: px(m.col * TILE_SIZE),
            y: px(m.row * TILE_SIZE + 8),
            w: px(TILE_SIZE * 2),
            h: px(8),
          },
          launchVy: m.launchVy ?? -310,
        };
      case 'hazard':
        return {
          kind: 'hazard',
          id: entityId(m.id),
          style: m.style,
          rect: {
            x: px(m.col * TILE_SIZE + 2),
            y: px(m.row * TILE_SIZE),
            w: px((m.widthTiles ?? 1) * TILE_SIZE - 4),
            h: px((m.heightTiles ?? 2) * TILE_SIZE),
          },
          period: sec(m.period),
          activeDuration: sec(m.activeDuration),
          warnDuration: sec(m.warnDuration),
          phaseOffset: sec(m.phaseOffset ?? 0),
        };
      case 'waterValve':
        return {
          kind: 'waterValve',
          id: triggerId(m.id),
          rect: {
            x: px(m.col * TILE_SIZE + 2),
            y: px(m.row * TILE_SIZE + 2),
            w: px(12),
            h: px(12),
          },
          cooldown: sec(m.cooldown ?? 4.5),
        };
    }
  });

  const enemies: EnemySpec[] = raw.enemies.map((e) => ({
    kind: 'strayDog',
    id: entityId(e.id),
    variant: e.variant,
    startPos: {
      x: px(e.col * TILE_SIZE),
      y: px(e.row * TILE_SIZE + (e.variant === 'guardDog' ? 2 : 4)),
    },
    patrolMinX: px(e.minCol * TILE_SIZE),
    patrolMaxX: px(e.maxCol * TILE_SIZE),
    speed: e.speed,
  }));

  const bossArena: Rect | undefined = raw.bossArenaTiles
    ? {
        x: px(raw.bossArenaTiles.col * TILE_SIZE),
        y: px(raw.bossArenaTiles.row * TILE_SIZE),
        w: px(raw.bossArenaTiles.w * TILE_SIZE),
        h: px(raw.bossArenaTiles.h * TILE_SIZE),
      }
    : undefined;

  const bossSpawn: Vec2 | undefined = raw.bossSpawnTile
    ? {
        x: px(raw.bossSpawnTile.col * TILE_SIZE),
        y: px(raw.bossSpawnTile.row * TILE_SIZE - 6),
      }
    : undefined;

  // 靜態不變量校驗（INV-LVL-02 / INV-LVL-03）：起點、機關不與實心磚重疊，3-3 必含 Boss 與水閥
  const isSolid = (t: TileType) => t === 1 || t === 3 || t === 5;
  const assertNotInSolid = (label: string, x: number, y: number) => {
    const c = Math.floor(x / TILE_SIZE);
    const r = Math.floor(y / TILE_SIZE);
    if (isSolid(tiles[r]?.[c] ?? 0)) {
      throw new Error(`Level ${raw.id}: ${label} overlaps solid tile at (${c}, ${r})`);
    }
  };
  assertNotInSolid('spawnOrange', spawnOrange.x, spawnOrange.y);
  assertNotInSolid('spawnBlack', spawnBlack.x, spawnBlack.y);
  for (const m of mechanics) {
    if (m.kind === 'gate' || m.kind === 'crate' || m.kind === 'pushBox') {
      const c = Math.floor((m.rect.x + m.rect.w / 2) / TILE_SIZE);
      const rTop = Math.floor((m.rect.y + 2) / TILE_SIZE);
      const rBot = Math.floor((m.rect.y + m.rect.h - 2) / TILE_SIZE);
      for (let r = rTop; r <= rBot; r++) {
        if (isSolid(tiles[r]?.[c] ?? 0)) {
          throw new Error(`Level ${raw.id}: mechanic ${m.id} overlaps solid tile at (${c}, ${r})`);
        }
      }
    }
  }
  if (raw.bossEncounter === 'battle') {
    if (!bossArena || !bossSpawn || !mechanics.some((m) => m.kind === 'waterValve')) {
      throw new Error(`Level ${raw.id}: battle level must define bossArena, bossSpawn, and waterValve`);
    }
  }

  return {
    id: raw.id,
    index: raw.index,
    chapter: raw.chapter,
    name: raw.name,
    subtitle: raw.subtitle,
    widthTiles,
    heightTiles,
    widthPx: px(widthTiles * TILE_SIZE),
    heightPx: px(heightTiles * TILE_SIZE),
    hasWind: raw.hasWind,
    hasRain: raw.hasRain,
    spawnOrange,
    spawnBlack,
    checkpoint,
    goal,
    yarnBall,
    fishes,
    heroDogSpot,
    bossEncounter: raw.bossEncounter,
    bossArena,
    bossSpawn,
    tiles,
    mechanics,
    enemies,
  };
}
