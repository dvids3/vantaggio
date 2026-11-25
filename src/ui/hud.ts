/**
 * HUD del partido: marcador central, reloj, botones y capas de pausa/ayuda.
 * Se construye una vez por partido y se actualiza por evento.
 */

import type { Team } from '../data/teams.ts';
import { crestSvg, h, icon, readable, shade } from './kit.ts';

/** Nombre completo del equipo en el marcador; el código de tres letras queda de respaldo. */
function nameEl(team: Team, ink: string): HTMLElement {
  return h('span', { class: 'name', text: team.name, title: `${team.name} (${team.short})`, style: `color:${ink}` });
}

export interface HudOpts {
  home: Team;
  away: Team;
  /** Partido contra la máquina (si no, dos jugadores en la misma pantalla). */
  versusBot: boolean;
  /** Lado que controla el humano. */
  humanSide: number;
  onPause: () => void;
  onResume: () => void;
  onQuit: () => void;
  onSound: () => void;
  /** Cambio manual del futbolista del jugador (solo contra la máquina). */
  onSub: () => void;
  soundOn: boolean;
}

/** Un futbolista en la lista de cambios. */
export interface SubChoice {
  name: string;
  num: number;
  pos: string;
  /** El que está en la cancha ahora mismo. */
  onField: boolean;
  /** Ya salió antes: no puede volver a entrar. */
  used: boolean;
  spd: number;
  jmp: number;
  pow: number;
  pre: number;
}

export class MatchHud {
  readonly el: HTMLElement;
  private readonly scoreEls: [HTMLElement, HTMLElement];
  private readonly clockEl: HTMLElement;
  private readonly flash: HTMLElement;
  private readonly flashWord: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly windEl: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly finalEl: HTMLElement;
  private readonly soundBtn: HTMLButtonElement;
  private readonly subBtn: HTMLButtonElement;
  private toastTimer = 0;
  private paused = false;
  private overlayOpen = false;
  /** Si la capa abierta es la de cambios, se cierra reanudando el partido. */
  private subsCancel: (() => void) | null = null;

  constructor(private readonly opts: HudOpts) {
    const { home, away } = opts;

    this.scoreEls = [h('b', { text: '0' }), h('b', { text: '0' })];
    this.clockEl = h('div', { class: 'clock', text: '00:00' });

    const homeSide = h('div', { class: 'sb-side home' });
    homeSide.style.background = `linear-gradient(180deg, ${shade(home.jersey, 0.1)}, ${shade(home.jersey, -0.38)})`;
    const homeInk = readable(home.jersey);
    const homeBadge = h('span', { class: 'badge' });
    homeBadge.append(crestSvg(home, 30));
    homeSide.append(homeBadge, nameEl(home, homeInk));
    const homeTag = opts.versusBot ? (opts.humanSide === 0 ? 'TÚ' : '') : 'P1';
    if (homeTag) homeSide.append(h('span', { class: 'you-tag', text: homeTag }));

    const awaySide = h('div', { class: 'sb-side away' });
    awaySide.style.background = `linear-gradient(180deg, ${shade(away.jersey, 0.1)}, ${shade(away.jersey, -0.38)})`;
    const awayInk = readable(away.jersey);
    const awayBadge = h('span', { class: 'badge' });
    awayBadge.append(crestSvg(away, 30));
    awaySide.append(nameEl(away, awayInk), awayBadge);
    const awayTag = opts.versusBot ? (opts.humanSide === 1 ? 'TÚ' : '') : 'P2';
    if (awayTag) awaySide.append(h('span', { class: 'you-tag', text: awayTag }));

    const scoreRow = h('div', { class: 'score-row' });
    scoreRow.append(homeSide, h('div', { class: 'sb-score' }, this.scoreEls[0], h('span', { class: 'dot', text: ':' }), this.scoreEls[1]), awaySide);

    const board = h('div', { class: 'scoreboard' }, scoreRow, this.clockEl);

    this.soundBtn = h('button', { class: 'round-btn', type: 'button', 'aria-label': 'Sonido' });
    this.soundBtn.append(icon(opts.soundOn ? 'sound' : 'soundOff'));
    this.soundBtn.addEventListener('click', () => {
      opts.onSound();
      this.setSound(!this.soundBtn.classList.contains('off'));
    });

    const helpBtn = h('button', { class: 'round-btn', type: 'button', 'aria-label': 'Ayuda' });
    helpBtn.append(icon('help'));
    helpBtn.addEventListener('click', () => this.toggleHelp());

    const pauseBtn = h('button', { class: 'round-btn', type: 'button', 'aria-label': 'Pausa' });
    pauseBtn.append(icon('pause'));
    pauseBtn.addEventListener('click', () => this.togglePause());

    // Cambio manual: el jugador decide cuándo entra otro futbolista. El rival
    // cambia solo con cada gol; tú no.
    this.subBtn = h('button', { class: 'round-btn subs', type: 'button', 'aria-label': 'Cambio de jugador' });
    this.subBtn.append(icon('swap'), h('span', { class: 'subs-lbl', text: 'CAMBIO 5' }));
    this.subBtn.addEventListener('click', () => opts.onSub());

    const tools = opts.versusBot
      ? h('div', { class: 'hud-tools' }, this.subBtn, this.soundBtn, helpBtn, pauseBtn)
      : h('div', { class: 'hud-tools' }, this.soundBtn, helpBtn, pauseBtn);

    const brand = h('div', { class: 'hud-brand' });
    const cup = h('div', { class: 'cup' });
    cup.append(icon('trophy'));
    brand.append(cup, h('div', { class: 'wordmark', html: 'VANTAGGIO<small>MUNDIAL 2026</small>' }));

    this.flashWord = h('span', { class: 'word', text: '¡GOL!' });
    this.flash = h('div', { class: 'goal-flash' }, this.flashWord);
    this.overlay = h('div', { class: 'hud-overlay', hidden: true });

    // Viento: flecha y fuerza. Sin esto el viento era invisible y parecía que
    // el balón se desviaba solo.
    this.windEl = h('div', { class: 'hud-wind', hidden: true });
    this.toastEl = h('div', { class: 'hud-toast', hidden: true });
    this.finalEl = h('div', { class: 'hud-final', hidden: true }, h('span', { class: 'word', text: 'FINAL' }));

    this.el = h(
      'div',
      { class: 'hud' },
      h('div', { class: 'hud-bar' }, brand, tools),
      board,
      this.windEl,
      this.toastEl,
      this.flash,
      this.finalEl,
      this.overlay,
    );
  }

  setScore(hg: number, ag: number): void {
    this.scoreEls[0].textContent = String(hg);
    this.scoreEls[1].textContent = String(ag);
  }

  setClock(seconds: number, hurry = false): void {
    const s = Math.max(0, Math.floor(seconds));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    this.clockEl.textContent = `${mm}:${ss}`;
    this.clockEl.classList.toggle('hurry', hurry);
  }

  /** Indicador de viento: dirección y fuerza en m/s. */
  setWind(wind: number): void {
    const on = Math.abs(wind) > 0.25;
    if (this.windEl.hidden === !on && !on) return;
    this.windEl.hidden = !on;
    if (!on) return;
    const strength = Math.abs(wind);
    this.windEl.textContent = `VIENTO ${wind > 0 ? '→' : '←'} ${strength.toFixed(1)} m/s`;
    this.windEl.classList.toggle('strong', strength > 3.6);
  }

  /** Aviso corto sobre la cancha (p. ej. el rival que entra). */
  toast(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.hidden = false;
    this.toastEl.classList.remove('show');
    void this.toastEl.offsetWidth;
    this.toastEl.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.hidden = true;
      this.toastEl.classList.remove('show');
    }, 2200);
  }

  /** Cartel de final: tapa la transición brusca a la ficha del resultado. */
  showFinal(): void {
    this.finalEl.hidden = false;
    this.finalEl.classList.add('show');
  }

  /** Cambios restantes. A 0 el botón queda apagado. */
  setSubs(left: number): void {
    const lbl = this.subBtn.querySelector('.subs-lbl');
    if (lbl) lbl.textContent = `CAMBIO ${Math.max(0, left)}`;
    this.subBtn.classList.toggle('off', left <= 0);
    this.subBtn.disabled = left <= 0;
  }

  setSound(on: boolean): void {
    this.soundBtn.classList.toggle('off', !on);
    this.soundBtn.replaceChildren(icon(on ? 'sound' : 'soundOff'));
  }

  flashGoal(team: Team): void {
    this.flashWord.textContent = `¡GOL DE ${team.name.toUpperCase()}!`;
    this.flashWord.style.fontSize = '';
    this.flash.classList.remove('show');
    void this.flash.offsetWidth;
    this.flash.classList.add('show');
  }

  get isPaused(): boolean {
    return this.paused;
  }

  togglePause(): void {
    if (this.overlayOpen) {
      // Si lo que está abierto son los cambios, cerrar equivale a cancelar y
      // el partido tiene que volver a correr.
      if (this.subsCancel) this.subsCancel();
      else this.closeOverlay();
      return;
    }
    this.paused = true;
    this.opts.onPause();
    this.openOverlay(
      'PAUSA',
      [
        { label: 'Reanudar', primary: true, onClick: () => this.resume() },
        { label: 'Salir del partido', onClick: () => this.quit() },
      ],
      `<p class="overlay-note">${this.opts.versusBot ? 'Si sales, el partido se cuenta como derrota por 0-3.' : 'Vuelves al menú sin resultado.'}</p>`,
    );
  }

  private resume(): void {
    this.paused = false;
    this.closeOverlay();
    this.opts.onResume();
  }

  private quit(): void {
    this.paused = false;
    this.closeOverlay();
    this.opts.onQuit();
  }

  private toggleHelp(): void {
    if (this.overlayOpen) {
      this.closeOverlay();
      this.paused = false;
      this.opts.onResume();
      return;
    }
    const wasPaused = this.paused;
    this.paused = true;
    this.opts.onPause();
    const help = this.opts.versusBot
      ? `<div class="help-grid">
        <div class="help-row"><span class="k">A / D · ← / →</span><span>Moverse y apuntar</span></div>
        <div class="help-row"><span class="k">W · ↑</span><span>Saltar</span></div>
        <div class="help-row"><span class="k">S · ↓</span><span>Bajar el remate</span></div>
        <div class="help-row"><span class="k">ESPACIO · ENTER</span><span>Patear (mantener = cargar)</span></div>
        <div class="help-row"><span class="k">SHIFT · C · /</span><span>Arranque rápido</span></div>
        <div class="help-row"><span class="k">ESC</span><span>Pausa</span></div>
        <div class="help-note">Puedes jugar con WASD o con las flechas: las dos funcionan. Cabecear es automático: salta y deja que el balón te golpee la cabeza.</div>
      </div>`
      : `<div class="help-grid">
        <div class="help-row"><span class="k">JUGADOR 1</span><span>A / D · W · S · ESPACIO · SHIFT</span></div>
        <div class="help-row"><span class="k">JUGADOR 2</span><span>← / → · ↑ · ↓ · ENTER · /</span></div>
        <div class="help-row"><span class="k">ESC</span><span>Pausa</span></div>
        <div class="help-note">Cabecear es automático: salta y deja que el balón te golpee la cabeza.</div>
      </div>`;
    this.openOverlay('CONTROLES', [{ label: 'Seguir jugando', primary: true, onClick: () => this.resume() }], help);
    this.paused = wasPaused ? true : true;
  }

  private openOverlay(title: string, actions: { label: string; primary?: boolean; onClick: () => void }[], body = ''): void {
    this.overlayOpen = true;
    this.overlay.replaceChildren();
    const card = h('div', { class: 'overlay-card' });
    card.append(h('div', { class: 'ribbon small', text: title }));
    // El cuerpo va DENTRO de la tarjeta: antes se insertaba como hermano y la
    // nota quedaba encima del listón, pisada por las puntas del mismo.
    if (body) card.insertAdjacentHTML('beforeend', body);
    else card.append(h('p', { class: 'overlay-text', text: 'El partido está detenido.' }));
    const row = h('div', { class: 'overlay-actions' });
    for (const a of actions) {
      const btn = h('button', { class: `pill${a.primary ? ' primary' : ''}`, type: 'button', text: a.label });
      btn.addEventListener('click', a.onClick);
      row.append(btn);
    }
    card.append(row);
    this.overlay.append(card);
    this.overlay.hidden = false;
  }

  /**
   * Cambio elegido a mano: lista el plantel con sus atributos para que el
   * jugador decida quién entra, en vez de rotar al siguiente a ciegas.
   */
  openSubs(left: number, choices: SubChoice[], onPick: (index: number) => void): void {
    if (this.overlayOpen) return;
    const wasPaused = this.paused;
    this.paused = true;
    this.opts.onPause();

    const finish = (resume: boolean): void => {
      this.subsCancel = null;
      this.closeOverlay();
      if (resume) {
        this.paused = wasPaused;
        this.opts.onResume();
      }
    };
    this.subsCancel = () => finish(true);

    const list = h('div', { class: 'subs-list' });
    choices.forEach((p, i) => {
      const row = h('button', {
        class: `sub-row${p.onField ? ' on-field' : ''}${p.used ? ' used' : ''}`,
        type: 'button',
      });
      row.append(h('span', { class: 'sub-num', text: String(p.num) }));
      const main = h('span', { class: 'sub-main' });
      main.append(h('span', { class: 'sub-name', text: p.name }), h('span', { class: 'sub-pos', text: p.pos }));
      const stats = h('span', { class: 'sub-stats' });
      for (const [key, val] of [
        ['VEL', p.spd],
        ['SAL', p.jmp],
        ['POT', p.pow],
        ['PRE', p.pre],
      ] as [string, number][]) {
        const track = h('span', { class: 'track' });
        const bar = h('i');
        bar.style.width = `${Math.max(18, Math.min(100, val))}%`;
        track.append(bar);
        const chip = h('span', { class: 'sub-stat' });
        chip.append(h('span', { class: 'k', text: key }), track);
        stats.append(chip);
      }
      row.append(main, stats);
      if (p.onField) row.append(h('span', { class: 'sub-tag', text: 'EN CANCHA' }));
      else if (p.used) row.append(h('span', { class: 'sub-tag', text: 'SALIÓ' }));
      else row.addEventListener('click', () => { finish(true); onPick(i); });
      if (p.onField || p.used) row.disabled = true;
      list.append(row);
    });

    this.overlayOpen = true;
    this.overlay.replaceChildren();
    const card = h('div', { class: 'overlay-card subs-card' });
    card.append(h('div', { class: 'ribbon small', text: 'CAMBIO DE JUGADOR' }));
    card.append(
      h('p', {
        class: 'overlay-note',
        text: `${left} ${left === 1 ? 'cambio disponible' : 'cambios disponibles'} · el partido está detenido`,
      }),
    );
    card.append(list);
    const actions = h('div', { class: 'overlay-actions' });
    const cancel = h('button', { class: 'pill', type: 'button', text: 'Cancelar' });
    cancel.addEventListener('click', () => this.subsCancel?.());
    actions.append(cancel);
    card.append(actions);
    this.overlay.append(card);
    this.overlay.hidden = false;
  }

  private closeOverlay(): void {
    this.overlayOpen = false;
    this.subsCancel = null;
    this.overlay.hidden = true;
    this.overlay.replaceChildren();
  }

  destroy(): void {
    this.el.remove();
  }
}
