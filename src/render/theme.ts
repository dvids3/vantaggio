export const THEME = {
  skyTop: '#04070f',
  skyMid: '#081326',
  skyLow: '#102a4a',
  stand: '#070d18',
  standEdge: '#0d1628',
  crowd: ['#f5c518', '#22d3ee', '#f472b6', '#a3e635', '#f97316', '#e2e8f0', '#818cf8', '#fbbf24'],
  grassLit: '#2aa85f',
  grass: '#1f8f4f',
  grassDark: '#177140',
  grassDeep: '#0b3f26',
  line: 'rgba(236, 255, 246, 0.92)',
  net: 'rgba(226, 250, 240, 0.22)',
  netLine: 'rgba(226, 250, 240, 0.38)',
  frame: '#f4fbff',
  frameShadow: '#9fb6c8',
  ball: '#fbfdfb',
  ballPatch: '#16232e',
  accent: '#22d3ee',
  gold: '#ffd166',
  danger: '#ef4444',
} as const;

export const UI = {
  fontNumber: (px: number) => `800 ${px}px "SF Pro Display", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`,
  fontLabel: (px: number) => `700 ${px}px "SF Pro Text", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`,
} as const;
