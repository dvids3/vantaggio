import type { Input } from '../sim/types.ts';
import { NO_INPUT } from '../sim/types.ts';

type Pad = 'p1' | 'p2';

const KEYMAP: Record<string, { pad: Pad; control: keyof Input }> = {
  KeyA: { pad: 'p1', control: 'left' },
  KeyD: { pad: 'p1', control: 'right' },
  KeyW: { pad: 'p1', control: 'up' },
  KeyS: { pad: 'p1', control: 'down' },
  Space: { pad: 'p1', control: 'kick' },
  KeyX: { pad: 'p1', control: 'kick' },
  ShiftLeft: { pad: 'p1', control: 'dash' },
  ShiftRight: { pad: 'p1', control: 'dash' },
  KeyC: { pad: 'p1', control: 'dash' },

  ArrowLeft: { pad: 'p2', control: 'left' },
  ArrowRight: { pad: 'p2', control: 'right' },
  ArrowUp: { pad: 'p2', control: 'up' },
  ArrowDown: { pad: 'p2', control: 'down' },
  Enter: { pad: 'p2', control: 'kick' },
  Numpad0: { pad: 'p2', control: 'kick' },
  Slash: { pad: 'p2', control: 'dash' },
  NumpadDecimal: { pad: 'p2', control: 'dash' },
};

export class InputController {
  readonly state: [Input, Input] = [{ ...NO_INPUT }, { ...NO_INPUT }];
  /** El lado 1 lo controla un bot (partido contra la máquina). */
  versusBot = true;
  onActivity: (() => void) | null = null;

  private touchPointers = new Map<number, keyof Input>();
  private pressed = new Set<string>();

  constructor(target: HTMLElement) {
    window.addEventListener('keydown', (e) => this.onKey(e, true), { passive: false });
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.reset());
    this.bindTouch(target);
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    const map = KEYMAP[e.code];
    if (!map) return;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (down && e.repeat) return;

    this.onActivity?.();
    if (down) this.pressed.add(e.code);
    else this.pressed.delete(e.code);
    this.recompute(map.pad);
  }

  /** Recalcula el estado del pad según teclas y dedos mantenidos. */
  private recompute(pad: 'p1' | 'p2'): void {
    const target = this.state[pad === 'p1' ? 0 : 1];
    for (const c of ['left', 'right', 'up', 'down', 'kick', 'dash'] as const) target[c] = false;

    for (const code of this.pressed) {
      const m = KEYMAP[code];
      if (m && m.pad === pad) target[m.control] = true;
    }
    if (pad === 'p1') {
      for (const c of this.touchPointers.values()) target[c] = true;
    }
  }

  reset(): void {
    for (const s of this.state) {
      s.left = false;
      s.right = false;
      s.up = false;
      s.down = false;
      s.kick = false;
      s.dash = false;
    }
    this.pressed.clear();
    this.touchPointers.clear();
  }

  bindTouch(root: HTMLElement): void {
    root.querySelectorAll<HTMLElement>('[data-control]').forEach((el) => {
      const control = el.dataset.control as keyof Input | undefined;
      if (!control) return;

      const set = (down: boolean, ev: PointerEvent): void => {
        if (down) {
          this.touchPointers.set(ev.pointerId, control);
          this.onActivity?.();
          el.classList.add('active');
        } else {
          this.touchPointers.delete(ev.pointerId);
          el.classList.remove('active');
        }
        // Recalcula desde cero: varios dedos pueden tocar el mismo botón.
        this.recompute('p1');
      };

      el.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        el.setPointerCapture(ev.pointerId);
        set(true, ev);
      });
      el.addEventListener('pointerup', (ev) => {
        ev.preventDefault();
        set(false, ev);
      });
      el.addEventListener('pointercancel', (ev) => set(false, ev));
      el.addEventListener('lostpointercapture', (ev) => set(false, ev));
      el.addEventListener('contextmenu', (ev) => ev.preventDefault());
    });
  }

  /** Evita que el navegador haga scroll mientras se juega. */
  static lockScroll(target: HTMLElement): void {
    target.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    target.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  }
}
