import type { FreeComponent, FreeWire } from '../types';
import { buildGraph } from './graph';

export interface ValidationIssue {
  level: 'error' | 'warning' | 'info';
  key: string;
  detailKey: string;
  ids: string[];
}

export interface ValidationResult {
  issues: ValidationIssue[];
  errorIds: Set<string>;
}

export function validateCircuit(
  components: FreeComponent[],
  wires: FreeWire[],
  solverResult: { totalResistance: number; totalCurrent: number; success: boolean; errorKey?: string },
  voltage: number,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const errorIds = new Set<string>();

  // No voltage = generator off, not an error
  if (voltage === 0) {
    issues.push({ level: 'info', key: 'circuit.generatorOff', detailKey: 'circuit.generatorOffDetail', ids: [] });
    return { issues, errorIds };
  }

  // Build electrical graph
  const graph = buildGraph(components, wires);

  if (!graph.generatorNodes) {
    return { issues, errorIds };
  }

  const { edges } = graph;

  // ── Ammeter in parallel ──
  // An ammeter (0Ω) in parallel with any other component creates a short through that branch
  for (const edge of edges) {
    if (edge.componentType !== 'ammeter') continue;
    // Check if any other edge shares both nodes with this ammeter
    const parallelEdge = edges.find(
      (e) => e.id !== edge.id &&
        ((e.nodeA === edge.nodeA && e.nodeB === edge.nodeB) ||
         (e.nodeA === edge.nodeB && e.nodeB === edge.nodeA)),
    );
    if (parallelEdge) {
      errorIds.add(edge.id);
      errorIds.add(parallelEdge.id);
      issues.push({
        level: 'error',
        key: 'circuit.ammeterInParallel',
        detailKey: 'circuit.ammeterInParallelDetail',
        ids: [edge.id, parallelEdge.id],
      });
    }
  }

  // ── Voltmeter in series ──
  // A voltmeter (∞Ω) in series blocks current. Detect when totalCurrent≈0 and voltage>0
  if (voltage > 0 && solverResult.totalCurrent < 0.0001 && solverResult.success) {
    // Find voltmeters that are not in parallel with any other load
    for (const edge of edges) {
      if (edge.componentType !== 'voltmeter') continue;
      const hasParallel = edges.some(
        (e) => e.id !== edge.id && e.componentType !== 'voltmeter' &&
          ((e.nodeA === edge.nodeA && e.nodeB === edge.nodeB) ||
           (e.nodeA === edge.nodeB && e.nodeB === edge.nodeA)),
      );
      if (!hasParallel) {
        errorIds.add(edge.id);
        issues.push({
          level: 'warning',
          key: 'circuit.voltmeterInSeries',
          detailKey: 'circuit.voltmeterInSeriesDetail',
          ids: [edge.id],
        });
      }
    }
  }

  // ── Short circuit ──
  // Zero or near-zero resistance path between generator terminals
  if (solverResult.success && solverResult.totalResistance < 0.001 && voltage > 0) {
    // Only flag if there are actual load components being shorted, not just a closed switch alone
    const hasLoads = edges.some((e) => e.componentType === 'lamp' || e.componentType === 'voltmeter');
    if (edges.length > 0) {
      // Find the shorting components (closed switches, ammeters, or direct wires)
      const shortingIds = edges
        .filter((e) => e.componentType === 'ammeter' || (e.componentType === 'switch' && e.closed !== false))
        .map((e) => e.id);
      for (const id of shortingIds) errorIds.add(id);
      if (issues.find((i) => i.key === 'circuit.ammeterInParallel')) {
        // Already covered by ammeter-in-parallel
      } else if (shortingIds.length > 0 || hasLoads) {
        issues.push({
          level: 'error',
          key: 'circuit.shortCircuit',
          detailKey: 'circuit.shortCircuitDetail',
          ids: shortingIds,
        });
      }
    }
  }

  // ── Open circuit (no complete path) ──
  if (!solverResult.success && solverResult.errorKey === 'freeMode.openCircuit') {
    issues.push({
      level: 'warning',
      key: 'circuit.openCircuit',
      detailKey: 'circuit.openCircuitDetail',
      ids: [],
    });
  }

  return { issues, errorIds };
}
