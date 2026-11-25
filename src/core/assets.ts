/**
 * URL de un recurso de `public/`.
 *
 * Se resuelve contra la página (`document.baseURI`) y no contra la raíz del
 * sitio: así el juego funciona igual servido en `/` que incrustado en
 * `/juegos/vantaggio/`, que es como lo publica la web del portal.
 */
export function publicUrl(path: string): string {
  const clean = path.replace(/^\/+/, '');
  if (typeof document === 'undefined') return `/${clean}`;
  return new URL(clean, document.baseURI).href;
}
