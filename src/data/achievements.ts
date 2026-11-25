export interface Achievement {
  id: string;
  name: string;
  desc: string;
  cup: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'debut', name: 'Debut', desc: 'Juega tu primer partido', cup: '🎽' },
  { id: 'victoria', name: 'Primera victoria', desc: 'Gana un partido', cup: '🏅' },
  { id: 'goleada', name: 'Goleada', desc: 'Gana por tres o más', cup: '🥇' },
  { id: 'muralla', name: 'Muralla', desc: 'Termina con la valla en cero', cup: '🛡️' },
  { id: 'repoker', name: 'Repóker', desc: 'Marca cinco goles en un partido', cup: '🖐️' },
  { id: 'cabezazo', name: 'Cabeza de oro', desc: 'Marca de cabeza', cup: '🗿' },
  { id: 'duelo', name: 'Duelo de amigos', desc: 'Juega un dos jugadores', cup: '👥' },
  { id: 'grupo', name: 'Clasificado', desc: 'Termina entre los dos primeros de tu grupo', cup: '🏆' },
  { id: 'lider', name: 'Líder de grupo', desc: 'Gana tu grupo del Mundial', cup: '👑' },
  { id: 'campeon', name: 'Campeón del mundo', desc: 'Gana el Mundial 2026', cup: '🏆' },
  { id: 'legendario', name: 'Contra leyendas', desc: 'Gana en dificultad Legendario', cup: '💀' },
];
