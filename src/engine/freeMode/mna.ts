import type { FreeComponent, FreeWire, CalculatedValues } from '../types';
import { buildGraph } from './graph';
import { WIRE_MATERIALS } from '../../utils/constants';
import { BASE_RESISTANCE } from '../../utils/constants';

/**
 * Modified Nodal Analysis solver for arbitrary circuit topologies.
 * Falls back from series-parallel reduction when it fails.
 * Handles bridge, star-delta, and other non-series-parallel circuits.
 */
export function solveMNA(
  components: FreeComponent[],
  wires: FreeWire[],
  voltage: number,
): { values: Record<string, CalculatedValues>; totalResistance: number; totalCurrent: number } | null {
  const graph = buildGraph(components, wires);
  if (!graph.generatorNodes) return null;

  const { nodeMap, generatorNodes } = graph;

  // 1. Renumber nodes: 0 = ground (gen neg), 1..N-1 = other nodes
  const groundNode = generatorNodes.neg;
  const nodeToIdx = new Map<number, number>();
  let idx = 0;
  nodeToIdx.set(groundNode, idx++); // ground is row 0
  for (const [, nodeId] of nodeMap) {
    if (!nodeToIdx.has(nodeId) && nodeId !== groundNode) {
      nodeToIdx.set(nodeId, idx++);
    }
  }
  const N = nodeToIdx.size;

  // 2. Build conductance matrix G (N x N) and current vector I
  const G: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));
  const I: number[] = new Array(N).fill(0);

  // Ground node equation: V[0] = 0
  G[0][0] = 1;

  // Add conductances for each component
  for (const comp of components) {
    if (comp.componentType === 'generator' || comp.componentType === 'junction') continue;

    const nodeA = nodeMap.get(`${comp.id}:0`);
    const nodeB = nodeMap.get(`${comp.id}:1`);
    if (nodeA === undefined || nodeB === undefined) continue;
    if (nodeA === nodeB) continue; // self-loop

    const conductance = computeConductance(comp);
    if (conductance === 0) continue; // short circuit — skip stamp
    if (!isFinite(conductance)) continue; // open circuit

    const a = nodeToIdx.get(nodeA)!;
    const b = nodeToIdx.get(nodeB)!;

    // Stamp conductance between nodes a and b
    if (a > 0) {
      G[a][a] += conductance;
      G[a][b] -= conductance;
    }
    if (b > 0) {
      G[b][b] += conductance;
      G[b][a] -= conductance;
    }
  }

  // Add wire resistances
  for (const w of wires) {
    const [fcId, fcIdx] = w.fromTerminal.split(':');
    const [tcId, tcIdx] = w.toTerminal.split(':');
    const nodeA = nodeMap.get(`${fcId}:${fcIdx}`);
    const nodeB = nodeMap.get(`${tcId}:${tcIdx}`);
    if (nodeA === undefined || nodeB === undefined || nodeA === nodeB) continue;

    const wireR = wireResistance(w, components);
    if (wireR <= 0 || !isFinite(wireR)) continue;
    const gw = 1 / wireR;

    const a = nodeToIdx.get(nodeA)!;
    const b = nodeToIdx.get(nodeB)!;
    if (a > 0) { G[a][a] += gw; G[a][b] -= gw; }
    if (b > 0) { G[b][b] += gw; G[b][a] -= gw; }
  }

  // 3. Voltage source stamp: generator between genPos and genNeg
  const srcNode = nodeToIdx.get(generatorNodes.pos)!;

  // MNA adds an extra variable for the voltage source current
  // Augment matrix: (N+1) x (N+1)
  const totalN = N + 1;
  for (let i = 0; i < N; i++) {
    G[i].push(0);
  }
  G.push(new Array(totalN).fill(0));

  // Voltage source equation: V[srcNode] - V[ground] = voltage
  G[srcNode][N] = 1;
  G[N][srcNode] = 1;
  G[N][N] = 0;
  I[N] = voltage;

  // 4. Gaussian elimination with partial pivoting
  const x = gaussianElimination(G, I, totalN);
  if (!x) return null;

  // 5. Node voltages: x[0..N-1], source current: x[N]
  const nodeVoltages = x.slice(0, N);
  const sourceCurrent = Math.abs(x[N]);
  const totalResistance = voltage / (sourceCurrent || 1e-12);
  const totalCurrent = sourceCurrent;

  // 6. Compute component voltages and currents
  const values: Record<string, CalculatedValues> = {};
  for (const comp of components) {
    if (comp.componentType === 'generator' || comp.componentType === 'junction') continue;

    const nodeA = nodeMap.get(`${comp.id}:0`);
    const nodeB = nodeMap.get(`${comp.id}:1`);
    if (nodeA === undefined || nodeB === undefined) continue;

    const va = nodeVoltages[nodeToIdx.get(nodeA)!];
    const vb = nodeVoltages[nodeToIdx.get(nodeB)!];
    const vDrop = Math.abs(va - vb);
    const r = componentResistance(comp);

    values[comp.id] = {
      voltage: vDrop,
      current: r > 0 && isFinite(r) ? vDrop / r : 0,
      resistance: r,
    };
  }

  return { values, totalResistance, totalCurrent };
}

function computeConductance(comp: FreeComponent): number {
  const r = componentResistance(comp);
  if (r <= 0 || !isFinite(r)) return Infinity; // short → very high conductance
  return 1 / r;
}

function componentResistance(comp: FreeComponent): number {
  switch (comp.componentType) {
    case 'lamp':
    case 'resistor':
      return BASE_RESISTANCE * comp.resistanceMultiplier;
    case 'ammeter':
    case 'fuse':
      return comp.blown ? Infinity : 0;
    case 'voltmeter':
      return Infinity;
    case 'switch':
      return comp.closed ? 0 : Infinity;
    default:
      return 0;
  }
}

function wireResistance(w: FreeWire, components: FreeComponent[]): number {
  const [fcId] = w.fromTerminal.split(':');
  const [tcId] = w.toTerminal.split(':');
  const fromComp = components.find(c => c.id === fcId);
  const toComp = components.find(c => c.id === tcId);
  if (!fromComp || !toComp) return 0;

  const dx = toComp.x - fromComp.x;
  const dy = toComp.y - fromComp.y;
  const lengthM = Math.sqrt(dx * dx + dy * dy) * 0.001;
  const resistivity = WIRE_MATERIALS[w.material]?.resistivity ?? WIRE_MATERIALS.copper.resistivity;
  const radiusM = (w.diameterMm / 2) * 0.001;
  const areaM2 = Math.PI * radiusM ** 2;
  return areaM2 > 0 ? (resistivity * lengthM) / areaM2 : 0;
}

function gaussianElimination(A: number[][], b: number[], n: number): number[] | null {
  // Augment A with b
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivot: find max in column
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      const v = Math.abs(M[row][col]);
      if (v > maxVal) { maxVal = v; maxRow = row; }
    }
    if (maxVal < 1e-15) continue; // singular, skip column
    if (maxRow !== col) {
      [M[col], M[maxRow]] = [M[maxRow], M[col]];
    }

    // Eliminate below
    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / M[col][col];
      for (let j = col; j <= n; j++) {
        M[row][j] -= factor * M[col][j];
      }
    }
  }

  // Back substitution
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * x[j];
    }
    x[i] = Math.abs(M[i][i]) > 1e-15 ? sum / M[i][i] : 0;
  }
  return x;
}
