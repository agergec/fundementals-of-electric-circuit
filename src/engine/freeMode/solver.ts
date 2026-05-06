import type { FreeComponent, FreeWire, CircuitNode } from '../types';
import type { CalculatedValues } from '../types';
import { terminalId } from '../types';
import { solveCircuit } from '../solve';
import { buildGraph } from './graph';
import { reduceToCircuit } from './topology';
import { solveMNA } from './mna';
import { WIRE_MATERIALS } from '../../utils/constants';



export interface FreeSolveResult {
  success: boolean;
  /** Circuit tree built from the graph (null if unreducible) */
  tree: CircuitNode | null;
  /** Per-component calculated values (keyed by component ID) */
  values: Record<string, CalculatedValues>;
  totalResistance: number;
  totalCurrent: number;
  /** Per-wire resistances (keyed by wire ID) */
  wireResistances: Record<string, number>;
  totalWireResistance: number;
  /** terminal ID → '+' or '-' based on connection to generator */
  polarities: Record<string, '+' | '-'>;
  errorKey?: string;
}

/**
 * Solve a free-mode circuit.
 *
 * Pipeline:
 *   1. Build electrical node graph (Union-Find terminal merging)
 *   2. Reduce to series/parallel tree via iterative SP reduction
 *   3. Run the existing two-pass solver on the tree
 *   4. Compute wire resistances
 */
export function solveFreeCircuit(
  components: FreeComponent[],
  wires: FreeWire[],
  voltage: number,
): FreeSolveResult {
  // ── 1. Build graph ──
  const graph = buildGraph(components, wires);

  // Build terminal polarities from generator connection
  const polarities: Record<string, '+' | '-'> = {};
  if (graph.generatorNodes) {
    for (const [tid, nodeId] of graph.nodeMap) {
      if (nodeId === graph.generatorNodes.pos) polarities[tid] = '+';
      else if (nodeId === graph.generatorNodes.neg) polarities[tid] = '-';
    }
    // Propagate through components: if one terminal has polarity, the other gets opposite
    let changed = true;
    while (changed) {
      changed = false;
      for (const comp of components) {
        if (comp.componentType === 'generator' || comp.componentType === 'junction') continue;
        const t0 = terminalId(comp.id, 0);
        const t1 = terminalId(comp.id, 1);
        if (polarities[t0] && !polarities[t1]) {
          polarities[t1] = polarities[t0] === '+' ? '-' : '+';
          changed = true;
        } else if (polarities[t1] && !polarities[t0]) {
          polarities[t0] = polarities[t1] === '+' ? '-' : '+';
          changed = true;
        }
      }
      // Also propagate through wires: terminals in same electrical node share polarity
      for (const [tid, nodeId] of graph.nodeMap) {
        if (!polarities[tid]) continue;
        for (const [otherTid, otherNodeId] of graph.nodeMap) {
          if (otherNodeId === nodeId && !polarities[otherTid]) {
            polarities[otherTid] = polarities[tid];
            changed = true;
          }
        }
      }
    }
  }

  if (!graph.generatorNodes) {
    return {
      success: false, tree: null, values: {}, totalResistance: Infinity,
      totalCurrent: 0, wireResistances: {}, totalWireResistance: 0,
      polarities, errorKey: 'freeMode.noGenerator',
    };
  }

  const { generatorNodes } = graph;
  let { edges } = graph;

  // Filter out edges not connected to generator (isolated components)
  edges = filterReachable(edges, generatorNodes.pos, generatorNodes.neg);

  if (edges.length === 0) {
    return {
      success: false, tree: null, values: {}, totalResistance: Infinity,
      totalCurrent: 0, wireResistances: {}, totalWireResistance: 0,
      polarities, errorKey: 'freeMode.openCircuit',
    };
  }

  // ── 2. Try series/parallel reduction, fall back to MNA ──
  const tree = reduceToCircuit(edges, generatorNodes.pos, generatorNodes.neg);
  let solverResult: { values: Record<string, CalculatedValues>; totalResistance: number; totalCurrent: number } | null = null;

  if (tree) {
    const r = solveCircuit(tree, voltage);
    solverResult = { values: r.values, totalResistance: r.totalResistance, totalCurrent: r.totalCurrent };
  } else {
    // Fall back to MNA for non-series-parallel circuits
    const mnaResult = solveMNA(components, wires, voltage);
    if (mnaResult) {
      solverResult = mnaResult;
    }
  }

  if (!solverResult) {
    return {
      success: false,
      tree: null,
      values: {},
      totalResistance: Infinity,
      totalCurrent: 0,
      wireResistances: {},
      totalWireResistance: 0, polarities,
      errorKey: 'freeMode.tooComplex',
    };
  }

  // ── 3. Compute wire resistances ──
  const wireResistances: Record<string, number> = {};
  let totalWireResistance = 0;

  for (const w of wires) {
    // Compute wire length from terminal positions
    const fromComp = components.find((c) => {
      const [cid] = w.fromTerminal.split(':');
      return c.id === cid;
    });
    const toComp = components.find((c) => {
      const [cid] = w.toTerminal.split(':');
      return c.id === cid;
    });

    if (!fromComp || !toComp) continue;

    const fromIdx = Number(w.fromTerminal.split(':')[1]) as 0 | 1;
    const toIdx = Number(w.toTerminal.split(':')[1]) as 0 | 1;

    const p1 = computeTerminalPos(fromComp, fromIdx);
    const p2 = computeTerminalPos(toComp, toIdx);
    const x1 = p1.x, y1 = p1.y;
    const x2 = p2.x, y2 = p2.y;

    const lengthPx = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const lengthM = lengthPx * 0.001; // 1px = 1mm

    const resistivity = WIRE_MATERIALS[w.material]?.resistivity ?? WIRE_MATERIALS.copper.resistivity;
    const radiusM = (w.diameterMm / 2) * 0.001;
    const areaM2 = Math.PI * radiusM ** 2;
    const resistance = areaM2 > 0 ? (resistivity * lengthM) / areaM2 : 0;

    wireResistances[w.id] = resistance;
    totalWireResistance += resistance;
  }

  // Add total wire resistance to total
  const totalR = solverResult.totalResistance + totalWireResistance;
  const totalI = totalR > 0 && isFinite(totalR) ? voltage / totalR : 0;

  return {
    success: true,
    tree,
    values: solverResult.values,
    totalResistance: totalR,
    totalCurrent: totalI,
    wireResistances,
    totalWireResistance,
    polarities,
  };
}

/** Compute the position of a terminal given components list */
export function computeTerminalPos(
  comp: FreeComponent,
  index: 0 | 1,
): { x: number; y: number } {
  if (comp.componentType === 'junction') return { x: comp.x, y: comp.y };
  const r = ((comp.rotation || 0) % 360 + 360) % 360;
  const half = comp.componentType === 'switch' ? 28 : 40;
  const sign = index === 0 ? -1 : 1;
  if (r === 0)   return { x: comp.x + sign * half, y: comp.y };
  if (r === 90)  return { x: comp.x, y: comp.y + sign * half };
  if (r === 180) return { x: comp.x - sign * half, y: comp.y };
  return { x: comp.x, y: comp.y - sign * half };
}

export function getTerminalPosition(
  components: FreeComponent[],
  terminalId: string,
): { x: number; y: number } | null {
  const [compId, idxStr] = terminalId.split(':');
  const comp = components.find((c) => c.id === compId);
  if (!comp) return null;
  return computeTerminalPos(comp, Number(idxStr) as 0 | 1);
}

/** Total pixel length of all wires */
export function totalWireLengthPx(
  components: FreeComponent[],
  wires: FreeWire[],
): number {
  let total = 0;
  for (const w of wires) {
    const from = getTerminalPosition(components, w.fromTerminal);
    const to = getTerminalPosition(components, w.toTerminal);
    if (from && to) {
      total += Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2);
    }
  }
  return total;
}

function filterReachable<T extends { nodeA: number; nodeB: number }>(
  edges: T[],
  genPos: number,
  genNeg: number,
): T[] {
  // BFS from generator nodes to find reachable nodes
  const adj = new Map<number, number[]>();
  for (const e of edges) {
    if (!adj.has(e.nodeA)) adj.set(e.nodeA, []);
    if (!adj.has(e.nodeB)) adj.set(e.nodeB, []);
    adj.get(e.nodeA)!.push(e.nodeB);
    adj.get(e.nodeB)!.push(e.nodeA);
  }

  const reachable = new Set<number>();
  const queue = [genPos, genNeg];
  reachable.add(genPos);
  reachable.add(genNeg);

  while (queue.length > 0) {
    const node = queue.shift()!;
    for (const neighbor of adj.get(node) ?? []) {
      if (!reachable.has(neighbor)) {
        reachable.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  // Only keep edges where at least one endpoint is reachable from generator
  return edges.filter((e) => reachable.has(e.nodeA) || reachable.has(e.nodeB));
}
