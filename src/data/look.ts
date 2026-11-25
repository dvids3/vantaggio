/**
 * Aspecto del futbolista.
 *
 * Dos capas, a propósito separadas:
 *
 *  1. **Datos** — el tono de piel sale de una tabla por selección (orden del
 *     roster) porque no todos los jugadores de un país tienen el mismo tono, y
 *     adivinarlo con un hash producía errores evidentes (James claro, Luis Díaz
 *     oscuro, ambos del mismo color). El resto de rasgos sí se derivan del
 *     nombre: son estables y variados sin necesidad de una ficha por jugador.
 *
 *  2. **Geometría** — forma de mandíbula, nariz, ojos, cejas y boca. Es lo que
 *     hace que dos cabezones no se vean como el mismo muñeco con otro peinado.
 *
 * Todo es determinista: la vista previa de la selección y el partido dibujan
 * exactamente la misma cara.
 */

import type { RosterPlayer, Team } from './teams.ts';

export type HairStyle = 'quiff' | 'buzz' | 'fade' | 'afro' | 'curls' | 'bun' | 'long' | 'bald';
export type Beard = 'none' | 'stubble' | 'full' | 'goatee';
export type JawKind = 'oval' | 'square' | 'round' | 'long';
export type NoseKind = 'straight' | 'button' | 'hook' | 'wide' | 'long';
export type EyeKind = 'calm' | 'sharp' | 'round' | 'narrow';
export type BrowKind = 'thick' | 'thin' | 'arched' | 'straight';
export type MouthKind = 'wide' | 'full' | 'thin';

/** Estampado de la camiseta: lo que hace reconocible a una selección. */
export type KitPattern = 'plain' | 'stripes' | 'hoops' | 'sash' | 'halves' | 'checks' | 'band';

export interface KitStyle {
  pattern: KitPattern;
  /** Color secundario del estampado (rayas, cuadros, franja). */
  alt: string;
  /** Ribete del cuello, puños y franjas del botín. */
  trim: string;
}

export interface PlayerLook {
  skin: string;
  /** Sombra de la piel, ya calculada, para no repetirla en cada dibujo. */
  skinShade: string;
  hairColor: string;
  beardColor: string;
  hairStyle: HairStyle;
  beard: Beard;
  jaw: JawKind;
  nose: NoseKind;
  eyes: EyeKind;
  brows: BrowKind;
  mouth: MouthKind;
  /** Color del iris: casi siempre marrón, a veces avellana o verde. */
  eyeColor: string;
  /**
   * Tamaño de la cabeza respecto al estándar. Dos cabezones de la misma
   * selección no miden igual: es lo primero que se nota en la silueta, más
   * que el color del pelo.
   */
  headScale: number;
  /** Altura del ojo dentro de la cara (−1 arriba, +1 abajo). */
  eyeY: number;
  /** Separación del ojo respecto a la nariz (0.22 estrecho … 0.34 adelantado). */
  eyeX: number;
  /** 1 = muy claro … 5 = muy oscuro. Útil para decidir rubio o canas. */
  tone: number;
}

const HAIR_STYLES: HairStyle[] = ['quiff', 'buzz', 'fade', 'afro', 'curls', 'bun', 'long', 'bald'];
const BEARDS: Beard[] = ['none', 'none', 'stubble', 'full', 'goatee', 'none'];
const JAWS: JawKind[] = ['oval', 'square', 'round', 'long', 'oval'];
const NOSES: NoseKind[] = ['straight', 'button', 'hook', 'wide', 'long', 'straight'];
const EYES: EyeKind[] = ['calm', 'sharp', 'round', 'narrow', 'calm'];
const BROWS: BrowKind[] = ['thick', 'thin', 'arched', 'straight', 'thick'];
const MOUTHS: MouthKind[] = ['wide', 'full', 'thin', 'wide'];
const EYE_COLORS = ['#4a2c1a', '#4a2c1a', '#3d2a18', '#2f3a2a', '#3a4a56'];

/** Cinco tonos base: marfil, trigueño claro, canela, moreno y ébano. */
export const SKIN_TONES = ['#f6d8c0', '#eec39d', '#d29a68', '#a8683c', '#6f4429'] as const;

/**
 * Tono por selección, en el orden del roster (1 = claro … 5 = oscuro).
 * Es un dato, no una suposición del hash: dentro de una misma selección hay
 * jugadores claros y oscuros, y así se respeta.
 */
const TONE_BY_TEAM: Record<string, number[]> = {
  mexico: [3, 3, 4, 3, 3, 4],
  sudafrica: [5, 5, 5, 5, 5],
  'corea-del-sur': [3, 3, 3, 3, 3],
  chequia: [2, 2, 2, 2, 2],
  canada: [2, 5, 3, 4, 4],
  'bosnia-y-herzegovina': [2, 3, 2, 3, 2],
  catar: [4, 4, 4, 4, 4],
  suiza: [2, 5, 2, 3, 5],
  brasil: [2, 3, 3, 4, 4],
  marruecos: [3, 3, 3, 3, 3],
  haiti: [5, 5, 5, 5, 5],
  escocia: [2, 2, 2, 2, 3],
  'estados-unidos': [2, 3, 2, 4, 2],
  paraguay: [3, 3, 3, 3, 3],
  australia: [2, 2, 2, 2, 2],
  turquia: [2, 3, 2, 2, 2],
  alemania: [2, 5, 2, 2, 4],
  curazao: [5, 5, 5, 5, 4],
  'costa-de-marfil': [5, 5, 5, 5, 5],
  ecuador: [3, 4, 3, 5, 5],
  'paises-bajos': [2, 4, 2, 5, 5],
  japon: [3, 3, 3, 3, 3],
  suecia: [2, 2, 2, 5, 3],
  tunez: [3, 4, 3, 3, 3],
  belgica: [2, 2, 2, 5, 5],
  egipto: [3, 3, 3, 3, 3],
  iran: [3, 3, 3, 3, 3],
  'nueva-zelanda': [2, 2, 2, 4, 2],
  espana: [2, 3, 2, 2, 4],
  'cabo-verde': [5, 5, 5, 5, 5],
  'arabia-saudita': [4, 4, 4, 4, 4],
  uruguay: [2, 4, 2, 2, 2],
  francia: [5, 5, 5, 5, 5],
  senegal: [5, 5, 5, 5, 5],
  irak: [4, 4, 4, 4, 4],
  noruega: [2, 2, 2, 2, 2],
  argentina: [2, 2, 2, 2, 2],
  argelia: [3, 3, 3, 3, 3],
  austria: [2, 4, 2, 2, 2],
  jordania: [4, 4, 4, 4, 4],
  portugal: [2, 2, 2, 2, 2],
  'rd-congo': [5, 5, 5, 5, 5],
  uzbekistan: [4, 4, 4, 4, 4],
  colombia: [3, 5, 5, 2, 5],
  inglaterra: [2, 2, 2, 2, 4],
  croacia: [2, 2, 2, 2, 2],
  ghana: [5, 5, 5, 5, 5],
  panama: [4, 4, 4, 4, 4],
};

/** Selecciones donde el rubio es creíble. */
const BLOND = new Set([
  'suecia', 'noruega', 'belgica', 'paises-bajos', 'francia', 'inglaterra',
  'croacia', 'alemania', 'austria', 'chequia', 'escocia', 'uruguay',
]);

/**
 * Estampados que no se pueden deducir de los dos colores de la ficha: los que
 * hacen reconocible a una selección de un vistazo. El resto de equipos van
 * lisos con su ribete, que ya los distingue.
 */
const PATTERN_BY_TEAM: Record<string, KitPattern> = {
  argentina: 'stripes',
  croacia: 'checks',
  'paises-bajos': 'halves',
  nigeria: 'stripes',
  'corea-del-sur': 'stripes',
  japon: 'band',
  'costa-de-marfil': 'band',
  senegal: 'band',
  marruecos: 'sash',
  'arabia-saudita': 'sash',
  mexico: 'sash',
  uruguay: 'band',
  escocia: 'halves',
  'estados-unidos': 'hoops',
  'nueva-zelanda': 'halves',
  suiza: 'band',
  catar: 'sash',
};

/** Colores del estampado cuando shorts/medias no los representan. */
const KIT_OVERRIDES: Record<string, Partial<KitStyle>> = {
  argentina: { alt: '#f4f9ff', trim: '#1b2b57' },
  croacia: { alt: '#ffffff', trim: '#1b2b57' },
  'paises-bajos': { alt: '#f07a1a', trim: '#0b1a33' },
  brasil: { trim: '#0b7a3b', alt: '#f7d117' },
  colombia: { trim: '#1b3a8c', alt: '#f2c300' },
  francia: { trim: '#d4a017', alt: '#1b2a6b' },
  inglaterra: { trim: '#c8102e', alt: '#ffffff' },
  espana: { trim: '#ffc400', alt: '#c60b1e' },
  alemania: { trim: '#111111', alt: '#ffffff' },
  portugal: { trim: '#046a38', alt: '#c8102e' },
  mexico: { trim: '#ce1126', alt: '#006847' },
  uruguay: { trim: '#f8f8f4', alt: '#5cbfeb' },
  japon: { trim: '#bc002d', alt: '#ffffff' },
  'corea-del-sur': { trim: '#0047a0', alt: '#cd2e3a' },
  marruecos: { trim: '#006233', alt: '#c1272d' },
  suiza: { trim: '#d52b1e', alt: '#ffffff' },
  escocia: { trim: '#ffffff', alt: '#1b2a5e' },
  'estados-unidos': { trim: '#1b2e6b', alt: '#ffffff' },
  'nueva-zelanda': { trim: '#ffffff', alt: '#111111' },
  catar: { trim: '#ffffff', alt: '#8a1538' },
  nigeria: { trim: '#0b7a3b', alt: '#ffffff' },
  'costa-de-marfil': { trim: '#009a44', alt: '#ff8200' },
  senegal: { trim: '#00853f', alt: '#fdef42' },
  'arabia-saudita': { trim: '#006c35', alt: '#ffffff' },
};

const BLOND_HAIR = '#e8d29a';
const GREY_HAIR = '#c9c6bc';

function hashOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function parseHex(hex: string): [number, number, number] {
  const n = hex.replace('#', '');
  const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n;
  const num = parseInt(full.slice(0, 6), 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function toHex(r: number, g: number, b: number): string {
  const c = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
  return `#${((1 << 24) | (c(r) << 16) | (c(g) << 8) | c(b)).toString(16).slice(1)}`;
}

/** Aclara u oscurece un hex sin salir de la gama de la piel. */
export function tinge(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex);
  if (amount >= 0) {
    return toHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
  }
  const k = 1 + amount;
  return toHex(r * k, g * k, b * k);
}

function toneIndex(team: Team, player?: RosterPlayer): number {
  if (player) {
    const at = team.roster.indexOf(player);
    const hit = TONE_BY_TEAM[team.id]?.[at];
    if (hit) return hit;
  }
  // Respaldo: el tono declarado por la selección se acerca al más parecido.
  const [r, g, b] = parseHex(team.skin);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return Math.max(1, Math.min(5, Math.round(5 - lum * 4)));
}

function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Camiseta: estampado + ribete. El ribete sale del color de la pantaloneta o
 * las medias que más contraste haga con la camiseta, así que un equipo blanco
 * recibe un vivo oscuro y uno oscuro un vivo claro — sin tocar las 48 fichas.
 */
/**
 * Uniforme alternativo: si la camiseta es clara se juega de oscuro y al revés.
 * El estampado se conserva, pero el color secundario pasa a ser el de la casa,
 * así se reconoce al equipo aunque cambie de ropa.
 */
export interface AltKit {
  jersey: string;
  shorts: string;
  socks: string;
  alt: string;
  trim: string;
}

export function altKitFor(team: Team): AltKit {
  const style = kitStyleFor(team);
  const light = luminance(team.jersey) > 0.6;
  const jersey = light ? '#121a28' : '#f2f4f6';
  const shorts = light ? '#f2f4f6' : '#121a28';
  const socks = light ? '#121a28' : '#f2f4f6';
  return { jersey, shorts, socks, alt: team.jersey, trim: team.jersey };
}

export function kitStyleFor(team: Team): KitStyle {
  const over = KIT_OVERRIDES[team.id] ?? {};
  const jerseyLum = luminance(team.jersey);
  const shortsLum = luminance(team.shorts);
  const socksLum = luminance(team.socks);
  const contrast = (v: number): number => Math.abs(v - jerseyLum);
  const altSource = contrast(shortsLum) >= contrast(socksLum) ? team.shorts : team.socks;
  return {
    pattern: PATTERN_BY_TEAM[team.id] ?? 'plain',
    alt: over.alt ?? altSource,
    trim: over.trim ?? (jerseyLum > 0.6 ? team.shorts : team.socks),
  };
}

/** Aspecto completo, estable por jugador. */
export function lookFor(team: Team, player?: RosterPlayer): PlayerLook {
  const h = hashOf(player ? `${team.id}:${player.name}` : team.id);
  const tone = toneIndex(team, player);
  const baseSkin = SKIN_TONES[tone - 1]!;
  // Micro-variación para que dos jugadores del mismo tono no sean idénticos.
  const skin = tinge(baseSkin, (((h >>> 21) % 5) - 2) * 0.018);

  let hairColor = team.hair;
  if (tone <= 2 && BLOND.has(team.id) && ((h >>> 11) & 1) === 0) {
    hairColor = BLOND_HAIR;
  } else if (tone <= 2 && (h >>> 13) % 29 === 0) {
    // Algún jugador con canas: da variedad sin salirse del estilo.
    hairColor = GREY_HAIR;
  } else if ((h >>> 17) % 5 === 0) {
    hairColor = tinge(team.hair, 0.16);
  } else if (tone >= 4) {
    hairColor = tinge(team.hair, -0.18);
  }

  const hairStyle = HAIR_STYLES[(h >>> 2) % HAIR_STYLES.length]!;
  const beard = BEARDS[(h >>> 7) % BEARDS.length]!;
  // Silueta: cabeza de 0,93 a 1,07 del estándar, ojo a distinta altura y algo
  // más o menos adelantado. Son variaciones pequeñas, pero a tamaño de juego
  // son las que distinguen a un futbolista de otro.
  const headScale = 0.93 + ((h >>> 26) % 15) / 100;
  const eyeY = (((h >>> 19) % 11) - 5) * 0.012;
  const eyeX = 0.22 + ((h >>> 23) % 7) * 0.02;

  return {
    skin,
    skinShade: tinge(skin, -0.16),
    hairColor,
    beardColor: tinge(hairColor, 0.06),
    hairStyle,
    beard,
    jaw: JAWS[(h >>> 4) % JAWS.length]!,
    nose: NOSES[(h >>> 9) % NOSES.length]!,
    eyes: EYES[(h >>> 12) % EYES.length]!,
    brows: BROWS[(h >>> 15) % BROWS.length]!,
    mouth: MOUTHS[(h >>> 18) % MOUTHS.length]!,
    eyeColor: EYE_COLORS[(h >>> 24) % EYE_COLORS.length]!,
    headScale,
    eyeY,
    eyeX,
    tone,
  };
}
