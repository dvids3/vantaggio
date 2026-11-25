/**
 * Vantaggio — dataset de las 48 selecciones del Mundial 2026.
 *
 * 12 grupos × 4 selecciones = 48 equipos, 5 futbolistas elegibles por selección.
 * Los dorsales son los habituales del jugador en su selección (1..23, sin repetir
 * dentro de un equipo). Los stats son 1..99 y están calibrados por puesto:
 *   POR → jmp alto, pow bajo · DEF → jmp/pow altos · MED → pre alto · DEL → spd/pow/pre altos.
 */

export type GroupId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L';

export interface RosterPlayer {
  name: string; // "Luis Díaz"
  num: number; // dorsal 1..23
  pos: 'POR' | 'DEF' | 'MED' | 'DEL';
  spd: number; // 1..99 velocidad
  jmp: number; // 1..99 salto
  pow: number; // 1..99 potencia de remate
  pre: number; // 1..99 precisión
}

export interface Team {
  id: string; // kebab-case: 'mexico', 'corea-del-sur'
  name: string; // "México"
  short: string; // 3 letras: "MEX"
  group: GroupId;
  flag: string; // emoji bandera: "🇲🇽"
  jersey: string; // hex del color principal de la camiseta
  shorts: string; // hex pantaloneta
  socks: string; // hex medias
  skin: string; // hex tono de piel por defecto
  hair: string; // hex color de pelo por defecto
  roster: RosterPlayer[]; // 5 o más: al menos un portero y un delantero
}

export const TEAMS: Team[] = [
  // ───────────────────────────── Grupo A ─────────────────────────────
  {
    id: 'mexico', name: 'México', short: 'MEX', group: 'A', flag: '🇲🇽',
    jersey: '#006847', shorts: '#ffffff', socks: '#ce1126', skin: '#c68e5f', hair: '#2b1b12',
    roster: [
      { name: 'Guillermo Ochoa', num: 13, pos: 'POR', spd: 46, jmp: 74, pow: 32, pre: 60 },
      { name: 'César Montes', num: 3, pos: 'DEF', spd: 66, jmp: 82, pow: 58, pre: 62 },
      { name: 'Edson Álvarez', num: 4, pos: 'MED', spd: 72, jmp: 78, pow: 74, pre: 80 },
      { name: 'Hirving Lozano', num: 22, pos: 'DEL', spd: 88, jmp: 74, pow: 80, pre: 78 },
      { name: 'Santiago Giménez', num: 9, pos: 'DEL', spd: 84, jmp: 82, pow: 88, pre: 86 },
      // Sexto de la lista: la plantilla se puede ampliar y la selección de
      // futbolista recorre todos los que haya. Este es el que ya tiene arte
      // dibujado a mano (ver render/arte.ts).
      { name: 'Julián Andrés Quiñones', num: 17, pos: 'DEL', spd: 86, jmp: 76, pow: 76, pre: 74 },
    ],
  },
  {
    id: 'sudafrica', name: 'Sudáfrica', short: 'RSA', group: 'A', flag: '🇿🇦',
    jersey: '#ffb612', shorts: '#007749', socks: '#ffb612', skin: '#5c3a24', hair: '#141110',
    roster: [
      { name: 'Ronwen Williams', num: 1, pos: 'POR', spd: 58, jmp: 80, pow: 42, pre: 70 },
      { name: 'Khuliso Mudau', num: 2, pos: 'DEF', spd: 68, jmp: 66, pow: 50, pre: 56 },
      { name: 'Teboho Mokoena', num: 8, pos: 'MED', spd: 74, jmp: 74, pow: 78, pre: 84 },
      { name: 'Percy Tau', num: 10, pos: 'DEL', spd: 82, jmp: 72, pow: 76, pre: 80 },
      { name: 'Lyle Foster', num: 9, pos: 'DEL', spd: 84, jmp: 78, pow: 82, pre: 76 },
    ],
  },
  {
    id: 'corea-del-sur', name: 'Corea del Sur', short: 'KOR', group: 'A', flag: '🇰🇷',
    jersey: '#cd2e3a', shorts: '#0047a0', socks: '#cd2e3a', skin: '#e8c39e', hair: '#1a1a1a',
    roster: [
      { name: 'Jo Hyeon-woo', num: 21, pos: 'POR', spd: 54, jmp: 80, pow: 38, pre: 64 },
      { name: 'Kim Min-jae', num: 3, pos: 'DEF', spd: 74, jmp: 88, pow: 66, pre: 68 },
      { name: 'Lee Kang-in', num: 18, pos: 'MED', spd: 80, jmp: 70, pow: 76, pre: 86 },
      { name: 'Hwang Hee-chan', num: 11, pos: 'DEL', spd: 86, jmp: 76, pow: 82, pre: 78 },
      { name: 'Son Heung-min', num: 7, pos: 'DEL', spd: 90, jmp: 80, pow: 88, pre: 90 },
    ],
  },
  {
    id: 'chequia', name: 'Chequia', short: 'CZE', group: 'A', flag: '🇨🇿',
    jersey: '#d7141a', shorts: '#ffffff', socks: '#11457e', skin: '#e6c4a8', hair: '#4a2c17',
    roster: [
      { name: 'Jindřich Staněk', num: 1, pos: 'POR', spd: 50, jmp: 76, pow: 36, pre: 62 },
      { name: 'Vladimír Coufal', num: 5, pos: 'DEF', spd: 72, jmp: 74, pow: 58, pre: 62 },
      { name: 'Tomáš Souček', num: 15, pos: 'MED', spd: 66, jmp: 86, pow: 78, pre: 74 },
      { name: 'Antonín Barák', num: 22, pos: 'MED', spd: 74, jmp: 72, pow: 76, pre: 80 },
      { name: 'Patrik Schick', num: 9, pos: 'DEL', spd: 82, jmp: 84, pow: 90, pre: 86 },
    ],
  },

  // ───────────────────────────── Grupo B ─────────────────────────────
  {
    id: 'canada', name: 'Canadá', short: 'CAN', group: 'B', flag: '🇨🇦',
    jersey: '#d80621', shorts: '#d80621', socks: '#d80621', skin: '#d9a878', hair: '#2e1c10',
    roster: [
      { name: 'Milan Borjan', num: 18, pos: 'POR', spd: 48, jmp: 78, pow: 34, pre: 60 },
      { name: 'Alphonso Davies', num: 19, pos: 'DEF', spd: 96, jmp: 82, pow: 78, pre: 80 },
      { name: 'Stephen Eustáquio', num: 7, pos: 'MED', spd: 76, jmp: 74, pow: 72, pre: 82 },
      { name: 'Cyle Larin', num: 17, pos: 'DEL', spd: 78, jmp: 84, pow: 82, pre: 72 },
      { name: 'Jonathan David', num: 20, pos: 'DEL', spd: 86, jmp: 74, pow: 86, pre: 84 },
    ],
  },
  {
    id: 'bosnia-y-herzegovina', name: 'Bosnia y Herzegovina', short: 'BIH', group: 'B', flag: '🇧🇦',
    jersey: '#002f6c', shorts: '#002f6c', socks: '#002f6c', skin: '#e0bd97', hair: '#3b2415',
    roster: [
      { name: 'Nikola Vasilj', num: 1, pos: 'POR', spd: 50, jmp: 76, pow: 36, pre: 62 },
      { name: 'Sead Kolašinac', num: 5, pos: 'DEF', spd: 74, jmp: 82, pow: 66, pre: 60 },
      { name: 'Miralem Pjanić', num: 10, pos: 'MED', spd: 68, jmp: 70, pow: 82, pre: 92 },
      { name: 'Ermedin Demirović', num: 9, pos: 'DEL', spd: 80, jmp: 80, pow: 84, pre: 76 },
      { name: 'Edin Džeko', num: 11, pos: 'DEL', spd: 64, jmp: 88, pow: 88, pre: 84 },
    ],
  },
  {
    id: 'catar', name: 'Catar', short: 'QAT', group: 'B', flag: '🇶🇦',
    jersey: '#8a1538', shorts: '#ffffff', socks: '#8a1538', skin: '#c99a6b', hair: '#14100c',
    roster: [
      { name: 'Meshaal Barsham', num: 22, pos: 'POR', spd: 52, jmp: 78, pow: 38, pre: 64 },
      { name: 'Boualem Khoukhi', num: 5, pos: 'DEF', spd: 62, jmp: 80, pow: 62, pre: 62 },
      { name: 'Mohammed Waad', num: 6, pos: 'MED', spd: 60, jmp: 70, pow: 62, pre: 72 },
      { name: 'Akram Afif', num: 11, pos: 'DEL', spd: 88, jmp: 72, pow: 86, pre: 92 },
      { name: 'Almoez Ali', num: 19, pos: 'DEL', spd: 82, jmp: 84, pow: 88, pre: 80 },
    ],
  },
  {
    id: 'suiza', name: 'Suiza', short: 'SUI', group: 'B', flag: '🇨🇭',
    jersey: '#d52b1e', shorts: '#ffffff', socks: '#d52b1e', skin: '#e9c7a7', hair: '#6b4a2a',
    roster: [
      { name: 'Yann Sommer', num: 1, pos: 'POR', spd: 52, jmp: 80, pow: 34, pre: 68 },
      { name: 'Manuel Akanji', num: 5, pos: 'DEF', spd: 78, jmp: 86, pow: 62, pre: 70 },
      { name: 'Remo Freuler', num: 8, pos: 'MED', spd: 72, jmp: 72, pow: 74, pre: 80 },
      { name: 'Granit Xhaka', num: 10, pos: 'MED', spd: 66, jmp: 76, pow: 82, pre: 92 },
      { name: 'Breel Embolo', num: 7, pos: 'DEL', spd: 84, jmp: 82, pow: 84, pre: 76 },
    ],
  },

  // ───────────────────────────── Grupo C ─────────────────────────────
  {
    id: 'brasil', name: 'Brasil', short: 'BRA', group: 'C', flag: '🇧🇷',
    jersey: '#f7d117', shorts: '#0055a4', socks: '#ffffff', skin: '#8d5524', hair: '#1b1210',
    roster: [
      { name: 'Alisson Becker', num: 1, pos: 'POR', spd: 56, jmp: 84, pow: 38, pre: 74 },
      { name: 'Marquinhos', num: 4, pos: 'DEF', spd: 76, jmp: 86, pow: 66, pre: 74 },
      { name: 'Casemiro', num: 5, pos: 'MED', spd: 64, jmp: 82, pow: 82, pre: 84 },
      { name: 'Vinícius Júnior', num: 7, pos: 'DEL', spd: 96, jmp: 82, pow: 90, pre: 88 },
      { name: 'Rodrygo Goes', num: 11, pos: 'DEL', spd: 88, jmp: 78, pow: 86, pre: 88 },
    ],
  },
  {
    id: 'marruecos', name: 'Marruecos', short: 'MAR', group: 'C', flag: '🇲🇦',
    jersey: '#c1272d', shorts: '#c1272d', socks: '#006233', skin: '#c58b5c', hair: '#1c1410',
    roster: [
      { name: 'Yassine Bounou', num: 1, pos: 'POR', spd: 54, jmp: 82, pow: 36, pre: 70 },
      { name: 'Achraf Hakimi', num: 2, pos: 'DEF', spd: 92, jmp: 80, pow: 78, pre: 82 },
      { name: 'Sofyan Amrabat', num: 4, pos: 'MED', spd: 70, jmp: 78, pow: 70, pre: 78 },
      { name: 'Brahim Díaz', num: 10, pos: 'MED', spd: 84, jmp: 72, pow: 78, pre: 86 },
      { name: 'Youssef En-Nesyri', num: 19, pos: 'DEL', spd: 80, jmp: 88, pow: 84, pre: 76 },
    ],
  },
  {
    id: 'haiti', name: 'Haití', short: 'HAI', group: 'C', flag: '🇭🇹',
    jersey: '#00209f', shorts: '#00209f', socks: '#d21034', skin: '#6b4226', hair: '#120d0a',
    roster: [
      { name: 'Johny Placide', num: 1, pos: 'POR', spd: 46, jmp: 76, pow: 34, pre: 58 },
      { name: 'Ricardo Adé', num: 4, pos: 'DEF', spd: 68, jmp: 78, pow: 58, pre: 58 },
      { name: 'Danley Jean Jacques', num: 6, pos: 'MED', spd: 70, jmp: 74, pow: 68, pre: 74 },
      { name: 'Frantzdy Pierrot', num: 10, pos: 'DEL', spd: 78, jmp: 86, pow: 80, pre: 70 },
      { name: 'Duckens Nazon', num: 9, pos: 'DEL', spd: 84, jmp: 74, pow: 84, pre: 76 },
    ],
  },
  {
    id: 'escocia', name: 'Escocia', short: 'SCO', group: 'C', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    jersey: '#1b2a5e', shorts: '#ffffff', socks: '#1b2a5e', skin: '#f0cfae', hair: '#a8562a',
    roster: [
      { name: 'Angus Gunn', num: 1, pos: 'POR', spd: 50, jmp: 78, pow: 34, pre: 64 },
      { name: 'Andrew Robertson', num: 3, pos: 'DEF', spd: 86, jmp: 72, pow: 70, pre: 84 },
      { name: 'Scott McTominay', num: 4, pos: 'MED', spd: 78, jmp: 88, pow: 86, pre: 80 },
      { name: 'John McGinn', num: 7, pos: 'MED', spd: 72, jmp: 82, pow: 84, pre: 82 },
      { name: 'Che Adams', num: 9, pos: 'DEL', spd: 80, jmp: 74, pow: 80, pre: 74 },
    ],
  },

  // ───────────────────────────── Grupo D ─────────────────────────────
  {
    id: 'estados-unidos', name: 'Estados Unidos', short: 'USA', group: 'D', flag: '🇺🇸',
    jersey: '#ffffff', shorts: '#1b2e6b', socks: '#ffffff', skin: '#f0c9a6', hair: '#2f2016',
    roster: [
      { name: 'Matt Turner', num: 1, pos: 'POR', spd: 52, jmp: 82, pow: 34, pre: 66 },
      { name: 'Sergiño Dest', num: 2, pos: 'DEF', spd: 88, jmp: 72, pow: 66, pre: 78 },
      { name: 'Weston McKennie', num: 8, pos: 'MED', spd: 78, jmp: 84, pow: 78, pre: 82 },
      { name: 'Folarin Balogun', num: 9, pos: 'DEL', spd: 86, jmp: 80, pow: 84, pre: 78 },
      { name: 'Christian Pulisic', num: 10, pos: 'DEL', spd: 90, jmp: 74, pow: 86, pre: 92 },
    ],
  },
  {
    id: 'paraguay', name: 'Paraguay', short: 'PAR', group: 'D', flag: '🇵🇾',
    jersey: '#d52b1e', shorts: '#0038a8', socks: '#d52b1e', skin: '#c99165', hair: '#1c1310',
    roster: [
      { name: 'Antony Silva', num: 1, pos: 'POR', spd: 48, jmp: 76, pow: 34, pre: 60 },
      { name: 'Gustavo Gómez', num: 15, pos: 'DEF', spd: 66, jmp: 88, pow: 66, pre: 62 },
      { name: 'Andrés Cubas', num: 5, pos: 'MED', spd: 72, jmp: 76, pow: 68, pre: 78 },
      { name: 'Julio Enciso', num: 19, pos: 'DEL', spd: 84, jmp: 72, pow: 84, pre: 82 },
      { name: 'Miguel Almirón', num: 10, pos: 'DEL', spd: 90, jmp: 74, pow: 82, pre: 84 },
    ],
  },
  {
    id: 'australia', name: 'Australia', short: 'AUS', group: 'D', flag: '🇦🇺',
    jersey: '#ffcd00', shorts: '#00843d', socks: '#ffcd00', skin: '#e8b98a', hair: '#4b3220',
    roster: [
      { name: 'Mathew Ryan', num: 1, pos: 'POR', spd: 52, jmp: 80, pow: 36, pre: 66 },
      { name: 'Harry Souttar', num: 19, pos: 'DEF', spd: 60, jmp: 94, pow: 66, pre: 58 },
      { name: 'Riley McGree', num: 10, pos: 'MED', spd: 78, jmp: 74, pow: 80, pre: 84 },
      { name: 'Jackson Irvine', num: 22, pos: 'MED', spd: 70, jmp: 84, pow: 84, pre: 82 },
      { name: 'Mitchell Duke', num: 15, pos: 'DEL', spd: 72, jmp: 84, pow: 78, pre: 66 },
    ],
  },
  {
    id: 'turquia', name: 'Turquía', short: 'TUR', group: 'D', flag: '🇹🇷',
    jersey: '#e30a17', shorts: '#ffffff', socks: '#e30a17', skin: '#e3bd98', hair: '#241a12',
    roster: [
      { name: 'Uğurcan Çakır', num: 1, pos: 'POR', spd: 54, jmp: 80, pow: 38, pre: 68 },
      { name: 'Merih Demiral', num: 3, pos: 'DEF', spd: 70, jmp: 88, pow: 70, pre: 60 },
      { name: 'Arda Güler', num: 8, pos: 'MED', spd: 82, jmp: 70, pow: 82, pre: 90 },
      { name: 'Kenan Yıldız', num: 11, pos: 'DEL', spd: 86, jmp: 74, pow: 84, pre: 82 },
      { name: 'Hakan Çalhanoğlu', num: 10, pos: 'MED', spd: 68, jmp: 76, pow: 92, pre: 94 },
    ],
  },

  // ───────────────────────────── Grupo E ─────────────────────────────
  {
    id: 'alemania', name: 'Alemania', short: 'GER', group: 'E', flag: '🇩🇪',
    jersey: '#ffffff', shorts: '#000000', socks: '#ffffff', skin: '#f2d3b3', hair: '#6d4c2f',
    roster: [
      { name: 'Marc-André ter Stegen', num: 1, pos: 'POR', spd: 52, jmp: 80, pow: 36, pre: 72 },
      { name: 'Antonio Rüdiger', num: 2, pos: 'DEF', spd: 78, jmp: 88, pow: 64, pre: 66 },
      { name: 'Kai Havertz', num: 7, pos: 'DEL', spd: 82, jmp: 84, pow: 86, pre: 82 },
      { name: 'Florian Wirtz', num: 17, pos: 'MED', spd: 82, jmp: 68, pow: 80, pre: 90 },
      { name: 'Jamal Musiala', num: 10, pos: 'MED', spd: 90, jmp: 72, pow: 84, pre: 90 },
    ],
  },
  {
    id: 'curazao', name: 'Curazao', short: 'CUW', group: 'E', flag: '🇨🇼',
    jersey: '#002b7f', shorts: '#002b7f', socks: '#f9e300', skin: '#6b4630', hair: '#171009',
    roster: [
      { name: 'Eloy Room', num: 1, pos: 'POR', spd: 50, jmp: 80, pow: 34, pre: 62 },
      { name: 'Cuco Martina', num: 2, pos: 'DEF', spd: 64, jmp: 74, pow: 56, pre: 58 },
      { name: 'Leandro Bacuna', num: 8, pos: 'MED', spd: 72, jmp: 72, pow: 76, pre: 78 },
      { name: 'Rangelo Janga', num: 9, pos: 'DEL', spd: 76, jmp: 84, pow: 82, pre: 68 },
      { name: 'Tahith Chong', num: 11, pos: 'DEL', spd: 86, jmp: 74, pow: 78, pre: 82 },
    ],
  },
  {
    id: 'costa-de-marfil', name: 'Costa de Marfil', short: 'CIV', group: 'E', flag: '🇨🇮',
    jersey: '#ff8200', shorts: '#ffffff', socks: '#009a44', skin: '#5a3520', hair: '#100b08',
    roster: [
      { name: 'Yahia Fofana', num: 1, pos: 'POR', spd: 52, jmp: 80, pow: 36, pre: 64 },
      { name: 'Odilon Kossounou', num: 4, pos: 'DEF', spd: 78, jmp: 84, pow: 62, pre: 64 },
      { name: 'Franck Kessié', num: 8, pos: 'MED', spd: 74, jmp: 84, pow: 84, pre: 80 },
      { name: 'Simon Adingra', num: 11, pos: 'DEL', spd: 88, jmp: 72, pow: 78, pre: 80 },
      { name: 'Sébastien Haller', num: 9, pos: 'DEL', spd: 70, jmp: 88, pow: 90, pre: 80 },
    ],
  },
  {
    id: 'ecuador', name: 'Ecuador', short: 'ECU', group: 'E', flag: '🇪🇨',
    jersey: '#ffd100', shorts: '#0072ce', socks: '#ef3340', skin: '#c98d5e', hair: '#1a120d',
    roster: [
      { name: 'Hernán Galíndez', num: 1, pos: 'POR', spd: 50, jmp: 78, pow: 34, pre: 64 },
      { name: 'Piero Hincapié', num: 3, pos: 'DEF', spd: 80, jmp: 86, pow: 64, pre: 70 },
      { name: 'Kendry Páez', num: 10, pos: 'MED', spd: 82, jmp: 70, pow: 80, pre: 86 },
      { name: 'Moisés Caicedo', num: 23, pos: 'MED', spd: 84, jmp: 82, pow: 78, pre: 86 },
      { name: 'Enner Valencia', num: 13, pos: 'DEL', spd: 76, jmp: 80, pow: 84, pre: 76 },
    ],
  },

  // ───────────────────────────── Grupo F ─────────────────────────────
  {
    id: 'paises-bajos', name: 'Países Bajos', short: 'NED', group: 'F', flag: '🇳🇱',
    jersey: '#f36c21', shorts: '#101820', socks: '#f36c21', skin: '#f0cba8', hair: '#a8562a',
    roster: [
      { name: 'Bart Verbruggen', num: 1, pos: 'POR', spd: 52, jmp: 80, pow: 36, pre: 68 },
      { name: 'Virgil van Dijk', num: 4, pos: 'DEF', spd: 74, jmp: 92, pow: 72, pre: 74 },
      { name: 'Frenkie de Jong', num: 21, pos: 'MED', spd: 80, jmp: 76, pow: 78, pre: 90 },
      { name: 'Memphis Depay', num: 10, pos: 'DEL', spd: 82, jmp: 78, pow: 88, pre: 86 },
      { name: 'Cody Gakpo', num: 11, pos: 'DEL', spd: 88, jmp: 80, pow: 86, pre: 84 },
    ],
  },
  {
    id: 'japon', name: 'Japón', short: 'JPN', group: 'F', flag: '🇯🇵',
    jersey: '#1c2f6b', shorts: '#1c2f6b', socks: '#1c2f6b', skin: '#eac9a4', hair: '#101010',
    roster: [
      { name: 'Zion Suzuki', num: 1, pos: 'POR', spd: 54, jmp: 80, pow: 36, pre: 66 },
      { name: 'Ko Itakura', num: 4, pos: 'DEF', spd: 76, jmp: 86, pow: 62, pre: 68 },
      { name: 'Wataru Endo', num: 6, pos: 'MED', spd: 70, jmp: 82, pow: 78, pre: 80 },
      { name: 'Takefusa Kubo', num: 11, pos: 'MED', spd: 86, jmp: 70, pow: 80, pre: 90 },
      { name: 'Kaoru Mitoma', num: 14, pos: 'DEL', spd: 92, jmp: 74, pow: 82, pre: 86 },
    ],
  },
  {
    id: 'suecia', name: 'Suecia', short: 'SWE', group: 'F', flag: '🇸🇪',
    jersey: '#fecc02', shorts: '#005293', socks: '#fecc02', skin: '#f3d3b6', hair: '#d9b26a',
    roster: [
      { name: 'Robin Olsen', num: 1, pos: 'POR', spd: 48, jmp: 78, pow: 34, pre: 62 },
      { name: 'Victor Lindelöf', num: 2, pos: 'DEF', spd: 72, jmp: 82, pow: 60, pre: 72 },
      { name: 'Dejan Kulusevski', num: 21, pos: 'MED', spd: 82, jmp: 74, pow: 80, pre: 88 },
      { name: 'Alexander Isak', num: 11, pos: 'DEL', spd: 92, jmp: 82, pow: 90, pre: 86 },
      { name: 'Viktor Gyökeres', num: 9, pos: 'DEL', spd: 84, jmp: 86, pow: 94, pre: 84 },
    ],
  },
  {
    id: 'tunez', name: 'Túnez', short: 'TUN', group: 'F', flag: '🇹🇳',
    jersey: '#e70013', shorts: '#ffffff', socks: '#e70013', skin: '#c08b5c', hair: '#191210',
    roster: [
      { name: 'Aymen Dahmen', num: 1, pos: 'POR', spd: 50, jmp: 78, pow: 34, pre: 62 },
      { name: 'Montassar Talbi', num: 3, pos: 'DEF', spd: 70, jmp: 84, pow: 60, pre: 66 },
      { name: 'Ellyes Skhiri', num: 8, pos: 'MED', spd: 72, jmp: 76, pow: 76, pre: 84 },
      { name: 'Hannibal Mejbri', num: 10, pos: 'MED', spd: 78, jmp: 70, pow: 74, pre: 82 },
      { name: 'Youssef Msakni', num: 7, pos: 'DEL', spd: 84, jmp: 72, pow: 80, pre: 86 },
    ],
  },

  // ───────────────────────────── Grupo G ─────────────────────────────
  {
    id: 'belgica', name: 'Bélgica', short: 'BEL', group: 'G', flag: '🇧🇪',
    jersey: '#e30613', shorts: '#e30613', socks: '#e30613', skin: '#eccaa8', hair: '#4a2f1c',
    roster: [
      { name: 'Thibaut Courtois', num: 1, pos: 'POR', spd: 50, jmp: 94, pow: 34, pre: 72 },
      { name: 'Wout Faes', num: 4, pos: 'DEF', spd: 68, jmp: 82, pow: 58, pre: 64 },
      { name: 'Kevin De Bruyne', num: 7, pos: 'MED', spd: 70, jmp: 74, pow: 92, pre: 98 },
      { name: 'Jérémy Doku', num: 22, pos: 'DEL', spd: 94, jmp: 68, pow: 76, pre: 82 },
      { name: 'Romelu Lukaku', num: 9, pos: 'DEL', spd: 80, jmp: 88, pow: 88, pre: 76 },
    ],
  },
  {
    id: 'egipto', name: 'Egipto', short: 'EGY', group: 'G', flag: '🇪🇬',
    jersey: '#c8102e', shorts: '#ffffff', socks: '#101820', skin: '#b97a4e', hair: '#12100e',
    roster: [
      { name: 'Mohamed El-Shenawy', num: 1, pos: 'POR', spd: 50, jmp: 80, pow: 34, pre: 64 },
      { name: 'Ahmed Hegazi', num: 6, pos: 'DEF', spd: 62, jmp: 84, pow: 60, pre: 58 },
      { name: 'Mohamed Elneny', num: 17, pos: 'MED', spd: 64, jmp: 74, pow: 66, pre: 78 },
      { name: 'Omar Marmoush', num: 9, pos: 'DEL', spd: 90, jmp: 78, pow: 86, pre: 84 },
      { name: 'Mohamed Salah', num: 10, pos: 'DEL', spd: 92, jmp: 76, pow: 88, pre: 90 },
    ],
  },
  {
    id: 'iran', name: 'Irán', short: 'IRN', group: 'G', flag: '🇮🇷',
    jersey: '#ffffff', shorts: '#ffffff', socks: '#ffffff', skin: '#d9a878', hair: '#1b1410',
    roster: [
      { name: 'Alireza Beiranvand', num: 1, pos: 'POR', spd: 50, jmp: 80, pow: 36, pre: 62 },
      { name: 'Milad Mohammadi', num: 5, pos: 'DEF', spd: 78, jmp: 72, pow: 58, pre: 64 },
      { name: 'Saeid Ezatolahi', num: 6, pos: 'MED', spd: 64, jmp: 78, pow: 66, pre: 76 },
      { name: 'Sardar Azmoun', num: 20, pos: 'DEL', spd: 78, jmp: 84, pow: 86, pre: 78 },
      { name: 'Mehdi Taremi', num: 9, pos: 'DEL', spd: 76, jmp: 86, pow: 92, pre: 84 },
    ],
  },
  {
    id: 'nueva-zelanda', name: 'Nueva Zelanda', short: 'NZL', group: 'G', flag: '🇳🇿',
    jersey: '#ffffff', shorts: '#101820', socks: '#ffffff', skin: '#efd0b0', hair: '#6b4a2a',
    roster: [
      { name: 'Max Crocombe', num: 1, pos: 'POR', spd: 48, jmp: 78, pow: 32, pre: 60 },
      { name: 'Michael Boxall', num: 5, pos: 'DEF', spd: 62, jmp: 84, pow: 58, pre: 56 },
      { name: 'Joe Bell', num: 6, pos: 'MED', spd: 66, jmp: 72, pow: 62, pre: 74 },
      { name: 'Sarpreet Singh', num: 10, pos: 'MED', spd: 74, jmp: 68, pow: 72, pre: 82 },
      { name: 'Chris Wood', num: 9, pos: 'DEL', spd: 68, jmp: 94, pow: 90, pre: 80 },
    ],
  },

  // ───────────────────────────── Grupo H ─────────────────────────────
  {
    id: 'espana', name: 'España', short: 'ESP', group: 'H', flag: '🇪🇸',
    jersey: '#c60b1e', shorts: '#1a3a8f', socks: '#c60b1e', skin: '#e8c3a0', hair: '#2a1c12',
    roster: [
      { name: 'Unai Simón', num: 23, pos: 'POR', spd: 52, jmp: 80, pow: 36, pre: 70 },
      { name: 'Aymeric Laporte', num: 14, pos: 'DEF', spd: 68, jmp: 84, pow: 62, pre: 72 },
      { name: 'Pedri González', num: 8, pos: 'MED', spd: 76, jmp: 68, pow: 78, pre: 94 },
      { name: 'Rodri Hernández', num: 16, pos: 'MED', spd: 66, jmp: 80, pow: 84, pre: 94 },
      { name: 'Lamine Yamal', num: 19, pos: 'DEL', spd: 90, jmp: 72, pow: 86, pre: 92 },
    ],
  },
  {
    id: 'cabo-verde', name: 'Cabo Verde', short: 'CPV', group: 'H', flag: '🇨🇻',
    jersey: '#003893', shorts: '#003893', socks: '#ffffff', skin: '#6f4629', hair: '#120d0a',
    roster: [
      { name: 'Vozinha', num: 1, pos: 'POR', spd: 48, jmp: 76, pow: 32, pre: 58 },
      { name: 'Roberto Lopes', num: 4, pos: 'DEF', spd: 64, jmp: 82, pow: 56, pre: 58 },
      { name: 'Jamiro Monteiro', num: 8, pos: 'MED', spd: 72, jmp: 72, pow: 70, pre: 76 },
      { name: 'Ryan Mendes', num: 10, pos: 'DEL', spd: 80, jmp: 70, pow: 78, pre: 80 },
      { name: 'Bebé', num: 11, pos: 'DEL', spd: 74, jmp: 76, pow: 88, pre: 78 },
    ],
  },
  {
    id: 'arabia-saudita', name: 'Arabia Saudita', short: 'KSA', group: 'H', flag: '🇸🇦',
    jersey: '#ffffff', shorts: '#006c35', socks: '#ffffff', skin: '#c99a6b', hair: '#14100c',
    roster: [
      { name: 'Mohammed Al-Owais', num: 21, pos: 'POR', spd: 50, jmp: 78, pow: 34, pre: 64 },
      { name: 'Ali Al-Bulaihi', num: 4, pos: 'DEF', spd: 64, jmp: 84, pow: 58, pre: 58 },
      { name: 'Mohamed Kanno', num: 17, pos: 'MED', spd: 70, jmp: 74, pow: 70, pre: 78 },
      { name: 'Firas Al-Buraikan', num: 9, pos: 'DEL', spd: 82, jmp: 76, pow: 82, pre: 78 },
      { name: 'Salem Al-Dawsari', num: 10, pos: 'DEL', spd: 86, jmp: 70, pow: 84, pre: 88 },
    ],
  },
  {
    id: 'uruguay', name: 'Uruguay', short: 'URU', group: 'H', flag: '🇺🇾',
    jersey: '#5aa9e6', shorts: '#101820', socks: '#101820', skin: '#ecc9a6', hair: '#3a2718',
    roster: [
      { name: 'Sergio Rochet', num: 1, pos: 'POR', spd: 52, jmp: 80, pow: 34, pre: 68 },
      { name: 'Ronald Araújo', num: 4, pos: 'DEF', spd: 76, jmp: 92, pow: 70, pre: 66 },
      { name: 'Giorgian de Arrascaeta', num: 10, pos: 'MED', spd: 74, jmp: 70, pow: 82, pre: 90 },
      { name: 'Federico Valverde', num: 15, pos: 'MED', spd: 84, jmp: 80, pow: 88, pre: 88 },
      { name: 'Darwin Núñez', num: 9, pos: 'DEL', spd: 88, jmp: 84, pow: 88, pre: 76 },
    ],
  },

  // ───────────────────────────── Grupo I ─────────────────────────────
  {
    id: 'francia', name: 'Francia', short: 'FRA', group: 'I', flag: '🇫🇷',
    jersey: '#1e2a5a', shorts: '#ffffff', socks: '#d52b1e', skin: '#a9714a', hair: '#161210',
    roster: [
      { name: 'Mike Maignan', num: 1, pos: 'POR', spd: 54, jmp: 82, pow: 36, pre: 74 },
      { name: 'William Saliba', num: 17, pos: 'DEF', spd: 78, jmp: 86, pow: 62, pre: 72 },
      { name: 'Aurélien Tchouaméni', num: 8, pos: 'MED', spd: 72, jmp: 84, pow: 78, pre: 82 },
      { name: 'Ousmane Dembélé', num: 11, pos: 'DEL', spd: 90, jmp: 72, pow: 84, pre: 88 },
      { name: 'Kylian Mbappé', num: 10, pos: 'DEL', spd: 98, jmp: 82, pow: 92, pre: 90 },
    ],
  },
  {
    id: 'senegal', name: 'Senegal', short: 'SEN', group: 'I', flag: '🇸🇳',
    jersey: '#00853f', shorts: '#fdef42', socks: '#00853f', skin: '#5c3620', hair: '#0f0b09',
    roster: [
      { name: 'Édouard Mendy', num: 16, pos: 'POR', spd: 50, jmp: 80, pow: 34, pre: 66 },
      { name: 'Kalidou Koulibaly', num: 3, pos: 'DEF', spd: 70, jmp: 88, pow: 66, pre: 62 },
      { name: 'Idrissa Gana Gueye', num: 5, pos: 'MED', spd: 68, jmp: 74, pow: 70, pre: 78 },
      { name: 'Nicolas Jackson', num: 9, pos: 'DEL', spd: 90, jmp: 78, pow: 82, pre: 74 },
      { name: 'Sadio Mané', num: 10, pos: 'DEL', spd: 88, jmp: 78, pow: 86, pre: 86 },
    ],
  },
  {
    id: 'irak', name: 'Irak', short: 'IRQ', group: 'I', flag: '🇮🇶',
    jersey: '#007a3d', shorts: '#ffffff', socks: '#101820', skin: '#c89468', hair: '#16110d',
    roster: [
      { name: 'Jalal Hassan', num: 1, pos: 'POR', spd: 46, jmp: 76, pow: 32, pre: 58 },
      { name: 'Rebin Sulaka', num: 4, pos: 'DEF', spd: 62, jmp: 80, pow: 58, pre: 56 },
      { name: 'Zidane Iqbal', num: 8, pos: 'MED', spd: 74, jmp: 70, pow: 70, pre: 80 },
      { name: 'Ali Al-Hamadi', num: 10, pos: 'DEL', spd: 78, jmp: 78, pow: 78, pre: 74 },
      { name: 'Aymen Hussein', num: 9, pos: 'DEL', spd: 76, jmp: 84, pow: 84, pre: 72 },
    ],
  },
  {
    id: 'noruega', name: 'Noruega', short: 'NOR', group: 'I', flag: '🇳🇴',
    jersey: '#ba0c2f', shorts: '#ffffff', socks: '#00205b', skin: '#f5d6ba', hair: '#c9a15a',
    roster: [
      { name: 'Ørjan Nyland', num: 1, pos: 'POR', spd: 50, jmp: 80, pow: 34, pre: 64 },
      { name: 'Kristoffer Ajer', num: 5, pos: 'DEF', spd: 72, jmp: 88, pow: 62, pre: 66 },
      { name: 'Martin Ødegaard', num: 10, pos: 'MED', spd: 74, jmp: 68, pow: 86, pre: 96 },
      { name: 'Alexander Sørloth', num: 11, pos: 'DEL', spd: 76, jmp: 92, pow: 88, pre: 74 },
      { name: 'Erling Haaland', num: 9, pos: 'DEL', spd: 88, jmp: 94, pow: 96, pre: 84 },
    ],
  },

  // ───────────────────────────── Grupo J ─────────────────────────────
  {
    id: 'argentina', name: 'Argentina', short: 'ARG', group: 'J', flag: '🇦🇷',
    jersey: '#75aadb', shorts: '#101820', socks: '#ffffff', skin: '#e8c8a8', hair: '#3b2718',
    roster: [
      { name: 'Emiliano Martínez', num: 23, pos: 'POR', spd: 52, jmp: 82, pow: 36, pre: 72 },
      { name: 'Cristian Romero', num: 13, pos: 'DEF', spd: 74, jmp: 90, pow: 66, pre: 68 },
      { name: 'Rodrigo De Paul', num: 7, pos: 'MED', spd: 76, jmp: 74, pow: 78, pre: 84 },
      { name: 'Julián Álvarez', num: 9, pos: 'DEL', spd: 88, jmp: 80, pow: 86, pre: 80 },
      { name: 'Lionel Messi', num: 10, pos: 'DEL', spd: 74, jmp: 70, pow: 96, pre: 98 },
    ],
  },
  {
    id: 'argelia', name: 'Argelia', short: 'ALG', group: 'J', flag: '🇩🇿',
    jersey: '#ffffff', shorts: '#006233', socks: '#ffffff', skin: '#c08a5c', hair: '#17100c',
    roster: [
      { name: 'Alexandre Oukidja', num: 1, pos: 'POR', spd: 50, jmp: 78, pow: 34, pre: 62 },
      { name: 'Ramy Bensebaini', num: 3, pos: 'DEF', spd: 76, jmp: 82, pow: 64, pre: 66 },
      { name: 'Ismaël Bennacer', num: 4, pos: 'MED', spd: 76, jmp: 74, pow: 72, pre: 86 },
      { name: 'Amine Gouiri', num: 9, pos: 'DEL', spd: 82, jmp: 76, pow: 80, pre: 82 },
      { name: 'Riyad Mahrez', num: 7, pos: 'DEL', spd: 84, jmp: 68, pow: 84, pre: 94 },
    ],
  },
  {
    id: 'austria', name: 'Austria', short: 'AUT', group: 'J', flag: '🇦🇹',
    jersey: '#ed2939', shorts: '#ffffff', socks: '#ed2939', skin: '#f0cfae', hair: '#5a3a22',
    roster: [
      { name: 'Alexander Schlager', num: 1, pos: 'POR', spd: 50, jmp: 78, pow: 34, pre: 64 },
      { name: 'David Alaba', num: 8, pos: 'DEF', spd: 78, jmp: 82, pow: 78, pre: 88 },
      { name: 'Marcel Sabitzer', num: 9, pos: 'MED', spd: 76, jmp: 78, pow: 82, pre: 82 },
      { name: 'Christoph Baumgartner', num: 19, pos: 'MED', spd: 82, jmp: 76, pow: 78, pre: 80 },
      { name: 'Marko Arnautović', num: 7, pos: 'DEL', spd: 68, jmp: 84, pow: 86, pre: 78 },
    ],
  },
  {
    id: 'jordania', name: 'Jordania', short: 'JOR', group: 'J', flag: '🇯🇴',
    jersey: '#ffffff', shorts: '#101820', socks: '#ffffff', skin: '#c99a6b', hair: '#14100c',
    roster: [
      { name: 'Yazeed Abu Laila', num: 1, pos: 'POR', spd: 48, jmp: 78, pow: 32, pre: 60 },
      { name: 'Abdallah Nasib', num: 4, pos: 'DEF', spd: 64, jmp: 80, pow: 56, pre: 58 },
      { name: 'Nour Al-Rawabdeh', num: 8, pos: 'MED', spd: 70, jmp: 74, pow: 68, pre: 76 },
      { name: 'Yazan Al-Naimat', num: 9, pos: 'DEL', spd: 78, jmp: 80, pow: 80, pre: 72 },
      { name: 'Musa Al-Taamari', num: 7, pos: 'DEL', spd: 88, jmp: 72, pow: 82, pre: 84 },
    ],
  },

  // ───────────────────────────── Grupo K ─────────────────────────────
  {
    id: 'portugal', name: 'Portugal', short: 'POR', group: 'K', flag: '🇵🇹',
    jersey: '#c8102e', shorts: '#006600', socks: '#c8102e', skin: '#e0b491', hair: '#3a2416',
    roster: [
      { name: 'Diogo Costa', num: 22, pos: 'POR', spd: 52, jmp: 80, pow: 34, pre: 74 },
      { name: 'Rúben Dias', num: 3, pos: 'DEF', spd: 72, jmp: 88, pow: 62, pre: 72 },
      { name: 'Bernardo Silva', num: 10, pos: 'MED', spd: 76, jmp: 68, pow: 80, pre: 92 },
      { name: 'Bruno Fernandes', num: 8, pos: 'MED', spd: 72, jmp: 74, pow: 90, pre: 94 },
      { name: 'Cristiano Ronaldo', num: 7, pos: 'DEL', spd: 78, jmp: 94, pow: 94, pre: 86 },
    ],
  },
  {
    id: 'rd-congo', name: 'RD Congo', short: 'COD', group: 'K', flag: '🇨🇩',
    jersey: '#007fff', shorts: '#007fff', socks: '#f7d117', skin: '#4a2e1c', hair: '#0d0907',
    roster: [
      { name: 'Lionel Mpasi', num: 1, pos: 'POR', spd: 50, jmp: 80, pow: 34, pre: 60 },
      { name: 'Chancel Mbemba', num: 4, pos: 'DEF', spd: 72, jmp: 86, pow: 64, pre: 64 },
      { name: 'Samuel Moutoussamy', num: 6, pos: 'MED', spd: 68, jmp: 74, pow: 66, pre: 74 },
      { name: 'Cédric Bakambu', num: 9, pos: 'DEL', spd: 80, jmp: 80, pow: 82, pre: 76 },
      { name: 'Yoane Wissa', num: 11, pos: 'DEL', spd: 84, jmp: 78, pow: 84, pre: 80 },
    ],
  },
  {
    id: 'uzbekistan', name: 'Uzbekistán', short: 'UZB', group: 'K', flag: '🇺🇿',
    jersey: '#0098c9', shorts: '#ffffff', socks: '#0098c9', skin: '#d6a97c', hair: '#1a120c',
    roster: [
      { name: 'Utkir Yusupov', num: 1, pos: 'POR', spd: 48, jmp: 78, pow: 32, pre: 60 },
      { name: 'Abdukodir Khusanov', num: 4, pos: 'DEF', spd: 80, jmp: 86, pow: 62, pre: 64 },
      { name: 'Jasurbek Jaloliddinov', num: 8, pos: 'MED', spd: 72, jmp: 72, pow: 68, pre: 76 },
      { name: 'Abbosbek Fayzullaev', num: 10, pos: 'MED', spd: 82, jmp: 70, pow: 78, pre: 84 },
      { name: 'Eldor Shomurodov', num: 9, pos: 'DEL', spd: 82, jmp: 80, pow: 82, pre: 78 },
    ],
  },
  {
    id: 'colombia', name: 'Colombia', short: 'COL', group: 'K', flag: '🇨🇴',
    jersey: '#f2c300', shorts: '#003893', socks: '#ce1126', skin: '#c08a5c', hair: '#171009',
    roster: [
      { name: 'Camilo Vargas', num: 12, pos: 'POR', spd: 50, jmp: 80, pow: 34, pre: 66 },
      { name: 'Davinson Sánchez', num: 23, pos: 'DEF', spd: 74, jmp: 88, pow: 66, pre: 64 },
      { name: 'Richard Ríos', num: 15, pos: 'MED', spd: 78, jmp: 78, pow: 74, pre: 80 },
      { name: 'James Rodríguez', num: 10, pos: 'MED', spd: 66, jmp: 68, pow: 86, pre: 94 },
      { name: 'Luis Díaz', num: 7, pos: 'DEL', spd: 92, jmp: 76, pow: 86, pre: 86 },
    ],
  },

  // ───────────────────────────── Grupo L ─────────────────────────────
  {
    id: 'inglaterra', name: 'Inglaterra', short: 'ENG', group: 'L', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    jersey: '#ffffff', shorts: '#1b2a5e', socks: '#ffffff', skin: '#f0cfae', hair: '#4a3020',
    roster: [
      { name: 'Jordan Pickford', num: 1, pos: 'POR', spd: 52, jmp: 80, pow: 36, pre: 70 },
      { name: 'John Stones', num: 5, pos: 'DEF', spd: 72, jmp: 84, pow: 62, pre: 74 },
      { name: 'Declan Rice', num: 4, pos: 'MED', spd: 74, jmp: 82, pow: 78, pre: 84 },
      { name: 'Harry Kane', num: 9, pos: 'DEL', spd: 76, jmp: 88, pow: 92, pre: 90 },
      { name: 'Jude Bellingham', num: 10, pos: 'MED', spd: 86, jmp: 86, pow: 88, pre: 90 },
    ],
  },
  {
    id: 'croacia', name: 'Croacia', short: 'CRO', group: 'L', flag: '🇭🇷',
    jersey: '#d52b1e', shorts: '#0b2a6b', socks: '#d52b1e', skin: '#efd0b0', hair: '#6b4a2a',
    roster: [
      { name: 'Dominik Livaković', num: 1, pos: 'POR', spd: 50, jmp: 80, pow: 34, pre: 66 },
      { name: 'Joško Gvardiol', num: 20, pos: 'DEF', spd: 84, jmp: 86, pow: 64, pre: 70 },
      { name: 'Mateo Kovačić', num: 8, pos: 'MED', spd: 74, jmp: 72, pow: 72, pre: 88 },
      { name: 'Andrej Kramarić', num: 9, pos: 'DEL', spd: 68, jmp: 76, pow: 82, pre: 82 },
      { name: 'Luka Modrić', num: 10, pos: 'MED', spd: 66, jmp: 66, pow: 86, pre: 96 },
    ],
  },
  {
    id: 'ghana', name: 'Ghana', short: 'GHA', group: 'L', flag: '🇬🇭',
    jersey: '#ffffff', shorts: '#101820', socks: '#ffffff', skin: '#4a2c18', hair: '#0d0907',
    roster: [
      { name: 'Lawrence Ati-Zigi', num: 1, pos: 'POR', spd: 50, jmp: 80, pow: 34, pre: 62 },
      { name: 'Alexander Djiku', num: 4, pos: 'DEF', spd: 66, jmp: 84, pow: 60, pre: 62 },
      { name: 'Thomas Partey', num: 5, pos: 'MED', spd: 66, jmp: 80, pow: 78, pre: 84 },
      { name: 'Iñaki Williams', num: 19, pos: 'DEL', spd: 92, jmp: 78, pow: 80, pre: 74 },
      { name: 'Mohammed Kudus', num: 20, pos: 'DEL', spd: 88, jmp: 76, pow: 84, pre: 86 },
    ],
  },
  {
    id: 'panama', name: 'Panamá', short: 'PAN', group: 'L', flag: '🇵🇦',
    jersey: '#d21034', shorts: '#072357', socks: '#d21034', skin: '#b07a4e', hair: '#171009',
    roster: [
      { name: 'Orlando Mosquera', num: 1, pos: 'POR', spd: 48, jmp: 78, pow: 34, pre: 60 },
      { name: 'Fidel Escobar', num: 5, pos: 'DEF', spd: 64, jmp: 80, pow: 58, pre: 58 },
      { name: 'Aníbal Godoy', num: 20, pos: 'MED', spd: 60, jmp: 72, pow: 64, pre: 76 },
      { name: 'Ismael Díaz', num: 7, pos: 'DEL', spd: 82, jmp: 72, pow: 78, pre: 76 },
      { name: 'Adalberto Carrasquilla', num: 8, pos: 'MED', spd: 76, jmp: 70, pow: 78, pre: 86 },
    ],
  },
];

const BY_ID: Map<string, Team> = new Map(TEAMS.map((team) => [team.id, team]));

export function teamById(id: string): Team {
  const team = BY_ID.get(id);
  if (!team) {
    throw new Error(`Selección desconocida: "${id}"`);
  }
  return team;
}
