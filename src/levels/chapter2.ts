import { LevelData } from '../core/types';
import { parseLevel } from './levelBuilder';

// 第二章：霓虹熱鬧夜市（2-1 ~ 2-3）

export const LEVEL_2_1: LevelData = parseLevel({
  id: '2-1',
  index: 3,
  chapter: 2,
  name: '燈籠攤販街',
  subtitle: '霓虹夜市・彈跳遮雨棚與湯鍋蒸氣',
  hasWind: false,
  hasRain: false,
  ascii: [
    '............................................................',
    '............................................................',
    '............................Y...............................',
    '...........................===..............................',
    '.............F..F.....................F..F..................',
    '............======...................======.................',
    '.......===............===......===..............===.........',
    '.....F.......................................F..............',
    '..B..O............F........C............F................G..',
    '################..############..##############..############',
    '################..############..##############..############',
  ],
  mechanics: [
    { kind: 'spring', id: 's2_1_awning1', col: 9, row: 8, launchVy: -315 },
    { kind: 'spring', id: 's2_1_awning2', col: 25, row: 8, launchVy: -330 },
    { kind: 'spring', id: 's2_1_awning3', col: 41, row: 8, launchVy: -315 },
    { kind: 'hazard', id: 'h2_1_steam1', style: 'steam', col: 19, row: 7, period: 3.2, activeDuration: 1.0, warnDuration: 0.6, phaseOffset: 0 },
    { kind: 'hazard', id: 'h2_1_steam2', style: 'steam', col: 36, row: 7, period: 3.2, activeDuration: 1.0, warnDuration: 0.6, phaseOffset: 1.4 },
  ],
  enemies: [
    { id: 'e2_1_dog1', variant: 'normal', col: 50, row: 8, minCol: 48, maxCol: 55, speed: 40 },
  ],
});

export const LEVEL_2_2: LevelData = parseLevel({
  id: '2-2',
  index: 4,
  chapter: 2,
  name: '霓虹高架棚',
  subtitle: '霓虹夜市・移動攤車與電源升降梯',
  hasWind: false,
  hasRain: false,
  ascii: [
    '................................................................',
    '................................................................',
    '..........................................Y.....................',
    '...........................|.............===....................',
    '...........................|.....F..F...........................',
    '.............F..F..........|....======.........=======..........',
    '...........................|....................................',
    '.....F..........................................................',
    '..B..O....H...........F.......C...............F..............G..',
    '##############......#############......#########################',
    '##############......#############......#########################',
  ],
  mechanics: [
    // 移動攤車（自動往返）
    { kind: 'movingPlatform', id: 'p2_2_cart1', col: 14, row: 8, widthTiles: 3, endCol: 18, endRow: 8, speed: 32 },
    // 黑貓攀牆啟動高處霓虹總開關，驅動升降梯載橘貓上高架棚；底部 row 7..8 留通道防卡死
    { kind: 'trigger', id: 't2_2_power', col: 26, row: 3, activation: 'wallSwitch', latched: true },
    { kind: 'movingPlatform', id: 'p2_2_lift', col: 34, row: 8, widthTiles: 3, endCol: 34, endRow: 5, speed: 36, requiredTriggerIds: ['t2_2_power'] },
    { kind: 'hazard', id: 'h2_2_steam', style: 'steam', col: 47, row: 7, period: 3.0, activeDuration: 0.9, warnDuration: 0.6, phaseOffset: 0.5 },
  ],
  enemies: [
    { id: 'e2_2_dog1', variant: 'guardDog', col: 51, row: 8, minCol: 49, maxCol: 59, speed: 46 },
  ],
});

export const LEVEL_2_3: LevelData = parseLevel({
  id: '2-3',
  index: 5,
  chapter: 2,
  name: '夜市大拱門',
  subtitle: '霓虹夜市・雙重連環壓板與看門大黑',
  hasWind: false,
  hasRain: false,
  bossEncounter: 'taunt',
  ascii: [
    '................................................................',
    '................................................................',
    '..............................................Y.................',
    '.............................................===................',
    '....................F..F........................................',
    '.......===.........======..........===..........................',
    '.....F........................F..........===.........F..F.......',
    '....................................................======......',
    '..B..O........F............C..............F..................G..',
    '####################..##########################################',
    '####################..##########################################',
  ],
  mechanics: [
    { kind: 'spring', id: 's2_3_awning', col: 13, row: 8, launchVy: -310 },
    { kind: 'hazard', id: 'h2_3_steam1', style: 'steam', col: 23, row: 7, period: 2.8, activeDuration: 0.9, warnDuration: 0.6, phaseOffset: 0 },
    // 雙重連環壓板（兩塊皆 latched: true，推箱壓 p1＋橘貓踩 p2 後拱門永久升起不卡死）
    { kind: 'pushBox', id: 'b2_3_box', col: 30, row: 8 },
    { kind: 'trigger', id: 't2_3_p1', col: 34, row: 8, activation: 'weight2', latched: true },
    { kind: 'trigger', id: 't2_3_p2', col: 38, row: 8, activation: 'weight2', latched: true },
    { kind: 'gate', id: 'g2_3_arch', col: 41, row: 5, heightTiles: 4, requiredTriggerIds: ['t2_3_p1', 't2_3_p2'], bottomGapPx: 12 },
    { kind: 'crate', id: 'c2_3_crate', col: 46, row: 8 },
  ],
  enemies: [
    { id: 'e2_3_guard1', variant: 'guardDog', col: 10, row: 8, minCol: 7, maxCol: 18, speed: 45 },
    { id: 'e2_3_guard2', variant: 'guardDog', col: 50, row: 8, minCol: 47, maxCol: 57, speed: 50 },
  ],
});

export const CHAPTER_2_LEVELS: readonly LevelData[] = [LEVEL_2_1, LEVEL_2_2, LEVEL_2_3];
