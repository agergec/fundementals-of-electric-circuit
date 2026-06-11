import type { FreeComponent, FreeWire } from '../types';
import { terminalId } from '../types';
import { buildGraph } from './graph';

export interface ValidationIssue {
  level: 'error' | 'warning' | 'info';
  key: string;
  detailKey: string;
  hintKey: string; // student-facing "try this" fix suggestion
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
    issues.push({ level: 'info', key: 'circuit.generatorOff', detailKey: 'circuit.generatorOffDetail', hintKey: 'circuit.generatorOffHint', ids: [] });
    return { issues, errorIds };
  }

  // Build electrical graph
  const graph = buildGraph(components, wires);

  if (graph.generators.length === 0) {
    return { issues, errorIds };
  }

  const { edges } = graph;

  // ── Parallel generators with different voltages ──
  if (graph.generators.length >= 2) {
    for (let i = 0; i < graph.generators.length; i++) {
      for (let j = i + 1; j < graph.generators.length; j++) {
        const ga = graph.generators[i];
        const gb = graph.generators[j];
        // Same pos AND neg nodes = directly in parallel
        const sameNodes =
          (ga.pos === gb.pos && ga.neg === gb.neg) ||
          (ga.pos === gb.neg && ga.neg === gb.pos);
        if (!sameNodes) continue;
        const va = components.find(c => c.id === ga.id)?.voltage ?? voltage;
        const vb = components.find(c => c.id === gb.id)?.voltage ?? voltage;
        if (Math.abs(va - vb) > 0.01) {
          errorIds.add(ga.id);
          errorIds.add(gb.id);
          issues.push({
            level: 'error',
            key: 'circuit.generatorsParallel',
            detailKey: 'circuit.generatorsParallelDetail',
            hintKey: 'circuit.generatorsParallelHint',
            ids: [ga.id, gb.id],
          });
        }
      }
    }
  }

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
        hintKey: 'circuit.ammeterInParallelHint',
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
          hintKey: 'circuit.voltmeterInSeriesHint',
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
          hintKey: 'circuit.shortCircuitHint',
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
      hintKey: 'circuit.openCircuitHint',
      ids: [],
    });
  }

  // ── Bypassed / open-pole components ──
  // A component is bypassed when both its terminals land on the same electrical node.
  // A terminal is open when no wire touches it (nodeMap registers every terminal,
  // so connectivity must be derived from the wires themselves).
  const wiredTerminals = new Set<string>();
  for (const w of wires) {
    wiredTerminals.add(w.fromTerminal);
    wiredTerminals.add(w.toTerminal);
  }
  for (const comp of components) {
    if (comp.componentType === 'generator' || comp.componentType === 'junction') continue;
    const n0 = graph.nodeMap.get(terminalId(comp.id, 0));
    const n1 = graph.nodeMap.get(terminalId(comp.id, 1));
    // Both terminals at same node: component is bypassed, no current flows through it
    if (n0 !== undefined && n1 !== undefined && n0 === n1) {
      errorIds.add(comp.id);
      issues.push({
        level: 'warning',
        key: 'circuit.componentBypassed',
        detailKey: 'circuit.componentBypassedDetail',
        hintKey: 'circuit.componentBypassedHint',
        ids: [comp.id],
      });
    }
    // One terminal is floating (no wire attached) while the other is connected
    const c0 = wiredTerminals.has(terminalId(comp.id, 0));
    const c1 = wiredTerminals.has(terminalId(comp.id, 1));
    if (c0 !== c1) {
      errorIds.add(comp.id);
      issues.push({
        level: 'warning',
        key: 'circuit.openPole',
        detailKey: 'circuit.openPoleDetail',
        hintKey: 'circuit.openPoleHint',
        ids: [comp.id],
      });
    }
  }

  // ── Generator shorted (pos == neg) ──
  for (const gen of graph.generators) {
    if (gen.pos === gen.neg) {
      errorIds.add(gen.id);
      issues.push({
        level: 'error',
        key: 'circuit.generatorShorted',
        detailKey: 'circuit.generatorShortedDetail',
        hintKey: 'circuit.generatorShortedHint',
        ids: [gen.id],
      });
    }
  }

  // ── Fuse blown ──
  for (const comp of components) {
    if (comp.componentType === 'fuse' && comp.blown) {
      errorIds.add(comp.id);
      issues.push({
        level: 'warning',
        key: 'circuit.fuseBlown',
        detailKey: 'circuit.fuseBlownDetail',
        hintKey: 'circuit.fuseBlownHint',
        ids: [comp.id],
      });
    }
  }

  return { issues, errorIds };
}
