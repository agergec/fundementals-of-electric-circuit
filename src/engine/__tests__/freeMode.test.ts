import { describe, it, expect } from 'vitest';
import { buildGraph } from '../freeMode/graph';
import { reduceToCircuit } from '../freeMode/topology';
import { solveFreeCircuit } from '../freeMode/solver';
import type { FreeComponent, FreeWire } from '../types';

function fc(id: string, type: FreeComponent['componentType'], x: number, y: number, closed?: boolean): FreeComponent {
  return { id, componentType: type, x, y, rotation: 0, resistanceMultiplier: 1, closed };
}

function wire(from: string, to: string): FreeWire {
  return { id: `w-${from}-${to}`, fromTerminal: from, toTerminal: to, material: 'copper', diameterMm: 1, lineType: 'straight' };
}

describe('buildGraph', () => {
  it('merges terminals connected by wires into electrical nodes', () => {
    const gen = fc('gen', 'generator', 80, 200);
    const lamp = fc('l1', 'lamp', 240, 200);
    const wires = [wire('gen:1', 'l1:0')];
    const result = buildGraph([gen, lamp], wires);

    expect(result.generatorNodes).toBeDefined();
    expect(result.edges).toHaveLength(1); // just the lamp
    expect(result.edges[0].id).toBe('l1');

    // gen:1 and l1:0 should be same electrical node (positive side)
    const genPos = result.nodeMap.get('gen:1');
    const lamp0 = result.nodeMap.get('l1:0');
    expect(genPos).toBe(lamp0);
  });

  it('places junction terminals in the same electrical node', () => {
    const gen = fc('gen', 'generator', 80, 200);
    const junc = fc('j1', 'junction', 160, 200);
    const lamp = fc('l1', 'lamp', 240, 200);
    const wires = [wire('gen:1', 'j1:0'), wire('j1:0', 'l1:0')];
    const result = buildGraph([gen, junc, lamp], wires);

    // Junction has single terminal — all wires share terminal 0
    const genPos = result.nodeMap.get('gen:1');
    const juncNode = result.nodeMap.get('j1:0');
    const lampNode = result.nodeMap.get('l1:0');
    expect(genPos).toBe(juncNode);
    expect(juncNode).toBe(lampNode);
  });

  it('detects missing generator', () => {
    const lamp = fc('l1', 'lamp', 240, 200);
    const wires: FreeWire[] = [];
    const result = buildGraph([lamp], wires);
    expect(result.generatorNodes).toBeNull();
  });
});

describe('reduceToCircuit', () => {
  it('reduces simple series: two lamps in series', () => {
    // pos=0, neg=2, lamps between 0-1 and 1-2
    const edges = [
      { id: 'l1', componentType: 'lamp', resistanceMultiplier: 1, nodeA: 0, nodeB: 1 },
      { id: 'l2', componentType: 'lamp', resistanceMultiplier: 1, nodeA: 1, nodeB: 2 },
    ];
    const tree = reduceToCircuit(edges, 0, 2);
    expect(tree).toBeDefined();
    expect(tree!.kind).toBe('series');
    if (tree!.kind === 'series') {
      expect(tree!.children).toHaveLength(2);
    }
  });

  it('reduces simple parallel: two lamps between same nodes', () => {
    const edges = [
      { id: 'l1', componentType: 'lamp', resistanceMultiplier: 1, nodeA: 0, nodeB: 1 },
      { id: 'l2', componentType: 'lamp', resistanceMultiplier: 1, nodeA: 0, nodeB: 1 },
    ];
    const tree = reduceToCircuit(edges, 0, 1);
    expect(tree).toBeDefined();
  });

  it('returns null for isolated components', () => {
    // Single component not connected to generator nodes
    const edges = [
      { id: 'l1', componentType: 'lamp', resistanceMultiplier: 1, nodeA: 2, nodeB: 3 },
    ];
    const tree = reduceToCircuit(edges, 0, 1);
    expect(tree).toBeNull();
  });
});

describe('solveFreeCircuit', () => {
  it('solves a simple generator-lamp series circuit', () => {
    const gen = fc('gen', 'generator', 80, 200);
    const lamp = fc('l1', 'lamp', 240, 200);
    // Gen:1(+) -> Lamp:0, Lamp:1 -> Gen:0(-)
    const wires = [wire('gen:1', 'l1:0'), wire('l1:1', 'gen:0')];
    const result = solveFreeCircuit([gen, lamp], wires, 12);

    expect(result.success).toBe(true);
    expect(result.totalResistance).toBeCloseTo(10, 0); // wire resistance adds ~0.007Ω
    expect(result.totalCurrent).toBeCloseTo(1.2, 1);
    expect(result.values['l1'].voltage).toBeCloseTo(12, 0);
    expect(result.values['l1'].current).toBeCloseTo(1.2, 1);
  });

  it('solves gen -> lamp -> ammeter -> gen (all series)', () => {
    const gen = fc('gen', 'generator', 80, 200);
    const lamp = fc('l1', 'lamp', 240, 200);
    const am = fc('am', 'ammeter', 400, 200);
    const wires = [
      wire('gen:1', 'l1:0'),
      wire('l1:1', 'am:0'),
      wire('am:1', 'gen:0'),
    ];
    const result = solveFreeCircuit([gen, lamp, am], wires, 12);

    expect(result.success).toBe(true);
    expect(result.totalResistance).toBeCloseTo(10, 0);
    expect(result.values['l1'].current).toBeCloseTo(1.2, 1);
    expect(result.values['am'].current).toBeCloseTo(1.2, 1);
  });

  it('assigns opposite polarities to each component terminal', () => {
    const gen = fc('gen', 'generator', 80, 200);
    const lamp = fc('l1', 'lamp', 240, 200);
    const sw = fc('sw', 'switch', 400, 200);
    const wires = [
      wire('gen:1', 'l1:0'),
      wire('l1:1', 'sw:0'),
      wire('sw:1', 'gen:0'),
    ];
    const result = solveFreeCircuit([gen, lamp, sw], wires, 12);

    // Generator terminals always have correct polarity
    expect(result.polarities['gen:0']).toBe('+');
    expect(result.polarities['gen:1']).toBe('-');
    // Each component should have opposite polarities on its two terminals
    expect(result.polarities['l1:0']).toBeDefined();
    expect(result.polarities['l1:1']).toBeDefined();
    expect(result.polarities['l1:0']).not.toBe(result.polarities['l1:1']);
    expect(result.polarities['sw:0']).toBeDefined();
    expect(result.polarities['sw:1']).toBeDefined();
    expect(result.polarities['sw:0']).not.toBe(result.polarities['sw:1']);
  });

  it('returns error for missing generator', () => {
    const lamp = fc('l1', 'lamp', 240, 200);
    const result = solveFreeCircuit([lamp], [], 12);
    expect(result.success).toBe(false);
    expect(result.errorKey).toBe('freeMode.noGenerator');
  });

  // ── MNA-specific edge cases ──

  it('solves two generators in parallel with lamp', () => {
    const g1 = fc('g1', 'generator', 80, 200);
    const g2 = fc('g2', 'generator', 80, 280);
    const lamp = fc('l1', 'lamp', 240, 240);
    const wires = [
      wire('g1:1', 'l1:0'), wire('l1:1', 'g1:0'),
      wire('g2:1', 'l1:0'), wire('l1:1', 'g2:0'),
    ];
    const result = solveFreeCircuit([g1, g2, lamp], wires, 12);
    expect(result.success).toBe(true);
    expect(result.totalResistance).toBeCloseTo(10, 0);
    expect(result.values['l1'].voltage).toBeCloseTo(12, 0);
  });

  it('solves three generators in series with lamp', () => {
    const g1 = fc('g1', 'generator', 80, 200);
    const g2 = fc('g2', 'generator', 160, 200);
    const g3 = fc('g3', 'generator', 240, 200);
    const lamp = fc('l1', 'lamp', 320, 200);
    // g3:1 → l1:0, l1:1 → g1:0, then g1:1 → g2:0, g2:1 → g3:0 closes the loop
    const wires = [
      wire('g3:1', 'l1:0'), wire('l1:1', 'g1:0'),
      wire('g1:1', 'g2:0'), wire('g2:1', 'g3:0'),
    ];
    const result = solveFreeCircuit([g1, g2, g3, lamp], wires, 12);
    expect(result.success).toBe(true);
    // Three 12V in series = 36V across 10Ω → 3.6A
    expect(result.totalCurrent).toBeCloseTo(3.6, 0);
  });

  it('solves circuit with ammeter in series via MNA', () => {
    const gen = fc('gen', 'generator', 80, 200);
    const lamp = fc('l1', 'lamp', 240, 200);
    const am = fc('am', 'ammeter', 400, 200);
    const vm = fc('vm', 'voltmeter', 240, 120);
    // gen:1 → l1:0, l1:1 → am:0, am:1 → gen:0, vm across l1
    const wires = [
      wire('gen:1', 'vm:0'), wire('vm:0', 'l1:0'),
      wire('l1:1', 'am:0'), wire('am:1', 'gen:0'),
      wire('l1:1', 'vm:1'),
    ];
    const result = solveFreeCircuit([gen, lamp, am, vm], wires, 12);
    expect(result.success).toBe(true);
    expect(result.values['l1'].current).toBeCloseTo(1.2, 1);
    expect(result.values['am'].current).toBeCloseTo(1.2, 1);
  });

  it('solves open circuit with MNA fallback', () => {
    const gen = fc('gen', 'generator', 80, 200);
    const lamp = fc('l1', 'lamp', 240, 200);
    // Only wire gen+ to lamp — no return path
    const wires = [wire('gen:1', 'l1:0')];
    const result = solveFreeCircuit([gen, lamp], wires, 12);
    // MNA fallback handles this — computes 0 current, very high resistance
    expect(result.success).toBe(true);
    expect(result.totalCurrent).toBeCloseTo(0, 0);
  });
});
