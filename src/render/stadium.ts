/**
 * Estadio ilustrado: dibuja el fondo completo en un canvas aparte.
 * Todo es vectorial para que escale a cualquier resolución sin assets.
 */

import { GOAL } from '../sim/config.ts';

export interface Projector {
  sx(x: number): number;
  sy(y: number): number;
  scale: number;
  w: number;
  h: number;
  pad: number;
}

export interface Head {
  x: number;
  y: number;
  r: number;
  skin: string;
  shirt: string;
  tone: number;
}

const SKINS = ['#f0cfa9', '#e5bb90', '#d3a173', '#b9814f', '#8f5b36', '#6d4326', '#f7ddc0'];
const SHIRTS = [
  '#3a4152',
  '#4a4f5c',
  '#5d5748',
  '#6e6455',
  '#33414a',
  '#45404f',
  '#7a7263',
  '#2b3340',
];

function rngFactory(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const STANDS = {
  barrierTop: 1.06,
  barrierBottom: 0.55,
  ledTop: 1.68,
  ledBottom: 1.06,
  lowerTop: 4.35,
  lowerBottom: 1.68,
  upperTop: 7.45,
  upperBottom: 4.6,
  roofTop: 11.4,
  roofBottom: 7.45,
  width: 18,
} as const;

export function standTopFor(groundY: number, scale: number): number {
  const topWorld = groundY / scale;
  const roofBand = Math.min(2.9, Math.max(1.7, topWorld * 0.2));
  return topWorld - roofBand;
}

export function buildCrowd(width: number, accents: string[] = [], standTop = 9.4): Head[] {
  const rng = rngFactory(20260611);
  const heads: Head[] = [];
  const palette = accents.length > 0 ? accents : ['#2f5fa8', '#c23b2e'];
  const tiers: [number, number, number][] = [
    [STANDS.lowerBottom + 0.06, STANDS.lowerTop - 0.1, 0.205],
    [STANDS.upperBottom + 0.06, Math.max(STANDS.upperBottom + 0.6, standTop - 0.12), 0.22],
  ];
  for (const [from, to, step] of tiers) {
    for (let y = from; y <= to; y += step) {
      const density = 0.19 + (y - from) * 0.004;
      for (let x = -0.6; x < width + 0.6; x += density) {
        // pasillos verticales
        const aisle = Math.abs(((x % 4.1) + 4.1) % 4.1);
        if (aisle < 0.24) continue;
        const roll = rng();
        if (roll < 0.06) continue;
        const tone = rng();
        const pick = rng();
        // Más camisetas con los colores de los dos equipos: la grada cambia
        // según quién juega y se lee de un vistazo a quién apoya.
        const shirt =
          pick < 0.24
            ? palette[0]!
            : pick < 0.46
              ? palette[palette.length - 1]!
              : SHIRTS[Math.floor(rng() * SHIRTS.length)]!;
        heads.push({
          x: x + (rng() - 0.5) * 0.06,
          y: y + (rng() - 0.5) * 0.05,
          r: 0.062 + rng() * 0.018,
          skin: SKINS[Math.floor(rng() * SKINS.length)]!,
          shirt,
          tone,
        });
      }
    }
  }
  return heads;
}

export function drawStadium(ctx: CanvasRenderingContext2D, p: Projector, crowd: Head[]): void {
  const { sx, sy, scale, w, h, pad } = p;
  const standTop = standTopFor(sy(0), scale);

  // ------------------------------------------------------------- cielo/techo
  const roof = ctx.createLinearGradient(0, -pad, 0, sy(standTop));
  roof.addColorStop(0, '#050604');
  roof.addColorStop(0.5, '#0b0d08');
  roof.addColorStop(1, '#171b11');
  ctx.fillStyle = roof;
  ctx.fillRect(-pad, -pad, w + pad * 2, sy(standTop) + pad);

  // cerchas del techo: cordones y diagonales de acero rojo
  const truss = 'rgba(154, 68, 48, 0.6)';
  const trussSoft = 'rgba(154, 68, 48, 0.26)';
  const chords = [standTop + 1.85, standTop + 1.0, standTop + 0.15];
  ctx.lineWidth = Math.max(1.2, scale * 0.032);
  for (const y of chords) {
    ctx.strokeStyle = truss;
    ctx.beginPath();
    ctx.moveTo(-pad, sy(y));
    ctx.lineTo(w + pad, sy(y));
    ctx.stroke();
  }
  ctx.strokeStyle = trussSoft;
  for (let x = -2; x < 26; x += 2.4) {
    ctx.beginPath();
    ctx.moveTo(sx(x), sy(chords[2]!));
    ctx.lineTo(sx(x + 1.1), sy(chords[0]!));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx(x + 1.1), sy(chords[2]!));
    ctx.lineTo(sx(x), sy(chords[0]!));
    ctx.stroke();
  }

  // borde de la cubierta
  ctx.fillStyle = '#0a0c07';
  ctx.fillRect(-pad, sy(standTop), w + pad * 2, Math.max(2, scale * 0.3));
  ctx.fillStyle = 'rgba(196, 168, 132, 0.16)';
  ctx.fillRect(-pad, sy(standTop), w + pad * 2, Math.max(1, scale * 0.018));

  // luminarias colgadas
  for (const lx of [3.6, 12, 20.4]) {
    const x = sx(lx);
    const y = sy(standTop + 0.95);
    const halo = ctx.createRadialGradient(x, y, 0, x, y, scale * 2.6);
    halo.addColorStop(0, 'rgba(255, 246, 214, 0.3)');
    halo.addColorStop(0.42, 'rgba(255, 236, 180, 0.08)');
    halo.addColorStop(1, 'rgba(255, 236, 180, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(x - scale * 2.6, y - scale * 2.6, scale * 5.2, scale * 5.2);

    ctx.strokeStyle = 'rgba(190, 170, 140, 0.35)';
    ctx.lineWidth = Math.max(1, scale * 0.016);
    ctx.beginPath();
    ctx.moveTo(x - scale * 0.6, y - scale * 0.1);
    ctx.lineTo(x - scale * 0.6, sy(standTop + 2.4));
    ctx.moveTo(x + scale * 0.6, y - scale * 0.1);
    ctx.lineTo(x + scale * 0.6, sy(standTop + 2.4));
    ctx.stroke();

    ctx.fillStyle = '#1d2317';
    ctx.fillRect(x - scale * 0.95, y - scale * 0.07, scale * 1.9, scale * 0.14);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = '#fff8dc';
      ctx.beginPath();
      ctx.arc(x - scale * 0.7 + i * scale * 0.47, y, scale * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --------------------------------------------------------------- graderíos
  const standBg = ctx.createLinearGradient(0, sy(standTop), 0, sy(STANDS.barrierTop));
  standBg.addColorStop(0, '#171c12');
  standBg.addColorStop(0.45, '#242b1b');
  standBg.addColorStop(1, '#1c2115');
  ctx.fillStyle = standBg;
  ctx.fillRect(-pad, sy(standTop), w + pad * 2, sy(standTop) - sy(STANDS.barrierTop));

  // peldaños
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.lineWidth = Math.max(1, scale * 0.022);
  for (let y = STANDS.lowerBottom; y < standTop; y += 0.19) {
    ctx.beginPath();
    ctx.moveTo(-pad, sy(y));
    ctx.lineTo(w + pad, sy(y));
    ctx.stroke();
  }

  // pasillos
  for (let x = 0; x < STANDS.width + 2; x += 4.1) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(sx(x) - scale * 0.12, sy(standTop), scale * 0.24, sy(standTop) - sy(STANDS.barrierTop));
  }

  // público
  for (const head of crowd) {
    const x = sx(head.x);
    const y = sy(head.y);
    const r = Math.max(0.8, head.r * scale);
    const dim = 0.34 + head.tone * 0.22;
    ctx.globalAlpha = dim;
    // hombros
    ctx.fillStyle = head.shirt;
    ctx.beginPath();
    ctx.ellipse(x, y + r * 1.45, r * 1.5, r * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    // cabeza
    ctx.fillStyle = head.skin;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // pelo
    ctx.fillStyle = head.tone > 0.6 ? 'rgba(30,20,14,0.55)' : 'rgba(60,40,24,0.45)';
    ctx.beginPath();
    ctx.arc(x, y - r * 0.18, r * 0.92, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // neblina sobre la grada: baja el contraste y evita el efecto "muro de puntos"
  const haze = ctx.createLinearGradient(0, sy(standTop), 0, sy(STANDS.barrierTop));
  haze.addColorStop(0, 'rgba(20, 26, 18, 0.4)');
  haze.addColorStop(0.55, 'rgba(20, 26, 18, 0.26)');
  haze.addColorStop(1, 'rgba(20, 26, 18, 0.34)');
  ctx.fillStyle = haze;
  ctx.fillRect(-pad, sy(standTop), w + pad * 2, sy(standTop) - sy(STANDS.barrierTop));

  // sombra de la cubierta sobre el graderío
  const shade = ctx.createLinearGradient(0, sy(standTop), 0, sy(STANDS.lowerBottom));
  shade.addColorStop(0, 'rgba(6, 8, 5, 0.82)');
  shade.addColorStop(0.45, 'rgba(8, 10, 6, 0.34)');
  shade.addColorStop(1, 'rgba(8, 10, 6, 0.55)');
  ctx.fillStyle = shade;
  ctx.fillRect(-pad, sy(standTop), w + pad * 2, sy(standTop) - sy(STANDS.lowerBottom));

  ctx.fillStyle = 'rgba(12, 16, 12, 0.22)';
  ctx.fillRect(-pad, sy(standTop), w + pad * 2, sy(STANDS.lowerBottom) - sy(standTop));

  // barandas entre pisos
  for (const y of [STANDS.lowerTop, standTop]) {
    ctx.fillStyle = 'rgba(12, 14, 9, 0.85)';
    ctx.fillRect(-pad, sy(y), w + pad * 2, Math.max(2, scale * 0.1));
    ctx.fillStyle = 'rgba(200, 210, 180, 0.14)';
    ctx.fillRect(-pad, sy(y), w + pad * 2, 1);
  }

  // -------------------------------------------------------------- listón LED
  const ledTop = sy(STANDS.ledTop);
  const ledBottom = sy(STANDS.ledBottom);
  ctx.fillStyle = '#080a06';
  ctx.fillRect(-pad, ledTop, w + pad * 2, ledBottom - ledTop);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fillRect(-pad, ledTop, w + pad * 2, 1);

  const ledH = ledBottom - ledTop;
  ctx.font = `700 ${Math.max(7, ledH * 0.46)}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = 'middle';
  const messages = ['VANTAGGIO', 'MUNDIAL 2026', 'FÚTBOL 1 VS 1'];
  const colors = ['#f2efe0', '#ffb347', '#9fd8a8'];
  let msg = 0;
  let cursor = -pad;
  while (cursor < w + pad) {
    const text = messages[msg % messages.length]!;
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = colors[msg % colors.length]!;
    ctx.globalAlpha = 0.9;
    ctx.fillText(text, cursor, (ledTop + ledBottom) / 2);
    cursor += tw + scale * 1.1;
    msg += 1;
  }
  ctx.globalAlpha = 1;

  // ---------------------------------------------------------------- valla
  const barTop = sy(STANDS.barrierTop);
  const barBottom = sy(STANDS.barrierBottom);
  const bar = ctx.createLinearGradient(0, barTop, 0, barBottom);
  bar.addColorStop(0, '#5d2019');
  bar.addColorStop(0.35, '#8a2f22');
  bar.addColorStop(1, '#3d160f');
  ctx.fillStyle = bar;
  ctx.fillRect(-pad, barTop, w + pad * 2, barBottom - barTop);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.fillRect(-pad, barTop, w + pad * 2, Math.max(1.5, scale * 0.035));

  ctx.font = `700 ${Math.max(6, (barBottom - barTop) * 0.38)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255, 226, 206, 0.26)';
  for (let x = -1; x < STANDS.width + 2; x += 3.2) {
    ctx.fillText('VANTAGGIO', sx(x), (barTop + barBottom) / 2 + 0.5);
  }

  // ---------------------------------------------------------------- césped
  const grassTop = sy(0);
  const grassBottom = h + pad;

  // El borde inferior de la valla queda por encima del césped (para que no tape
  // los pies de los jugadores) y ese hueco se veía como una franja negra: el
  // "piso roto" que se notaba en el centro del campo. Se rellena con el pasto
  // en sombra de detrás del cartel.
  {
    const gapTop = sy(STANDS.barrierBottom);
    const gap = ctx.createLinearGradient(0, gapTop, 0, grassTop);
    gap.addColorStop(0, '#151b11');
    gap.addColorStop(0.55, '#1d3a24');
    gap.addColorStop(1, '#2a6b3d');
    ctx.fillStyle = gap;
    ctx.fillRect(-pad, gapTop, w + pad * 2, Math.max(0, grassTop - gapTop) + 1);
  }
  const pitch = ctx.createLinearGradient(0, grassTop, 0, grassBottom);
  pitch.addColorStop(0, '#3a9455');
  pitch.addColorStop(0.16, '#2e8248');
  pitch.addColorStop(0.6, '#226b39');
  pitch.addColorStop(1, '#164a27');
  ctx.fillStyle = pitch;
  ctx.fillRect(-pad, grassTop, w + pad * 2, grassBottom - grassTop);

  // Franjas de corte en perspectiva: cada banda es más alta que la anterior
  // (más cerca de la cámara). Antes eran nueve franjas de menos de un metro
  // pegadas al horizonte y el césped se veía como una alfombra lisa.
  {
    const grassH = grassBottom - grassTop;
    const bands = 14;
    const weights: number[] = [];
    for (let i = 0; i < bands; i++) weights.push(0.55 + Math.pow(i / (bands - 1), 1.75) * 2.6);
    const sum = weights.reduce((a, b) => a + b, 0);
    let y = grassTop;
    for (let i = 0; i < bands; i++) {
      const bh = (weights[i]! / sum) * grassH;
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(-pad, y, w + pad * 2, bh + 0.6);
      }
      y += bh;
    }
  }

  // Textura: manchas, briznas y calvas. El césped de un estadio no es un plano
  // verde perfecto; tiene zonas pisadas y sombras.
  {
    const grassH = grassBottom - grassTop;
    const rnd = rngFactory(90210);
    for (let i = 0; i < 240; i++) {
      const t = rnd();
      const gy = grassTop + grassH * (0.04 + Math.pow(t, 0.72) * 0.96);
      const depth = (gy - grassTop) / Math.max(1, grassH);
      const gx = rnd() * (w + pad * 2) - pad;
      const rw = scale * (0.18 + depth * 1.15) * (0.5 + rnd());
      const rh = rw * (0.09 + depth * 0.13);
      ctx.fillStyle = rnd() > 0.5 ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.055)';
      ctx.beginPath();
      ctx.ellipse(gx, gy, rw, rh, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Calvas en las dos áreas pequeñas y en el punto penal.
    for (const wx of [GOAL.lineLeft + 1.2, GOAL.lineRight - 1.2]) {
      const gx = sx(wx);
      const wear = ctx.createRadialGradient(gx, grassTop + grassH * 0.16, 0, gx, grassTop + grassH * 0.16, scale * 1.15);
      wear.addColorStop(0, 'rgba(120, 96, 48, 0.22)');
      wear.addColorStop(1, 'rgba(120, 96, 48, 0)');
      ctx.fillStyle = wear;
      ctx.beginPath();
      ctx.ellipse(gx, grassTop + grassH * 0.16, scale * 1.15, scale * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Luz del estadio: un poco más claro en el centro y oscuro en los bordes,
  // sin lavar las franjas de corte.
  {
    const light = ctx.createRadialGradient(w / 2, grassTop + (grassBottom - grassTop) * 0.35, 0, w / 2, grassTop, Math.max(w, grassBottom - grassTop) * 0.8);
    light.addColorStop(0, 'rgba(255, 252, 214, 0.06)');
    light.addColorStop(0.65, 'rgba(255, 252, 214, 0.015)');
    light.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
    ctx.fillStyle = light;
    ctx.fillRect(-pad, grassTop, w + pad * 2, grassBottom - grassTop);
  }

  // línea de banda y brillo del horizonte
  ctx.fillStyle = 'rgba(236, 255, 246, 0.85)';
  ctx.fillRect(-pad, grassTop - Math.max(1, scale * 0.025), w + pad * 2, Math.max(1.5, scale * 0.025));

  const glow = ctx.createLinearGradient(0, grassTop - scale * 0.5, 0, grassTop + scale * 0.3);
  glow.addColorStop(0, 'rgba(255, 240, 190, 0.16)');
  glow.addColorStop(1, 'rgba(255, 240, 190, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-pad, grassTop - scale * 0.5, w + pad * 2, scale * 0.8);

  // Línea de medio campo y círculo central. El círculo estaba centrado sobre
  // la línea de banda (media elipse fuera del césped) y la línea era un muñón;
  // ahora los dos viven dentro del pasto, con la elipse achatada en
  // perspectiva.
  {
    const cx = w * 0.5;
    const cy = grassTop + scale * 0.3;
    const rx = scale * 0.78;
    const ry = scale * 0.19;
    ctx.strokeStyle = 'rgba(236, 255, 246, 0.5)';
    ctx.lineWidth = Math.max(1.2, scale * 0.03);
    // la línea baja desde el borde del campo y se pierde al acercarse
    const mid = ctx.createLinearGradient(0, grassTop, 0, grassTop + scale * 1.15);
    mid.addColorStop(0, 'rgba(236, 255, 246, 0.55)');
    mid.addColorStop(1, 'rgba(236, 255, 246, 0.08)');
    ctx.strokeStyle = mid;
    ctx.beginPath();
    ctx.moveTo(cx, grassTop);
    ctx.lineTo(cx, grassTop + scale * 1.15);
    ctx.stroke();
    // círculo central completo, siempre por debajo de la línea de banda
    ctx.strokeStyle = 'rgba(236, 255, 246, 0.46)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    // punto central
    ctx.fillStyle = 'rgba(236, 255, 246, 0.62)';
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(1.2, scale * 0.035), 0, Math.PI * 2);
    ctx.fill();
  }

  // Sombra de la valla sobre el pasto: corta y suave. Antes era una franja
  // negra de 20 cm que cruzaba el círculo central y parecía un escalón.
  const vshadow = ctx.createLinearGradient(0, grassTop, 0, grassTop + scale * 0.09);
  vshadow.addColorStop(0, 'rgba(0, 0, 0, 0.26)');
  vshadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = vshadow;
  ctx.fillRect(-pad, grassTop, w + pad * 2, scale * 0.09);

  // ------------------------------------------------------------------ arcos
  drawGoal(ctx, p, -1);
  drawGoal(ctx, p, 1);

  // viñeta
  const vig = ctx.createRadialGradient(w / 2, h * 0.48, h * 0.24, w / 2, h * 0.52, w * 0.78);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(0, 0, 0, 0.46)');
  ctx.fillStyle = vig;
  ctx.fillRect(-pad, -pad, w + pad * 2, h + pad * 2);
}

// ------------------------------------------------------- público animado

/** Subconjunto del graderío que se anima en cada cuadro (el resto va horneado). */
export function crowdMovers(heads: Head[]): Head[] {
  return heads.filter((_, i) => i % 8 === 0);
}

/** Oscurece un color para que el público animado se funda con el horneado. */
function dim(hex: string, k: number): string {
  const n = hex.replace('#', '');
  const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n;
  const num = parseInt(full.slice(0, 6), 16);
  const r = Math.round(((num >> 16) & 255) * k);
  const g = Math.round(((num >> 8) & 255) * k);
  const b = Math.round((num & 255) * k);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Hinchada viva: una parte del público salta, levanta los brazos y hace la ola.
 * Sin esto la grada era una foto fija y el estadio se sentía muerto.
 */
export function drawCrowdLive(
  ctx: CanvasRenderingContext2D,
  p: Projector,
  movers: Head[],
  time: number,
  flags: string[] = [],
): void {
  const { sx, sy, scale } = p;
  const wave = ((time * 0.16) % 1.7) - 0.35;
  const waveW = 0.11;

  for (let i = 0; i < movers.length; i++) {
    const head = movers[i]!;
    const x = sx(head.x);
    const y = sy(head.y);
    const r = Math.max(0.9, head.r * scale);
    const u = head.x / STANDS.width;
    const d = Math.abs(u - wave);
    const inWave = d < waveW ? 1 - d / waveW : 0;

    const phase = (i * 1.7) % (Math.PI * 2);
    const bob = Math.sin(time * 3.1 + phase) * 0.5 + 0.5;
    const jump = r * (bob * 0.42 + inWave * 1.5);
    // Un poco más apagados que el fondo horneado: la capa animada se dibuja
    // después de la neblina, y sin esto los que saltan brillaban de más.
    const base = (0.34 + head.tone * 0.2) * 0.74;
    const shirt = dim(head.shirt, 0.66);
    const skin = dim(head.skin, 0.64);

    ctx.globalAlpha = base;
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.ellipse(x, y + r * 1.45 - jump, r * 1.5, r * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    if (inWave > 0.05 || bob > 0.86) {
      const lift = r * (0.5 + inWave * 0.9);
      ctx.strokeStyle = skin;
      ctx.lineWidth = Math.max(1, r * 0.42);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - r * 1.1, y - jump + r * 0.2);
      ctx.lineTo(x - r * 1.35, y - jump - lift);
      ctx.moveTo(x + r * 1.1, y - jump + r * 0.2);
      ctx.lineTo(x + r * 1.35, y - jump - lift);
      ctx.stroke();
    }
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(x, y - jump, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(30,22,14,0.55)';
    ctx.beginPath();
    ctx.arc(x, y - jump - r * 0.18, r * 0.92, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
  }

  // Banderas de las dos selecciones que están jugando. Se usan las banderas
  // reales (emoji) colgadas de las barandas, en posiciones fijas y alternas:
  // antes eran ocho rectángulos de rayas flotando a cualquier altura, que
  // parecían papeles pegados en la grada.
  if (flags.length > 0) {
    const spots: [number, number][] = [
      [1.7, STANDS.lowerTop],
      [4.6, STANDS.upperBottom + 0.35],
      [7.3, STANDS.lowerTop],
      [10.4, STANDS.lowerTop],
      [13.1, STANDS.upperBottom + 0.35],
      [16.1, STANDS.lowerTop],
    ];
    const size = Math.max(16, p.scale * 0.55);
    ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (let i = 0; i < spots.length; i++) {
      const flag = flags[i % flags.length]!;
      const [wx, wy] = spots[i]!;
      const x = sx(wx);
      const y = sy(wy) - p.scale * 0.34;
      // mástil corto desde la baranda
      ctx.strokeStyle = 'rgba(10, 12, 8, 0.7)';
      ctx.lineWidth = Math.max(1, p.scale * 0.022);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + p.scale * 0.74);
      ctx.stroke();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(time * 1.5 + i * 1.7) * 0.07);
      ctx.globalAlpha = 0.92;
      ctx.fillText(flag, 0, 0);
      ctx.restore();
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
  }
  ctx.globalAlpha = 1;
}

function goalGeom(p: Projector, side: -1 | 1) {
  const { sx, sy, scale } = p;
  const line = side === 1 ? GOAL.lineRight : GOAL.lineLeft;
  const back = line + side * GOAL.depth;
  const height = GOAL.height;
  const xFront = sx(line);
  const xBack = sx(back);
  return {
    side,
    line,
    back,
    height,
    xFront,
    xBack,
    xLo: Math.min(xFront, xBack),
    xHi: Math.max(xFront, xBack),
    top: sy(height),
    bottom: sy(0),
    post: Math.max(3, GOAL.bar * scale),
    scale,
  };
}

type GoalGeom = ReturnType<typeof goalGeom>;

/** Malla de la red: rombos con algo de caída, no un cuadro plano. */
function paintNet(ctx: CanvasRenderingContext2D, g: GoalGeom, alpha: number): void {
  const { xLo, xHi, top, bottom, scale, side } = g;
  const spanX = xHi - xLo;
  const spanY = bottom - top;
  const cell = Math.max(7, scale * 0.2);

  ctx.save();
  ctx.beginPath();
  ctx.rect(xLo, top, spanX, spanY);
  ctx.clip();

  // diagonales en las dos direcciones: el rombo clásico de una red
  ctx.lineWidth = Math.max(0.8, scale * 0.0095);
  for (const dir of [1, -1]) {
    ctx.strokeStyle = `rgba(246, 252, 246, ${0.3 * alpha})`;
    for (let x = xLo - spanY; x < xHi + spanY; x += cell * 1.55) {
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x + dir * spanY, bottom);
      ctx.stroke();
    }
  }

  // cordeles verticales que caen con una leve comba
  ctx.strokeStyle = `rgba(240, 250, 240, ${0.16 * alpha})`;
  for (let x = xLo + cell * 0.5; x < xHi; x += cell * 1.55) {
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.quadraticCurveTo(x - side * cell * 0.22, (top + bottom) / 2, x, bottom);
    ctx.stroke();
  }

  // costuras horizontales con caída: la red cuelga, no está tensa
  ctx.strokeStyle = `rgba(240, 250, 240, ${0.15 * alpha})`;
  for (let y = top + cell; y < bottom; y += cell * 1.55) {
    const sag = cell * 0.26;
    ctx.beginPath();
    ctx.moveTo(xLo, y);
    ctx.quadraticCurveTo((xLo + xHi) / 2, y + sag, xHi, y);
    ctx.stroke();
  }
  ctx.restore();
}

/** Postes y travesaño: cápsulas con brillo, contorno y sombra de apoyo. */
function paintFrame(ctx: CanvasRenderingContext2D, g: GoalGeom): void {
  const { xFront, xBack, xLo, xHi, top, bottom, post, side, scale } = g;
  const r = post / 2;

  // travesaño: cápsula horizontal, con canto claro arriba y sombra abajo
  const rail = ctx.createLinearGradient(0, top - r, 0, top + r);
  rail.addColorStop(0, '#ffffff');
  rail.addColorStop(0.4, '#f4f7ee');
  rail.addColorStop(0.78, '#c6cfc1');
  rail.addColorStop(1, '#98a393');
  ctx.fillStyle = rail;
  ctx.beginPath();
  ctx.moveTo(xLo + r, top - r);
  ctx.lineTo(xHi - r, top - r);
  ctx.arc(xHi - r, top, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(xLo + r, top + r);
  ctx.arc(xLo + r, top, r, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(24, 32, 24, 0.5)';
  ctx.lineWidth = Math.max(1, scale * 0.012);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.beginPath();
  ctx.ellipse((xLo + xHi) / 2, top - r * 0.42, (xHi - xLo) / 2 - r * 1.1, r * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();

  // poste delantero: cápsula vertical con brillo lateral
  const front = ctx.createLinearGradient(xFront - r, 0, xFront + r, 0);
  front.addColorStop(0, '#aeb8a8');
  front.addColorStop(0.18, '#ffffff');
  front.addColorStop(0.52, '#f1f5ea');
  front.addColorStop(0.82, '#c2ccbc');
  front.addColorStop(1, '#95a090');
  ctx.fillStyle = front;
  ctx.beginPath();
  ctx.moveTo(xFront - r, top);
  ctx.lineTo(xFront - r, bottom - r);
  ctx.arc(xFront, bottom - r, r, Math.PI, 0, true);
  ctx.lineTo(xFront + r, top);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(24, 32, 24, 0.42)';
  ctx.lineWidth = Math.max(1, scale * 0.012);
  ctx.stroke();

  // poste trasero: más fino y en penumbra, para que el arco tenga fondo
  const br = r * 0.74;
  const back = ctx.createLinearGradient(xBack - br, 0, xBack + br, 0);
  back.addColorStop(0, '#6f7a6c');
  back.addColorStop(0.42, '#c3ccbb');
  back.addColorStop(1, '#79846f');
  ctx.fillStyle = back;
  ctx.beginPath();
  ctx.moveTo(xBack - br, top);
  ctx.lineTo(xBack - br, bottom - br * 0.6);
  ctx.arc(xBack, bottom - br * 0.6, br, Math.PI, 0, true);
  ctx.lineTo(xBack + br, top);
  ctx.closePath();
  ctx.fill();

  // sombra del travesaño sobre la red
  const barShadow = ctx.createLinearGradient(0, top + r, 0, top + r + scale * 0.16);
  barShadow.addColorStop(0, 'rgba(8, 12, 8, 0.45)');
  barShadow.addColorStop(1, 'rgba(8, 12, 8, 0)');
  ctx.fillStyle = barShadow;
  ctx.fillRect(g.xLo, top + r, g.xHi - g.xLo, scale * 0.16);

  // base: apoyo en el césped y línea de cal
  const base = ctx.createRadialGradient(xFront, bottom, 0, xFront, bottom, post * 4.2);
  base.addColorStop(0, 'rgba(0, 0, 0, 0.38)');
  base.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.ellipse(xFront + side * post * 0.5, bottom + post * 0.12, post * 3.6, post * 1.0, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(240, 250, 240, 0.5)';
  ctx.fillRect(xFront - post * 0.9, bottom - Math.max(1, scale * 0.02), post * 1.8, Math.max(1.4, scale * 0.028));
}

function drawGoal(ctx: CanvasRenderingContext2D, p: Projector, side: -1 | 1): void {
  const g = goalGeom(p, side);
  const { xFront, xBack, xLo, xHi, top, bottom, scale, side: dir } = g;

  // interior: entra luz por la boca y el fondo se apaga
  const interior = ctx.createLinearGradient(xFront, 0, xBack, 0);
  interior.addColorStop(0, 'rgba(228, 240, 230, 0.14)');
  interior.addColorStop(0.55, 'rgba(30, 44, 32, 0.42)');
  interior.addColorStop(1, 'rgba(6, 12, 8, 0.7)');
  ctx.fillStyle = interior;
  ctx.fillRect(xLo, top, xHi - xLo, bottom - top);

  paintNet(ctx, g, 1);

  // el pasto dentro del arco es más oscuro: da profundidad
  const floor = ctx.createLinearGradient(0, bottom - scale * 0.05, 0, bottom + 0);
  floor.addColorStop(0, 'rgba(0, 0, 0, 0)');
  floor.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
  ctx.fillStyle = floor;
  ctx.fillRect(xLo, bottom - scale * 0.05, xHi - xLo, scale * 0.05);
  void dir;

  paintFrame(ctx, g);
}

/**
 * Capa delantera del arco: se dibuja DESPUÉS del balón para que un balón dentro
 * de la red quede detrás del poste y de la malla, no flotando encima.
 */
export function drawGoalFront(ctx: CanvasRenderingContext2D, p: Projector, side: -1 | 1): void {
  const g = goalGeom(p, side);
  // Velo del interior: lo que está dentro de la red queda detrás de la malla,
  // un punto más oscuro y con menos color. Sin este velo el balón (y el jugador
  // que entra a despejar) se veían POR ENCIMA de la portería.
  const veil = ctx.createLinearGradient(0, g.top, 0, g.bottom);
  veil.addColorStop(0, 'rgba(6, 12, 8, 0.12)');
  veil.addColorStop(0.55, 'rgba(6, 12, 8, 0.3)');
  veil.addColorStop(1, 'rgba(6, 12, 8, 0.46)');
  ctx.fillStyle = veil;
  ctx.fillRect(g.xLo, g.top, g.xHi - g.xLo, g.bottom - g.top);
  // Malla delantera más marcada: es la que "tapa" a lo que hay dentro.
  paintNet(ctx, g, 1.35);
  paintFrame(ctx, g);
}

/**
 * Juego de luces del techo, tipo espectáculo de inauguración. Sustituye al
 * balón gigante que asomaba por arriba: el balón era un adorno estático y
 * tapaba media grada, así que ahora el techo tiene focos con haces que barren.
 *
 * Los haces se recortan por encima de la valla publicitaria: alumbran la grada
 * y el techo, nunca a los jugadores ni al césped.
 */
export function drawShowLights(ctx: CanvasRenderingContext2D, p: Projector, time: number): void {
  const { w, h, scale, pad, sy } = p;
  const rigY = Math.max(5, h * 0.01);
  const limitY = sy(STANDS.barrierTop);

  ctx.save();
  // Solo la grada y el techo.
  ctx.beginPath();
  ctx.rect(-pad, -pad, w + pad * 2, limitY + pad);
  ctx.clip();

  // Riel del que cuelgan los focos.
  ctx.fillStyle = 'rgba(14, 16, 11, 0.92)';
  ctx.fillRect(-pad, rigY, w + pad * 2, Math.max(2, scale * 0.055));
  ctx.fillStyle = 'rgba(196, 168, 132, 0.12)';
  ctx.fillRect(-pad, rigY, w + pad * 2, 1);

  const pods = [0.13, 0.31, 0.5, 0.69, 0.87];
  for (let i = 0; i < pods.length; i++) {
    const x = w * pods[i]!;
    const y = rigY + Math.max(2, scale * 0.04);
    // Barrido lento y desfasado: los haces no van todos a la vez.
    const phase = time * 0.32 + i * 1.7;
    const tilt = Math.sin(phase) * 0.36 + Math.sin(phase * 0.57 + i) * 0.09;
    const len = h * 0.7;
    const dx = Math.sin(tilt) * len;
    const bottomY = y + Math.cos(tilt) * len;
    const spread = scale * (0.9 + 0.16 * Math.sin(phase * 1.4));

    // Haz: dos triángulos concéntricos (halo ancho + núcleo) para que los
    // bordes no queden como una cuña de cartón.
    const cone = (halfW: number, alpha: number): void => {
      const beam = ctx.createLinearGradient(x, y, x + dx, bottomY);
      beam.addColorStop(0, `rgba(255, 248, 220, ${alpha})`);
      beam.addColorStop(0.4, `rgba(255, 240, 190, ${alpha * 0.36})`);
      beam.addColorStop(1, 'rgba(255, 236, 180, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(x - scale * 0.08, y);
      ctx.lineTo(x + scale * 0.08, y);
      ctx.lineTo(x + dx + halfW, bottomY);
      ctx.lineTo(x + dx - halfW, bottomY);
      ctx.closePath();
      ctx.fill();
    };
    cone(spread * 1.7, 0.1);
    cone(spread * 0.6, 0.16);

    // Carcasa del foco.
    ctx.fillStyle = '#1a1f15';
    ctx.beginPath();
    ctx.roundRect(x - scale * 0.3, y - scale * 0.16, scale * 0.6, scale * 0.32, scale * 0.08);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 132, 108, 0.5)';
    ctx.lineWidth = Math.max(1, scale * 0.014);
    ctx.stroke();

    // Lente encendida + destello.
    const lens = ctx.createRadialGradient(x, y + scale * 0.16, 0, x, y + scale * 0.16, scale * 0.34);
    lens.addColorStop(0, 'rgba(255, 255, 236, 0.95)');
    lens.addColorStop(0.45, 'rgba(255, 240, 180, 0.45)');
    lens.addColorStop(1, 'rgba(255, 236, 160, 0)');
    ctx.fillStyle = lens;
    ctx.fillRect(x - scale * 0.34, y - scale * 0.18, scale * 0.68, scale * 0.68);
    ctx.fillStyle = 'rgba(255, 252, 232, 0.9)';
    ctx.beginPath();
    ctx.ellipse(x, y + scale * 0.16, scale * 0.15, scale * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Luces de ambiente: puntos que titilan sobre la grada alta.
  for (let i = 0; i < 26; i++) {
    const px = ((i * 0.37 + 0.11) % 1) * w;
    const py = rigY + h * 0.04 + ((i * 0.53) % 1) * (limitY - rigY) * 0.55;
    const tw = 0.25 + 0.75 * Math.abs(Math.sin(time * (0.7 + (i % 5) * 0.13) + i));
    ctx.globalAlpha = tw * 0.35;
    ctx.fillStyle = i % 7 === 0 ? '#ffd9a0' : '#eef6ff';
    ctx.beginPath();
    ctx.arc(px, py, Math.max(0.8, scale * 0.02), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
