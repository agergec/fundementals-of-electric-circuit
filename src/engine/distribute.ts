import type { CircuitNode, CalculatedValues } from './types';
import { calcResistance } from './resistance';

/**
 * Pass 2: Top-down distribution of voltage and current through the tree.
 * Populates a plain object of component ID → { voltage, current, resistance }.
 */
export function distribute(
  node: CircuitNode,
  voltage: number,
  current: number,
  values: Record<string, CalculatedValues>,
): void {
  switch (node.kind) {
    case 'component': {
      const r = calcResistance(node);
      values[node.id] = { voltage, current, resistance: r };
      break;
    }
    case 'series': {
      const resistances = node.children.map((c) => calcResistance(c));
      const totalR = resistances.reduce((a, b) => a + b, 0);

      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        const childR = resistances[i];
        let childV: number;

        if (totalR > 0 && isFinite(totalR)) {
          // Normal case: voltage divides by resistance ratio
          childV = voltage * (childR / totalR);
        } else if (!isFinite(totalR)) {
          // Open circuit (switch open or voltmeter branch):
          // Infinite-R children see the full voltage, finite-R children see 0V
          childV = isFinite(childR) ? 0 : voltage;
        } else {
          childV = 0;
        }

        distribute(child, childV, current, values);
      }

      values[node.id] = { voltage, current, resistance: totalR };
      break;
    }
    case 'parallel': {
      for (const branch of node.branches) {
        const branchR = calcResistance(branch);
        const branchI =
          branchR > 0 && isFinite(branchR) ? voltage / branchR : 0;

        distribute(branch, voltage, branchI, values);
      }

      const totalR = calcResistance(node);
      values[node.id] = { voltage, current, resistance: totalR };
      break;
    }
  }
}
