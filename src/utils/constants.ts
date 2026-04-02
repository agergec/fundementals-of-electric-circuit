export const BASE_RESISTANCE = 10; // ohms
export const MAX_VOLTAGE = 24;
export const MIN_VOLTAGE = 0;
export const DEFAULT_VOLTAGE = 12;

export const RESISTANCE_OPTIONS = [
  { label: 'R/3', multiplier: 1 / 3 },
  { label: 'R/2', multiplier: 0.5 },
  { label: 'R', multiplier: 1 },
  { label: '2R', multiplier: 2 },
  { label: '3R', multiplier: 3 },
  { label: '4R', multiplier: 4 },
];

export const PIXEL_TO_METERS = 0.005; // 1 SVG pixel = 5mm real world

export const WIRE_MATERIALS = {
  silver: { resistivity: 1.59e-8 },
  copper: { resistivity: 1.68e-8 },
  steel:  { resistivity: 1.00e-7 },
} as const;

export type WireMaterial = keyof typeof WIRE_MATERIALS;

export const COLORS = {
  voltage: '#3b82f6',   // blue
  current: '#ef4444',   // red
  resistance: '#22c55e', // green
  wire: '#fbbf24',       // amber/yellow
  wireOff: '#6b7280',    // gray
  background: '#1e1b2e', // dark purple
  panel: '#2d2a3e',      // lighter purple
  accent: '#f59e0b',     // amber
};
