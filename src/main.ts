import { ParticlePool } from './art/particles';
import { WorldRenderer } from './art/renderer';
import { SpriteBakery } from './art/spriteBakery';
import { ChipAudioEngine } from './audio/chipAudio';
import { KeyboardInputController } from './core/input';
import {
  isTrueEndingUnlocked,
  loadSave,
  persistSave,
  recordLevelClear,
} from './core/storage';
import {
  FIXED_DT,
  PauseOption,
  SaveDataV1,
  WorldState,
  sec,
} from './core/types';
import { createWorld, respawnAtCheckpoint, stepWorld } from './entities/world';
import { ALL_LEVELS, getLevelById, getLevelByIndex } from './levels';
import { UI_H, UI_W, UiOverlayRenderer } from './ui/overlay';

const PAUSE_OPTIONS: readonly PauseOption[] = [
  'resume',
  'retryCheckpoint',
  'restartLevel',
  'levelSelect',
];

function bootstrap(): void {
  const gameCanvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  const uiCanvas = document.getElementById('ui-canvas') as HTMLCanvasElement | null;
  if (!gameCanvas || !uiCanvas) return;

  const gameCtx = gameCanvas.getContext('2d')!;
  const uiCtx = uiCanvas.getContext('2d')!;

  const bakery = new SpriteBakery();
  const particles = new ParticlePool();
  const worldRenderer = new WorldRenderer(bakery, particles);
  const uiRenderer = new UiOverlayRenderer();
  const audio = new ChipAudioEngine();
  const inputCtrl = new KeyboardInputController(window);

  let save: SaveDataV1 = loadSave();
  audio.setMuted(save.muted);

  let topMode: 'TITLE' | 'LEVEL_SELECT' | 'WORLD' = 'TITLE';
  let selectedLevelIndex = Math.min(save.unlockedLevelIndex, ALL_LEVELS.length - 1);
  let pauseIdx = 0;
  let endingType: 'normal' | 'true' = 'normal';
  let world: WorldState | null = null;

  // 底部工具列互動
  const hintBar = document.getElementById('hint-bar');
  const btnHideHint = document.getElementById('btn-hide-hint');
  const btnShowHint = document.getElementById('toggle-hint-floating');
  const btnMute = document.getElementById('btn-mute');

  const syncMuteLabel = (): void => {
    if (btnMute) btnMute.textContent = audio.isMuted() ? '音效：關' : '音效：開';
  };
  syncMuteLabel();

  const toggleMute = (): void => {
    audio.unlock();
    const muted = audio.toggleMute();
    save = { ...save, muted };
    persistSave(save);
    syncMuteLabel();
  };

  btnMute?.addEventListener('click', (e) => {
    toggleMute();
    (e.currentTarget as HTMLButtonElement).blur();
  });
  btnHideHint?.addEventListener('click', (e) => {
    hintBar?.classList.add('hidden');
    btnShowHint?.classList.add('visible');
    (e.currentTarget as HTMLButtonElement).blur();
  });
  btnShowHint?.addEventListener('click', (e) => {
    hintBar?.classList.remove('hidden');
    btnShowHint?.classList.remove('visible');
    (e.currentTarget as HTMLButtonElement).blur();
  });

  const startLevelByIndex = (idx: number): void => {
    const level = getLevelByIndex(idx);
    world = createWorld(level, save);
    topMode = 'WORLD';
    pauseIdx = 0;
    audio.unlock();
    audio.playBgm(`ch${level.chapter}`);
  };

  const handlePauseConfirm = (opt: PauseOption): void => {
    if (!world) return;
    if (opt === 'resume') {
      world.scene = { kind: 'PLAYING' };
    } else if (opt === 'retryCheckpoint') {
      const evts: ReturnType<typeof stepWorld> = [];
      respawnAtCheckpoint(world, evts);
      consumeEvents(evts);
    } else if (opt === 'restartLevel') {
      startLevelByIndex(world.level.index);
    } else if (opt === 'levelSelect') {
      topMode = 'LEVEL_SELECT';
      selectedLevelIndex = world.level.index;
      audio.playBgm('title');
    }
  };

  const handleLevelClearProceed = (): void => {
    if (!world || world.scene.kind !== 'LEVEL_CLEAR') return;
    if (world.scene.nextLevelId) {
      const next = getLevelById(world.scene.nextLevelId);
      startLevelByIndex(next.index);
    } else {
      endingType = isTrueEndingUnlocked(save) ? 'true' : 'normal';
      world.scene = { kind: 'ENDING', endingType };
      audio.playBgm('ending');
    }
  };

  const consumeEvents = (events: ReturnType<typeof stepWorld>): void => {
    for (const ev of events) {
      if (ev.type === 'sfx') {
        audio.playSfx(ev.id);
      } else if (ev.type === 'bgm') {
        audio.playBgm(ev.track);
      } else if (ev.type === 'particle') {
        particles.emit(ev.kind, ev.x, ev.y);
      } else if (ev.type === 'screen_shake') {
        worldRenderer.triggerShake(ev.intensity, ev.duration);
      } else if (ev.type === 'save_dirty' && world) {
        if (world.scene.kind === 'LEVEL_CLEAR') {
          save = recordLevelClear(
            save,
            world.level.id,
            world.level.index,
            world.score,
            world.yarnCollectedInLevel,
            world.heroBonded,
          );
        } else if (world.heroBonded && !save.heroBonded) {
          save = { ...save, heroBonded: true };
        }
        persistSave(save);
      }
    }
  };

  // UI 畫布滑鼠點擊處理
  uiCanvas.addEventListener('pointerdown', (e) => {
    audio.unlock();
    const rect = uiCanvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * UI_W;
    const y = ((e.clientY - rect.top) / rect.height) * UI_H;

    for (const r of uiRenderer.clickableRegions) {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        if (r.id === 'start_game') {
          topMode = 'LEVEL_SELECT';
          audio.playBgm('title');
        } else if (r.id === 'toggle_unlock_all') {
          save = { ...save, allUnlockedPreview: !save.allUnlockedPreview };
          persistSave(save);
          audio.playSfx('switch');
        } else if (r.id.startsWith('level_')) {
          const idx = Number(r.id.slice(6));
          if (Number.isInteger(idx) && idx >= 0 && idx < ALL_LEVELS.length) {
            selectedLevelIndex = idx;
            startLevelByIndex(idx);
          }
        } else if (r.id === 'dialogue_continue' && world && world.scene.kind === 'DIALOGUE') {
          if (world.scene.minLockTimer <= 0) {
            world.scene = { kind: 'PLAYING' };
            inputCtrl.clearJumpBuffer();
          }
        } else if (r.id.startsWith('pause_')) {
          handlePauseConfirm(r.id.slice(6) as PauseOption);
        } else if (r.id === 'next_level') {
          handleLevelClearProceed();
        } else if (r.id === 'back_to_title') {
          topMode = 'TITLE';
          world = null;
          audio.playBgm('title');
        }
        return;
      }
    }
  });

  // 首次鍵盤互動解鎖音訊
  window.addEventListener('keydown', () => audio.unlock(), { once: true });

  // 背景展示用世界（標題畫面背景）
  const demoWorld = createWorld(getLevelByIndex(0), save);

  let lastTs = performance.now();
  let accumulator = 0;

  const loop = (now: number): void => {
    const rawDt = Math.max(0, Math.min(0.05, (now - lastTs) / 1000));
    lastTs = now;
    accumulator += rawDt;

    while (accumulator >= FIXED_DT) {
      const dt = sec(FIXED_DT);
      const input = inputCtrl.sample(dt);
      accumulator -= FIXED_DT;

      if (input.justPressed.mute) {
        toggleMute();
      }

      if (topMode === 'TITLE') {
        demoWorld.elapsed = sec(demoWorld.elapsed + dt);
        if (input.justPressed.confirm) {
          audio.unlock();
          topMode = 'LEVEL_SELECT';
          audio.playBgm('title');
          audio.playSfx('switch');
        }
      } else if (topMode === 'LEVEL_SELECT') {
        if (input.justPressed.right) {
          selectedLevelIndex = (selectedLevelIndex + 1) % ALL_LEVELS.length;
          audio.playSfx('switch');
        } else if (input.justPressed.left) {
          selectedLevelIndex = (selectedLevelIndex + ALL_LEVELS.length - 1) % ALL_LEVELS.length;
          audio.playSfx('switch');
        } else if (input.justPressed.down) {
          selectedLevelIndex = (selectedLevelIndex + 3) % ALL_LEVELS.length;
          audio.playSfx('switch');
        } else if (input.justPressed.up) {
          selectedLevelIndex = (selectedLevelIndex + ALL_LEVELS.length - 3) % ALL_LEVELS.length;
          audio.playSfx('switch');
        } else if (input.justPressed.confirm) {
          const unlocked =
            save.allUnlockedPreview || selectedLevelIndex <= save.unlockedLevelIndex;
          if (unlocked) {
            startLevelByIndex(selectedLevelIndex);
          }
        } else if (input.justPressed.pause) {
          topMode = 'TITLE';
        }
      } else if (topMode === 'WORLD' && world) {
        if (world.scene.kind === 'PLAYING' && input.justPressed.pause) {
          pauseIdx = 0;
          world.scene = { kind: 'PAUSED', selectedOption: 'resume' };
        } else if (world.scene.kind === 'PAUSED') {
          if (input.justPressed.pause) {
            world.scene = { kind: 'PLAYING' };
          } else if (input.justPressed.down || input.justPressed.right) {
            pauseIdx = (pauseIdx + 1) % PAUSE_OPTIONS.length;
            world.scene = { kind: 'PAUSED', selectedOption: PAUSE_OPTIONS[pauseIdx]! };
            audio.playSfx('switch');
          } else if (input.justPressed.up || input.justPressed.left) {
            pauseIdx = (pauseIdx + PAUSE_OPTIONS.length - 1) % PAUSE_OPTIONS.length;
            world.scene = { kind: 'PAUSED', selectedOption: PAUSE_OPTIONS[pauseIdx]! };
            audio.playSfx('switch');
          } else if (input.justPressed.confirm) {
            handlePauseConfirm(PAUSE_OPTIONS[pauseIdx]!);
          }
        } else if (world.scene.kind === 'LEVEL_CLEAR') {
          if (input.justPressed.confirm) {
            handleLevelClearProceed();
          }
        } else if (world.scene.kind === 'ENDING') {
          if (input.justPressed.confirm) {
            topMode = 'TITLE';
            world = null;
            audio.playBgm('title');
          }
        } else {
          const prevSceneKind: string = world.scene.kind;
          const events = stepWorld(world, input, dt);
          const nextSceneKind: string = world.scene.kind;
          if (prevSceneKind === 'DIALOGUE' && nextSceneKind === 'PLAYING') {
            inputCtrl.clearJumpBuffer();
          }
          consumeEvents(events);
          if (world.scene.kind === 'PLAYING' || world.scene.kind === 'RESPAWN') {
            worldRenderer.updateEffects(dt);
          }
        }
      }
    }

    // 繪製底層 320x180 像素世界
    worldRenderer.render(gameCtx, topMode === 'WORLD' && world ? world : demoWorld);

    // 繪製上層 960x540 高解析中文 UI 覆蓋層
    const sceneKind =
      topMode === 'TITLE'
        ? 'TITLE'
        : topMode === 'LEVEL_SELECT'
          ? 'LEVEL_SELECT'
          : world?.scene.kind ?? 'TITLE';
    uiRenderer.render(
      uiCtx,
      topMode === 'WORLD' ? world : null,
      sceneKind,
      save,
      selectedLevelIndex,
      PAUSE_OPTIONS[pauseIdx]!,
      endingType,
    );

    window.requestAnimationFrame(loop);
  };

  window.requestAnimationFrame(loop);
}

bootstrap();
