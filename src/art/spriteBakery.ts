export type SpriteKey =
  | 'orange_idle'
  | 'orange_run1'
  | 'orange_run2'
  | 'orange_jump'
  | 'orange_sit'
  | 'orange_smash'
  | 'black_idle'
  | 'black_run1'
  | 'black_run2'
  | 'black_jump'
  | 'black_sit'
  | 'black_dash'
  | 'hero_dog_sit'
  | 'hero_dog_run'
  | 'boss_idle'
  | 'boss_dash'
  | 'boss_stun'
  | 'stray_dog'
  | 'guard_dog'
  | 'fish'
  | 'yarn';

interface SpriteDef {
  palette: Record<string, string>;
  rows: readonly string[];
  defaultFacing?: 'left' | 'right';
}

const ORANGE_PAL: Record<string, string> = {
  o: '#f28b30', // 暖橘
  d: '#b85418', // 虎斑深橘
  w: '#fff3db', // 白肚白爪
  e: '#1d1824', // 眼鼻
  p: '#f29ea6', // 粉耳
  g: '#ffe478', // 猛擊閃光
};

// 黑貓採深藍灰毛色＋1px 微亮輪廓高光 (h) ＋亮金雙眼 (y)，確保深夜屋頂絕不隱形
const BLACK_PAL: Record<string, string> = {
  b: '#222638', // 深藍黑毛
  d: '#131624', // 暗部
  h: '#6e7da6', // 1px 亮輪廓高光
  y: '#ffe84d', // 亮金雙眼
  p: '#8a5f7a', // 耳內
  c: '#72f0ff', // 暗影衝刺殘影藍
};

const HERO_DOG_PAL: Record<string, string> = {
  t: '#dfa354', // 土黃毛
  d: '#9c6427', // 深耳背
  w: '#fff2d6', // 白口鼻白胸
  r: '#e63244', // 鮮明紅領巾
  k: '#1c1824', // 眼鼻
  g: '#ffe875', // 領巾金扣
};

const BOSS_PAL: Record<string, string> = {
  g: '#5c6070', // 灰虎斑
  d: '#2c2f3b', // 深條紋
  w: '#e8ecf2', // 囂張白手套與胸毛
  s: '#e63b6d', // 左眼紫紅刀疤
  y: '#ff524f', // 兇惡紅黃眼
  a: '#9d4edd', // 暗影紫氣場
};

const DOG_PAL: Record<string, string> = {
  b: '#b8763e',
  d: '#6e401d',
  w: '#f2e4cc',
  k: '#1b1621',
  r: '#d94848',
};

const GUARD_DOG_PAL: Record<string, string> = {
  b: '#3b3747',
  d: '#1d1a26',
  w: '#d9cbb8',
  k: '#ff5252',
  r: '#e63946',
};

const ITEM_PAL: Record<string, string> = {
  f: '#8ad4f5',
  d: '#4682b4',
  w: '#ffffff',
  k: '#1b1a26',
  y: '#ff5c8a',
  l: '#ffa3bd',
  s: '#b82552',
};

const SPRITE_DEFS: Record<SpriteKey, SpriteDef> = {
  orange_idle: {
    palette: ORANGE_PAL,
    rows: [
      '..........oo..',
      '.o...o...o..o.',
      '.opoopo....oo.',
      '.oooooo...oo..',
      '.oeoooe..ooo..',
      '.oowwoo.oooo..',
      '..ddddoooooo..',
      '..ooowwooooo..',
      '..oowwwwoood..',
      '..ooowwooooo..',
      '..oooddooooo..',
      '...oo....oo...',
      '...ww....ww...',
      '..............',
    ],
  },
  orange_run1: {
    palette: ORANGE_PAL,
    rows: [
      '..............',
      '.o...o....ooo.',
      '.opoopo..o..o.',
      '.oooooo....o..',
      '.oeoooe..ooo..',
      '.oowwooooooo..',
      '..ddddoooooo..',
      '..ooowwooooo..',
      '..oowwwwoood..',
      '..ooowwooooo..',
      '..oo......oo..',
      '.ww........ww.',
      '..............',
      '..............',
    ],
  },
  orange_run2: {
    palette: ORANGE_PAL,
    rows: [
      '..............',
      '.o...o...oo...',
      '.opoopo....o..',
      '.oooooo...oo..',
      '.oeoooe..ooo..',
      '.oowwooooooo..',
      '..ddddoooooo..',
      '..ooowwooooo..',
      '..oowwwwoood..',
      '....oo..oo....',
      '....ww..ww....',
      '..............',
      '..............',
      '..............',
    ],
  },
  orange_jump: {
    palette: ORANGE_PAL,
    rows: [
      '.o...o........',
      '.opoopo.......',
      '.oooooo....oo.',
      '.oeoooe...o...',
      '.oowwoo..oo...',
      '..ddddoooo....',
      '..ooowwooo....',
      '..oowwwwoo....',
      '..ooowwooo....',
      '.ww......ww...',
      '..............',
      '..............',
      '..............',
      '..............',
    ],
  },
  orange_sit: {
    palette: ORANGE_PAL,
    rows: [
      '..............',
      '....o...o.....',
      '....opoopo....',
      '....oooooo....',
      '....oeoooe....',
      '....oowwoo....',
      '...ddddoooo...',
      '...ooowwooo.o.',
      '...oowwwwoo.o.',
      '...ooowwoooo..',
      '...oooddooo...',
      '...ww..ww.....',
      '..............',
      '..............',
    ],
  },
  orange_smash: {
    palette: ORANGE_PAL,
    rows: [
      '...g..........',
      '..g....o...o..',
      '.ggg..opoopo..',
      '.ggoo.oooooo..',
      '.ggoooeoooeo..',
      '..goooowwooo..',
      '.gooooooodddd.',
      '.gooooowwooo..',
      '..ggoowwwwoo..',
      '..g.oo....oo..',
      '....ww....ww..',
      '..............',
      '..............',
      '..............',
    ],
  },
  black_idle: {
    palette: BLACK_PAL,
    rows: [
      '.h..h...hh.',
      'hphhph...bh',
      'hbbbbh..bbh',
      'hbyybh.bbh.',
      'hbbbbhbbb..',
      '.hbbbbbbh..',
      '.hbbbbbbh..',
      '.hbbddbbh..',
      '..hb..bh...',
      '..hh..hh...',
      '...........',
    ],
  },
  black_run1: {
    palette: BLACK_PAL,
    rows: [
      '.h..h......',
      'hphhph..hhh',
      'hbbbbh.b..h',
      'hbyybhbbbh.',
      'hbbbbbbbb..',
      '.hbbbbbbh..',
      '.hbbddbbh..',
      'hbh....hbh.',
      '.h......h..',
      '...........',
      '...........',
    ],
  },
  black_run2: {
    palette: BLACK_PAL,
    rows: [
      '.h..h..hh..',
      'hphhph...h.',
      'hbbbbh..bh.',
      'hbyybhbbbh.',
      'hbbbbbbbb..',
      '.hbbbbbbh..',
      '..hbbbbh...',
      '...hb.bh...',
      '...hh.hh...',
      '...........',
      '...........',
    ],
  },
  black_jump: {
    palette: BLACK_PAL,
    rows: [
      '.h..h......',
      'hphhph.....',
      'hbbbbh..hh.',
      'hbyybh.b...',
      'hbbbbhbb...',
      '.hbbbbbh...',
      '.hbbddbh...',
      'hh....hh...',
      '...........',
      '...........',
      '...........',
    ],
  },
  black_sit: {
    palette: BLACK_PAL,
    rows: [
      '..h..h.....',
      '.hphhph....',
      '.hbbbbh....',
      '.hbyybh....',
      '.hbbbbh..h.',
      '.hbbbbbh.h.',
      '.hbbddbhbh.',
      '..hbbbbhh..',
      '..hh..hh...',
      '...........',
      '...........',
    ],
  },
  black_dash: {
    palette: BLACK_PAL,
    rows: [
      '...h..h.ccc',
      '..hphhph.cc',
      '.chbbbbhccc',
      'cchbyybh.cc',
      'cchbbbbhccc',
      '.chbbbh..cc',
      '..hh.hh...c',
      '...........',
      '...........',
      '...........',
      '...........',
    ],
  },
  hero_dog_sit: {
    palette: HERO_DOG_PAL,
    rows: [
      '....dd..dd........',
      '...dttddttd.......',
      '...tttttttt.......',
      '...tkttttkt.......',
      '...ttwwwwtt.......',
      '....ttkktt........',
      '...rrgrrrrr.......',
      '...rrrrrrrr...tt..',
      '...tttwwttt..tt...',
      '...tttwwtttttt....',
      '...tttttttttt.....',
      '...ttt..tttt......',
      '...ww....ww.......',
      '..................',
    ],
  },
  hero_dog_run: {
    palette: HERO_DOG_PAL,
    rows: [
      '..................',
      '....dd..dd........',
      '...dttddttd....tt.',
      '...tttttttt...tt..',
      '...tkttttkt..tt...',
      '...ttwwwwtttttt...',
      '...rrgrrrrrttt....',
      '..rrrrrrrrtttt....',
      '..tttttttttttt....',
      '..ttt....tttt.....',
      '.ww........ww.....',
      '..................',
      '..................',
      '..................',
    ],
  },
  boss_idle: {
    palette: BOSS_PAL,
    rows: [
      '..g......g..........',
      '.gdg....gdg....aa...',
      '.gggggggggg...a..a..',
      '.ggysgggygg..a.gg...',
      '.ggggwwgggg.a.gg....',
      '..ggddddgg.a.ggg....',
      '..ggggggggggggg.....',
      '..ggdwwdgggggg......',
      '..ggdwwdggddgg......',
      '..gggggggggggg......',
      '..ggg....gggg.......',
      '..www....wwww.......',
      '....................',
      '....................',
    ],
  },
  boss_dash: {
    palette: BOSS_PAL,
    rows: [
      'aaaaaaaa............',
      '..g......g...aaa....',
      '.gdg....gdg.a.......',
      '.ggggggggggaa.......',
      '.ggysgggyggggg......',
      '.ggggwwgggggggg.....',
      '..ggddddggggggg.....',
      '..ggdwwdgggggg......',
      '..www......www......',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
    ],
  },
  boss_stun: {
    palette: BOSS_PAL,
    rows: [
      '..y...a...y.........',
      '....a...y...........',
      '.gdg....gdg.........',
      '.gggggggggg.........',
      '.ggssgggssg.........',
      '.ggggwwgggg.........',
      '..ggddddggggg.......',
      '..ggdwwdggggg.......',
      '..ggggggggggg.......',
      '..www....www........',
      '....................',
      '....................',
      '....................',
      '....................',
    ],
  },
  stray_dog: {
    palette: DOG_PAL,
    rows: [
      '..d..d........',
      '.dbbbbd....b..',
      '.bkbbkb...b...',
      '.bbwwbb..bb...',
      '..rrrrbbbb....',
      '..bbbbbbbb....',
      '..bbddbbbb....',
      '..bb....bb....',
      '..ww....ww....',
      '..............',
    ],
  },
  guard_dog: {
    palette: GUARD_DOG_PAL,
    rows: [
      '..d...d.........',
      '.dbbbbbd.....b..',
      '.bkbbbkb....b...',
      '.bbbwwbbb..bb...',
      '..rrrrrrbbbb....',
      '..bbbbbbbbbb....',
      '..bbbddbbbbb....',
      '..bbb....bbb....',
      '..www....www....',
      '................',
    ],
  },
  fish: {
    palette: ITEM_PAL,
    defaultFacing: 'right',
    rows: [
      '....ffff..',
      '..ffwffkf.',
      'ffddddffff',
      '..ffddddf.',
      '....ffff..',
    ],
  },
  yarn: {
    palette: ITEM_PAL,
    rows: [
      '..yyyyy...',
      '.ylllyyy..',
      'yllyysyyy.',
      'yyysyyysy.',
      'yysyyysyy.',
      '.yyyyyyy..',
      '..sssss.yy',
      '.........y',
    ],
  },
};

export interface BakedSprite {
  right: HTMLCanvasElement;
  left: HTMLCanvasElement;
  w: number;
  h: number;
}

export class SpriteBakery {
  private readonly cache = new Map<SpriteKey, BakedSprite>();

  constructor() {
    for (const key of Object.keys(SPRITE_DEFS) as SpriteKey[]) {
      this.cache.set(key, this.bake(SPRITE_DEFS[key]));
    }
  }

  private bake(def: SpriteDef): BakedSprite {
    const h = def.rows.length;
    const w = def.rows[0]?.length ?? 1;
    const right = document.createElement('canvas');
    right.width = w;
    right.height = h;
    const rCtx = right.getContext('2d')!;

    const left = document.createElement('canvas');
    left.width = w;
    left.height = h;
    const lCtx = left.getContext('2d')!;

    const facesRight = def.defaultFacing === 'right';
    for (let y = 0; y < h; y++) {
      const row = def.rows[y]!;
      for (let x = 0; x < w; x++) {
        const ch = row[x]!;
        if (ch === '.') continue;
        const color = def.palette[ch];
        if (!color) continue;
        const rx = facesRight ? x : w - 1 - x;
        const lx = facesRight ? w - 1 - x : x;
        rCtx.fillStyle = color;
        rCtx.fillRect(rx, y, 1, 1);
        lCtx.fillStyle = color;
        lCtx.fillRect(lx, y, 1, 1);
      }
    }

    return { right, left, w, h };
  }

  public get(key: SpriteKey): BakedSprite {
    return this.cache.get(key)!;
  }
}
