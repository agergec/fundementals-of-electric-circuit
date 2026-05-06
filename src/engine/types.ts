export type ComponentType = 'lamp' | 'ammeter' | 'voltmeter' | 'switch' | 'generator' | 'junction';

export interface ComponentNode {
  kind: 'component';
  id: string;
  componentType: ComponentType;
  resistanceMultiplier: number; // for lamps: 0.5, 1, 2, 3 etc.
  closed?: boolean; // for switches: true = closed (conducting), false = open
}

export interface SeriesNode {
  kind: 'series';
  id: string;
  children: CircuitNode[];
}

export interface ParallelNode {
  kind: 'parallel';
  id: string;
  branches: SeriesNode[];
}

export type CircuitNode = SeriesNode | ParallelNode | ComponentNode;

export interface CalculatedValues {
  voltage: number;
  current: number;
  resistance: number;
}

export interface SolverResult {
  totalResistance: number;
  totalCurrent: number;
  values: Record<string, CalculatedValues>;
}

// ── Free mode types ──

/** Terminal identifier: "{componentId}:0" (left) or "{componentId}:1" (right) */
export type TerminalId = string;

export function terminalId(componentId: string, index: 0 | 1): TerminalId {
  return `${componentId}:${index}`;
}

export function parseTerminalId(tid: TerminalId): { componentId: string; index: 0 | 1 } {
  const [componentId, idx] = tid.split(':');
  return { componentId, index: (Number(idx) as 0 | 1) };
}

export interface FreeComponent {
  id: string;
  componentType: ComponentType;
  x: number;
  y: number;
  rotation: number; // 0, 90, 180, 270
  resistanceMultiplier: number;
  closed?: boolean; // for switches
  rotateText?: boolean; // default false — text stays upright unless enabled
}

export interface FreeWire {
  id: string;
  fromTerminal: TerminalId;
  toTerminal: TerminalId;
  material: import('../utils/constants').WireMaterial;
  diameterMm: number;
  lineType: 'curved' | 'straight' | 'corner';
  cornerX?: number;
  cornerY?: number;
}

export type ToolType = 'select' | 'wire' | 'place-generator' | 'place-lamp' | 'place-switch' | 'place-ammeter' | 'place-voltmeter' | 'place-junction';

export interface FreeSolverResult {
  totalResistance: number;
  totalCurrent: number;
  values: Record<string, CalculatedValues>; // keyed by component ID
}
