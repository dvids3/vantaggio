/**
 * Bucle fijo. La simulación corre siempre a 240 Hz para que el balón, que
 * viaja a 46 m/s, no atraviese las colisiones. El render corre a la tasa del
 * monitor.
 */
export const FIXED_DT = 1 / 240;

export function startLoop(stepFn: (dt: number) => void, renderFn: (frameDt: number) => void): () => void {
  let last = performance.now();
  let acc = 0;
  let running = true;

  const frame = (now: number): void => {
    if (!running) return;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;

    acc += dt;
    let guard = 0;
    while (acc >= FIXED_DT && guard++ < 24) {
      stepFn(FIXED_DT);
      acc -= FIXED_DT;
    }
    if (guard >= 24) acc = 0;

    renderFn(dt);
    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
  return () => {
    running = false;
  };
}
