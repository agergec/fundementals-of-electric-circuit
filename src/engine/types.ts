export type ComponentType = 'lamp' | 'ammeter' | 'voltmeter' | 'switch';

export interface ComponentNode {
  kind: 'component';
  id: string;
  componentType: ComponentType;
  resistanceMultiplier: number; // for lamps: 0.5, 1, 2, 3 etc.
  closed?: boolean; // for switches: true = closed (conducting), false = open
  // Voltmeter: ID of the component/node it measures across
  measuresAcross?: string;
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
