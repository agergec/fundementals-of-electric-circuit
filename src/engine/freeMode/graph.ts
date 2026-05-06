import type { FreeComponent, FreeWire, TerminalId } from '../types';
import { terminalId } from '../types';

// ── Union-Find for merging connected terminals ──

class UnionFind {
  private parent: Map<TerminalId, TerminalId> = new Map();

  find(x: TerminalId): TerminalId {
    if (!this.parent.has(x)) this.parent.set(x, x);
    const p = this.parent.get(x)!;
    if (p !== x) {
      const root = this.find(p);
      this.parent.set(x, root);
      return root;
    }
    return x;
  }

  union(a: TerminalId, b: TerminalId): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }

  /** Assign consecutive integer IDs to each disjoint set */
  buildNodeIds(): Map<TerminalId, number> {
    const rootToNodeId = new Map<TerminalId, number>();
    let nextId = 0;

    // Collect all known terminals
    const allTerminals = new Set(this.parent.keys());

    const result = new Map<TerminalId, number>();
    for (const t of allTerminals) {
      const root = this.find(t);
      if (!rootToNodeId.has(root)) {
        rootToNodeId.set(root, nextId++);
      }
      result.set(t, rootToNodeId.get(root)!);
    }
    return result;
  }
}

export interface ComponentEdge {
  id: string;
  componentType: string;
  resistanceMultiplier: number;
  closed?: boolean;
  nodeA: number; // electrical node ID
  nodeB: number; // electrical node ID
}

export interface GraphResult {
  /** Maps terminal ID → electrical node ID */
  nodeMap: Map<TerminalId, number>;
  /** Components as edges between electrical nodes */
  edges: ComponentEdge[];
  /** The two electrical nodes of the generator */
  generatorNodes: { pos: number; neg: number } | null;
}

/**
 * Build the electrical connectivity graph from components and wires.
 * Terminals connected by wires are merged into the same electrical node.
 */
export function buildGraph(
  components: FreeComponent[],
  wires: FreeWire[],
): GraphResult {
  const uf = new UnionFind();

  // Register all terminals
  for (const comp of components) {
    uf.find(terminalId(comp.id, 0));
    uf.find(terminalId(comp.id, 1));
  }

  // Merge terminals connected by wires (junctions merge all wires via single central terminal)
  for (const w of wires) {
    uf.union(w.fromTerminal, w.toTerminal);
  }

  const nodeMap = uf.buildNodeIds();

  // Build component edges
  const edges: ComponentEdge[] = [];
  let generatorNodes: { pos: number; neg: number } | null = null;

  for (const comp of components) {
    const nodeA = nodeMap.get(terminalId(comp.id, 0));
    const nodeB = nodeMap.get(terminalId(comp.id, 1));
    if (nodeA === undefined || nodeB === undefined) continue;

    if (comp.componentType === 'generator') {
      generatorNodes = { pos: nodeA, neg: nodeB };
      continue;
    }

    // Junctions are pass-through connection points, not circuit elements
    if (comp.componentType === 'junction') continue;

    // Skip self-loops (shouldn't happen, but guard)
    if (nodeA === nodeB) continue;

    edges.push({
      id: comp.id,
      componentType: comp.componentType,
      resistanceMultiplier: comp.resistanceMultiplier,
      closed: comp.closed,
      nodeA,
      nodeB,
    });
  }

  return { nodeMap, edges, generatorNodes };
}

/** Helper: are two terminals in the same electrical node? */
export function areConnected(
  nodeMap: Map<TerminalId, number>,
  t1: TerminalId,
  t2: TerminalId,
): boolean {
  const n1 = nodeMap.get(t1);
  const n2 = nodeMap.get(t2);
  return n1 !== undefined && n2 !== undefined && n1 === n2;
}
