export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const sign = (v: number): number => (v < 0 ? -1 : v > 0 ? 1 : 0);

/** Avanza `v` hacia `target` como máximo `maxDelta`. */
export const approach = (v: number, target: number, maxDelta: number): number => {
  if (v < target) return Math.min(v + maxDelta, target);
  if (v > target) return Math.max(v - maxDelta, target);
  return target;
};

export const damp = (v: number, perSecond: number, dt: number): number =>
  v / (1 + perSecond * dt);

export interface SegmentHit {
  nx: number;
  ny: number;
  penetration: number;
  px: number;
  py: number;
}

/**
 * Colisión círculo ↔ segmento. Devuelve la normal (del segmento hacia el círculo)
 * y cuánto hay que empujar para separarlos, o null si no se tocan.
 */
export function circleSegment(
  cx: number,
  cy: number,
  r: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): SegmentHit | null {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  let t = len2 > 0 ? ((cx - ax) * abx + (cy - ay) * aby) / len2 : 0;
  t = clamp(t, 0, 1);
  const px = ax + abx * t;
  const py = ay + aby * t;
  let dx = cx - px;
  let dy = cy - py;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  let d = Math.sqrt(d2);
  if (d < 1e-6) {
    // Círculo exactamente sobre el segmento: empuja por la normal del segmento.
    const n = len2 > 0 ? Math.hypot(abx, aby) : 1;
    dx = -aby / n;
    dy = abx / n;
    d = 1e-6;
  }
  const inv = 1 / (d || 1e-6);
  return { nx: dx * inv, ny: dy * inv, penetration: r - d, px, py };
}

/** PRNG determinista (mulberry32) para partículas y simulaciones paralelas. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
