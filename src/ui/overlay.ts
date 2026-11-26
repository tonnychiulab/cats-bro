import {
  BOSS_MAX_HP,
  FISH_PER_EXTRA_LIFE,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  MAX_LIVES,
  PauseOption,
  SaveDataV1,
  UI_OVERLAY_SCALE,
  WorldState,
  getBossPhase,
} from '../core/types';
import { ALL_LEVELS } from '../levels';

export const UI_W = LOGICAL_WIDTH * UI_OVERLAY_SCALE; // 960
export const UI_H = LOGICAL_HEIGHT * UI_OVERLAY_SCALE; // 540

export interface ClickableRegion {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const FONT = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", monospace';

export class UiOverlayRenderer {
  public clickableRegions: ClickableRegion[] = [];

  public render(
    ctx: CanvasRenderingContext2D,
    world: WorldState | null,
    sceneKind: WorldState['scene']['kind'] | 'TITLE' | 'LEVEL_SELECT',
    save: SaveDataV1,
    selectedLevelIndex: number,
    pauseOption: PauseOption,
    endingType: 'normal' | 'true',
  ): void {
    ctx.clearRect(0, 0, UI_W, UI_H);
    this.clickableRegions = [];

    if (sceneKind === 'TITLE') {
      this.drawTitleScreen(ctx, save);
      return;
    }
    if (sceneKind === 'LEVEL_SELECT') {
      this.drawLevelSelect(ctx, save, selectedLevelIndex);
      return;
    }
    if (!world) return;

    // 遊戲中 HUD
    this.drawHud(ctx, world);

    if (world.scene.kind === 'DIALOGUE') {
      this.drawDialogueBox(ctx, world.scene.speaker, world.scene.text, world.scene.minLockTimer <= 0);
    } else if (world.scene.kind === 'PAUSED') {
      this.drawPauseMenu(ctx, pauseOption);
    } else if (world.scene.kind === 'RESPAWN') {
      this.drawCenterBanner(ctx, '九命歸零…', '回到溫暖角落休息一下，隨即滿 9 命出發！');
    } else if (world.scene.kind === 'LEVEL_CLEAR') {
      this.drawLevelClear(ctx, world, save);
    } else if (world.scene.kind === 'ENDING') {
      this.drawEnding(ctx, endingType, save);
    }
  }

  private drawPanel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    bg = 'rgba(20, 17, 34, 0.92)',
    border = '#7869a6',
  ): void {
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = border;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  }

  private drawTitleScreen(ctx: CanvasRenderingContext2D, save: SaveDataV1): void {
    ctx.fillStyle = 'rgba(12, 10, 24, 0.72)';
    ctx.fillRect(0, 0, UI_W, UI_H);

    this.drawPanel(ctx, 130, 58, 700, 420, 'rgba(22, 18, 38, 0.94)', '#f2a65a');

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd27d';
    ctx.font = `700 44px ${FONT}`;
    ctx.fillText('橘黑兄弟：九命歸途', UI_W / 2, 148);

    ctx.fillStyle = '#d4c8f0';
    ctx.font = `600 17px ${FONT}`;
    ctx.fillText('ORANGE & BLACK BROS: NINE LIVES HOME · 16-BIT', UI_W / 2, 182);

    ctx.fillStyle = '#fff3db';
    ctx.font = `500 15px ${FONT}`;
    ctx.fillText('橘貓（力量／抗風抗滑／推箱猛擊）  ×  黑貓（敏捷／二段跳／攀牆／暗影衝刺）', UI_W / 2, 234);
    ctx.fillStyle = '#9ee8ff';
    ctx.fillText('九條命 × 九大台灣關卡 · 尋找戴紅領巾的好狗「阿福」，迎戰壞貓「疤面老大」！', UI_W / 2, 264);

    // 按鈕：開始冒險 / 選關
    this.drawButton(ctx, 'start_game', UI_W / 2 - 150, 314, 300, 50, '進入 9 關選單（Enter / Space）', true);

    ctx.fillStyle = '#b9aed4';
    ctx.font = `500 14px ${FONT}`;
    ctx.fillText(
      `進度：已通關 ${save.clearedLevels.length} / 9 關   ·   毛線球 ${save.collectedYarns.length} / 9   ·   阿福結緣：${save.heroBonded ? '已結緣' : '尚未遇見'}`,
      UI_W / 2,
      416,
    );
    ctx.fillStyle = '#8b7fa8';
    ctx.font = `400 13px ${FONT}`;
    ctx.fillText('純程式碼程式化像素精靈 ＋ Web Audio 4 軌晶片音樂 · 開箱即玩', UI_W / 2, 448);
  }

  private drawLevelSelect(ctx: CanvasRenderingContext2D, save: SaveDataV1, selectedIdx: number): void {
    ctx.fillStyle = 'rgba(14, 12, 26, 0.94)';
    ctx.fillRect(0, 0, UI_W, UI_H);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd27d';
    ctx.font = `700 28px ${FONT}`;
    ctx.fillText('選擇關卡（3 章 × 3 關 = 9 關）', 42, 54);

    // 右上角：全部解鎖（試玩模式）開關
    const previewLabel = save.allUnlockedPreview ? '試玩解鎖：已開啟（全 9 關）' : '試玩解鎖：關閉（點此全開）';
    this.drawButton(ctx, 'toggle_unlock_all', 660, 22, 258, 38, previewLabel, save.allUnlockedPreview);

    const chapters = [
      { ch: 1, title: '第一章：黃昏騎樓巷弄', color: '#f29e5a' },
      { ch: 2, title: '第二章：霓虹熱鬧夜市', color: '#ff5c93' },
      { ch: 3, title: '第三章：深夜雨天屋頂', color: '#69c2ff' },
    ];

    chapters.forEach((cInfo, row) => {
      const yBase = 88 + row * 134;
      ctx.textAlign = 'left';
      ctx.fillStyle = cInfo.color;
      ctx.font = `700 16px ${FONT}`;
      ctx.fillText(cInfo.title, 44, yBase + 16);

      for (let col = 0; col < 3; col++) {
        const idx = row * 3 + col;
        const lvl = ALL_LEVELS[idx]!;
        const x = 44 + col * 298;
        const y = yBase + 26;
        const w = 280;
        const h = 92;
        const unlocked = save.allUnlockedPreview || idx <= save.unlockedLevelIndex;
        const cleared = save.clearedLevels.includes(lvl.id);
        const hasYarn = save.collectedYarns.includes(lvl.id);
        const isSel = idx === selectedIdx;

        this.drawPanel(
          ctx,
          x,
          y,
          w,
          h,
          unlocked ? (isSel ? 'rgba(62, 48, 98, 0.96)' : 'rgba(30, 25, 50, 0.92)') : 'rgba(20, 18, 28, 0.72)',
          isSel ? '#ffe278' : unlocked ? cInfo.color : '#3c364d',
        );

        ctx.textAlign = 'left';
        ctx.fillStyle = unlocked ? '#fff4dc' : '#6c6680';
        ctx.font = `700 17px ${FONT}`;
        ctx.fillText(`${lvl.id} ${lvl.name}`, x + 14, y + 30);

        ctx.fillStyle = unlocked ? '#bfb4db' : '#555066';
        ctx.font = `400 12px ${FONT}`;
        ctx.fillText(lvl.subtitle, x + 14, y + 52);

        ctx.fillStyle = cleared ? '#59e892' : unlocked ? '#ffd27d' : '#5e5870';
        ctx.font = `600 12px ${FONT}`;
        const statusText = !unlocked
          ? '尚未解鎖'
          : `${cleared ? '★ 已通關' : '可挑戰'}   ${hasYarn ? '● 已收毛線球' : '○ 毛線球未得'}`;
        ctx.fillText(statusText, x + 14, y + 76);

        if (unlocked) {
          this.clickableRegions.push({ id: `level_${idx}`, x, y, w, h });
        }
      }
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = '#b9aed4';
    ctx.font = `500 14px ${FONT}`;
    ctx.fillText(
      `方向鍵選擇 · Enter / 滑鼠點擊進入關卡 · 毛線球 ${save.collectedYarns.length}/9 · 阿福守護：${save.heroBonded ? '已結緣' : '藏於 1-2 / 2-2 / 3-2 支線'}`,
      UI_W / 2,
      516,
    );
  }

  private drawHud(ctx: CanvasRenderingContext2D, world: WorldState): void {
    // 左上角狀態卡（九命＋主控貓＋體力＋阿福徽章）
    this.drawPanel(ctx, 14, 12, 336, 76, 'rgba(18, 15, 30, 0.82)', '#5c5082');

    // 九條命愛心列
    for (let i = 0; i < MAX_LIVES; i++) {
      const hx = 26 + i * 24;
      const hy = 22;
      const filled = i < world.lives;
      ctx.fillStyle = filled ? (world.heroShieldTimer > 0 ? '#ffe85c' : '#ff5277') : '#38304d';
      ctx.fillRect(hx + 2, hy, 5, 5);
      ctx.fillRect(hx + 9, hy, 5, 5);
      ctx.fillRect(hx, hy + 3, 16, 6);
      ctx.fillRect(hx + 2, hy + 9, 12, 3);
      ctx.fillRect(hx + 5, hy + 12, 6, 3);
    }

    // 阿福紅領巾守護徽章
    if (world.heroBonded) {
      const rx = 250;
      const ry = 20;
      ctx.fillStyle = world.heroRescueUsedInLevel ? '#4b455e' : '#e63244';
      ctx.fillRect(rx, ry, 88, 20);
      ctx.fillStyle = '#fff3db';
      ctx.textAlign = 'center';
      ctx.font = `700 11px ${FONT}`;
      ctx.fillText(world.heroRescueUsedInLevel ? '阿福已救援' : '★ 阿福守護', rx + 44, ry + 14);
    }

    // 主控貓資訊＋技能體力條＋夥伴模式
    const activeCat = world.cats[world.activeCatId];
    ctx.textAlign = 'left';
    ctx.fillStyle = world.activeCatId === 'orange' ? '#ffb357' : '#7ae8ff';
    ctx.font = `700 14px ${FONT}`;
    const catLabel = world.activeCatId === 'orange' ? '橘貓（猛擊/抗風）' : '黑貓（衝刺/二段跳）';
    ctx.fillText(catLabel, 26, 60);

    // 體力條
    ctx.fillStyle = '#2d2642';
    ctx.fillRect(26, 68, 150, 10);
    ctx.fillStyle = world.activeCatId === 'orange' ? '#f28b30' : '#4ee6ff';
    ctx.fillRect(26, 68, Math.round((activeCat.stamina / 100) * 150), 10);

    // 夥伴模式標籤
    ctx.fillStyle = world.partnerMode === 'STAY' ? '#ffe278' : '#9ee8b8';
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText(
      `夥伴：${world.partnerMode === 'STAY' ? '待命(E)' : '跟隨(E)'}`,
      194,
      76,
    );

    // 右上角關卡與收集資訊
    this.drawPanel(ctx, 690, 12, 256, 64, 'rgba(18, 15, 30, 0.82)', '#5c5082');
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd27d';
    ctx.font = `700 15px ${FONT}`;
    ctx.fillText(`${world.level.id} ${world.level.name}`, 934, 34);

    ctx.fillStyle = '#e8e0f5';
    ctx.font = `600 13px ${FONT}`;
    const fishProgress = world.fishBank % FISH_PER_EXTRA_LIFE;
    ctx.fillText(
      `魚乾 ${world.fishBank} (${fishProgress}/10補命)  ｜  毛線球 ${world.yarnCollectedInLevel ? '1/1' : '0/1'}`,
      934,
      58,
    );

    // 3-3 Boss 血條
    if (world.boss && world.boss.status === 'active' && world.boss.behavior.kind !== 'DEFEATED') {
      this.drawPanel(ctx, 360, 14, 316, 46, 'rgba(34, 14, 28, 0.88)', '#e63b6d');
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff99b8';
      ctx.font = `700 13px ${FONT}`;
      ctx.fillText(
        `惡霸 Boss · 疤面老大（第 ${getBossPhase(world.boss.hp)} 階段）`,
        518,
        32,
      );
      for (let i = 0; i < BOSS_MAX_HP; i++) {
        ctx.fillStyle = i < world.boss.hp ? '#ff3b6b' : '#402232';
        ctx.fillRect(390 + i * 86, 40, 78, 11);
      }
    }

    // 忠犬阿福支線靠近線索提示
    if (world.level.heroDogSpot && !world.heroBonded) {
      const dist = Math.hypot(
        world.cats[world.activeCatId].x - world.level.heroDogSpot.x,
        world.cats[world.activeCatId].y - world.level.heroDogSpot.y,
      );
      if (dist < 130) {
        this.drawPanel(ctx, 330, 96, 300, 32, 'rgba(30, 20, 42, 0.85)', '#ff6b8b');
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffe875';
        ctx.font = `600 13px ${FONT}`;
        ctx.fillText('汪…♪ 附近暗巷好像有戴紅領巾的好狗！', UI_W / 2, 117);
      }
    }

    // 終點等兄弟提示
    if (world.goalWaitingHintTimer > 0) {
      this.drawPanel(ctx, 320, 468, 320, 36, 'rgba(22, 18, 38, 0.9)', '#ffe278');
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffe278';
      ctx.font = `700 15px ${FONT}`;
      ctx.fillText('兩隻兄弟要一起進門才算過關喔！', UI_W / 2, 491);
    }

    // 陣風預警提示
    if (world.windWarning || world.windActive) {
      ctx.textAlign = 'center';
      ctx.fillStyle = world.windActive ? '#9ee8ff' : '#ffe875';
      ctx.font = `700 14px ${FONT}`;
      ctx.fillText(
        world.windActive ? '≪ 強陣風吹襲中（橘貓抗風／推箱擋風）≪' : '⚠ 陣風即將吹襲…',
        UI_W / 2,
        104,
      );
    }
  }

  private drawDialogueBox(
    ctx: CanvasRenderingContext2D,
    speaker: string,
    text: string,
    canContinue: boolean,
  ): void {
    const borderColor =
      speaker === '阿福' ? '#ff5c77' : speaker === '疤面老大' ? '#c752ff' : '#ffd27d';
    this.drawPanel(ctx, 90, 372, 780, 134, 'rgba(16, 13, 28, 0.96)', borderColor);

    ctx.textAlign = 'left';
    ctx.fillStyle = borderColor;
    ctx.font = `700 20px ${FONT}`;
    ctx.fillText(`【${speaker}】`, 116, 408);

    ctx.fillStyle = '#fff5e4';
    ctx.font = `500 18px ${FONT}`;
    // 動態依寬度折行（最多 3 行，防長文溢出）
    const maxWidth = 720;
    const lines: string[] = [];
    let current = '';
    for (const ch of text) {
      if (ctx.measureText(current + ch).width > maxWidth && current.length > 0) {
        lines.push(current);
        current = ch;
      } else {
        current += ch;
      }
    }
    if (current) lines.push(current);
    lines.slice(0, 3).forEach((line, idx) => {
      ctx.fillText(line, 116, 438 + idx * 24);
    });

    if (canContinue) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffe278';
      ctx.font = `600 14px ${FONT}`;
      ctx.fillText('按 Enter / Space 或點擊繼續 ▶', 846, 494);
      this.clickableRegions.push({ id: 'dialogue_continue', x: 90, y: 372, w: 780, h: 134 });
    }
  }

  private drawPauseMenu(ctx: CanvasRenderingContext2D, selected: PauseOption): void {
    ctx.fillStyle = 'rgba(10, 8, 20, 0.68)';
    ctx.fillRect(0, 0, UI_W, UI_H);
    this.drawPanel(ctx, 310, 120, 340, 300, 'rgba(22, 18, 38, 0.96)', '#ffd27d');

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd27d';
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText('遊戲暫停', UI_W / 2, 168);

    const opts: { id: PauseOption; label: string }[] = [
      { id: 'resume', label: '繼續冒險' },
      { id: 'retryCheckpoint', label: '重試檢查點（解推箱軟鎖）' },
      { id: 'restartLevel', label: '重開本關（完整重置）' },
      { id: 'levelSelect', label: '返回 9 關選單' },
    ];
    opts.forEach((o, i) => {
      this.drawButton(ctx, `pause_${o.id}`, 350, 194 + i * 52, 260, 40, o.label, selected === o.id);
    });
  }

  private drawCenterBanner(ctx: CanvasRenderingContext2D, title: string, sub: string): void {
    ctx.fillStyle = 'rgba(10, 8, 20, 0.65)';
    ctx.fillRect(0, 0, UI_W, UI_H);
    this.drawPanel(ctx, 210, 190, 540, 150, 'rgba(24, 18, 40, 0.96)', '#ff7b8a');
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff99a8';
    ctx.font = `700 30px ${FONT}`;
    ctx.fillText(title, UI_W / 2, 248);
    ctx.fillStyle = '#f4ebd9';
    ctx.font = `500 17px ${FONT}`;
    ctx.fillText(sub, UI_W / 2, 294);
  }

  private drawLevelClear(ctx: CanvasRenderingContext2D, world: WorldState, save: SaveDataV1): void {
    ctx.fillStyle = 'rgba(10, 8, 20, 0.72)';
    ctx.fillRect(0, 0, UI_W, UI_H);
    this.drawPanel(ctx, 200, 118, 560, 304, 'rgba(22, 18, 40, 0.96)', '#59e892');

    ctx.textAlign = 'center';
    ctx.fillStyle = '#73ffad';
    ctx.font = `700 32px ${FONT}`;
    ctx.fillText(`${world.level.id} ${world.level.name} 過關！`, UI_W / 2, 174);

    ctx.fillStyle = '#fff3db';
    ctx.font = `600 18px ${FONT}`;
    ctx.fillText(`本關得分：${world.score}   ·   剩餘命數：${world.lives} / 9`, UI_W / 2, 224);
    ctx.fillText(
      `本關毛線球：${world.yarnCollectedInLevel ? '★ 已入手！' : '尚未取得'}   ·   總毛線球：${save.collectedYarns.length} / 9`,
      UI_W / 2,
      262,
    );

    const nextText =
      world.scene.kind === 'LEVEL_CLEAR' && world.scene.nextLevelId
        ? `前往下一關 ${world.scene.nextLevelId}（Enter / Space）`
        : '推開溫暖家門・迎接結局！（Enter / Space）';
    this.drawButton(ctx, 'next_level', 290, 318, 380, 48, nextText, true);
  }

  private drawEnding(ctx: CanvasRenderingContext2D, endingType: 'normal' | 'true', save: SaveDataV1): void {
    ctx.fillStyle = 'rgba(14, 12, 26, 0.92)';
    ctx.fillRect(0, 0, UI_W, UI_H);
    const isTrue = endingType === 'true';
    this.drawPanel(
      ctx,
      120,
      74,
      720,
      392,
      'rgba(28, 20, 44, 0.97)',
      isTrue ? '#ffe266' : '#f29e5a',
    );

    ctx.textAlign = 'center';
    ctx.fillStyle = isTrue ? '#ffe866' : '#ffd27d';
    ctx.font = `700 36px ${FONT}`;
    ctx.fillText(
      isTrue ? '★ 真結局：九命圓滿・歸途傳奇 ★' : '平安回家・溫暖的夜',
      UI_W / 2,
      146,
    );

    ctx.fillStyle = '#fff5e4';
    ctx.font = `500 18px ${FONT}`;
    if (isTrue) {
      ctx.fillText('橘貓與黑貓帶著全 9 顆毛線球與滿滿小魚乾回到溫暖的家！', UI_W / 2, 208);
      ctx.fillText('門廊外，戴著紅領巾的忠犬「阿福」也獲贈一碗熱騰騰的肉骨頭，', UI_W / 2, 242);
      ctx.fillText('兩貓一狗從此成了這條台灣老街最棒的守護夥伴。', UI_W / 2, 276);
    } else {
      ctx.fillText('歷經黃昏騎樓、霓虹夜市與深夜雨天屋頂，打敗疤面老大後，', UI_W / 2, 214);
      ctx.fillText('橘貓與黑貓終於跳進溫暖的家門，窩在沙發上幸福打呼。', UI_W / 2, 250);
      ctx.fillStyle = '#a8c6ff';
      ctx.font = `500 15px ${FONT}`;
      ctx.fillText(
        `（提示：集滿全 9 顆毛線球 [${save.collectedYarns.length}/9] 並與阿福結緣 [${save.heroBonded ? '已達成' : '未達成'}] 可解鎖真結局！）`,
        UI_W / 2,
        294,
      );
    }

    this.drawButton(ctx, 'back_to_title', UI_W / 2 - 140, 356, 280, 48, '返回標題畫面（Enter）', true);
  }

  private drawButton(
    ctx: CanvasRenderingContext2D,
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    highlighted: boolean,
  ): void {
    this.drawPanel(
      ctx,
      x,
      y,
      w,
      h,
      highlighted ? '#4a3a75' : '#26203d',
      highlighted ? '#ffe278' : '#6a5d94',
    );
    ctx.textAlign = 'center';
    ctx.fillStyle = highlighted ? '#fff6db' : '#d2c7e8';
    ctx.font = `700 15px ${FONT}`;
    ctx.fillText(label, x + w / 2, y + h / 2 + 6);
    this.clickableRegions.push({ id, x, y, w, h });
  }
}
