import type { CircuitNode, SolverResult } from './types';
import { calcResistance } from './resistance';
import { distribute } from './distribute';

/**
 * Top-level solver: takes the circuit tree and source voltage,
 * returns all calculated values for every component.
 * Switch states are read from each switch node's `closed` field.
 */
export function solveCircuit(
  circuit: CircuitNode,
  sourceVoltage: number,
): SolverResult {
  const totalResistance = calcResistance(circuit);
  const totalCurrent =
    totalResistance > 0 && isFinite(totalResistance)
      ? sourceVoltage / totalResistance
      : 0;

  const values: Record<string, import('./types').CalculatedValues> = {};
  distribute(circuit, sourceVoltage, totalCurrent, values);

  return { totalResistance, totalCurrent, values };
}
