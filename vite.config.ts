import { defineConfig } from 'vite';

/**
 * `base: './'` deja el juego autocontenido: funciona igual servido en la raíz
 * que dentro de una subcarpeta (la web del portal lo publica en
 * /juegos/vantaggio/). Sin esto, los assets se piden a `/assets/...` del sitio
 * que lo incrusta y no cargan.
 */
export default defineConfig({
  base: './',
});
