/**
 * Arte de los futbolistas.
 *
 * Ahora mismo el muñeco tiene TRES piezas:
 *
 *  · **cabeza** — dibujo de cada selección (de momento solo México). Si el
 *    equipo no trae cabeza, el renderizador dibuja la de vectores.
 *  · **cuerpo** — no es una imagen: lo dibuja el renderizador con los colores
 *    del equipo (camiseta y pantaloneta). Así los 48 equipos se ven distintos
 *    sin necesitar 48 dibujos.
 *  · **guayos** — los seis botines del usuario, repartidos al azar pero de
 *    forma estable: cada futbolista conserva su botín en todos los partidos.
 *    Es UN botín por jugador, como el dibujo original: el muñeco no tiene
 *    piernas ni pies, el botín va bajo la pantaloneta.
 *
 * Las cabezas se declaran una a una, como antes, con su `ventana` sobre el SVG.
 * Los botines llegan ya recortados y en WebP (ver `scripts/prep-guayos.mjs`),
 * así que se cargan tal cual.
 */

import { publicUrl } from '../core/assets.ts';

/** Una pieza ya rasterizada: el canvas y el tamaño en píxeles. */
export interface Pieza {
  cv: HTMLCanvasElement;
  w: number;
  h: number;
}

/** Lo que un futbolista puede tener dibujado a mano. */
export interface ArteJugador {
  /** Cabeza dibujada, o `null` si ese equipo todavía no tiene. */
  cabeza: Pieza | null;
  /** Botines. Siempre hay: si aún no cargaron, el renderizador los dibuja. */
  guayos: Pieza | null;
}

// ------------------------------------------------------------------ botines

/**
 * Los seis pares que aportó el usuario, recortados por `prep-guayos.mjs`.
 *
 * OJO: los archivos NO vinieron todos mirando al mismo lado. Cada SVG traía los
 * dos zapatos (uno hacia cada lado) y el script se queda con el de arriba, que
 * en tres archivos mira a la DERECHA y en los otros tres a la IZQUIERDA. El
 * juego dibuja siempre hacia +x, así que `espejo` dice cuáles hay que voltear:
 * el que ya mira a +x se deja quieto y el que mira a -x se espeja al cargar.
 *
 * Si algún día se rehace el recorte, hay que volver a mirar cada archivo: el
 * botín tiene el talón (la caña alta, con el hueco del tobillo) de un lado y la
 * punta —baja y afilada— del otro. Con el zapato mal volteado el muñeco queda
 * con el pie al revés y parece que corre hacia atrás.
 */
export const GUAYOS: readonly { src: string; espejo: boolean }[] = [
  { src: 'arte/guayos/adidas1.webp', espejo: false },
  { src: 'arte/guayos/adidas2.webp', espejo: true },
  { src: 'arte/guayos/nike1.webp', espejo: true },
  { src: 'arte/guayos/nike2.webp', espejo: false },
  { src: 'arte/guayos/puma1.webp', espejo: false },
  { src: 'arte/guayos/puma2.webp', espejo: true },
];

/** Torcedura estable: el mismo nombre siempre cae en el mismo índice. */
function hash(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Compara nombres sin tildes, sin mayúsculas y con espacios simples. */
function normNombre(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Qué par le toca a este futbolista. Se sortea con el nombre del jugador y el de
 * su selección: dos del mismo equipo llevan botines distintos, y el mismo
 * jugador lleva siempre el mismo par aunque cambie de partido.
 */
export function guayoId(equipo: string | undefined, jugador?: string): number {
  const clave = `${equipo ?? ''}|${jugador ? normNombre(jugador) : ''}`;
  return hash(clave) % GUAYOS.length;
}

// ------------------------------------------------------------------ cabezas

interface Fuente {
  src: string;
  /** Ventana a recortar: [x, y, ancho, alto] en coordenadas del viewBox. */
  ventana: [number, number, number, number];
  /** viewBox completo del archivo. */
  viewBox: [number, number, number, number];
  /** Ancho en píxeles al que se rasteriza el recorte. */
  ancho: number;
  /** Mirar el dibujo al derecho o al revés. La cabeza dibujada mira a -x. */
  espejo?: boolean;
}

interface Declaracion {
  /** Selección a la que pertenece (id de teams.ts). */
  equipo: string;
  /** Futbolista concreto. Si se omite, el arte vale para todo el equipo. */
  jugador?: string;
  cabeza: Fuente;
}

const DECLARACIONES: Record<string, Declaracion> = {
  'mexico/julian-quinones': {
    equipo: 'mexico',
    jugador: 'Julián Andrés Quiñones',
    // Julián Quiñones (México). Dibujado de perfil mirando a la izquierda.
    cabeza: {
      src: 'arte/jugadores/mexico/cabeza.svg',
      viewBox: [-815.47, -536.38, 823.54, 1018.53],
      ventana: [-815.47, -536.38, 823.54, 1018.53],
      ancho: 520,
      espejo: true,
    },
  },
};

const cache = new Map<string, ArteJugador>();
const loading = new Set<string>();
const failed = new Set<string>();
/** Callbacks a avisar cuando un arte termina de cargar (para re-pintar la UI). */
const oyentes = new Map<string, Set<() => void>>();

const botas: (Pieza | null)[] = GUAYOS.map(() => null);
let botasCargando: Promise<void> | null = null;

/** Declaraciones que sirven para este futbolista. */
function sirvenPara(equipo: string | undefined, jugador?: string): string[] {
  const nombre = jugador ? normNombre(jugador) : '';
  const fuera: string[] = [];
  for (const [id, decl] of Object.entries(DECLARACIONES)) {
    if (decl.equipo !== equipo) continue;
    if (!decl.jugador) fuera.push(id);
    else if (nombre && normNombre(decl.jugador) === nombre) fuera.push(id);
  }
  return fuera;
}

/** ¿Este futbolista tiene cabeza dibujada (aunque todavía no esté cargada)? */
export function tieneArte(equipo: string, jugador?: string): boolean {
  return sirvenPara(equipo, jugador).length > 0;
}

/** Cabeza lista para dibujar, o `null` si no hay o todavía no cargó. */
export function cabezaDe(equipo: string | undefined, jugador?: string): Pieza | null {
  for (const id of sirvenPara(equipo, jugador)) {
    const hit = cache.get(id);
    if (hit?.cabeza) return hit.cabeza;
  }
  return null;
}

/** Cabeza rasterizada como data URL, para mostrarla en la interfaz. */
export function cabezaUrl(equipo: string | undefined, jugador?: string): string | null {
  const pieza = cabezaDe(equipo, jugador);
  return pieza ? pieza.cv.toDataURL('image/png') : null;
}

/** Los botines de este futbolista, o `null` mientras cargan. */
export function guayosDe(equipo: string | undefined, jugador?: string): Pieza | null {
  return botas[guayoId(equipo, jugador)] ?? null;
}

/** Arte completo, para quien necesite las dos piezas a la vez. */
export function arteDe(equipo: string | undefined, jugador?: string): ArteJugador | null {
  const guayos = guayosDe(equipo, jugador);
  const cabeza = cabezaDe(equipo, jugador);
  if (!guayos && !cabeza) return null;
  return { cabeza, guayos };
}

/** Empieza a cargar los botines y las cabezas declaradas. Idempotente. */
export function precargarArte(): void {
  void cargarBotines();
  for (const id of Object.keys(DECLARACIONES)) void cargar(id);
}

/** Termina cuando los seis pares están listos (para pruebas y capturas). */
export function esperarGuayos(): Promise<void> {
  return cargarBotines();
}

function cargarBotines(): Promise<void> {
  botasCargando ??= Promise.all(
    GUAYOS.map(async ({ src, espejo }, i) => {
      if (botas[i]) return;
      try {
        botas[i] = await rasterizar(src, 420, espejo);
      } catch {
        // Un botín que no carga no puede tumbar el partido: el renderizador
        // dibuja el de siempre.
        botas[i] = null;
      }
    }),
  ).then(() => undefined);
  return botasCargando;
}

/**
 * Carga (una sola vez) la cabeza de un futbolista. `listo` se llama cuando
 * termina, para que la pantalla que lo pidió se vuelva a pintar.
 */
export function cargarArte(equipo: string, jugador?: string, listo?: () => void): void {
  const ids = sirvenPara(equipo, jugador);
  if (listo) {
    for (const id of ids) {
      if (cache.has(id) || failed.has(id)) continue;
      const set = oyentes.get(id) ?? new Set<() => void>();
      set.add(listo);
      oyentes.set(id, set);
    }
  }
  for (const id of ids) void cargar(id);
}

async function cargar(id: string): Promise<void> {
  const decl = DECLARACIONES[id];
  if (!decl || cache.has(id) || loading.has(id) || failed.has(id)) return;
  loading.add(id);
  try {
    const cabeza = await recortar(decl.cabeza);
    cache.set(id, { cabeza, guayos: null });
    for (const cb of oyentes.get(id) ?? []) cb();
  } catch {
    // Un SVG que no carga no puede tumbar el partido: ese futbolista sigue con
    // la cabeza de vectores, como si no tuviera arte.
    failed.add(id);
  } finally {
    loading.delete(id);
    oyentes.delete(id);
  }
}

/** Carga una imagen y la pasa a un canvas del tamaño exacto del recorte. */
async function rasterizar(src: string, ancho: number, espejo: boolean): Promise<Pieza> {
  const img = await cargarImagen(publicUrl(src));
  const k = ancho / img.naturalWidth;
  const w = Math.round(img.naturalWidth * k);
  const h = Math.round(img.naturalHeight * k);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  if (!ctx) throw new Error('sin contexto 2d');
  ctx.imageSmoothingQuality = 'high';
  if (espejo) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(img, 0, 0, w, h);
  return { cv, w, h };
}

/**
 * Carga el SVG y copia la ventana a un canvas del tamaño exacto del recorte.
 * Al dibujar el viewBox completo con ese encuadre, lo que queda fuera de la
 * ventana cae fuera del canvas y se recorta solo.
 */
async function recortar(f: Fuente): Promise<Pieza> {
  const img = await cargarImagen(publicUrl(f.src));

  const [vx, vy, vw, vh] = f.viewBox;
  const [wx, wy, ww, wh] = f.ventana;
  const k = f.ancho / ww;
  const w = Math.max(1, Math.round(ww * k));
  const h = Math.max(1, Math.round(wh * k));

  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  if (!ctx) throw new Error('sin contexto 2d');
  ctx.imageSmoothingQuality = 'high';
  if (f.espejo) {
    // Se dibuja espejado desde el recorte: así el jugador mira a +x, que es la
    // convención del renderizador (el espejo del partido se aplica después).
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(img, (vx - wx) * k, (vy - wy) * k, vw * k, vh * k);
  return { cv, w, h };
}

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error(`no cargó ${src}`));
    img.src = src;
  });
}
