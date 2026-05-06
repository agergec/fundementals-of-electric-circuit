import { describe, it, expect } from 'vitest';
import { solveCircuit } from '../solve';
import type { CircuitNode, SeriesNode, ParallelNode, ComponentNode } from '../types';

// Helpers
function comp(id: string, type: ComponentNode['componentType'], multiplier = 1, closed?: boolean): ComponentNode {
  return { kind: 'component', id, componentType: type, resistanceMultiplier: multiplier, closed };
}
function series(id: string, children: CircuitNode[]): SeriesNode {
  return { kind: 'series', id, children };
}
function parallel(id: string, branches: SeriesNode[]): ParallelNode {
  return { kind: 'parallel', id, branches };
}

describe('solveCircuit', () => {
  it('solves a simple series circuit: gen -> lamp', () => {
    const lamp1 = comp('l1', 'lamp', 1);
    const tree = series('root', [lamp1]);
    const result = solveCircuit(tree, 12);

    expect(result.totalResistance).toBeCloseTo(10); // R = 10Ω
    expect(result.totalCurrent).toBeCloseTo(1.2);   // I = 12/10
    expect(result.values['l1'].voltage).toBeCloseTo(12);
    expect(result.values['l1'].current).toBeCloseTo(1.2);
    expect(result.values['l1'].resistance).toBeCloseTo(10);
  });

  it('solves two lamps in series', () => {
    const lamp1 = comp('l1', 'lamp', 1);
    const lamp2 = comp('l2', 'lamp', 2); // 2R = 20Ω
    const tree = series('root', [lamp1, lamp2]);
    const result = solveCircuit(tree, 12);

    expect(result.totalResistance).toBeCloseTo(30);
    expect(result.totalCurrent).toBeCloseTo(0.4); // 12/30
    // Voltage division: lamp1 gets 10/30 * 12 = 4V, lamp2 gets 20/30 * 12 = 8V
    expect(result.values['l1'].voltage).toBeCloseTo(4);
    expect(result.values['l2'].voltage).toBeCloseTo(8);
    expect(result.values['l1'].current).toBeCloseTo(0.4);
    expect(result.values['l2'].current).toBeCloseTo(0.4);
  });

  it('solves two lamps in parallel', () => {
    const lamp1 = comp('l1', 'lamp', 1);
    const lamp2 = comp('l2', 'lamp', 1);
    const tree = parallel('root', [
      series('b1', [lamp1]),
      series('b2', [lamp2]),
    ]);
    const result = solveCircuit(tree, 12);

    // Two 10Ω in parallel = 5Ω
    expect(result.totalResistance).toBeCloseTo(5);
    expect(result.totalCurrent).toBeCloseTo(2.4);
    // Each branch gets full 12V, 1.2A
    expect(result.values['l1'].voltage).toBeCloseTo(12);
    expect(result.values['l2'].voltage).toBeCloseTo(12);
    expect(result.values['l1'].current).toBeCloseTo(1.2);
    expect(result.values['l2'].current).toBeCloseTo(1.2);
  });

  it('handles open circuit (switch open)', () => {
    const sw = comp('sw', 'switch', 1, false); // open
    const lamp1 = comp('l1', 'lamp', 1);
    const tree = series('root', [sw, lamp1]);
    const result = solveCircuit(tree, 12);

    expect(result.totalResistance).toBe(Infinity);
    expect(result.totalCurrent).toBe(0);
    expect(result.values['l1'].current).toBe(0);
  });

  it('handles closed switch (0Ω)', () => {
    const sw = comp('sw', 'switch', 1, true);
    const lamp1 = comp('l1', 'lamp', 1);
    const tree = series('root', [sw, lamp1]);
    const result = solveCircuit(tree, 12);

    expect(result.totalResistance).toBeCloseTo(10);
    expect(result.totalCurrent).toBeCloseTo(1.2);
  });

  it('handles ammeter (0Ω) in series', () => {
    const am = comp('am', 'ammeter', 1);
    const lamp1 = comp('l1', 'lamp', 1);
    const tree = series('root', [am, lamp1]);
    const result = solveCircuit(tree, 12);

    expect(result.totalResistance).toBeCloseTo(10);
    expect(result.values['am'].voltage).toBeCloseTo(0);
    expect(result.values['am'].current).toBeCloseTo(1.2);
  });

  it('handles voltmeter (∞Ω) in parallel', () => {
    const vm = comp('vm', 'voltmeter', 1);
    const lamp1 = comp('l1', 'lamp', 1);
    const vmBranch = series('b1', [vm]);
    const lampBranch = series('b2', [lamp1]);
    const tree = parallel('root', [vmBranch, lampBranch]);
    const result = solveCircuit(tree, 12);

    // Voltmeter branch has ∞Ω, lamp branch has 10Ω. Total = 10Ω
    expect(result.totalResistance).toBeCloseTo(10);
    expect(result.values['vm'].voltage).toBeCloseTo(12);
    expect(result.values['vm'].current).toBe(0);
    expect(result.values['l1'].voltage).toBeCloseTo(12);
  });

  it('handles generator at 0V', () => {
    const lamp1 = comp('l1', 'lamp', 1);
    const tree = series('root', [lamp1]);
    const result = solveCircuit(tree, 0);

    expect(result.totalCurrent).toBe(0);
    expect(result.values['l1'].voltage).toBe(0);
  });

  it('handles nested series-parallel', () => {
    // Gen -> Lamp1 -> (Lamp2 || Lamp3)
    const l1 = comp('l1', 'lamp', 1);
    const l2 = comp('l2', 'lamp', 1);
    const l3 = comp('l3', 'lamp', 1);
    const par = parallel('p1', [series('b2', [l2]), series('b3', [l3])]);
    const tree = series('root', [l1, par]);
    const result = solveCircuit(tree, 12);

    // R = 10 + (10||10) = 10 + 5 = 15Ω
    expect(result.totalResistance).toBeCloseTo(15);
    expect(result.totalCurrent).toBeCloseTo(0.8);
    // l1 gets 10/15 * 12 = 8V, l2 and l3 get 4V each
    expect(result.values['l1'].voltage).toBeCloseTo(8);
    expect(result.values['l2'].voltage).toBeCloseTo(4);
    expect(result.values['l3'].voltage).toBeCloseTo(4);
  });
});
