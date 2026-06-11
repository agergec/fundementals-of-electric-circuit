export const BASE_RESISTANCE = 10; // ohms
export const MAX_VOLTAGE = 24;
export const MIN_VOLTAGE = 0;
export const DEFAULT_VOLTAGE = 12;

export const RESISTANCE_OPTIONS = [
  { label: 'R/4', multiplier: 0.25 },
  { label: 'R/3', multiplier: 1 / 3 },
  { label: 'R/2', multiplier: 0.5 },
  { label: 'R', multiplier: 1 },
  { label: '2R', multiplier: 2 },
  { label: '3R', multiplier: 3 },
  { label: '4R', multiplier: 4 },
];

export const PIXEL_TO_METERS = 0.001; // 1 SVG pixel = 1mm real world (lab bench scale)

// ── Free-mode canvas interaction ──
export const GRID_SNAP = 40;
// Single snap radius for all terminal interactions (highlight, wire completion, rewire)
export const TERMINAL_SNAP_RADIUS = 24;
export const WIRE_HIT_RADIUS = 16; // drop-component-on-wire detection
// Wires shorter than this are not split on component drop (would create degenerate segments)
export const MIN_SPLIT_WIRE_LEN = 2 * GRID_SNAP;
// Wires shorter than this force the inserted component to the wire midpoint
export const SNAP_TO_MIDPOINT_LEN = 4 * GRID_SNAP;

export const WIRE_MATERIALS = {
  silver:   { resistivity: 1.59e-8 },
  copper:   { resistivity: 1.68e-8 },
  steel:    { resistivity: 1.00e-7 },
  nichrome: { resistivity: 1.10e-6 }, // Nickel-chromium alloy, used in heating elements
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
