import { InputAction, InputSnapshot, Seconds, sec } from './types';

export const JUMP_BUFFER_DURATION = sec(0.1);

const ALL_ACTIONS: readonly InputAction[] = [
  'left',
  'right',
  'jump',
  'skill',
  'switchCat',
  'toggleStay',
  'pause',
  'mute',
  'confirm',
];

const KEY_TO_ACTIONS: Record<string, readonly InputAction[]> = {
  ArrowLeft: ['left'],
  KeyA: ['left'],
  ArrowRight: ['right'],
  KeyD: ['right'],
  Space: ['jump', 'confirm'],
  ArrowUp: ['jump'],
  KeyW: ['jump'],
  KeyZ: ['jump'],
  KeyJ: ['skill'],
  KeyX: ['skill'],
  ShiftLeft: ['skill'],
  ShiftRight: ['skill'],
  KeyQ: ['switchCat'],
  Tab: ['switchCat'],
  KeyC: ['switchCat'],
  KeyE: ['toggleStay'],
  KeyK: ['toggleStay'],
  KeyP: ['pause'],
  Escape: ['pause'],
  KeyM: ['mute'],
  Enter: ['confirm'],
};

export function createEmptyInput(): InputSnapshot {
  const held = {} as Record<InputAction, boolean>;
  const justPressed = {} as Record<InputAction, boolean>;
  for (const action of ALL_ACTIONS) {
    held[action] = false;
    justPressed[action] = false;
  }
  return {
    held,
    justPressed,
    jumpBufferTimer: sec(0),
  };
}

export class KeyboardInputController {
  private readonly pressedCodes = new Set<string>();
  private readonly pendingJustPressed = new Set<InputAction>();
  private jumpBufferTimer: number = 0;

  constructor(private readonly target: Window = window) {
    this.target.addEventListener('keydown', this.onKeyDown, { passive: false });
    this.target.addEventListener('keyup', this.onKeyUp);
    this.target.addEventListener('blur', this.onBlur);
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    const actions = KEY_TO_ACTIONS[e.code];
    if (!actions) return;
    if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow')) {
      e.preventDefault();
    }
    const isFresh = !this.pressedCodes.has(e.code);
    this.pressedCodes.add(e.code);
    if (isFresh) {
      for (const a of actions) {
        this.pendingJustPressed.add(a);
        if (a === 'jump') {
          this.jumpBufferTimer = JUMP_BUFFER_DURATION;
        }
      }
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.pressedCodes.delete(e.code);
  };

  private readonly onBlur = (): void => {
    this.pressedCodes.clear();
    this.pendingJustPressed.clear();
    this.jumpBufferTimer = 0;
  };

  public clearJumpBuffer(): void {
    this.jumpBufferTimer = 0;
  }

  public sample(dt: Seconds): InputSnapshot {
    const snap = createEmptyInput();
    for (const code of this.pressedCodes) {
      const actions = KEY_TO_ACTIONS[code];
      if (!actions) continue;
      for (const a of actions) {
        snap.held[a] = true;
      }
    }
    for (const a of this.pendingJustPressed) {
      snap.justPressed[a] = true;
    }
    this.pendingJustPressed.clear();

    snap.jumpBufferTimer = sec(this.jumpBufferTimer);
    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }
    return snap;
  }

  public destroy(): void {
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('blur', this.onBlur);
  }
}
