import type { CircuitNode } from '../types';
import type { ComponentEdge } from './graph';

// ── Series-parallel reduction ──
//
// We reduce a component graph (edges between electrical nodes) to a single
// equivalent edge by repeatedly applying two operations:
//   1. Series:  a degree-2 node (not an endpoint) → merge its two edges
//   2. Parallel: multiple edges between the same two nodes → merge them
//
// Each reduction step builds a piece of the CircuitNode tree, which the
// existing solver can consume.

type SPEdge =
  | { kind: 'leaf'; id: string; compType: string; multiplier: number; closed?: boolean }
  | { kind: 'composite'; id: string; tree: CircuitNode };

/**
 * Try to reduce the component graph between two endpoint nodes.
 * Returns the root SeriesNode if successful, or null if the graph
 * is not series-parallel reducible.
 */
export function reduceToCircuit(
  edges: ComponentEdge[],
  nodeA: number,
  nodeB: number,
): CircuitNode | null {
  if (edges.length === 0) return null;

  // Build mutable adjacency
  const adj = new Map<number, SPEdge[]>();
  for (const e of edges) {
    const sp: SPEdge = {
      kind: 'leaf',
      id: e.id,
      compType: e.componentType,
      multiplier: e.resistanceMultiplier,
      closed: e.closed,
    };
    addEdge(adj, e.nodeA, e.nodeB, sp);
  }

  let nextId = 0;

  // Repeatedly reduce until one edge remains between nodeA and nodeB
  for (let iter = 0; iter < 100; iter++) {
    const between = getEdgesBetween(adj, nodeA, nodeB);

    // ── Fully reduced? ──
    if (between.length === 1 && getTotalEdgeCount(adj) === 1) {
      return spToFinal(between[0], () => String(++nextId));
    }

    // ── Parallel reduction ──
    // 1. Check between endpoints
    if (between.length >= 2) {
      mergeParallel(adj, nodeA, nodeB, () => String(++nextId));
      continue;
    }

    // 2. Check between any pair of nodes (three parallel lamps sharing nodes A-B,
    //    with switch in series on node B-C — lamps are between A and B, not endpoints)
    const parallelPair = findParallelPair(adj);
    if (parallelPair) {
      mergeParallel(adj, parallelPair.u, parallelPair.v, () => String(++nextId));
      continue;
    }

    // ── Series reduction ──
    const seriesNode = findDegreeTwoNode(adj, nodeA, nodeB);
    if (!seriesNode) return null; // not series-parallel reducible

    const [e1, e2] = getTwoEdges(adj, seriesNode);
    const otherA = e1.nodeA === seriesNode ? e1.nodeB : e1.nodeA;
    const otherB = e2.nodeA === seriesNode ? e2.nodeB : e2.nodeA;

    const seriesId = `s-${++nextId}`;
    const childA = spToCircuitNode(e1.edge);
    const childB = spToCircuitNode(e2.edge);

    const seriesNodeTree: CircuitNode = {
      kind: 'series',
      id: seriesId,
      children: [childA, childB],
    };

    removeNode(adj, seriesNode);
    addEdge(adj, otherA, otherB, {
      kind: 'composite',
      id: seriesId,
      tree: seriesNodeTree,
    });
  }

  return null; // too many iterations
}

// ── Adjacency helpers ──

interface AdjEntry {
  nodeA: number;
  nodeB: number;
  edge: SPEdge;
}

function addEdge(adj: Map<number, SPEdge[]>, a: number, b: number, edge: SPEdge): void {
  if (!adj.has(a)) adj.set(a, []);
  if (!adj.has(b)) adj.set(b, []);
  adj.get(a)!.push(edge);
  adj.get(b)!.push(edge);
}

/** Merge ≥2 parallel edges between u and v into one composite ParallelNode */
function mergeParallel(
  adj: Map<number, SPEdge[]>,
  u: number,
  v: number,
  nextId: () => string,
): void {
  const edges = getEdgesBetween(adj, u, v);
  const branches = edges.map((b) => spToBranch(b, nextId));
  const parallelId = `p-${nextId()}`;
  const parallelNode: CircuitNode = {
    kind: 'parallel',
    id: parallelId,
    branches,
  };
  removeAllEdgesBetween(adj, u, v);
  addEdge(adj, u, v, { kind: 'composite', id: parallelId, tree: parallelNode });
}

/** Find any pair of nodes with ≥2 edges between them (parallel candidates) */
function findParallelPair(adj: Map<number, SPEdge[]>): { u: number; v: number } | null {
  const nodes = [...adj.keys()];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const between = getEdgesBetween(adj, nodes[i], nodes[j]);
      if (between.length >= 2) return { u: nodes[i], v: nodes[j] };
    }
  }
  return null;
}

function removeEdge(adj: Map<number, SPEdge[]>, a: number, edge: SPEdge): void {
  const list = adj.get(a);
  if (!list) return;
  const idx = list.indexOf(edge);
  if (idx >= 0) list.splice(idx, 1);
  if (list.length === 0) adj.delete(a);
}

function removeNode(adj: Map<number, SPEdge[]>, node: number): void {
  const edges = adj.get(node);
  if (!edges) return;
  for (const e of [...edges]) {
    for (const [n, list] of adj) {
      if (n !== node && list.includes(e)) {
        removeEdge(adj, n, e);
      }
    }
  }
  adj.delete(node);
}

function removeAllEdgesBetween(adj: Map<number, SPEdge[]>, a: number, b: number): void {
  const listA = adj.get(a);
  const listB = adj.get(b);
  if (listA) {
    const toRemove = listA.filter((e) => listB?.includes(e));
    for (const e of toRemove) {
      removeEdge(adj, a, e);
      removeEdge(adj, b, e);
    }
  }
}

function getEdgesBetween(adj: Map<number, SPEdge[]>, a: number, b: number): SPEdge[] {
  const listA = adj.get(a);
  const listB = adj.get(b);
  if (!listA || !listB) return [];
  return listA.filter((e) => listB.includes(e));
}

function getTotalEdgeCount(adj: Map<number, SPEdge[]>): number {
  let count = 0;
  const seen = new Set<SPEdge>();
  for (const list of adj.values()) {
    for (const e of list) {
      if (!seen.has(e)) {
        seen.add(e);
        count++;
      }
    }
  }
  return count;
}

function findDegreeTwoNode(
  adj: Map<number, SPEdge[]>,
  excludeA: number,
  excludeB: number,
): number | null {
  for (const [node, edges] of adj) {
    if (node === excludeA || node === excludeB) continue;
    const unique = new Set(edges);
    if (unique.size === 2) return node;
  }
  return null;
}

function getTwoEdges(
  adj: Map<number, SPEdge[]>,
  node: number,
): [AdjEntry, AdjEntry] {
  const edges = adj.get(node)!;
  const unique = [...new Set(edges)];

  function otherEnd(e: SPEdge): number {
    for (const [n, list] of adj) {
      if (n !== node && list.includes(e)) return n;
    }
    return -1;
  }

  return [
    { nodeA: node, nodeB: otherEnd(unique[0]), edge: unique[0] },
    { nodeA: node, nodeB: otherEnd(unique[1]), edge: unique[1] },
  ];
}

// ── Conversion helpers ──

function spToBranch(sp: SPEdge, nextId: () => string): import('../types').SeriesNode {
  return {
    kind: 'series',
    id: `br-${nextId()}`,
    children: [spToCircuitNode(sp)],
  };
}

function spToCircuitNode(sp: SPEdge): CircuitNode {
  if (sp.kind === 'composite') return sp.tree;
  return makeComponentNode(sp.id, sp.compType, sp.multiplier, sp.closed);
}

function spToFinal(
  sp: SPEdge,
  nextId: () => string,
): CircuitNode {
  if (sp.kind === 'composite') {
    // If it's already a tree root, return it. Otherwise wrap in series.
    const t = sp.tree;
    if (t.kind === 'series') return t;
    return { kind: 'series', id: `root-${nextId()}`, children: [t] };
  }
  const comp = makeComponentNode(sp.id, sp.compType, sp.multiplier, sp.closed);
  return { kind: 'series', id: `root-${nextId()}`, children: [comp] };
}

function makeComponentNode(
  id: string,
  compType: string,
  multiplier: number,
  closed?: boolean,
): CircuitNode {
  return {
    kind: 'component',
    id,
    componentType: compType as import('../types').ComponentType,
    resistanceMultiplier: multiplier,
    closed,
  };
}
