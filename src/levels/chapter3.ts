import { LevelData } from '../core/types';
import { parseLevel } from './levelBuilder';

// 第三章：深夜雨天屋頂（3-1 ~ 3-3）

export const LEVEL_3_1: LevelData = parseLevel({
  id: '3-1',
  index: 6,
  chapter: 3,
  name: '雨夜鐵皮屋',
  subtitle: '深夜屋頂・濕滑鐵皮與高空曬衣繩',
  hasWind: false,
  hasRain: true,
  ascii: [
    '............................................................',
    '............................................................',
    '...............................Y............................',
    '..............................===...........................',
    '..............F..F.......................F..F...............',
    '.............======........===..........======..............',
    '.......===.........................===......................',
    '.....F...........................................F..........',
    '..B..O..............F......C..............F..............G..',
    '######~~~~~~~~~~..~~~~~~~~~~~~~~..~~~~~~~~~~~~~~..##########',
    '######~~~~~~~~~~..~~~~~~~~~~~~~~..~~~~~~~~~~~~~~..##########',
  ],
  mechanics: [
    { kind: 'crate', id: 'c3_1_crate', col: 23, row: 8 },
    { kind: 'hazard', id: 'h3_1_bolt1', style: 'lightning', col: 36, row: 6, heightTiles: 3, period: 3.6, activeDuration: 0.7, warnDuration: 0.9, phaseOffset: 0.5 },
  ],
  enemies: [
    { id: 'e3_1_dog', variant: 'normal', col: 42, row: 8, minCol: 39, maxCol: 47, speed: 42 },
  ],
});

export const LEVEL_3_2: LevelData = parseLevel({
  id: '3-2',
  index: 7,
  chapter: 3,
  name: '狂風水塔道',
  subtitle: '深夜屋頂・陣風推箱擋風與阿福誓言',
  hasWind: true,
  hasRain: true,
  ascii: [
    '................................................................',
    '................................................................',
    '..........................................Y.....................',
    '.........................................===....................',
    '................F..F.............|..............................',
    '...............======............|....======........F..F........',
    '.......===.......................|.................======.......',
    '.....F..........................................................',
    '..B..O....H...........F....C...............F.................G..',
    '######~~~~~~~~~~~~~~~~~~~~~~~~~~~..~~~~~~~~~~~~~~~..############',
    '######~~~~~~~~~~~~~~~~~~~~~~~~~~~..~~~~~~~~~~~~~~~..############',
  ],
  mechanics: [
    // 推箱擋風＋壓板，或黑貓鑽窄縫觸發門後永久拉桿開門；攀牆底部留通道讓橘貓通行
    { kind: 'pushBox', id: 'b3_2_windbox', col: 15, row: 8, blocksWind: true },
    { kind: 'trigger', id: 't3_2_plate', col: 25, row: 8, activation: 'weight2', latched: false },
    { kind: 'trigger', id: 't3_2_latch', col: 30, row: 8, activation: 'touch', latched: true },
    {
      kind: 'gate',
      id: 'g3_2_gate',
      col: 28,
      row: 5,
      heightTiles: 4,
      requiredTriggerIds: ['t3_2_plate', 't3_2_latch'],
      openOnAnyTrigger: true,
      bottomGapPx: 12,
    },
    { kind: 'hazard', id: 'h3_2_bolt1', style: 'lightning', col: 39, row: 6, heightTiles: 3, period: 3.8, activeDuration: 0.7, warnDuration: 1.0, phaseOffset: 0 },
    { kind: 'hazard', id: 'h3_2_bolt2', style: 'lightning', col: 46, row: 6, heightTiles: 3, period: 3.8, activeDuration: 0.7, warnDuration: 1.0, phaseOffset: 1.8 },
  ],
  enemies: [
    { id: 'e3_2_guard', variant: 'guardDog', col: 54, row: 8, minCol: 52, maxCol: 60, speed: 46 },
  ],
});

export const LEVEL_3_3: LevelData = parseLevel({
  id: '3-3',
  index: 8,
  chapter: 3,
  name: '九命歸途終點',
  subtitle: '深夜屋頂・疤面老大最終決戰與溫暖的家',
  hasWind: true,
  hasRain: true,
  bossEncounter: 'battle',
  bossArenaTiles: { col: 25, row: 2, w: 21, h: 7 },
  bossSpawnTile: { col: 41, row: 8 },
  ascii: [
    '......................................................',
    '......................................................',
    '........................|..........Y..........|.......',
    '........................|.........===.........|.......',
    '........................|.....................|.......',
    '........F..F............|....===.......===....|.......',
    '.......======...........|.....................|.......',
    '.....F................................................',
    '..B..O..........F...C..............................G..',
    '###########..###########~~~~~~~~~~~~~~~~~~~~~~########',
    '###########..###########~~~~~~~~~~~~~~~~~~~~~~########',
  ],
  mechanics: [
    // 3-3 Boss 房內擋風推箱＋左右高處水塔水閥；擊敗 Boss 後解除 bossBounds，雙貓可經底部直接走進家門 G
    { kind: 'pushBox', id: 'b3_3_shield', col: 28, row: 8, blocksWind: true },
    { kind: 'waterValve', id: 'v3_3_left', col: 25, row: 4, cooldown: 4.5 },
    { kind: 'waterValve', id: 'v3_3_right', col: 44, row: 4, cooldown: 4.5 },
  ],
  enemies: [],
});

export const CHAPTER_3_LEVELS: readonly LevelData[] = [LEVEL_3_1, LEVEL_3_2, LEVEL_3_3];
