import type { CircuitNode } from './types';
import { BASE_RESISTANCE } from '../utils/constants';

/**
 * Pass 1: Bottom-up recursive calculation of equivalent resistance.
 * Switch state is read from each switch node's own `closed` field.
 */
export function calcResistance(node: CircuitNode): number {
  switch (node.kind) {
    case 'component': {
      switch (node.componentType) {
        case 'lamp':
          return BASE_RESISTANCE * node.resistanceMultiplier;
        case 'ammeter':
          return 0; // ideal ammeter
        case 'voltmeter':
          return Infinity; // not in main path
        case 'switch':
          return node.closed ? 0 : Infinity;
        case 'resistor':
          return BASE_RESISTANCE * node.resistanceMultiplier;
        case 'fuse':
          return node.blown ? Infinity : 0;
        default:
          return 0;
      }
    }
    case 'series': {
      let total = 0;
      for (const child of node.children) {
        const r = calcResistance(child);
        if (!isFinite(r)) return Infinity; // open circuit
        total += r;
      }
      return total;
    }
    case 'parallel': {
      let reciprocalSum = 0;
      for (const branch of node.branches) {
        const r = calcResistance(branch);
        if (r === 0) return 0; // short circuit through this branch
        if (isFinite(r)) {
          reciprocalSum += 1 / r;
        }
      }
      if (reciprocalSum === 0) return Infinity; // all branches open
      return 1 / reciprocalSum;
    }
  }
}
