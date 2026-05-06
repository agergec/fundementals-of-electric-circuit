import { describe, it, expect } from 'vitest';
import { validateCircuit } from '../freeMode/validate';
import type { FreeComponent, FreeWire } from '../types';

function fc(id: string, type: FreeComponent['componentType'], x: number, y: number, closed?: boolean): FreeComponent {
  return { id, componentType: type, x, y, rotation: 0, resistanceMultiplier: 1, closed };
}
function w(from: string, to: string): FreeWire {
  return { id: `w-${from}-${to}`, fromTerminal: from, toTerminal: to, material: 'copper', diameterMm: 1, lineType: 'straight' };
}

describe('validateCircuit', () => {
  it('detects ammeter in parallel with lamp', () => {
    const gen = fc('gen', 'generator', 80, 200);
    const lamp = fc('l1', 'lamp', 240, 200);
    const am = fc('am', 'ammeter', 240, 280);
    const wires = [
      w('gen:1', 'l1:0'), w('gen:1', 'am:0'),
      w('l1:1', 'gen:0'), w('am:1', 'gen:0'),
    ];
    const result = validateCircuit([gen, lamp, am], wires,
      { totalResistance: 0, totalCurrent: Infinity, success: true }, 12);

    expect(result.issues.some(i => i.key === 'circuit.ammeterInParallel')).toBe(true);
    expect(result.errorIds.has('am')).toBe(true);
  });

  it('detects voltmeter in series', () => {
    const gen = fc('gen', 'generator', 80, 200);
    const vm = fc('vm', 'voltmeter', 240, 200);
    const wires = [w('gen:1', 'vm:0'), w('vm:1', 'gen:0')];
    const result = validateCircuit([gen, vm], wires,
      { totalResistance: Infinity, totalCurrent: 0, success: true }, 12);

    expect(result.issues.some(i => i.key === 'circuit.voltmeterInSeries')).toBe(true);
    expect(result.errorIds.has('vm')).toBe(true);
  });

  it('detects short circuit', () => {
    const gen = fc('gen', 'generator', 80, 200);
    const sw = fc('sw', 'switch', 240, 200, true);
    const lamp = fc('l1', 'lamp', 240, 280);
    const wires = [
      w('gen:1', 'sw:0'), w('sw:1', 'gen:0'),
      w('gen:1', 'l1:0'), w('l1:1', 'gen:0'),
    ];
    const result = validateCircuit([gen, sw, lamp], wires,
      { totalResistance: 0, totalCurrent: Infinity, success: true }, 12);

    expect(result.issues.some(i => i.key === 'circuit.shortCircuit')).toBe(true);
  });

  it('shows info when generator is off', () => {
    const gen = fc('gen', 'generator', 80, 200);
    const lamp = fc('l1', 'lamp', 240, 200);
    const wires = [w('gen:1', 'l1:0'), w('l1:1', 'gen:0')];
    const result = validateCircuit([gen, lamp], wires,
      { totalResistance: 10, totalCurrent: 0, success: true }, 0);

    expect(result.issues.some(i => i.level === 'info')).toBe(true);
  });
});
