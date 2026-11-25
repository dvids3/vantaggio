import { BALL, GOAL, PLAYER, WORLD } from '../sim/config.ts';
import type { Ball, Match, Particle, Player } from '../sim/types.ts';
import type {
  Beard,
  BrowKind,
  EyeKind,
  HairStyle,
  JawKind,
  KitPattern,
  MouthKind,
  NoseKind,
} from '../data/look.ts';
import { clamp } from '../core/math.ts';
import { publicUrl } from '../core/assets.ts';
import { THEME, UI } from './theme.ts';
import { cabezaDe, guayosDe } from './arte.ts';
import type { Pieza } from './arte.ts';
import { buildCrowd, crowdMovers, drawCrowdLive, drawGoalFront, drawShowLights, drawStadium, standTopFor, STANDS } from './stadium.ts';
import type { Head } from './stadium.ts';

/** Colores de la equipación de un lado. */
export interface Kit {
  jersey: string;
  shorts: string;
  socks: string;
  skin: string;
  hair: string;
  /** Color real del pelo cuando no coincide con el del equipo (rubio, canoso). */
  hairColor?: string;
  hairStyle?: HairStyle;
  beard?: Beard;
  jaw?: JawKind;
  nose?: NoseKind;
  eyes?: EyeKind;
  brows?: BrowKind;
  mouth?: MouthKind;
  eyeColor?: string;
  /** Tamaño de la cabeza (0,93 – 1,07). Distingue siluetas. */
  headScale?: number;
  /** Altura y separación del ojo dentro de la cara. */
  eyeY?: number;
  eyeX?: number;
  /** Estampado de la camiseta (rayas, cuadros, franja). */
  pattern?: KitPattern;
  /** Color secundario del estampado. */
  alt?: string;
  /** Ribete del cuello y de las franjas del botín. */
  trim?: string;
  /**
   * Equipo con arte dibujado a mano (cabeza, camiseta y guayos en SVG). Si el
   * arte no cargó, el jugador se dibuja con vectores igual que siempre.
   */
  artId?: string;
  /** Futbolista concreto: el arte puede ser solo suyo, no de toda la selección. */
  artPlayer?: string;
  /** Va vestido con la equipación alternativa. */
  altKit?: boolean;
}

export interface Look {
  kits: [Kit, Kit];
  /** Banderas (emoji) de los dos equipos, para la grada. */
  flags?: [string, string];
  ball: number;
  weather: boolean;
  wind: boolean;
  fans: boolean;
}

export const DEFAULT_LOOK: Look = {
  kits: [
    { jersey: '#f2c300', shorts: '#1b3a8c', socks: '#f2c300', skin: '#d3a173', hair: '#241a16' },
    { jersey: '#75aadb', shorts: '#0b1a33', socks: '#eef6ff', skin: '#e5bb90', hair: '#1b1410' },
  ],
  ball: 0,
  weather: false,
  wind: false,
  fans: false,
};

/**
 * Geometría del rostro por variante. Los números están en unidades de radio
 * de cabeza y perfil mirando a +x. Son los que hacen que dos cabezones no
 * parezcan el mismo muñeco con distinto peinado.
 */
const JAW_SHAPE: Record<JawKind, { jw: number; cl: number }> = {
  oval: { jw: 0.21, cl: 0.8 },
  square: { jw: 0.27, cl: 0.77 },
  round: { jw: 0.18, cl: 0.73 },
  long: { jw: 0.19, cl: 0.88 },
};

const NOSE_SHAPE: Record<NoseKind, { tx: number; ty: number; ux: number; uy: number; bridge: number }> = {
  straight: { tx: 0.85, ty: 0.07, ux: 0.64, uy: 0.22, bridge: 0.58 },
  button: { tx: 0.8, ty: 0.12, ux: 0.62, uy: 0.25, bridge: 0.57 },
  hook: { tx: 0.9, ty: 0.03, ux: 0.69, uy: 0.19, bridge: 0.59 },
  wide: { tx: 0.86, ty: 0.08, ux: 0.6, uy: 0.24, bridge: 0.56 },
  long: { tx: 0.93, ty: 0.1, ux: 0.7, uy: 0.25, bridge: 0.6 },
};

const EYE_SHAPE: Record<EyeKind, { rx: number; ry: number; rot: number }> = {
  calm: { rx: 0.16, ry: 0.105, rot: -0.14 },
  sharp: { rx: 0.17, ry: 0.085, rot: -0.24 },
  round: { rx: 0.145, ry: 0.13, rot: -0.1 },
  narrow: { rx: 0.17, ry: 0.075, rot: -0.16 },
};

const BROW_SHAPE: Record<BrowKind, { w: number; lift: number; tilt: number }> = {
  thick: { w: 0.11, lift: 0.02, tilt: 0.02 },
  thin: { w: 0.06, lift: 0.02, tilt: 0.03 },
  arched: { w: 0.085, lift: 0.1, tilt: -0.02 },
  straight: { w: 0.085, lift: 0.0, tilt: 0.06 },
};

const MOUTH_SHAPE: Record<MouthKind, { w: number; h: number }> = {
  wide: { w: 0.18, h: 0.11 },
  full: { w: 0.16, h: 0.14 },
  thin: { w: 0.14, h: 0.08 },
};

export interface View {
  scale: number;
  originX: number;
  groundY: number;
  w: number;
  h: number;
}

export interface DrawOpts {
  time: number;
  debug: boolean;
  fps: number;
  bot: boolean;
  sound: boolean;
  /** Cinta LED con los otros partidos de la ronda (solo eliminatorias). */
  ticker?: string[];
}

const PAD = 48;

/**
 * Escala del dibujo del futbolista. Se bajó un 10 % porque a tamaño de juego
 * los cabezones tapaban media cancha. Se toca SOLO el dibujo: la colisión
 * sigue siendo la del muñeco grande, que es más cómoda de jugar (el balón no
 * atraviesa una cabeza "fantasma").
 */
const PLAYER_ART = 0.9;

/**
 * Escala del cuerpo (camiseta y pantaloneta) respecto a la cabeza. Menos de 1
 * achica el muñeco de perfil y deja que el botín mande en la silueta, que es
 * lo que se reconoce a tamaño de juego. El mentón no se mueve: la escala se
 * aplica alrededor del cuello.
 */
const BODY_ART = 0.85;

interface BallPalette {
  style: 'trionda' | 'classic' | 'gold';
  base: string;
  edge: string;
  seam: string;
  accents?: string[];
  patch?: string;
}

const BALL_PALETTES: BallPalette[] = [
  {
    style: 'trionda',
    base: '#f9f6ec',
    edge: '#cfd6d0',
    seam: 'rgba(120, 132, 122, 0.45)',
    accents: ['#e23b2e', '#18a05b', '#2f5fd0'],
  },
  { style: 'classic', base: '#fcfbf5', edge: '#c9c6b9', seam: 'rgba(150, 148, 136, 0.55)', patch: '#1c1a16' },
];

/**
 * Balones reales que aportó el usuario. Se dibujan desde `public/balls` y, si
 * la imagen aún no cargó, se cae al balón vectorial de siempre.
 */
const BALL_IMG_SRC = ['balls/trionda.webp', 'balls/clasico.webp'].map((p) => publicUrl(p));
const ballImages: HTMLImageElement[] = [];
function ballImage(idx: number): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  const i = ((idx % 2) + 2) % 2;
  let img = ballImages[i];
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.src = BALL_IMG_SRC[i]!;
    ballImages[i] = img;
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

/**
 * Números del jugador dibujado a mano (cabeza, camiseta y botín de un SVG).
 *
 * Están juntos a propósito: son los que se afinan mirando una captura al lado
 * del dibujo original, y repartidos por el método no se encuentran. Todas las
 * medidas son en «radios de cabeza», la unidad que ya usa el muñeco de
 * vectores, así que mover una mueve el muñeco entero de forma coherente.
 *
 * Referencia para afinar: en el dibujo original el cuello de la camiseta abraza
 * la mandíbula y los hombros apenas sobresalen de la cabeza; una prenda más
 * ancha que la cabeza se lee como un cartel pegado a la espalda.
 */
const ARTE_TUNE = {
  /** Alto de la cabeza. Bajarla deja ver cuello y botín sin dejar de ser cabezón. */
  headH: 1.9,
  /** Cuánto baja la cabeza sobre la camiseta para tapar la franja del cuello. */
  headOverlap: 0.42,
  /** Ancho de la camiseta de borde a borde. En el dibujo original la prenda es
   *  más estrecha que la cabeza: los hombros asoman apenas detrás de la nuca. */
  kitW: 1.36,
  /** Estirón vertical: 1 = el aspecto del dibujo. */
  kitStretch: 1.05,
  /** Dónde cae el ribete respecto al mentón (0 = pegado al mentón). El ribete
   *  es la costura del cuello: es la que tapa el corte de la cabeza. */
  kitBand: 0.06,
  /** Corrimiento de la prenda a lo ancho, en radios (+ = hacia la cara). */
  kitX: 0.22,
  /** Multiplicador de la inclinación que declare el dibujo (1 = la del dibujo). */
  inclinacion: 0.4,
  /** Largo del botín: el de la lámina es enorme (casi el alto de la cabeza) y
   *  con la prenda encima tiene que asomar por delante del ruedo. */
  shoeW: 1.45,
  /** Adelanto del botín (radios). El talón queda debajo del pecho y la puntera
   *  asoma por delante del ruedo. */
  shoeX: 0.02,
};

// En desarrollo los números quedan a mano en la consola (`__arteTune.kitW = 1.2`)
// para afinar el muñeco mirando la cancha, sin recargar ni recompilar.
if (import.meta.env.DEV) {
  (globalThis as unknown as { __arteTune?: typeof ARTE_TUNE }).__arteTune = ARTE_TUNE;
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private bg: HTMLCanvasElement;
  private bgCtx: CanvasRenderingContext2D;
  private crowd: Head[] = [];
  /** Subconjunto del público que se anima cuadro a cuadro. */
  private movers: Head[] = [];
  look: Look = DEFAULT_LOOK;
  private weatherSeed = 1;
  view: View = { scale: 1, originX: 0, groundY: 0, w: 1, h: 1 };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D no disponible');
    this.ctx = ctx;
    this.bg = document.createElement('canvas');
    const bgCtx = this.bg.getContext('2d');
    if (!bgCtx) throw new Error('Canvas 2D no disponible');
    this.bgCtx = bgCtx;
    this.resize();
  }

  // ---------------------------------------------------------------- geometría

  private sx(x: number): number {
    return this.view.originX + x * this.view.scale;
  }

  private sy(y: number): number {
    return this.view.groundY - y * this.view.scale;
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);

    const scale = Math.min(w / WORLD.width, h / 9.6);
    this.view = {
      scale,
      originX: (w - WORLD.width * scale) / 2,
      groundY: h - Math.max(h * 0.26, 0.5 * scale),
      w,
      h,
    };

    this.bg.width = Math.round((w + PAD * 2) * dpr);
    this.bg.height = Math.round((h + PAD * 2) * dpr);
    this.buildCrowd();
    this.buildBackground();
  }

  // ------------------------------------------------------------------ fondo

  private buildCrowd(): void {
    const v = this.view;
    const top = standTopFor(v.groundY, v.scale);
    this.crowd = buildCrowd(
      WORLD.width,
      this.look.kits.map((k) => k.jersey),
      top,
    );
    this.movers = crowdMovers(this.crowd);
  }

  /** Proyector que comparten el fondo y las capas animadas. */
  private proj(): { sx: (x: number) => number; sy: (y: number) => number; scale: number; w: number; h: number; pad: number } {
    const v = this.view;
    return {
      sx: (x: number) => this.sx(x),
      sy: (y: number) => this.sy(y),
      scale: v.scale,
      w: v.w,
      h: v.h,
      pad: PAD,
    };
  }

  setLook(look: Look): void {
    this.look = look;
    this.buildCrowd();
    this.buildBackground();
  }

  private buildBackground(): void {
    const ctx = this.bgCtx;
    const v = this.view;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(PAD, PAD);
    ctx.clearRect(-PAD, -PAD, v.w + PAD * 2, v.h + PAD * 2);
    drawStadium(
      ctx,
      {
        sx: (x: number) => this.sx(x),
        sy: (y: number) => this.sy(y),
        scale: v.scale,
        w: v.w,
        h: v.h,
        pad: PAD,
      },
      this.crowd,
    );
  }

  // ----------------------------------------------------------------- dibujo

  draw(m: Match, opts: DrawOpts): void {
    const ctx = this.ctx;
    const v = this.view;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const shake = m.shake;
    const t = opts.time;
    const ox = shake > 0 ? Math.sin(t * 91) * 9 * shake : 0;
    const oy = shake > 0 ? Math.cos(t * 77) * 6 * shake : 0;

    ctx.fillStyle = THEME.skyTop;
    ctx.fillRect(0, 0, v.w, v.h);
    ctx.drawImage(this.bg, -PAD + ox, -PAD + oy, v.w + PAD * 2, v.h + PAD * 2);

    ctx.save();
    ctx.translate(ox, oy);

    drawShowLights(ctx, this.proj(), t);

    // El público del fondo está horneado en el canvas del estadio; estos son
    // los que saltan, saludan y hacen la ola. Sin ellos la grada era una foto.
    drawCrowdLive(ctx, this.proj(), this.movers, t, this.look.flags ?? []);

    if (opts.ticker && opts.ticker.length > 0) this.drawTicker(opts.ticker, t);

    this.drawShadow(m.players[0]);
    this.drawShadow(m.players[1]);
    // Haz de luz del balón que baja del techo: va debajo de todo para que el
    // balón y los jugadores queden por delante.
    if (m.phase === 'kickoff' && m.ball.y > BALL.r + 0.02) this.drawDropSpot(m.ball, t);
    this.drawBallShadow(m.ball);

    this.drawPlayer(m.players[0], this.look.kits[0], opts.time);
    this.drawPlayer(m.players[1], this.look.kits[1], opts.time);

    this.drawBall(m.ball);

    // Postes y red por delante de todo lo que entra: así el balón y el jugador
    // que se mete a despejar se ven DENTRO de la red y no flotando encima.
    // Solo se repinta el arco en el que hay algo: si no, el poste taparía a un
    // jugador que pasa por delante.
    const ballLeft = m.ball.x < GOAL.lineLeft && m.ball.y < GOAL.height;
    const ballRight = m.ball.x > GOAL.lineRight && m.ball.y < GOAL.height;
    const bodyLeft = m.players.some((p) => p.x < GOAL.lineLeft + 0.1);
    const bodyRight = m.players.some((p) => p.x > GOAL.lineRight - 0.1);
    if (ballLeft || bodyLeft) drawGoalFront(ctx, this.proj(), -1);
    if (ballRight || bodyRight) drawGoalFront(ctx, this.proj(), 1);

    for (const p of m.particles) this.drawParticle(p);

    if (this.look.weather) this.drawWeather(t);
    if (this.look.wind) this.drawWind(m.wind, t);
    if (this.look.fans) this.drawFans(t);

    this.drawCharge(m.players[0]);
    this.drawCharge(m.players[1]);

    if (m.phase === 'goal' && m.phaseT < 0.45) {
      ctx.fillStyle = `rgba(255,255,255,${(1 - m.phaseT / 0.45) * 0.32})`;
      ctx.fillRect(0, 0, v.w, v.h);
    }

    if (m.phase === 'kickoff') {
      const a = clamp(1 - m.phaseT / 0.5, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = THEME.gold;
      ctx.font = UI.fontNumber(Math.min(64, v.scale * 1.6));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SAQUE', v.w / 2, v.h * 0.34);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }

    ctx.restore();

    if (opts.debug) this.drawDebug(m, opts);
  }

  private drawDebug(m: Match, opts: DrawOpts): void {
    const ctx = this.ctx;
    const v = this.view;
    const lines = [
      `fps ${opts.fps.toFixed(0)}`,
      `balón ${m.ball.x.toFixed(1)}, ${m.ball.y.toFixed(1)}  v ${Math.hypot(m.ball.vx, m.ball.vy).toFixed(1)} m/s`,
      `p0 ${m.players[0].x.toFixed(1)}  p1 ${m.players[1].x.toFixed(1)}`,
      `fase ${m.phase}  t ${m.clock.toFixed(1)}  sacudida ${m.shake.toFixed(2)}`,
      `remates ${m.stats.shots.join('/')}  cabezazos ${m.stats.headers.join('/')}  máx ${m.stats.maxBallSpeed.toFixed(1)}`,
    ];
    ctx.save();
    ctx.font = '600 12px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textBaseline = 'top';
    const w = 300;
    ctx.fillStyle = 'rgba(3, 8, 18, 0.72)';
    ctx.fillRect(12, 76, w, lines.length * 16 + 14);
    ctx.fillStyle = 'rgba(120, 245, 200, 0.92)';
    lines.forEach((l, i) => ctx.fillText(l, 22, 84 + i * 16));
    ctx.restore();
    void v;
  }

  private drawShadow(p: Player): void {
    const ctx = this.ctx;
    const v = this.view;
    const h = p.y;
    const alpha = clamp(0.34 - h * 0.035, 0.06, 0.34);
    const k = clamp(1 - h * 0.05, 0.55, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#02140b';
    ctx.beginPath();
    ctx.ellipse(this.sx(p.x), v.groundY + 2, 0.42 * v.scale * k, 0.13 * v.scale * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Haz de luz del balón que baja del techo al saque, con un anillo pulsando en
   * el punto de caída. Sin esto la caída se lee como un balón que aparece de la
   * nada arriba de la grada; con esto se ve de dónde viene y dónde va a caer.
   */
  private drawDropSpot(b: Ball, time: number): void {
    const ctx = this.ctx;
    const v = this.view;
    const x = this.sx(b.x);
    const gy = v.groundY;
    const h = Math.max(0, b.y - BALL.r);
    // Se apaga a medida que el balón llega al pasto: el haz "entrega" el balón.
    const k = Math.pow(clamp(h / 6, 0, 1), 0.7);
    if (k <= 0.01) return;
    const topW = 0.3 * v.scale;
    const botW = 0.95 * v.scale;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, 0, 0, gy);
    g.addColorStop(0, `rgba(190, 232, 255, ${0.1 * k})`);
    g.addColorStop(0.55, `rgba(190, 232, 255, ${0.05 * k})`);
    g.addColorStop(1, `rgba(255, 240, 190, ${0.13 * k})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - topW, 0);
    ctx.lineTo(x + topW, 0);
    ctx.lineTo(x + botW, gy);
    ctx.lineTo(x - botW, gy);
    ctx.closePath();
    ctx.fill();

    const pulse = 0.5 + 0.5 * Math.sin(time * 7);
    ctx.strokeStyle = `rgba(255, 214, 110, ${(0.14 + pulse * 0.26) * k})`;
    ctx.lineWidth = Math.max(1.2, v.scale * 0.03);
    ctx.beginPath();
    ctx.ellipse(x, gy + 2, (0.55 + pulse * 0.08) * v.scale, (0.2 + pulse * 0.03) * v.scale, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Halo pegado al balón: la grada es un mosaico de puntos y, sin esto, el
    // balón que viene bajando se confunde con el público.
    const px = this.sx(b.x);
    const py = this.sy(b.y);
    const br = BALL.r * v.scale;
    const halo = ctx.createRadialGradient(px, py, br * 0.55, px, py, br * 3.6);
    halo.addColorStop(0, `rgba(255, 250, 226, ${0.45 * k})`);
    halo.addColorStop(0.4, `rgba(255, 238, 196, ${0.16 * k})`);
    halo.addColorStop(1, 'rgba(255, 238, 196, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(px, py, br * 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawBallShadow(b: Ball): void {
    const ctx = this.ctx;
    const v = this.view;
    const h = Math.max(0, b.y - BALL.r);
    const alpha = clamp(0.3 - h * 0.02, 0.04, 0.3);
    const k = clamp(1 - h * 0.045, 0.4, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#02140b';
    ctx.beginPath();
    ctx.ellipse(this.sx(b.x), v.groundY + 2, 0.17 * v.scale * k, 0.07 * v.scale * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Estampado de la camiseta, recortado a la prenda por quien llama.
   * Coordenadas en px del lienzo: (x, y) es la esquina de la caja.
   */
  private paintKit(team: Kit, x: number, y: number, w: number, h: number, headR: number): void {
    const ctx = this.ctx;
    const alt = team.alt ?? team.shorts;
    const pattern = team.pattern ?? 'plain';
    ctx.save();
    if (pattern === 'stripes') {
      ctx.fillStyle = alt;
      const step = Math.max(5, w / 6);
      for (let i = 0; i < 6; i += 2) ctx.fillRect(x + i * step, y, step, h);
    } else if (pattern === 'hoops') {
      ctx.fillStyle = alt;
      const step = Math.max(5, h / 4);
      for (let i = 1; i < 4; i += 2) ctx.fillRect(x, y + i * step, w, step);
    } else if (pattern === 'checks') {
      const cols = 4;
      const rows = 3;
      const cw = w / cols;
      const ch = h / rows;
      ctx.fillStyle = alt;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if ((r + c) % 2 === 0) ctx.fillRect(x + c * cw, y + r * ch, cw, ch);
        }
      }
    } else if (pattern === 'halves') {
      ctx.fillStyle = alt;
      ctx.fillRect(x + w * 0.5, y, w * 0.5, h);
    } else if (pattern === 'sash') {
      ctx.strokeStyle = alt;
      ctx.lineWidth = h * 0.34;
      ctx.beginPath();
      ctx.moveTo(x, y + h * 0.92);
      ctx.lineTo(x + w, y + h * 0.12);
      ctx.stroke();
    } else if (pattern === 'band') {
      ctx.fillStyle = alt;
      ctx.fillRect(x, y + h * 0.46, w, h * 0.24);
    }
    ctx.restore();
    void headR;
  }

  private drawPlayer(p: Player, team: Kit, time: number): void {
    const ctx = this.ctx;
    const s = this.view.scale;
    const M = (v: number) => v * s;
    const px = this.sx(p.x);
    const py = this.sy(p.y);

    // estela del dash
    for (const tr of p.trail) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, tr.a) * 0.2;
      ctx.fillStyle = team.jersey;
      this.roundRect(ctx, this.sx(tr.x) - M(0.26), this.sy(tr.y) - M(1.5), M(0.52), M(1.1), M(0.2));
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(px, py);
    ctx.scale(PLAYER_ART, PLAYER_ART);

    const sq = p.squash;
    ctx.scale(1 + sq * 0.4, 1 - sq * 0.8);
    if (p.facing < 0) ctx.scale(-1, 1);

    const speed = Math.abs(p.vx);
    const running = p.onGround && speed > 0.5;
    const amp = clamp(speed / PLAYER.maxSpeed, 0, 1);
    const swing = running ? Math.sin(p.runPhase) * amp : 0;
    const airborne = !p.onGround;
    const kickP = p.kickAnim > 0 ? 1 - p.kickAnim / PLAYER.kickAnim : 0;

    const headR = M(PLAYER.headR);
    const headCy = -M(PLAYER.headY);
    const ink = '#1c1410';

    // ============================================================
    //  CUERPO
    //  Ya no hay uniforme dibujado: el cuerpo se pinta con los colores del
    //  equipo y lo único que llega dibujado es UN botín por jugador. Se viste
    //  de atrás hacia delante —botín, pantaloneta y camiseta— y la cabeza va al
    //  final, encima de todo. El botín asoma bajo el ruedo: el muñeco no tiene
    //  piernas ni pies.
    // ============================================================
    const pose = this.poseBota(p);
    const guayos = guayosDe(team.artId, team.artPlayer);
    this.dibujarCuerpo(team, headR, headCy, pose, guayos);

    // ============================================================
    //  CABEZA
    //  Si el equipo trae una cabeza dibujada se usa esa; si no, la de vectores
    //  de siempre. Las dos se apoyan en el mismo mentón, así el cuerpo no
    //  cambia cuando llegue el dibujo.
    // ============================================================
    const artHead = cabezaDe(team.artId, team.artPlayer);
    if (artHead) {
      const headH = headR * 1.98;
      const headW = (artHead.w / artHead.h) * headH;
      const chin = headCy + 0.80 * headR;
      ctx.drawImage(artHead.cv, -headW * 0.5, chin - headH, headW, headH);
    } else {

    // ============================================================
    //  CABEZA — perfil mirando a +x, estilo Football Heads.
    //  Cada futbolista trae su propia mandíbula, nariz, ojos y boca.
    // ============================================================
    // La cabeza no mide igual en todos: `headScale` (0,93 – 1,07) cambia la
    // silueta completa del muñeco, que es lo que se reconoce a lo lejos.
    const R = headR * (team.headScale ?? 1);
    const HY = headCy;
    const skin = team.skin;
    const jaw = JAW_SHAPE[team.jaw ?? 'oval'];
    const nose = NOSE_SHAPE[team.nose ?? 'straight'];
    const eye = EYE_SHAPE[team.eyes ?? 'calm'];
    const brow = BROW_SHAPE[team.brows ?? 'thick'];
    const lips = MOUTH_SHAPE[team.mouth ?? 'wide'];
    const eyeAnchorX = (team.eyeX ?? 0.3) * R;
    const eyeAnchorY = HY + (team.eyeY ?? 0) * R;
    const eyeShift = eyeAnchorX - 0.3 * R;

    // silueta: cráneo redondo, frente inclinada, nariz, labios y mentón
    const headPath = (): void => {
      ctx.beginPath();
      ctx.moveTo(0, HY - 1.0 * R);
      // frente
      ctx.bezierCurveTo(0.28 * R, HY - 0.98 * R, 0.44 * R, HY - 0.8 * R, 0.49 * R, HY - 0.56 * R);
      // ceja y puente
      ctx.bezierCurveTo(0.53 * R, HY - 0.42 * R, 0.56 * R, HY - 0.3 * R, nose.bridge * R, HY - 0.2 * R);
      // dorso de la nariz
      ctx.bezierCurveTo(0.7 * R, HY + (nose.ty - 0.16) * R, (nose.tx - 0.08) * R, HY + (nose.ty - 0.1) * R, nose.tx * R, HY + nose.ty * R);
      // punta redondeada y base
      ctx.bezierCurveTo(
        (nose.tx + 0.02) * R, HY + (nose.ty + 0.11) * R,
        (nose.ux + 0.06) * R, HY + (nose.uy + 0.01) * R,
        nose.ux * R, HY + nose.uy * R,
      );
      // filtrum
      ctx.bezierCurveTo(
        (nose.ux - 0.02) * R, HY + (nose.uy + 0.07) * R,
        (nose.ux + 0.02) * R, HY + (nose.uy + 0.1) * R,
        (nose.ux + 0.005) * R, HY + (nose.uy + 0.15) * R,
      );
      // labio superior
      ctx.bezierCurveTo((nose.ux - 0.02) * R, HY + (nose.uy + 0.24) * R, 0.66 * R, HY + 0.46 * R, 0.6 * R, HY + 0.51 * R);
      // labio inferior
      ctx.bezierCurveTo(0.58 * R, HY + 0.57 * R, 0.54 * R, HY + 0.6 * R, 0.47 * R, HY + 0.63 * R);
      // mentón
      ctx.bezierCurveTo(0.44 * R, HY + (jaw.cl - 0.1) * R, 0.38 * R, HY + jaw.cl * R, jaw.jw * R, HY + (jaw.cl + 0.02) * R);
      // mandíbula
      ctx.bezierCurveTo((jaw.jw - 0.18) * R, HY + (jaw.cl + 0.05) * R, 0.02 * R, HY + (jaw.cl + 0.02) * R, -0.2 * R, HY + (jaw.cl - 0.06) * R);
      // nuca
      ctx.bezierCurveTo(-0.56 * R, HY + 0.66 * R, -0.9 * R, HY + 0.52 * R, -0.97 * R, HY + 0.28 * R);
      // parte de atrás de la cabeza
      ctx.bezierCurveTo(-1.03 * R, HY + 0.04 * R, -1.01 * R, HY - 0.34 * R, -0.85 * R, HY - 0.64 * R);
      ctx.bezierCurveTo(-0.68 * R, HY - 0.9 * R, -0.38 * R, HY - 1.01 * R, -0.12 * R, HY - 1.0 * R);
      ctx.bezierCurveTo(-0.08 * R, HY - 1.0 * R, -0.03 * R, HY - 1.0 * R, 0, HY - 1.0 * R);
      ctx.closePath();
    };

    // relleno de piel con volumen
    const skinGrad = ctx.createLinearGradient(-0.4 * R, HY - R, 0.5 * R, HY + R);
    skinGrad.addColorStop(0, lighten(skin, 0.2));
    skinGrad.addColorStop(0.55, skin);
    skinGrad.addColorStop(1, shade(skin, -0.1));
    headPath();
    ctx.fillStyle = skinGrad;
    ctx.fill();

    // sombreado: mandíbula y bajo el pómulo
    ctx.save();
    headPath();
    ctx.clip();
    ctx.fillStyle = 'rgba(120, 60, 30, 0.1)';
    ctx.beginPath();
    ctx.ellipse(0.16 * R, HY + (jaw.cl - 0.08) * R, 0.4 * R, 0.15 * R, -0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(120, 60, 30, 0.09)';
    ctx.beginPath();
    ctx.ellipse(-0.62 * R, HY + 0.06 * R, 0.24 * R, 0.44 * R, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // brillo de frente y pómulo
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0.26 * R, HY - 0.46 * R, 0.2 * R, 0.14 * R, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0.42 * R, HY + 0.1 * R, 0.14 * R, 0.1 * R, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // oreja (en el lateral, hacia atrás)
    const earX = -0.44 * R;
    const earY = HY + 0.02 * R;
    ctx.fillStyle = lighten(skin, 0.04);
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1.2, M(0.028));
    ctx.beginPath();
    ctx.ellipse(earX, earY, 0.09 * R, 0.12 * R, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(earX + 0.02 * R, earY - 0.08 * R);
    ctx.quadraticCurveTo(earX + 0.06 * R, earY + 0.01 * R, earX + 0.02 * R, earY + 0.09 * R);
    ctx.stroke();

    // ---- pelo: cada selección y cada jugador tienen su corte ----
    const hairStyle: HairStyle = team.hairStyle ?? 'quiff';
    const hairColor = team.hairColor ?? team.hair;
    const hairDark = shade(hairColor, -0.2);
    const hairLine = Math.max(1.6, M(0.04));

    // Tupé: la silueta base de la referencia, con el copete peinado atrás.
    const quiffPath = (): void => {
      ctx.beginPath();
      ctx.moveTo(0.44 * R, HY - 0.58 * R);
      ctx.quadraticCurveTo(0.42 * R, HY - 0.82 * R, 0.28 * R, HY - 0.94 * R);
      ctx.quadraticCurveTo(0.18 * R, HY - 1.04 * R, 0.02 * R, HY - 1.02 * R);
      ctx.quadraticCurveTo(-0.02 * R, HY - 0.94 * R, -0.1 * R, HY - 0.97 * R);
      ctx.quadraticCurveTo(-0.1 * R, HY - 1.12 * R, -0.26 * R, HY - 1.12 * R);
      ctx.quadraticCurveTo(-0.52 * R, HY - 1.06 * R, -0.7 * R, HY - 0.86 * R);
      ctx.quadraticCurveTo(-0.92 * R, HY - 0.66 * R, -0.96 * R, HY - 0.36 * R);
      ctx.quadraticCurveTo(-0.97 * R, HY - 0.22 * R, -0.92 * R, HY - 0.16 * R);
      ctx.quadraticCurveTo(-0.8 * R, HY - 0.24 * R, -0.74 * R, HY - 0.42 * R);
      ctx.quadraticCurveTo(-0.62 * R, HY - 0.56 * R, -0.4 * R, HY - 0.6 * R);
      ctx.quadraticCurveTo(-0.1 * R, HY - 0.64 * R, 0.16 * R, HY - 0.62 * R);
      ctx.quadraticCurveTo(0.34 * R, HY - 0.6 * R, 0.44 * R, HY - 0.58 * R);
      ctx.closePath();
    };

    // Rapado: casquete pegado al cráneo.
    const buzzPath = (): void => {
      ctx.beginPath();
      ctx.moveTo(0.44 * R, HY - 0.52 * R);
      ctx.quadraticCurveTo(0.44 * R, HY - 0.8 * R, 0.24 * R, HY - 0.96 * R);
      ctx.quadraticCurveTo(0.04 * R, HY - 1.08 * R, -0.2 * R, HY - 1.06 * R);
      ctx.quadraticCurveTo(-0.6 * R, HY - 1.02 * R, -0.86 * R, HY - 0.68 * R);
      ctx.quadraticCurveTo(-0.98 * R, HY - 0.5 * R, -0.96 * R, HY - 0.3 * R);
      ctx.quadraticCurveTo(-0.9 * R, HY - 0.4 * R, -0.78 * R, HY - 0.48 * R);
      ctx.quadraticCurveTo(-0.5 * R, HY - 0.6 * R, -0.2 * R, HY - 0.62 * R);
      ctx.quadraticCurveTo(0.1 * R, HY - 0.64 * R, 0.44 * R, HY - 0.52 * R);
      ctx.closePath();
    };

    // Degradado: rapado en los lados con un poco de volumen arriba.
    const fadePath = (): void => {
      ctx.beginPath();
      ctx.moveTo(0.44 * R, HY - 0.5 * R);
      ctx.quadraticCurveTo(0.46 * R, HY - 0.74 * R, 0.3 * R, HY - 0.88 * R);
      ctx.quadraticCurveTo(0.2 * R, HY - 1.0 * R, 0.04 * R, HY - 1.03 * R);
      ctx.quadraticCurveTo(-0.12 * R, HY - 1.06 * R, -0.28 * R, HY - 1.0 * R);
      ctx.quadraticCurveTo(-0.58 * R, HY - 0.96 * R, -0.82 * R, HY - 0.66 * R);
      ctx.quadraticCurveTo(-0.94 * R, HY - 0.48 * R, -0.92 * R, HY - 0.3 * R);
      ctx.quadraticCurveTo(-0.86 * R, HY - 0.42 * R, -0.74 * R, HY - 0.5 * R);
      ctx.quadraticCurveTo(-0.48 * R, HY - 0.6 * R, -0.2 * R, HY - 0.62 * R);
      ctx.quadraticCurveTo(0.1 * R, HY - 0.64 * R, 0.44 * R, HY - 0.5 * R);
      ctx.closePath();
    };

    // Afro: melena redonda y rizada que envuelve la cabeza.
    const afroPath = (): void => {
      ctx.beginPath();
      ctx.moveTo(0.46 * R, HY - 0.48 * R);
      ctx.bezierCurveTo(0.56 * R, HY - 0.92 * R, 0.26 * R, HY - 1.3 * R, -0.16 * R, HY - 1.26 * R);
      ctx.bezierCurveTo(-0.66 * R, HY - 1.22 * R, -1.08 * R, HY - 0.82 * R, -1.08 * R, HY - 0.32 * R);
      ctx.bezierCurveTo(-1.08 * R, HY - 0.04 * R, -0.96 * R, HY + 0.14 * R, -0.8 * R, HY + 0.16 * R);
      ctx.bezierCurveTo(-0.72 * R, HY - 0.14 * R, -0.64 * R, HY - 0.42 * R, -0.44 * R, HY - 0.54 * R);
      ctx.bezierCurveTo(-0.2 * R, HY - 0.66 * R, 0.2 * R, HY - 0.62 * R, 0.46 * R, HY - 0.48 * R);
      ctx.closePath();
    };

    // Rizos cortos: afro bajo, pegado a la cabeza.
    const curlsPath = (): void => {
      ctx.beginPath();
      ctx.moveTo(0.46 * R, HY - 0.5 * R);
      ctx.bezierCurveTo(0.54 * R, HY - 0.84 * R, 0.28 * R, HY - 1.12 * R, -0.12 * R, HY - 1.1 * R);
      ctx.bezierCurveTo(-0.54 * R, HY - 1.08 * R, -0.94 * R, HY - 0.78 * R, -0.96 * R, HY - 0.38 * R);
      ctx.bezierCurveTo(-0.96 * R, HY - 0.12 * R, -0.88 * R, HY + 0.06 * R, -0.76 * R, HY + 0.08 * R);
      ctx.bezierCurveTo(-0.7 * R, HY - 0.16 * R, -0.62 * R, HY - 0.4 * R, -0.44 * R, HY - 0.52 * R);
      ctx.bezierCurveTo(-0.2 * R, HY - 0.64 * R, 0.2 * R, HY - 0.62 * R, 0.46 * R, HY - 0.5 * R);
      ctx.closePath();
    };

    const paintHair = (path: () => void, extra?: () => void): void => {
      if (extra) extra();
      const g = ctx.createLinearGradient(-0.9 * R, HY - R, 0.4 * R, HY + 0.1 * R);
      g.addColorStop(0, hairDark);
      g.addColorStop(0.55, hairColor);
      g.addColorStop(1, lighten(hairColor, 0.08));
      path();
      ctx.fillStyle = g;
      ctx.fill();
      // brillo del pelo
      ctx.save();
      path();
      ctx.clip();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-0.3 * R, HY - 0.86 * R, 0.34 * R, 0.12 * R, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // contorno del pelo
      path();
      ctx.strokeStyle = ink;
      ctx.lineWidth = hairLine;
      ctx.stroke();
    };

    if (hairStyle === 'afro') {
      paintHair(afroPath, () => {
        // rizos: bultitos que rompen el contorno liso
        ctx.fillStyle = hairColor;
        const curls: [number, number, number][] = [
          [0.24, -1.18, 0.22], [-0.12, -1.3, 0.26], [-0.52, -1.16, 0.24],
          [-0.86, -0.88, 0.24], [-1.02, -0.52, 0.22],
        ];
        for (const [cx, cy, cr] of curls) {
          ctx.beginPath();
          ctx.arc(cx * R, HY + cy * R, cr * R, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    } else if (hairStyle === 'curls') {
      paintHair(curlsPath, () => {
        ctx.fillStyle = hairColor;
        const curls: [number, number, number][] = [
          [0.3, -0.9, 0.17], [0.08, -1.06, 0.18], [-0.2, -1.08, 0.18],
          [-0.5, -0.96, 0.17], [-0.76, -0.72, 0.16], [-0.9, -0.44, 0.14],
        ];
        for (const [cx, cy, cr] of curls) {
          ctx.beginPath();
          ctx.arc(cx * R, HY + cy * R, cr * R, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    } else if (hairStyle === 'buzz') {
      paintHair(buzzPath);
    } else if (hairStyle === 'fade') {
      paintHair(fadePath);
    } else if (hairStyle === 'bald') {
      // calvo: solo el brillo del cráneo
      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-0.1 * R, HY - 0.78 * R, 0.34 * R, 0.16 * R, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (hairStyle === 'bun') {
      paintHair(quiffPath, () => {
        // moño bajo, asomando por detrás de la nuca
        ctx.beginPath();
        ctx.arc(-1.0 * R, HY - 0.58 * R, 0.28 * R, 0, Math.PI * 2);
        ctx.fillStyle = hairDark;
        ctx.fill();
        ctx.strokeStyle = ink;
        ctx.lineWidth = hairLine * 0.8;
        ctx.stroke();
      });
    } else {
      paintHair(
        quiffPath,
        hairStyle === 'long'
          ? () => {
              // melena: el pelo cae por la nuca hasta el cuello
              ctx.beginPath();
              ctx.moveTo(-0.62 * R, HY - 0.78 * R);
              ctx.bezierCurveTo(-0.98 * R, HY - 0.56 * R, -1.08 * R, HY - 0.05 * R, -1.0 * R, HY + 0.62 * R);
              ctx.quadraticCurveTo(-0.84 * R, HY + 0.72 * R, -0.7 * R, HY + 0.5 * R);
              ctx.bezierCurveTo(-0.74 * R, HY + 0.05 * R, -0.7 * R, HY - 0.4 * R, -0.48 * R, HY - 0.68 * R);
              ctx.closePath();
              ctx.fillStyle = hairDark;
              ctx.fill();
            }
          : undefined,
      );
      // raya del copete
      if (hairStyle === 'quiff' || hairStyle === 'long') {
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1.4, M(0.022));
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0.32 * R, HY - 0.62 * R);
        ctx.quadraticCurveTo(0.12 * R, HY - 0.8 * R, -0.06 * R, HY - 0.94 * R);
        ctx.stroke();
        ctx.restore();
      }
    }

    // ---- barba: sombra de tres días, barba cerrada o perilla ----
    const beard: Beard = team.beard ?? 'none';
    if (beard !== 'none') {
      ctx.save();
      headPath();
      ctx.clip();
      ctx.globalAlpha = beard === 'full' ? 0.92 : 0.26;
      ctx.fillStyle = hairColor;
      if (beard === 'goatee') {
        // perilla: bigote y mentón, sin patillas
        ctx.beginPath();
        ctx.moveTo(0.42 * R, HY + (nose.uy + 0.12) * R);
        ctx.quadraticCurveTo(0.6 * R, HY + (nose.uy + 0.2) * R, 0.66 * R, HY + (nose.uy + 0.3) * R);
        ctx.quadraticCurveTo(0.58 * R, HY + (nose.uy + 0.38) * R, 0.46 * R, HY + (nose.uy + 0.3) * R);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0.3 * R, HY + (jaw.cl - 0.04) * R, 0.2 * R, 0.14 * R, 0.15, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // banda que sigue la mandíbula
        ctx.beginPath();
        ctx.moveTo(0.66 * R, HY + 0.2 * R);
        ctx.bezierCurveTo(0.68 * R, HY + 0.46 * R, 0.52 * R, HY + 0.7 * R, 0.24 * R, HY + 0.8 * R);
        ctx.bezierCurveTo(-0.04 * R, HY + 0.88 * R, -0.32 * R, HY + 0.74 * R, -0.48 * R, HY + 0.38 * R);
        ctx.lineTo(-0.34 * R, HY + 0.36 * R);
        ctx.bezierCurveTo(-0.2 * R, HY + 0.62 * R, 0.04 * R, HY + 0.7 * R, 0.26 * R, HY + 0.62 * R);
        ctx.bezierCurveTo(0.46 * R, HY + 0.54 * R, 0.54 * R, HY + 0.38 * R, 0.52 * R, HY + 0.22 * R);
        ctx.closePath();
        ctx.fill();
        // bigote
        ctx.beginPath();
        ctx.moveTo(0.32 * R, HY + (nose.uy + 0.04) * R);
        ctx.quadraticCurveTo(0.5 * R, HY + (nose.uy - 0.04) * R, 0.66 * R, HY + (nose.uy + 0.04) * R);
        ctx.quadraticCurveTo(0.52 * R, HY + (nose.uy + 0.16) * R, 0.34 * R, HY + (nose.uy + 0.12) * R);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // patilla: pelo que baja por delante de la oreja. Es el detalle que hace
    // que el corte se lea de perfil y no como un casco.
    if (hairStyle !== 'bald' && hairStyle !== 'buzz') {
      ctx.save();
      headPath();
      ctx.clip();
      ctx.fillStyle = hairColor;
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.moveTo(-0.3 * R, HY - 0.3 * R);
      ctx.quadraticCurveTo(-0.36 * R, HY - 0.05 * R, -0.42 * R, HY + 0.06 * R);
      ctx.quadraticCurveTo(-0.5 * R, HY - 0.06 * R, -0.46 * R, HY - 0.32 * R);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // contorno de la cara (encima del pelo)
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(2, M(0.05));
    headPath();
    ctx.stroke();

    // ---- ceja gruesa, inclinada hacia la nariz ----
    ctx.strokeStyle = team.hairColor ?? team.hair;
    ctx.lineWidth = Math.max(3.2, M(brow.w));
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-0.04 * R + eyeShift, HY - (0.28 + brow.tilt) * R + (team.eyeY ?? 0) * R);
    ctx.quadraticCurveTo(
      0.26 * R + eyeShift,
      HY - (0.27 + brow.lift) * R + (team.eyeY ?? 0) * R,
      0.48 * R + eyeShift,
      HY - (0.14 + brow.tilt * 0.4) * R + (team.eyeY ?? 0) * R,
    );
    ctx.stroke();

    // sombra del párpado bajo la ceja
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(0.28 * R + eyeShift, eyeAnchorY - 0.07 * R, 0.2 * R, 0.05 * R, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // rubor de la mejilla: rompe la cara plana y da calor al muñeco
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#c8503c';
    ctx.beginPath();
    ctx.ellipse(0.34 * R, HY + 0.24 * R, 0.16 * R, 0.09 * R, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ---- ojo (almendra) ----
    const blink = Math.sin(time * 1.7 + p.side * 2.1) > 0.985 ? 0.08 : 1;
    ctx.save();
    ctx.translate(eyeAnchorX, eyeAnchorY);
    ctx.rotate(eye.rot);
    ctx.fillStyle = '#fbf7f2';
    ctx.beginPath();
    ctx.ellipse(0, 0, eye.rx * R, eye.ry * R * blink, 0, 0, Math.PI * 2);
    ctx.fill();
    if (blink > 0.5) {
      // iris pegado al párpado superior
      ctx.fillStyle = team.eyeColor ?? '#3a2418';
      ctx.beginPath();
      ctx.arc(0.024 * R, -0.012 * R, 0.07 * R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#140f0b';
      ctx.beginPath();
      ctx.arc(0.028 * R, -0.012 * R, 0.036 * R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath();
      ctx.arc(0.008 * R, -0.042 * R, 0.016 * R, 0, Math.PI * 2);
      ctx.fill();
      // párpado superior grueso
      ctx.strokeStyle = ink;
      ctx.lineWidth = Math.max(1.8, M(0.03));
      ctx.beginPath();
      ctx.moveTo(-eye.rx * 1.03 * R, -0.035 * R);
      ctx.quadraticCurveTo(0, -0.11 * R, eye.rx * 1.03 * R, -0.02 * R);
      ctx.stroke();
    }
    ctx.restore();

    // ---- nariz: arista, fosa y surco de la mejilla ----
    ctx.strokeStyle = 'rgba(95, 48, 26, 0.5)';
    ctx.lineWidth = Math.max(1.4, M(0.03));
    ctx.beginPath();
    ctx.moveTo((nose.bridge + 0.02) * R, HY - 0.16 * R);
    ctx.quadraticCurveTo((nose.tx - 0.12) * R, HY + (nose.ty - 0.06) * R, (nose.tx - 0.05) * R, HY + (nose.ty + 0.04) * R);
    ctx.stroke();
    ctx.fillStyle = 'rgba(70, 35, 20, 0.65)';
    ctx.beginPath();
    ctx.ellipse((nose.ux - 0.02) * R, HY + (nose.uy - 0.03) * R, 0.032 * R, 0.024 * R, 0.45, 0, Math.PI * 2);
    ctx.fill();
    // brillo del tabique: redondea la nariz y evita que sea una cuña plana
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.2, M(0.026));
    ctx.beginPath();
    ctx.moveTo((nose.bridge + 0.01) * R, HY - 0.13 * R);
    ctx.quadraticCurveTo((nose.tx - 0.09) * R, HY + (nose.ty - 0.04) * R, (nose.tx - 0.03) * R, HY + (nose.ty + 0.03) * R);
    ctx.stroke();
    ctx.restore();

    // ---- boca: dientes apretados / abierta al patear ----
    const mouthOpen = p.charging || p.kickAnim > 0;
    const mouthY = HY + (nose.uy + 0.22) * R;
    ctx.save();
    // El recorte va ANTES de desplazar el contexto: headPath está en
    // coordenadas del jugador, no del labio.
    headPath();
    ctx.clip();
    ctx.translate(0.5 * R, mouthY);
    ctx.rotate(0.06);
    const mw = lips.w * R;
    if (mouthOpen) {
      ctx.fillStyle = '#40150f';
      ctx.beginPath();
      ctx.ellipse(0, 0, mw * 0.9, lips.h * R, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = Math.max(1.4, M(0.026));
      ctx.stroke();
      ctx.fillStyle = '#f7f2e7';
      ctx.beginPath();
      ctx.ellipse(0, -lips.h * R * 0.55, mw * 0.72, lips.h * R * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Boca cerrada: una línea de labios, no una sonrisa con dientes.
      ctx.strokeStyle = '#3a1710';
      ctx.lineWidth = Math.max(2, M(0.045));
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-mw * 0.82, -0.02 * R);
      ctx.quadraticCurveTo(0, 0.05 * R, mw * 0.82, -0.02 * R);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = Math.max(1.2, M(0.02));
      ctx.beginPath();
      ctx.moveTo(-mw * 0.5, 0.08 * R);
      ctx.quadraticCurveTo(0, 0.115 * R, mw * 0.5, 0.08 * R);
      ctx.stroke();
    }
    ctx.restore();
    }

    ctx.restore();

    if (p.hitFlash > 0) {
      ctx.save();
      ctx.globalAlpha = p.hitFlash * 4;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(px, py - M(PLAYER.headY), M(PLAYER.headR) * 1.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawBall(b: Ball): void {
    const ctx = this.ctx;
    const s = this.view.scale;
    const px = this.sx(b.x);
    const py = this.sy(b.y);
    const r = BALL.r * s;
    const speed = Math.hypot(b.vx, b.vy);
    const pal = BALL_PALETTES[((this.look.ball % 2) + 2) % 2]!;
    const TAU = Math.PI * 2;

    if (speed > 14) {
      for (let i = 0; i < b.trail.length; i++) {
        const t = b.trail[i]!;
        ctx.globalAlpha = t.a * 0.16 * (i / b.trail.length);
        ctx.fillStyle = '#c8f6ff';
        ctx.beginPath();
        ctx.arc(this.sx(t.x), this.sy(t.y), r * 0.85, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Balón real (foto recortada): gira con el bote y conserva la luz fija.
    // La foto trae ~8 % de margen transparente; se dibuja un poco más grande
    // para que el balón visible coincida con su radio de colisión.
    const photo = ballImage(this.look.ball);
    if (photo) {
      const pr = r * 1.09;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(b.rot);
      ctx.drawImage(photo, -pr, -pr, pr * 2, pr * 2);
      ctx.restore();

      const rim = ctx.createRadialGradient(px, py, r * 0.54, px, py, r);
      rim.addColorStop(0, 'rgba(0,0,0,0)');
      rim.addColorStop(0.86, 'rgba(0,0,0,0.05)');
      rim.addColorStop(1, 'rgba(0,0,0,0.22)');
      ctx.beginPath();
      ctx.arc(px, py, r, 0, TAU);
      ctx.fillStyle = rim;
      ctx.fill();
      return;
    }

    ctx.save();
    ctx.translate(px, py);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.clip();

    // base esférica
    const g = ctx.createRadialGradient(-r * 0.34, -r * 0.4, r * 0.05, 0, 0, r * 1.06);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, pal.base);
    g.addColorStop(0.88, pal.edge);
    g.addColorStop(1, shade(pal.edge, -0.16));
    ctx.fillStyle = g;
    ctx.fillRect(-r, -r, r * 2, r * 2);

    ctx.rotate(b.rot);

    if (pal.style === 'trionda') {
      // tres aspas curvas de color, como la Trionda
      const accents = pal.accents ?? [];
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.rotate((-0.5 + i * 2.09));
        ctx.fillStyle = accents[i] ?? '#cccccc';
        ctx.globalAlpha = 0.92;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.99);
        ctx.bezierCurveTo(r * 0.44, -r * 0.72, r * 0.36, -r * 0.16, r * 0.05, r * 0.12);
        ctx.bezierCurveTo(-r * 0.2, -r * 0.2, -r * 0.32, -r * 0.64, 0, -r * 0.99);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.strokeStyle = pal.seam;
      ctx.lineWidth = Math.max(1, r * 0.045);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.74, (i / 3) * TAU + 0.15, (i / 3) * TAU + 1.55);
        ctx.stroke();
      }
    } else {
      // pentágonos (clásico / oro)
      const patchColor = pal.patch ?? '#222222';
      const pent = (cx: number, cy: number, pr: number, rot: number): void => {
        ctx.beginPath();
        for (let k = 0; k < 5; k++) {
          const aa = (k / 5) * TAU + rot;
          const x = cx + Math.cos(aa) * pr;
          const y = cy + Math.sin(aa) * pr;
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
      };
      ctx.fillStyle = patchColor;
      pent(0, 0, r * 0.3, -Math.PI / 2);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU - Math.PI / 2;
        pent(Math.cos(a) * r * 0.68, Math.sin(a) * r * 0.68, r * 0.21, a + 0.3);
      }
      ctx.strokeStyle = pal.seam;
      ctx.lineWidth = Math.max(1, r * 0.04);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3);
        ctx.lineTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
        ctx.stroke();
      }
    }

    // sombra perimetral: da volumen sin ensuciar
    const rim = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r);
    rim.addColorStop(0, 'rgba(0, 0, 0, 0)');
    rim.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
    ctx.fillStyle = rim;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();

    // brillo especular: la luz no gira con el balón
    ctx.save();
    ctx.translate(px, py);
    const spec = ctx.createRadialGradient(-r * 0.36, -r * 0.42, 0, -r * 0.36, -r * 0.42, r * 0.72);
    spec.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    spec.addColorStop(0.35, 'rgba(255, 255, 255, 0.2)');
    spec.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = spec;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(18, 26, 20, 0.3)';
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.98, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  private drawWeather(t: number): void {
    const ctx = this.ctx;
    const v = this.view;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(214, 236, 255, 0.5)';
    ctx.lineWidth = Math.max(1, v.scale * 0.013);
    for (let i = 0; i < 150; i++) {
      const seed = i * 12.9898;
      const rx = Math.sin(seed) * 0.5 + 0.5;
      const rs = Math.sin(seed * 1.7) * 0.5 + 0.5;
      const speed = 0.75 + rs * 0.6;
      const x = ((rx * 1.3 - 0.15 + t * 0.03) % 1) * v.w;
      const y = ((rs + t * speed) % 1) * v.h;
      const len = v.scale * (0.2 + rs * 0.3);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - len * 0.3, y + len);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Ráfagas de viento: la dirección y la fuerza salen del viento real. */
  private drawWind(wind: number, t: number): void {
    const ctx = this.ctx;
    const v = this.view;
    const dir = wind >= 0 ? 1 : -1;
    const strength = Math.min(1, Math.abs(wind) / 5.5);
    ctx.save();
    ctx.strokeStyle = `rgba(232, 242, 222, ${0.08 + strength * 0.12})`;
    ctx.lineWidth = Math.max(1, v.scale * 0.026);
    ctx.lineCap = 'round';
    for (let i = 0; i < 10; i++) {
      const yy = v.h * 0.12 + ((i / 10) * v.h * 0.52);
      const speed = 0.22 + strength * 0.5;
      const raw = ((t * speed + i * 0.21) % 1) * 1.5 - 0.25;
      const x = (dir > 0 ? raw : 1 - raw) * v.w;
      const amp = v.scale * (0.4 + (i % 3) * 0.3) * (0.4 + strength);
      ctx.beginPath();
      ctx.moveTo(x, yy);
      ctx.bezierCurveTo(x + amp * 2 * dir, yy - amp, x + amp * 4 * dir, yy + amp, x + amp * 6 * dir, yy - amp * 0.4);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Cinta de resultados en la valla publicitaria: los otros partidos de la
   * ronda pasan en bucle, con su marcador al minuto del partido. Discreta y
   * por debajo de la cabeza de los jugadores, para no estorbar.
   *
   * Dos cosas que antes estaban mal:
   *  - la banda ocupaba TODO el ancho y el texto se dibujaba encima de los
   *    postes y de la red (parecía escrito sobre la portería);
   *  - el bucle dependía de medir una cadena entera y al llegar al último
   *    partido saltaba de golpe al primero.
   * Ahora la cinta vive entre los dos arcos y avanza partido a partido, así que
   * nunca se corta: al terminar el último sigue el primero sin hueco.
   */
  private drawTicker(items: string[], time: number): void {
    const ctx = this.ctx;
    // Sobre la valla roja (donde antes solo decía VANTAGGIO), no sobre el
    // listón LED de arriba: así no tapa la cabeza de los cabezones.
    const top = this.sy(STANDS.barrierTop);
    const bottom = this.sy(STANDS.barrierBottom);
    const hgt = bottom - top;
    if (hgt < 5) return;

    // Entre los arcos, con un margen: la banda no puede pisar la red.
    const x0 = this.sx(GOAL.lineLeft + GOAL.depth + 0.42);
    const x1 = this.sx(GOAL.lineRight - GOAL.depth - 0.42);
    const width = x1 - x0;
    if (width < hgt * 4) return;
    const y = (top + bottom) / 2 + 0.5;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, top, width, hgt);
    ctx.clip();

    ctx.fillStyle = '#0a0705';
    ctx.fillRect(x0, top, width, hgt);
    ctx.fillStyle = 'rgba(255, 176, 96, 0.2)';
    ctx.fillRect(x0, top, width, 1);

    const font = `700 ${Math.max(7, hgt * 0.58)}px "Barlow Condensed", "SF Pro Text", ui-sans-serif, system-ui, sans-serif`;
    ctx.font = font;
    ctx.textBaseline = 'middle';
    const gap = hgt * 2.4;
    const widths = items.map((s) => ctx.measureText(s).width);
    const total = widths.reduce((acc, w) => acc + w + gap, 0) || 1;

    // Etiqueta fija a la izquierda de la banda.
    const label = 'EN VIVO';
    const labelW = ctx.measureText(label).width + hgt * 1.5;
    const speed = Math.max(22, hgt * 4.1);
    const offset = (time * speed) % total;

    ctx.fillStyle = 'rgba(255, 216, 154, 0.92)';
    let x = x0 - offset;
    let i = 0;
    let guard = 0;
    while (x < x1 && guard++ < 200) {
      ctx.fillText(items[i]!, x, y);
      x += widths[i]! + gap;
      i = (i + 1) % items.length;
    }

    // Panel fijo a la izquierda: tapa el arranque del texto al entrar.
    ctx.fillStyle = '#0a0705';
    ctx.fillRect(x0, top, labelW, hgt);
    const blink = 0.5 + Math.sin(time * 6) * 0.5;
    ctx.globalAlpha = 0.5 + blink * 0.5;
    ctx.fillStyle = '#ff5a3c';
    ctx.beginPath();
    ctx.arc(x0 + hgt * 0.42, y, Math.max(1.4, hgt * 0.11), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f4ecd8';
    ctx.font = `800 ${Math.max(6, hgt * 0.46)}px "Barlow Condensed", "SF Pro Text", ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(label, x0 + hgt * 0.78, y);

    // Fundido en los dos extremos: la banda se apaga antes de tocar el arco.
    const fade = ctx.createLinearGradient(x0, 0, x0 + hgt * 1.6, 0);
    fade.addColorStop(0, 'rgba(10, 7, 5, 0.95)');
    fade.addColorStop(1, 'rgba(10, 7, 5, 0)');
    ctx.fillStyle = fade;
    ctx.fillRect(x0, top, hgt * 1.6, hgt);
    const fadeOut = ctx.createLinearGradient(x1, 0, x1 - hgt * 1.6, 0);
    fadeOut.addColorStop(0, 'rgba(10, 7, 5, 0.95)');
    fadeOut.addColorStop(1, 'rgba(10, 7, 5, 0)');
    ctx.fillStyle = fadeOut;
    ctx.fillRect(x1 - hgt * 1.6, top, hgt * 1.6, hgt);
    ctx.restore();
  }

  private drawFans(t: number): void {
    const ctx = this.ctx;
    const v = this.view;
    // Bengalas: humo rojo que sube desde la grada. Es lo que de verdad se ve
    // de una hinchada enojada, más que las botellas.
    for (let i = 0; i < 3; i++) {
      const cycle = 3.6 + i * 0.8;
      const phase = ((t + i * 1.7) % cycle) / cycle;
      const x = v.w * (0.14 + i * 0.36);
      const y = v.h * 0.3 - phase * v.h * 0.16;
      const flare = Math.max(0, 1 - phase * 1.4);
      ctx.save();
      ctx.globalAlpha = flare * 0.5;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, v.scale * 0.5);
      grad.addColorStop(0, 'rgba(255, 96, 60, 0.85)');
      grad.addColorStop(0.5, 'rgba(255, 60, 40, 0.22)');
      grad.addColorStop(1, 'rgba(255, 60, 40, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, v.scale * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Botellas volando hacia la cancha.
    for (let i = 0; i < 7; i++) {
      const cycle = 2.1 + i * 0.37;
      const phase = ((t + i * 1.31) % cycle) / cycle;
      const startX = ((i * 0.37 + 0.15) % 1) * v.w;
      const dir = i % 2 === 0 ? 1 : -1;
      const x = startX + dir * phase * v.w * 0.09;
      const y = v.h * 0.24 + phase * phase * v.h * 0.58;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(phase * 8 * dir);
      ctx.globalAlpha = Math.min(1, (1 - phase) * 3.2);
      const w = v.scale * 0.11;
      const hh = v.scale * 0.3;
      ctx.fillStyle = '#2f6b3a';
      ctx.beginPath();
      ctx.roundRect(-w / 2, -hh / 2, w, hh, w * 0.35);
      ctx.fill();
      ctx.fillStyle = '#ded8c6';
      ctx.fillRect(-w * 0.22, -hh / 2 - v.scale * 0.055, w * 0.44, v.scale * 0.06);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(-w * 0.18, -hh * 0.2, w * 0.16, hh * 0.4);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private drawParticle(p: Particle): void {
    const ctx = this.ctx;
    const s = this.view.scale;
    const a = clamp(p.life / p.max, 0, 1);
    if (a <= 0) return;
    const x = this.sx(p.x);
    const y = this.sy(p.y);

    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;

    if (p.kind === 'confetti') {
      ctx.translate(x, y);
      ctx.rotate(p.rot);
      ctx.fillRect(-p.size * s * 0.5, -p.size * s * 0.28, p.size * s, p.size * s * 0.56);
    } else if (p.kind === 'spark') {
      const len = p.size * s * 3.2;
      const ang = Math.atan2(-p.vy, p.vx);
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.fillRect(0, -p.size * s * 0.4, len, p.size * s * 0.8);
    } else if (p.kind === 'bottle') {
      const w = p.size * s * 1.05;
      const hh = p.size * s * 2.5;
      ctx.translate(x, y);
      ctx.rotate(p.rot);
      ctx.fillRect(-w / 2, -hh / 2, w, hh);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(-w * 0.18, -hh / 2, w * 0.24, hh * 0.5);
    } else if (p.kind === 'ring') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(1.5, p.size * s * 0.7);
      ctx.beginPath();
      ctx.arc(x, y, (1 - a) * p.size * s * 9 + p.size * s, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1, p.size * s), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Posición y giro del botín, compartidos por el muñeco de vectores y por el
   * de arte: si cada uno animara el zapato por su cuenta, el mismo jugador se
   * movería distinto según el equipo que le tocara.
   */
  private poseBota(p: Player): { x: number; y: number; rot: number } {
    const M = (v: number): number => v * this.view.scale;
    const speed = Math.abs(p.vx);
    const running = p.onGround && speed > 0.5;
    const amp = clamp(speed / PLAYER.maxSpeed, 0, 1);
    const swing = running ? Math.sin(p.runPhase) * amp : 0;
    const bob = running ? Math.abs(Math.sin(p.runPhase)) * M(0.045) : 0;
    let bootX = M(0.13) + swing * M(0.12);
    let bootY = -bob;
    let bootRot = swing * 0.17;
    if (!p.onGround) {
      bootX = M(0.14);
      bootY = -M(0.09);
      bootRot = 0.45;
    }
    if (p.kickAnim > 0) {
      const kickP = 1 - p.kickAnim / PLAYER.kickAnim;
      const k = Math.sin(kickP * Math.PI);
      bootX += M(0.05) + k * M(0.13);
      bootY -= k * M(0.07);
      bootRot = -1.2 * k;
    }
    return { x: bootX, y: bootY, rot: bootRot };
  }

  /**
   * Cuerpo del futbolista, dibujado con los colores del equipo y DE PERFIL,
   * como la cabeza: mira siempre a +x (el espejo del partido lo voltea).
   *
   * Se mide en «radios de cabeza» (R) y en el sistema del jugador: el origen
   * está en las plantas de los pies y la cabeza cuelga hacia arriba en
   * `headCy`. Las capas van de atrás hacia delante: botín, pantaloneta,
   * camiseta y cabeza. Lo único que llega dibujado es el botín; el resto se
   * pinta aquí para que los 48 equipos se distingan sin necesitar 48 dibujos.
   */
  private dibujarCuerpo(
    team: Kit,
    R: number,
    headCy: number,
    pose: { x: number; y: number; rot: number },
    guayos: Pieza | null,
  ): void {
    const ctx = this.ctx;
    const ink = '#1c1410';

    // Reparto del alto disponible, de la planta del pie al mentón: botín,
    // media, pantaloneta y camiseta. El cuello de la camiseta se mete un poco
    // DETRÁS de la mandíbula (por eso `collar` es negativo respecto al mentón):
    // así no queda una franja de piel suelta entre la cabeza y la prenda.
    const chin = headCy + 0.80 * R;
    const collar = chin - 0.02 * R;
    const hem = -0.60 * R;
    const shortsTop = hem - 0.02 * R;
    const shortsBot = -0.44 * R;

    // El alto del botín sale del propio dibujo: así el tobillo queda justo
    // bajo el ruedo de la pantaloneta, sin depender de un número fijo que solo
    // sirva para uno de los seis pares.
    const botaW = R * 1.35;
    const botaH = guayos ? (guayos.h / guayos.w) * botaW : R * 0.38;

    // sombra de contacto con el pasto: acompaña el ancho del botín, que ahora
    // es la pieza más grande del muñeco
    ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
    ctx.beginPath();
    ctx.ellipse(0.26 * R, 0, 0.84 * R, 0.1 * R, 0, 0, Math.PI * 2);
    ctx.fill();

    // ---- botín: uno solo, el dibujo del usuario, apoyado en el pasto ----
    // El jugador es un muñeco sin piernas: el botín hace de pies y su tobillo
    // se mete bajo el ruedo de la pantaloneta. Por eso no se dibuja pierna ni
    // pie, y tampoco un segundo zapato: el dibujo del usuario es UN botín.
    const bota = (x: number, y: number, rot: number, escala = 1): void => {
      if (!guayos) {
        this.dibujarBotaVector(team, x, y, rot);
        return;
      }
      const ancho = botaW * escala;
      const alto = (guayos.h / guayos.w) * ancho;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.drawImage(guayos.cv, -ancho * 0.3, -alto, ancho, alto);
      ctx.restore();
    };

    bota(pose.x, pose.y, pose.rot);

    // ---- cuerpo más chico ----
    // Camiseta y pantaloneta se dibujan a `BODY_ART` de su tamaño anterior, con
    // la escala puesta en el cuello: el mentón sigue apoyado en la camiseta, el
    // cuerpo se achica hacia abajo y el botín —que no se escala— queda como la
    // pieza grande del muñeco.
    ctx.save();
    ctx.translate(0, collar);
    ctx.scale(BODY_ART, BODY_ART);
    ctx.translate(0, -collar);

    // ---- pantaloneta ----
    // De perfil: la cintura va casi recta, el trasero sobresale hacia atrás y
    // el ruedo delantero baja sobre la pierna que se ve. Nada de la simetría
    // de antes, que era justo lo que hacía que el cuerpo pareciera de frente.
    const shortsPath = (): void => {
      ctx.beginPath();
      ctx.moveTo(0.43 * R, shortsTop);
      ctx.lineTo(-0.36 * R, shortsTop);
      // cadera y trasero
      ctx.bezierCurveTo(-0.45 * R, shortsTop + 0.03 * R, -0.45 * R, shortsBot - 0.05 * R, -0.4 * R, shortsBot + 0.01 * R);
      // ruedo
      ctx.lineTo(0.24 * R, shortsBot + 0.01 * R);
      ctx.quadraticCurveTo(0.37 * R, shortsBot - 0.01 * R, 0.41 * R, shortsBot - 0.12 * R);
      ctx.lineTo(0.43 * R, shortsTop);
      ctx.closePath();
    };
    const shortsGrad = ctx.createLinearGradient(-0.48 * R, 0, 0.44 * R, 0);
    shortsGrad.addColorStop(0, shade(team.shorts, 0.16));
    shortsGrad.addColorStop(0.62, team.shorts);
    shortsGrad.addColorStop(1, shade(team.shorts, -0.2));
    shortsPath();
    ctx.fillStyle = shortsGrad;
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1.4, R * 0.026);
    ctx.stroke();
    // franja lateral, en el color del ribete: de perfil es justo la cara que
    // da a la cámara, así que se ve entera
    ctx.save();
    shortsPath();
    ctx.clip();
    ctx.fillStyle = team.trim ?? '#f4f2e8';
    ctx.globalAlpha = 0.88;
    ctx.fillRect(0.25 * R, shortsTop, 0.05 * R, shortsBot - shortsTop + 0.04 * R);
    ctx.restore();

    // ---- camiseta ----
    // De perfil, mirando a +x. Lo que la hace «de lado» y no un peto de
    // frente: la manga asoma por delante del pecho (el escalón del hombro),
    // el pecho sobresale, la espalda cae por detrás y el ruedo se abre sobre
    // la cadera. Nada simétrico.
    const jerseyPath = (): void => {
      ctx.beginPath();
      ctx.moveTo(0.10 * R, collar - 0.02 * R); // cuello, borde delantero
      // hombro: cae redondeado, sin pico de manga que parezca un brazo
      ctx.bezierCurveTo(0.3 * R, collar - 0.005 * R, 0.41 * R, collar + 0.05 * R, 0.44 * R, collar + 0.15 * R);
      // costado del pecho: el punto más ancho, y de ahí al ruedo se angosta
      ctx.bezierCurveTo(0.46 * R, collar + 0.3 * R, 0.45 * R, hem - 0.12 * R, 0.42 * R, hem + 0.01 * R);
      // ruedo
      ctx.bezierCurveTo(0.24 * R, hem + 0.05 * R, -0.2 * R, hem + 0.05 * R, -0.39 * R, hem + 0.01 * R);
      // espalda
      ctx.bezierCurveTo(-0.46 * R, hem - 0.1 * R, -0.49 * R, collar + 0.32 * R, -0.42 * R, collar + 0.17 * R);
      // trapecio hasta la nuca
      ctx.bezierCurveTo(-0.33 * R, collar + 0.04 * R, -0.21 * R, collar - 0.01 * R, -0.14 * R, collar - 0.02 * R);
      ctx.closePath();
    };

    ctx.save();
    jerseyPath();
    ctx.clip();
    ctx.fillStyle = team.jersey;
    ctx.fillRect(-0.6 * R, collar - 0.04 * R, 1.28 * R, hem - collar + 0.14 * R);
    this.paintKit(team, -0.6 * R, collar, 1.28 * R, hem + 0.06 * R - collar, R);
    // sombra del mentón sobre el pecho
    const cuelloSombra = ctx.createLinearGradient(0, collar, 0, collar + 0.24 * R);
    cuelloSombra.addColorStop(0, 'rgba(0, 0, 0, 0.34)');
    cuelloSombra.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = cuelloSombra;
    ctx.fillRect(-0.6 * R, collar - 0.04 * R, 1.28 * R, 0.28 * R);
    // la espalda, lejos de la luz, queda en sombra
    const ladoSombra = ctx.createLinearGradient(0.1 * R, 0, -0.58 * R, 0);
    ladoSombra.addColorStop(0, 'rgba(0, 0, 0, 0)');
    ladoSombra.addColorStop(1, 'rgba(0, 0, 0, 0.32)');
    ctx.fillStyle = ladoSombra;
    ctx.fillRect(-0.6 * R, collar - 0.04 * R, 1.28 * R, hem - collar + 0.14 * R);
    // luz del pecho: es la cara que da al frente
    const pechoLuz = ctx.createLinearGradient(0.18 * R, 0, 0.58 * R, 0);
    pechoLuz.addColorStop(0, 'rgba(255, 255, 255, 0)');
    pechoLuz.addColorStop(1, 'rgba(255, 255, 255, 0.16)');
    ctx.fillStyle = pechoLuz;
    ctx.fillRect(-0.6 * R, collar - 0.04 * R, 1.28 * R, hem - collar + 0.14 * R);
    // ribete del ruedo: sigue la línea de abajo y no se sube por la manga
    ctx.strokeStyle = team.trim ?? team.socks;
    ctx.lineWidth = Math.max(1.4, R * 0.042);
    ctx.beginPath();
    ctx.moveTo(0.38 * R, hem + 0.01 * R);
    ctx.bezierCurveTo(0.24 * R, hem + 0.05 * R, -0.2 * R, hem + 0.05 * R, -0.39 * R, hem + 0.01 * R);
    ctx.stroke();

    // costura de la espalda: una línea vertical que remata el volumen
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.lineWidth = Math.max(1, R * 0.016);
    ctx.beginPath();
    ctx.moveTo(-0.35 * R, collar + 0.18 * R);
    ctx.quadraticCurveTo(-0.4 * R, hem - 0.2 * R, -0.42 * R, hem + 0.02 * R);
    ctx.stroke();
    ctx.restore();

    jerseyPath();
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1.4, R * 0.028);
    ctx.stroke();

    // cuello: en perfil se ve el aro por delante y por detrás del cuello
    ctx.strokeStyle = team.trim ?? team.socks;
    ctx.lineWidth = Math.max(1.5, R * 0.026);
    ctx.beginPath();
    ctx.moveTo(0.11 * R, collar - 0.01 * R);
    ctx.quadraticCurveTo(0.0 * R, collar + 0.14 * R, -0.15 * R, collar - 0.01 * R);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Botín de respaldo: el de vectores de siempre, para los primeros cuadros
   * (los dibujos todavía no cargaron) y por si un archivo falta.
   */
  private dibujarBotaVector(team: Kit, bx: number, by: number, rot: number): void {
    const ctx = this.ctx;
    const u = this.view.scale * 0.62;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(rot);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
    ctx.beginPath();
    ctx.ellipse(0.08 * u, 0.004 * u, 0.34 * u, 0.045 * u, 0, 0, Math.PI * 2);
    ctx.fill();

    // tapones
    ctx.fillStyle = '#0c0b09';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse((-0.14 + i * 0.13) * u, 0.004 * u, 0.022 * u, 0.012 * u, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // suela
    ctx.fillStyle = '#242019';
    ctx.beginPath();
    ctx.moveTo(-0.2 * u, -0.02 * u);
    ctx.quadraticCurveTo(-0.22 * u, -0.07 * u, -0.14 * u, -0.075 * u);
    ctx.lineTo(0.36 * u, -0.075 * u);
    ctx.quadraticCurveTo(0.42 * u, -0.075 * u, 0.42 * u, -0.035 * u);
    ctx.lineTo(0.42 * u, -0.012 * u);
    ctx.quadraticCurveTo(0.22 * u, 0.008 * u, -0.14 * u, 0.008 * u);
    ctx.quadraticCurveTo(-0.2 * u, 0.008 * u, -0.2 * u, -0.02 * u);
    ctx.closePath();
    ctx.fill();

    // cuerpo
    const upper = ctx.createLinearGradient(0, -0.36 * u, 0, -0.02 * u);
    upper.addColorStop(0, '#3d3830');
    upper.addColorStop(0.5, '#1d1a16');
    upper.addColorStop(1, '#0c0b09');
    ctx.fillStyle = upper;
    ctx.beginPath();
    ctx.moveTo(-0.18 * u, -0.075 * u);
    ctx.quadraticCurveTo(-0.22 * u, -0.2 * u, -0.16 * u, -0.27 * u);
    ctx.quadraticCurveTo(-0.1 * u, -0.35 * u, 0 * u, -0.36 * u);
    ctx.quadraticCurveTo(0.08 * u, -0.37 * u, 0.13 * u, -0.3 * u);
    ctx.quadraticCurveTo(0.22 * u, -0.22 * u, 0.3 * u, -0.15 * u);
    ctx.quadraticCurveTo(0.4 * u, -0.1 * u, 0.42 * u, -0.075 * u);
    ctx.closePath();
    ctx.fill();

    // cordones
    ctx.strokeStyle = 'rgba(240, 238, 228, 0.6)';
    ctx.lineWidth = Math.max(1, 0.012 * u);
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const t = i / 2;
      ctx.beginPath();
      ctx.moveTo((0.0 + t * 0.06) * u, (-0.29 + t * 0.02) * u);
      ctx.lineTo((0.09 + t * 0.06) * u, (-0.22 + t * 0.03) * u);
      ctx.stroke();
    }

    // tres franjas del equipo en el talón
    ctx.fillStyle = team.trim ?? '#f6f4ec';
    for (let i = 0; i < 3; i++) {
      const ox = (-0.15 + i * 0.06) * u;
      ctx.beginPath();
      ctx.moveTo(ox, -0.26 * u);
      ctx.lineTo(ox + 0.036 * u, -0.24 * u);
      ctx.lineTo(ox + 0.016 * u, -0.09 * u);
      ctx.lineTo(ox - 0.02 * u, -0.105 * u);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  private drawCharge(p: Player): void {
    if (!p.charging || p.charge < 0.02) return;
    const ctx = this.ctx;
    const s = this.view.scale;
    const frac = clamp(p.charge / PLAYER.maxCharge, 0, 1);
    const level = p.charge < PLAYER.chargeTap ? 1 : p.charge < PLAYER.chargeMid ? 2 : 3;
    const color = level === 3 ? THEME.danger : level === 2 ? THEME.gold : THEME.accent;

    const w = 1.42 * s;
    const h = Math.max(6, 0.15 * s);
    const cx = this.sx(p.x);
    const x = cx - w / 2;
    const y = this.sy(p.y + PLAYER.headY + PLAYER.headR) - h - 0.5 * s;

    ctx.save();
    ctx.fillStyle = 'rgba(3, 9, 18, 0.6)';
    this.roundRect(ctx, x - 2, y - 2, w + 4, h + 4, (h + 4) / 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    this.roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();

    ctx.fillStyle = color;
    this.roundRect(ctx, x, y, Math.max(h, w * frac), h, h / 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = Math.max(1, s * 0.016);
    for (const t of [PLAYER.chargeTap / PLAYER.maxCharge, PLAYER.chargeMid / PLAYER.maxCharge]) {
      const mx = x + w * t;
      ctx.beginPath();
      ctx.moveTo(mx, y - 1);
      ctx.lineTo(mx, y + h + 1);
      ctx.stroke();
    }

    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < level ? color : 'rgba(255,255,255,0.16)';
      ctx.beginPath();
      ctx.arc(cx + (i - 1) * h * 1.7, y - h * 1.15, h * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }
}

// ------------------------------------------------------------------ colores

function darken(hex: string, amount: number): string {
  return shade(hex, -amount);
}

function darker(hex: string): string {
  return shade(hex, -0.18);
}

function lighten(hex: string, amount: number): string {
  return shade(hex, amount);
}

function shade(hex: string, amount: number): string {
  const n = hex.replace('#', '');
  const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n;
  const num = parseInt(full.slice(0, 6), 16);
  let r = (num >> 16) & 255;
  let g = (num >> 8) & 255;
  let b = num & 255;
  if (amount >= 0) {
    r = Math.round(r + (255 - r) * amount);
    g = Math.round(g + (255 - g) * amount);
    b = Math.round(b + (255 - b) * amount);
  } else {
    const k = 1 + amount;
    r = Math.round(r * k);
    g = Math.round(g * k);
    b = Math.round(b * k);
  }
  return `rgb(${r}, ${g}, ${b})`;
}
