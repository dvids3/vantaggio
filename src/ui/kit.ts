/**
 * Kit de interfaz: helpers de DOM y arte de la interfaz.
 * Escudos y balones salen de `public/` (los archivos que aportó el usuario);
 * el resto se dibuja con SVG.
 */

import { publicUrl } from '../core/assets.ts';
import type { RosterPlayer, Team } from '../data/teams.ts';
import { altKitFor, kitStyleFor, lookFor } from '../data/look.ts';

// ------------------------------------------------------------------ helpers

type Attrs = Record<string, string | number | boolean | undefined | null>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'text') el.textContent = String(v);
    else if (k === 'html') el.innerHTML = String(v);
    else if (k.startsWith('on') && typeof v === 'string') {
      el.setAttribute(k, v);
    } else if (k === 'style') {
      el.setAttribute('style', String(v));
    } else if (v === true) {
      el.setAttribute(k, '');
    } else {
      el.setAttribute(k, String(v));
    }
  }
  for (const c of children) {
    if (c === null || c === undefined) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function icon(name: IconName, cls = ''): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.9');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  if (cls) svg.setAttribute('class', cls);
  svg.innerHTML = ICONS[name] ?? '';
  return svg;
}

export type IconName =
  | 'gear'
  | 'trophy'
  | 'check'
  | 'cloud'
  | 'wind'
  | 'bottle'
  | 'dice'
  | 'help'
  | 'pause'
  | 'sound'
  | 'soundOff'
  | 'chart'
  | 'back'
  | 'chevronLeft'
  | 'chevronRight'
  | 'bolt'
  | 'shield'
  | 'star'
  | 'swap'
  | 'lock';

const ICONS: Record<IconName, string> = {
  gear: `<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.5 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.14 15a1.7 1.7 0 0 0-1.56-1.03H2.5a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.2 8.94a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H8.6a1.7 1.7 0 0 0 1.03-1.56V2.9a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V8.6a1.7 1.7 0 0 0 1.56 1.03h.09a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15z"/>`,
  trophy: `<path d="M7 4h10v4a5 5 0 0 1-10 0V4z"/><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3"/><path d="M12 13v4M9 21h6M10 17h4l.5 4h-5l.5-4z"/>`,
  check: `<path d="M20 6 9.5 16.5 4 11"/>`,
  cloud: `<path d="M17 17H7a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 8.5a4.2 4.2 0 0 1 0 8.5z"/><path d="M8 20.5 7 22M12 20.5 11 22M16 20.5 15 22"/>`,
  wind: `<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h8a2.5 2.5 0 1 1-2.5 2.5"/>`,
  bottle: `<path d="M10 3h4v3l1.2 1.6c.5.7.8 1.5.8 2.3V19a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-9.1c0-.8.3-1.6.8-2.3L10 6V3z"/><path d="M8 12h8"/>`,
  dice: `<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/>`,
  help: `<circle cx="12" cy="12" r="9"/><path d="M9.2 9.3a3 3 0 0 1 5.8.9c0 2-2.9 2.4-2.9 4.2"/><circle cx="12" cy="17.6" r=".9" fill="currentColor" stroke="none"/>`,
  pause: `<rect x="7" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.4" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none"/>`,
  sound: `<path d="M11 5 6.5 9H3v6h3.5L11 19V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.4 6a9 9 0 0 1 0 12"/>`,
  soundOff: `<path d="M11 5 6.5 9H3v6h3.5L11 19V5z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>`,
  chart: `<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>`,
  back: `<path d="M19 12H5M11 6l-6 6 6 6"/>`,
  chevronLeft: `<path d="M15 5 8 12l7 7"/>`,
  chevronRight: `<path d="M9 5l7 7-7 7"/>`,
  bolt: `<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>`,
  shield: `<path d="M12 3 20 6v6c0 5-3.4 8.3-8 9.5C7.4 20.3 4 17 4 12V6l8-3z"/>`,
  star: `<path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L3.6 9.8l6.5-.9L12 3z"/>`,
  swap: `<path d="M4 8h13l-3.4-3.4"/><path d="M20 16H7l3.4 3.4"/>`,
  lock: `<rect x="4.5" y="10" width="15" height="10" rx="2.5"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/>`,
};

// ------------------------------------------------------------------ colores

export function shade(hex: string, amount: number): string {
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
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function readable(hex: string): string {
  const n = hex.replace('#', '');
  const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n;
  const num = parseInt(full.slice(0, 6), 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#16200f' : '#ffffff';
}

let uid = 0;
const nextId = (): string => `v${(uid += 1)}`;

// -------------------------------------------------------------------- arte

const SHIELD = 'M50 3 95 15v45c0 27-19.6 44.4-45 55C24.6 104.4 5 87 5 60V15L50 3Z';

/**
 * Escudo real de la selección (SVG oficial en `public/crests/{id}.svg`).
 * Cada escudo se sirve como archivo independiente; si falta, cae al escudo
 * procedural de respaldo.
 */
export function crestSvg(team: Team, size = 120): HTMLImageElement {
  const img = document.createElement('img');
  img.className = 'crest';
  img.alt = team.name;
  img.width = size;
  img.height = Math.round((size * 118) / 100);
  img.loading = 'lazy';
  img.decoding = 'async';
  img.draggable = false;
  img.src = publicUrl(`crests/${team.id}.svg`);
  img.addEventListener(
    'error',
    () => {
      img.replaceWith(crestFallbackSvg(team, size));
    },
    { once: true },
  );
  return img;
}

export function crestFallbackSvg(team: Team, size = 120): SVGSVGElement {
  const id = nextId();
  const w = size;
  const hh = Math.round((size * 118) / 100);
  const light = shade(team.jersey, 0.22);
  const dark = shade(team.jersey, -0.32);
  const stripe = readable(team.jersey) === '#ffffff' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.28)';
  const ink = readable(team.jersey);

  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('viewBox', '0 0 100 118');
  el.setAttribute('width', String(w));
  el.setAttribute('height', String(hh));
  el.setAttribute('class', 'crest');
  el.innerHTML = `
    <defs>
      <linearGradient id="${id}g" x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0" stop-color="${light}"/>
        <stop offset="0.55" stop-color="${team.jersey}"/>
        <stop offset="1" stop-color="${dark}"/>
      </linearGradient>
      <clipPath id="${id}c"><path d="${SHIELD}"/></clipPath>
    </defs>
    <path d="${SHIELD}" fill="#0d1109" opacity="0.55" transform="translate(2.5 3.5)"/>
    <path d="${SHIELD}" fill="url(#${id}g)" stroke="#f6ecd2" stroke-width="3.2"/>
    <g clip-path="url(#${id}c)">
      <path d="M-10 88 92 18v22L4 104Z" fill="${stripe}"/>
      <rect x="5" y="3" width="90" height="26" fill="rgba(0,0,0,0.16)"/>
    </g>
    <text x="50" y="68" text-anchor="middle" font-family="Trebuchet MS, ui-sans-serif, sans-serif"
      font-size="27" font-weight="700" letter-spacing="1" fill="${ink}"
      stroke="rgba(0,0,0,0.35)" stroke-width="0.8" paint-order="stroke">${team.short}</text>
    <text x="50" y="87" text-anchor="middle" font-family="Trebuchet MS, ui-sans-serif, sans-serif"
      font-size="9" letter-spacing="2.4" fill="${ink}" opacity="0.72">2026</text>
  `;
  return el;
}

/**
 * Retrato del futbolista para la selección y la antesala.
 *
 * No es una foto: es un retrato ilustrado, con volumen (degradados de piel,
 * pómulo, sombra de mandíbula), pelo por capas y rasgos propios. Comparte los
 * datos con el cabezón del partido (`lookFor`), así que el jugador que eliges
 * es el mismo que sale a la cancha.
 */
export function avatarSvg(team: Team, player?: RosterPlayer, size = 104): SVGSVGElement {
  const id = nextId();
  const face = lookFor(team, player);
  const skin = face.skin;
  const skinLight = shade(skin, 0.18);
  const skinDark = shade(skin, -0.18);
  const hair = face.hairColor;
  const hairDark = shade(hair, -0.22);
  const hairLight = shade(hair, 0.14);

  const jaw = face.jaw;
  const jw = jaw === 'square' ? 29 : jaw === 'round' ? 28 : jaw === 'long' ? 25 : 26;
  const chin = jaw === 'square' ? 83 : jaw === 'round' ? 81 : jaw === 'long' ? 90 : 86;
  const cheekY = 50;
  const hairline = face.hairStyle === 'buzz' ? 34 : face.hairStyle === 'fade' ? 33 : 30;
  const noseW = face.nose === 'wide' ? 4.4 : face.nose === 'button' ? 3.0 : face.nose === 'long' ? 3.9 : 3.5;
  const noseDrop = face.nose === 'long' ? 1.2 : face.nose === 'button' ? -0.6 : 0;
  const mouthW = face.mouth === 'wide' ? 6.6 : face.mouth === 'full' ? 5.4 : 4.4;

  const facePath = `M ${60 - jw} ${cheekY}
    C ${60 - jw} 34 ${60 - 17} 22 60 22
    C ${60 + 17} 22 ${60 + jw} 34 ${60 + jw} ${cheekY}
    C ${60 + jw} ${cheekY + 13} ${60 + jw - 7} ${chin - 10} ${60 + 9} ${chin - 6}
    C ${60 + 5} ${chin - 2} ${60 + 2} ${chin} 60 ${chin}
    C ${60 - 2} ${chin} ${60 - 5} ${chin - 2} ${60 - 9} ${chin - 6}
    C ${60 - jw + 7} ${chin - 10} ${60 - jw} ${cheekY + 13} ${60 - jw} ${cheekY} Z`;

  const capPath = `M ${60 - jw - 2} ${cheekY - 2}
    C ${60 - jw - 2} 28 ${60 - 18} 16 60 16
    C ${60 + 18} 16 ${60 + jw + 2} 28 ${60 + jw + 2} ${cheekY - 2}
    C ${60 + jw - 5} ${hairline + 8} ${60 + 9} ${hairline} 60 ${hairline}
    C ${60 - 9} ${hairline} ${60 - jw + 5} ${hairline + 8} ${60 - jw - 2} ${cheekY - 2} Z`;

  // Pelo de fondo: melena, afro, moño.
  let back = '';
  if (face.hairStyle === 'afro') {
    back = `<circle cx="60" cy="46" r="35" fill="${hair}"/>
      <circle cx="34" cy="34" r="12" fill="${hair}"/><circle cx="60" cy="18" r="14" fill="${hair}"/>
      <circle cx="86" cy="34" r="12" fill="${hair}"/><circle cx="30" cy="52" r="11" fill="${hair}"/>
      <circle cx="90" cy="52" r="11" fill="${hair}"/>`;
  } else if (face.hairStyle === 'long') {
    back = `<path d="M 29 44 C 20 62 20 88 24 106 L 44 106 C 38 84 38 62 42 40 Z" fill="${hairDark}"/>
      <path d="M 91 44 C 100 62 100 88 96 106 L 76 106 C 82 84 82 62 78 40 Z" fill="${hairDark}"/>`;
  } else if (face.hairStyle === 'bun') {
    back = `<circle cx="60" cy="14" r="10" fill="${hair}"/><circle cx="60" cy="14" r="10" fill="none" stroke="${hairDark}" stroke-width="2"/>`;
  }

  // Pelo de delante: gorra con la línea de nacimiento.
  let front = '';
  if (face.hairStyle === 'bald') {
    front = `<ellipse cx="52" cy="30" rx="14" ry="6" fill="#ffffff" opacity="0.14"/>`;
  } else if (face.hairStyle === 'curls') {
    front = `<path d="${capPath}" fill="${hair}"/>` +
      [[38, 30], [46, 23], [55, 20], [65, 20], [74, 23], [82, 30], [86, 40]]
        .map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="7" fill="${hair}"/>`)
        .join('');
  } else if (face.hairStyle === 'afro') {
    front = `<path d="${capPath}" fill="${hair}"/>`;
  } else if (face.hairStyle === 'buzz' || face.hairStyle === 'fade') {
    front = `<path d="${capPath}" fill="${hair}"/>
      <path d="M ${60 - jw + 3} 40 C ${60 - jw + 6} 34 ${60 - jw + 11} 31 ${60 - jw + 17} 30"
        stroke="${hairLight}" stroke-width="1.6" fill="none" opacity="0.35" stroke-linecap="round"/>`;
  } else if (face.hairStyle === 'long') {
    front = `<path d="${capPath}" fill="${hair}"/>`;
  } else {
    // tupé: la gorra más un copete peinado hacia atrás
    front = `<path d="M ${60 - jw - 2} 44 C ${60 - jw - 4} 24 ${60 - 20} 12 62 12
      C 76 12 88 20 90 32 C 80 22 66 20 52 26 C 46 29 42 36 41 44 Z" fill="${hair}"/>
      <path d="${capPath}" fill="${hair}"/>
      <path d="M 44 26 C 54 18 72 18 84 26" stroke="${hairLight}" stroke-width="2.4" fill="none" opacity="0.5" stroke-linecap="round"/>`;
  }

  // Barba.
  let beard = '';
  if (face.beard !== 'none') {
    const alpha = face.beard === 'full' ? 0.9 : face.beard === 'stubble' ? 0.3 : 0.92;
    if (face.beard === 'goatee') {
      beard = `<path d="M 52 ${chin - 14} C 56 ${chin - 8} 64 ${chin - 8} 68 ${chin - 14}
        C 70 ${chin - 6} 66 ${chin - 1} 60 ${chin - 1} C 54 ${chin - 1} 50 ${chin - 6} 52 ${chin - 14} Z"
        fill="${hair}" opacity="${alpha}"/>
        <path d="M 53 66 C 57 64 63 64 67 66 C 65 69 62 70 60 70 C 58 70 55 69 53 66 Z" fill="${hair}" opacity="${alpha}"/>`;
    } else {
      beard = `<path d="M ${60 - jw + 1} 58 C ${60 - jw + 2} ${chin - 12} ${60 - 12} ${chin - 2} 60 ${chin - 1}
        C ${60 + 12} ${chin - 2} ${60 + jw - 2} ${chin - 12} ${60 + jw - 1} 58
        C ${60 + jw - 8} ${chin - 14} ${60 + 10} ${chin - 12} 60 ${chin - 12}
        C ${60 - 10} ${chin - 12} ${60 - jw + 8} ${chin - 14} ${60 - jw + 1} 58 Z"
        fill="${hair}" opacity="${alpha}"/>
        <path d="M 52 64 C 56 61 64 61 68 64 C 66 68 63 69 60 69 C 57 69 54 68 52 64 Z" fill="${hair}" opacity="${alpha}"/>`;
    }
  }

  const eye = (cx: number, mirror: number): string => {
    const ry = face.eyes === 'round' ? 5.4 : face.eyes === 'narrow' ? 3.4 : face.eyes === 'sharp' ? 3.8 : 4.4;
    const rx = face.eyes === 'round' ? 5.2 : 5.6;
    return `<ellipse cx="${cx}" cy="52" rx="${rx}" ry="${ry}" fill="#fbf6ee"/>
      <ellipse cx="${cx}" cy="52" rx="${rx}" ry="${ry}" fill="none" stroke="${skinDark}" stroke-width="0.9" opacity="0.5"/>
      <circle cx="${cx + mirror * 0.4}" cy="52.4" r="3.1" fill="${face.eyeColor}"/>
      <circle cx="${cx + mirror * 0.4}" cy="52.4" r="1.7" fill="#150f0a"/>
      <circle cx="${cx + mirror * 0.4}" cy="52.4" r="3.1" fill="none" stroke="#2a170d" stroke-width="0.7" opacity="0.7"/>
      <circle cx="${cx + mirror * 0.4 - 0.9}" cy="51.4" r="0.85" fill="#ffffff" opacity="0.95"/>
      <path d="M ${cx - rx} 50.4 Q ${cx} ${50 - ry + 0.6} ${cx + rx} 50.2" stroke="#221a14" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;
  };

  const brow = (cx: number, flip: number): string => {
    const lift = face.brows === 'arched' ? -3 : face.brows === 'straight' ? 0 : -1;
    const w = face.brows === 'thin' ? 1.8 : 3;
    return `<path d="M ${cx - 7 * flip} 45 Q ${cx} ${42 + lift} ${cx + 7 * flip} 44.5" stroke="${hairDark}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
  };

  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('viewBox', '0 0 120 120');
  el.setAttribute('width', String(size));
  el.setAttribute('height', String(size));
  el.innerHTML = `
    <defs>
      <radialGradient id="${id}bg" cx="0.5" cy="0.36" r="0.78">
        <stop offset="0" stop-color="#33402a"/><stop offset="1" stop-color="#0c0f09"/>
      </radialGradient>
      <linearGradient id="${id}skin" x1="0.2" y1="0" x2="0.85" y2="1">
        <stop offset="0" stop-color="${skinLight}"/>
        <stop offset="0.55" stop-color="${skin}"/>
        <stop offset="1" stop-color="${skinDark}"/>
      </linearGradient>
      <linearGradient id="${id}jersey" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${shade(team.jersey, 0.14)}"/>
        <stop offset="1" stop-color="${shade(team.jersey, -0.3)}"/>
      </linearGradient>
    </defs>
    <rect width="120" height="120" fill="url(#${id}bg)"/>
    <circle cx="60" cy="50" r="42" fill="#ffffff" opacity="0.05"/>
    ${back}
    <path d="M 47 ${chin - 16} h 26 v 36 h -26 Z" fill="${skinDark}"/>
    <path d="M 8 120 C 12 104 28 96 42 95 L 45 103 C 36 108 30 114 28 120 Z" fill="${shade(team.jersey, -0.28)}"/>
    <path d="M 112 120 C 108 104 92 96 78 95 L 75 103 C 84 108 90 114 92 120 Z" fill="${shade(team.jersey, -0.28)}"/>
    <path d="M 12 120 C 16 100 36 92 60 92 C 84 92 104 100 108 120 Z" fill="url(#${id}jersey)"/>
    <path d="M 45 96 Q 60 90 75 96 Q 60 103 45 96 Z" fill="${shade(team.jersey, -0.4)}"/>
    <path d="${facePath}" fill="url(#${id}skin)"/>
    <ellipse cx="34" cy="58" rx="4.6" ry="7" fill="${skin}" stroke="${skinDark}" stroke-width="1"/>
    <ellipse cx="86" cy="58" rx="4.6" ry="7" fill="${skin}" stroke="${skinDark}" stroke-width="1"/>
    <ellipse cx="44" cy="62" rx="6" ry="3.2" fill="#c0623f" opacity="0.13"/>
    <ellipse cx="76" cy="62" rx="6" ry="3.2" fill="#c0623f" opacity="0.13"/>
    ${beard}
    ${front}
    <ellipse cx="43" cy="60" rx="7.5" ry="4.4" fill="${skinDark}" opacity="0.1"/>
    <ellipse cx="77" cy="60" rx="7.5" ry="4.4" fill="${skinDark}" opacity="0.1"/>
    ${eye(51, 1)}
    ${eye(69, -1)}
    ${brow(51, 1)}
    ${brow(69, -1)}
    <path d="M 60 50 C 58.6 55 58.4 58 59.4 ${60 + noseDrop}" stroke="${skinDark}" stroke-width="1.4" fill="none" opacity="0.55" stroke-linecap="round"/>
    <ellipse cx="${60 - noseW}" cy="${61.6 + noseDrop}" rx="1.5" ry="1" fill="${skinDark}"/>
    <ellipse cx="${60 + noseW}" cy="${61.6 + noseDrop}" rx="1.5" ry="1" fill="${skinDark}"/>
    <ellipse cx="57" cy="56" rx="3.4" ry="2.2" fill="#ffffff" opacity="0.16"/>
    <path d="M ${60 - mouthW} ${chin - 18} Q 60 ${chin - 21} ${60 + mouthW} ${chin - 18}" stroke="${shade(skin, -0.4)}" stroke-width="1.9" fill="none" stroke-linecap="round"/>
    <path d="M ${60 - mouthW + 1} ${chin - 15} Q 60 ${chin - 12} ${60 + mouthW - 1} ${chin - 15}" stroke="${shade(skin, 0.22)}" stroke-width="1.6" fill="none" opacity="0.55" stroke-linecap="round"/>
    ${
      player && player.num
        ? `<circle cx="92" cy="104" r="11" fill="#10140c" opacity="0.85" stroke="rgba(255,255,255,0.35)" stroke-width="1.2"/>
           <text x="92" y="108.5" text-anchor="middle" font-family="'Chakra Petch', 'Arial Narrow', sans-serif"
             font-size="12" font-weight="700" fill="#f7f3e6">${player.num}</text>`
        : ''
    }
  `;
  return el;
}

export function jerseySvg(team: Team, num: number, size = 34, alternate = false): SVGSVGElement {
  const id = nextId();
  const style = kitStyleFor(team);
  const altKit = alternate ? altKitFor(team) : null;
  const jersey = altKit?.jersey ?? team.jersey;
  const alt = altKit?.alt ?? style.alt;
  const trim = altKit?.trim ?? style.trim;
  const ink = readable(jersey);
  const body = 'M14 7h12l7 4 5 6-6 6-4-4v18H13V19l-4 4-6-6 5-6 6-4z';

  // Estampado recortado a la camiseta: rayas, cuadros, franja, mitades o banda.
  let pattern = '';
  if (style.pattern === 'stripes') {
    pattern = [0, 2, 4, 6].map((i) => `<rect x="${13 + i * 3}" y="0" width="3" height="44" fill="${alt}"/>`).join('');
  } else if (style.pattern === 'hoops') {
    pattern = [10, 18, 26, 34].map((y) => `<rect x="0" y="${y}" width="44" height="4" fill="${alt}"/>`).join('');
  } else if (style.pattern === 'checks') {
    const cells: string[] = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if ((r + c) % 2 === 0) cells.push(`<rect x="${c * 9}" y="${r * 9}" width="9" height="9" fill="${alt}"/>`);
      }
    }
    pattern = cells.join('');
  } else if (style.pattern === 'halves') {
    pattern = `<rect x="20" y="0" width="24" height="44" fill="${alt}"/>`;
  } else if (style.pattern === 'sash') {
    pattern = `<path d="M-2 34 L44 6 L44 15 L-2 43 Z" fill="${alt}"/>`;
  } else if (style.pattern === 'band') {
    pattern = `<rect x="0" y="20" width="44" height="7" fill="${alt}"/>`;
  }

  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('viewBox', '0 0 44 44');
  el.setAttribute('width', String(size));
  el.setAttribute('height', String(size));
  el.innerHTML = `
    <defs>
      <clipPath id="${id}c"><path d="${body}"/></clipPath>
      <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="rgba(255,255,255,0.16)"/>
        <stop offset="0.55" stop-color="rgba(255,255,255,0)"/>
        <stop offset="1" stop-color="rgba(0,0,0,0.24)"/>
      </linearGradient>
    </defs>
    <path d="${body}" fill="${jersey}"/>
    <g clip-path="url(#${id}c)">${pattern}</g>
    <path d="${body}" fill="url(#${id}s)"/>
    <path d="${body}" fill="none" stroke="#f4eeda" stroke-width="2" stroke-linejoin="round"/>
    <path d="M17 7h10l-2 3h-6z" fill="${trim}" stroke="#f4eeda" stroke-width="1.4"/>
    <path d="M9 13l4 4M35 13l-4 4" stroke="${trim}" stroke-width="3" stroke-linecap="round"/>
    <text x="22" y="33" text-anchor="middle" font-family="Chakra Petch, Trebuchet MS, sans-serif" font-size="13" font-weight="700" fill="${ink}" stroke="rgba(0,0,0,0.25)" stroke-width="0.6">${num}</text>
  `;
  return el;
}

/** Balón real del Mundial 2026: la foto recortada que aportó el usuario. */
export function ballImg(variant = 0, size = 52): HTMLImageElement {
  const v = ((Math.round(variant) % 2) + 2) % 2;
  const img = document.createElement('img');
  img.src = publicUrl(v === 0 ? 'balls/trionda.webp' : 'balls/clasico.webp');
  img.alt = v === 0 ? 'Balón Trionda' : 'Balón clásico';
  img.width = size;
  img.height = size;
  img.className = 'ball-img';
  img.decoding = 'async';
  return img;
}

export function pitchSvg(colors: [string, string] = ['#ffd34f', '#7fc7ff']): SVGSVGElement {
  const id = nextId();
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('viewBox', '0 0 300 180');
  el.innerHTML = `
    <defs>
      <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2f8f4a"/><stop offset="1" stop-color="#1d6b36"/>
      </linearGradient>
    </defs>
    <rect width="300" height="180" fill="url(#${id}g)"/>
    <g opacity="0.5">
      <rect x="0" y="0" width="300" height="20" fill="#ffffff" opacity="0.05"/>
      <rect x="0" y="40" width="300" height="20" fill="#ffffff" opacity="0.05"/>
      <rect x="0" y="80" width="300" height="20" fill="#ffffff" opacity="0.05"/>
      <rect x="0" y="120" width="300" height="20" fill="#ffffff" opacity="0.05"/>
      <rect x="0" y="160" width="300" height="20" fill="#ffffff" opacity="0.05"/>
    </g>
    <g fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2">
      <rect x="8" y="8" width="284" height="164"/>
      <line x1="150" y1="8" x2="150" y2="172"/>
      <circle cx="150" cy="90" r="30"/>
      <rect x="8" y="52" width="34" height="76"/>
      <rect x="258" y="52" width="34" height="76"/>
      <rect x="8" y="72" width="14" height="36"/>
      <rect x="278" y="72" width="14" height="36"/>
    </g>
    <circle cx="150" cy="90" r="2.6" fill="rgba(255,255,255,0.7)"/>
    <g opacity="0.9">
      <circle cx="60" cy="90" r="6.4" fill="${colors[0]}" stroke="rgba(0,0,0,0.55)" stroke-width="1.6"/>
      <circle cx="238" cy="90" r="6.4" fill="${colors[1]}" stroke="rgba(0,0,0,0.55)" stroke-width="1.6"/>
      <circle cx="150" cy="90" r="3.4" fill="#fff" stroke="#222" stroke-width="1.2"/>
    </g>
  `;
  return el;
}

/** Balón gigante de fondo: polígonos de colores, como en la referencia. */
export function backdropBallSvg(): string {
  const c = 500;
  const colors = ['#8fd9a8', '#e8c76a', '#e08a6a', '#8fb7e8', '#c9a3e0'];
  const polys: string[] = [];
  const ring = (radius: number, count: number, size: number, offset: number): void => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + offset;
      const cx = c + Math.cos(a) * radius;
      const cy = c + Math.sin(a) * radius;
      const pts: string[] = [];
      for (let k = 0; k < 5; k++) {
        const aa = (k / 5) * Math.PI * 2 + a;
        pts.push(`${(cx + Math.cos(aa) * size).toFixed(1)},${(cy + Math.sin(aa) * size).toFixed(1)}`);
      }
      polys.push(
        `<polygon points="${pts.join(' ')}" fill="none" stroke="${colors[(i + Math.round(radius)) % colors.length]}" stroke-width="2.2" opacity="0.75"/>`,
      );
    }
  };
  ring(0, 1, 105, 0);
  ring(178, 5, 96, 0.3);
  ring(330, 5, 88, 0.95);
  const links: string[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    links.push(
      `<line x1="${c + Math.cos(a) * 96}" y1="${c + Math.sin(a) * 96}" x2="${c + Math.cos(a) * 258}" y2="${c + Math.sin(a) * 258}" stroke="rgba(210,220,190,0.22)" stroke-width="1.6"/>`,
      `<line x1="${c + Math.cos(a + 0.3) * 270}" y1="${c + Math.sin(a + 0.3) * 270}" x2="${c + Math.cos(a + 0.3) * 412}" y2="${c + Math.sin(a + 0.3) * 412}" stroke="rgba(210,220,190,0.16)" stroke-width="1.4"/>`,
    );
  }
  return `<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
    <circle cx="500" cy="500" r="430" fill="none" stroke="rgba(200,210,180,0.16)" stroke-width="2"/>
    ${links.join('')}
    ${polys.join('')}
  </svg>`;
}

// ---------------------------------------------------------------- controles

export interface PillOpts {
  primary?: boolean;
  wide?: boolean;
  ghost?: boolean;
  disabled?: boolean;
  iconName?: IconName;
  onClick?: () => void;
}

export function pill(label: string, opts: PillOpts = {}): HTMLButtonElement {
  const cls = ['pill'];
  if (opts.primary) cls.push('primary');
  if (opts.wide) cls.push('wide');
  if (opts.ghost) cls.push('ghost');
  const btn = h('button', { class: cls.join(' '), type: 'button' });
  if (opts.iconName) btn.append(icon(opts.iconName));
  btn.append(h('span', { text: label }));
  if (opts.disabled) btn.disabled = true;
  if (opts.onClick) btn.addEventListener('click', opts.onClick);
  return btn;
}

export function arrowButton(dir: 'left' | 'right', onClick: () => void, label: string): HTMLButtonElement {
  const btn = h('button', {
    class: 'arrow',
    type: 'button',
    'aria-label': label,
  });
  btn.append(icon(dir === 'left' ? 'chevronLeft' : 'chevronRight'));
  btn.addEventListener('click', onClick);
  return btn;
}

export function toggle(on: boolean, onChange: (v: boolean) => void): HTMLButtonElement {
  const btn = h('button', {
    class: `toggle${on ? ' on' : ''}`,
    type: 'button',
    role: 'switch',
    'aria-checked': String(on),
  });
  btn.append(icon('check'));
  btn.addEventListener('click', () => {
    const next = !btn.classList.contains('on');
    btn.classList.toggle('on', next);
    btn.setAttribute('aria-checked', String(next));
    onChange(next);
  });
  return btn;
}

export function flagEmoji(code: string, size?: number): HTMLSpanElement {
  const el = h('span', { class: 'emoji', text: code });
  if (size) el.style.fontSize = `${size}px`;
  return el;
}
