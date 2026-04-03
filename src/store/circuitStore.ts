import { create } from 'zustand';
import type {
  CircuitNode,
  SeriesNode,
  ComponentNode,
  ParallelNode,
  CalculatedValues,
  ComponentType,
} from '../engine/types';
import { distribute } from '../engine/distribute';
import { calcResistance } from '../engine/resistance';
import { DEFAULT_VOLTAGE, PIXEL_TO_METERS, WIRE_MATERIALS } from '../utils/constants';
import type { WireMaterial } from '../utils/constants';

let nextId = 1;
function uid(): string {
  return `node-${nextId++}`;
}

function makeLamp(multiplier = 1): ComponentNode {
  return {
    kind: 'component',
    id: uid(),
    componentType: 'lamp',
    resistanceMultiplier: multiplier,
  };
}

function makeComponent(type: ComponentType): ComponentNode {
  return {
    kind: 'component',
    id: uid(),
    componentType: type,
    resistanceMultiplier: 1,
    closed: type === 'switch' ? true : undefined,
  };
}

function makeSeriesNode(children: CircuitNode[]): SeriesNode {
  return { kind: 'series', id: uid(), children };
}

function cloneNode(node: CircuitNode): CircuitNode {
  switch (node.kind) {
    case 'component':
      return { ...node };
    case 'series':
      return { ...node, children: node.children.map(cloneNode) };
    case 'parallel':
      return {
        ...node,
        branches: node.branches.map(
          (b) => cloneNode(b) as SeriesNode,
        ),
      };
  }
}

type FindResult = {
  parent: SeriesNode | ParallelNode;
  index: number;
  node: CircuitNode;
};

function findNode(
  root: CircuitNode,
  id: string,
  parent?: SeriesNode | ParallelNode,
  index?: number,
): FindResult | null {
  if (root.id === id && parent !== undefined && index !== undefined) {
    return { parent, node: root, index };
  }
  if (root.kind === 'series') {
    for (let i = 0; i < root.children.length; i++) {
      const result = findNode(root.children[i], id, root, i);
      if (result) return result;
    }
  }
  if (root.kind === 'parallel') {
    for (let i = 0; i < root.branches.length; i++) {
      const result = findNode(root.branches[i], id, root, i);
      if (result) return result;
    }
  }
  return null;
}

function findParentParallel(
  root: CircuitNode,
  id: string,
  parentChain: CircuitNode[] = [],
): { parallel: ParallelNode; branchIndex: number } | null {
  if (root.id === id) {
    for (let i = parentChain.length - 1; i >= 0; i--) {
      if (parentChain[i].kind === 'parallel') {
        const pn = parentChain[i] as ParallelNode;
        const branchIdx = pn.branches.findIndex((b) => containsNode(b, id));
        return { parallel: pn, branchIndex: branchIdx >= 0 ? branchIdx : 0 };
      }
    }
    return null;
  }
  if (root.kind === 'series') {
    for (const child of root.children) {
      const result = findParentParallel(child, id, [...parentChain, root]);
      if (result) return result;
    }
  }
  if (root.kind === 'parallel') {
    for (const branch of root.branches) {
      const result = findParentParallel(branch, id, [...parentChain, root]);
      if (result) return result;
    }
  }
  return null;
}

function containsNode(root: CircuitNode, id: string): boolean {
  if (root.id === id) return true;
  if (root.kind === 'series') {
    return root.children.some((c) => containsNode(c, id));
  }
  if (root.kind === 'parallel') {
    return root.branches.some((b) => containsNode(b, id));
  }
  return false;
}

function findNodeDirect(root: CircuitNode, id: string): CircuitNode | null {
  if (root.id === id) return root;
  if (root.kind === 'series') {
    for (const child of root.children) {
      const found = findNodeDirect(child, id);
      if (found) return found;
    }
  }
  if (root.kind === 'parallel') {
    for (const branch of root.branches) {
      const found = findNodeDirect(branch, id);
      if (found) return found;
    }
  }
  return null;
}

function simplify(node: CircuitNode): CircuitNode | null {
  if (node.kind === 'component') return node;
  if (node.kind === 'series') {
    const children = node.children
      .map(simplify)
      .filter((c): c is CircuitNode => c !== null);
    if (children.length === 0) return null;
    if (children.length === 1) return children[0];
    return { ...node, children };
  }
  if (node.kind === 'parallel') {
    const branches = node.branches
      .map((b) => simplify(b) as SeriesNode | null)
      .filter((b): b is SeriesNode => b !== null);
    if (branches.length === 0) return null;
    if (branches.length === 1) return branches[0];
    return { ...node, branches };
  }
  return node;
}

interface CircuitStore {
  voltage: number;
  circuit: SeriesNode;
  calculatedValues: Record<string, CalculatedValues>;
  totalResistance: number;
  totalCurrent: number;
  selectedComponentId: string | null;

  // Wire resistance settings
  wireEnabled: boolean;
  wireMaterial: WireMaterial;
  wireDiameterMm: number;
  wireTotalLengthPx: number;
  wireResistance: number;

  setVoltage: (v: number) => void;
  toggleSwitch: (id: string) => void;
  addComponent: (type: ComponentType, afterId?: string) => void;
  addAmperemeterNear: (targetId: string) => void;
  addVoltmeterAcross: (targetId: string) => void;
  removeComponent: (id: string) => void;
  setLampResistance: (id: string, multiplier: number) => void;
  addParallelBranch: (componentId: string) => void;
  addAmmeterParallelBranch: (componentId: string) => void;
  selectComponent: (id: string | null) => void;
  resetCircuit: () => void;
  recalculate: () => void;
  setWireEnabled: (v: boolean) => void;
  setWireMaterial: (m: WireMaterial) => void;
  setWireDiameterMm: (d: number) => void;
  setWireTotalLengthPx: (px: number) => void;
}

function createInitialCircuit(): SeriesNode {
  nextId = 1;
  return makeSeriesNode([
    makeComponent('switch'),
    makeLamp(),
  ]);
}

function calcWireResistance(state: {
  wireEnabled: boolean;
  wireMaterial: WireMaterial;
  wireDiameterMm: number;
  wireTotalLengthPx: number;
}): number {
  if (!state.wireEnabled || state.wireTotalLengthPx <= 0) return 0;
  const { resistivity } = WIRE_MATERIALS[state.wireMaterial];
  const L = state.wireTotalLengthPx * PIXEL_TO_METERS;
  const radius = (state.wireDiameterMm / 2) / 1000; // m
  const A = Math.PI * radius * radius;
  return resistivity * L / A;
}

function recalc(state: {
  circuit: SeriesNode;
  voltage: number;
  wireEnabled: boolean;
  wireMaterial: WireMaterial;
  wireDiameterMm: number;
  wireTotalLengthPx: number;
}) {
  const circuitR = calcResistance(state.circuit);
  const wireR = calcWireResistance(state);
  const totalR = circuitR + wireR;
  const totalI = totalR > 0 && isFinite(totalR) ? state.voltage / totalR : 0;

  // Voltage available to the circuit after wire drops (V_circuit = I × R_circuit)
  const circuitVoltage = isFinite(circuitR) ? totalI * circuitR : 0;

  // Re-distribute with corrected voltage and current so component values reflect wire loss
  const values: Record<string, import('../engine/types').CalculatedValues> = {};
  distribute(state.circuit, circuitVoltage, totalI, values);

  return {
    calculatedValues: values,
    totalResistance: totalR,
    totalCurrent: totalI,
    wireResistance: wireR,
  };
}

export const useCircuitStore = create<CircuitStore>((set) => {
  const initialCircuit = createInitialCircuit();
  const wireDefaults = {
    wireEnabled: false,
    wireMaterial: 'copper' as WireMaterial,
    wireDiameterMm: 1,
    wireTotalLengthPx: 0,
  };
  const initialCalc = recalc({
    circuit: initialCircuit,
    voltage: DEFAULT_VOLTAGE,
    ...wireDefaults,
  });

  return {
    voltage: DEFAULT_VOLTAGE,
    circuit: initialCircuit,
    calculatedValues: initialCalc.calculatedValues,
    totalResistance: initialCalc.totalResistance,
    totalCurrent: initialCalc.totalCurrent,
    selectedComponentId: null,
    ...wireDefaults,
    wireResistance: 0,

    setVoltage: (v) => {
      set((state) => ({
        voltage: v,
        ...recalc({ ...state, voltage: v }),
      }));
    },

    toggleSwitch: (id) => {
      set((state) => {
        const circuit = cloneNode(state.circuit) as SeriesNode;
        const node = findNodeDirect(circuit, id);
        if (node && node.kind === 'component' && node.componentType === 'switch') {
          node.closed = !node.closed;
        }
        return { circuit, ...recalc({ ...state, circuit }) };
      });
    },

    addComponent: (type, afterId) => {
      set((state) => {
        const circuit = cloneNode(state.circuit) as SeriesNode;
        const newComponent = type === 'lamp' ? makeLamp() : makeComponent(type);

        if (afterId) {
          const found = findNode(circuit, afterId);
          if (found && found.parent.kind === 'series') {
            // Normal case: insert in series right after the found component
            found.parent.children.splice(found.index + 1, 0, newComponent);
          } else if (found && found.parent.kind === 'parallel') {
            // The branch was simplified to a bare ComponentNode (no SeriesNode wrapper).
            // Wrap the existing component + new component in a proper SeriesNode.
            const newBranch = makeSeriesNode([found.node as CircuitNode, newComponent]);
            (found.parent as ParallelNode).branches.splice(found.index, 1, newBranch as unknown as SeriesNode);
          } else {
            circuit.children.push(newComponent);
          }
        } else {
          circuit.children.push(newComponent);
        }

        return { circuit, ...recalc({ ...state, circuit }) };
      });
    },

    addAmperemeterNear: (targetId) => {
      set((state) => {
        const circuit = cloneNode(state.circuit) as SeriesNode;
        const found = findNode(circuit, targetId);
        if (!found) return state;

        const ammeter = makeComponent('ammeter');
        if (found.parent.kind === 'series') {
          found.parent.children.splice(found.index + 1, 0, ammeter);
        }

        return { circuit, ...recalc({ ...state, circuit }) };
      });
    },

    addVoltmeterAcross: (targetId) => {
      set((state) => {
        const circuit = cloneNode(state.circuit) as SeriesNode;
        const found = findNode(circuit, targetId);
        if (!found) return state;

        const targetNode = found.node;
        const voltmeter = makeComponent('voltmeter');

        if (found.parent.kind === 'series') {
          const parallelNode: ParallelNode = {
            kind: 'parallel',
            id: uid(),
            branches: [
              makeSeriesNode([targetNode]),
              makeSeriesNode([voltmeter]),
            ],
          };
          found.parent.children[found.index] = parallelNode;
        } else if (targetNode.kind === 'parallel') {
          targetNode.branches.push(makeSeriesNode([voltmeter]));
        }

        return { circuit, ...recalc({ ...state, circuit }) };
      });
    },

    removeComponent: (id) => {
      set((state) => {
        const circuit = cloneNode(state.circuit) as SeriesNode;
        const found = findNode(circuit, id);
        if (!found) return state;

        if (found.parent.kind === 'series') {
          found.parent.children.splice(found.index, 1);
        } else if (found.parent.kind === 'parallel') {
          found.parent.branches.splice(found.index, 1);
        }

        const simplified = simplify(circuit);
        const finalCircuit = (simplified?.kind === 'series'
          ? simplified
          : makeSeriesNode(simplified ? [simplified] : [makeLamp()])) as SeriesNode;

        return {
          circuit: finalCircuit,
          selectedComponentId:
            state.selectedComponentId === id ? null : state.selectedComponentId,
          ...recalc({ ...state, circuit: finalCircuit }),
        };
      });
    },

    setLampResistance: (id, multiplier) => {
      set((state) => {
        const circuit = cloneNode(state.circuit) as SeriesNode;
        const node = findNodeDirect(circuit, id);
        if (node && node.kind === 'component' && node.componentType === 'lamp') {
          node.resistanceMultiplier = multiplier;
        }
        return { circuit, ...recalc({ ...state, circuit }) };
      });
    },

    addParallelBranch: (componentId) => {
      set((state) => {
        const circuit = cloneNode(state.circuit) as SeriesNode;
        const found = findNode(circuit, componentId);
        if (!found) return state;

        const targetNode = found.node;

        if (targetNode.kind === 'parallel') {
          targetNode.branches.push(makeSeriesNode([makeLamp()]));
        } else {
          const parentParallel = findParentParallel(circuit, componentId);
          if (parentParallel) {
            parentParallel.parallel.branches.push(makeSeriesNode([makeLamp()]));
          } else if (found.parent.kind === 'series') {
            const parallelNode: ParallelNode = {
              kind: 'parallel',
              id: uid(),
              branches: [
                makeSeriesNode([targetNode]),
                makeSeriesNode([makeLamp()]),
              ],
            };
            found.parent.children[found.index] = parallelNode;
          }
        }

        return { circuit, ...recalc({ ...state, circuit }) };
      });
    },

    addAmmeterParallelBranch: (componentId) => {
      set((state) => {
        const circuit = cloneNode(state.circuit) as SeriesNode;
        const found = findNode(circuit, componentId);
        if (!found) return state;

        const targetNode = found.node;
        const newBranch = makeSeriesNode([makeComponent('ammeter')]);

        if (targetNode.kind === 'parallel') {
          targetNode.branches.push(newBranch);
        } else {
          const parentParallel = findParentParallel(circuit, componentId);
          if (parentParallel) {
            parentParallel.parallel.branches.push(newBranch);
          } else if (found.parent.kind === 'series') {
            const parallelNode: ParallelNode = {
              kind: 'parallel',
              id: uid(),
              branches: [
                makeSeriesNode([targetNode]),
                newBranch,
              ],
            };
            found.parent.children[found.index] = parallelNode;
          }
        }

        return { circuit, ...recalc({ ...state, circuit }) };
      });
    },

    selectComponent: (id) => {
      set({ selectedComponentId: id });
    },

    resetCircuit: () => {
      const circuit = createInitialCircuit();
      set((state) => ({
        circuit,
        voltage: DEFAULT_VOLTAGE,
        selectedComponentId: null,
        ...recalc({ ...state, circuit, voltage: DEFAULT_VOLTAGE }),
      }));
    },

    recalculate: () => {
      set((state) => recalc(state));
    },

    setWireEnabled: (v) => set((state) => ({ wireEnabled: v, ...recalc({ ...state, wireEnabled: v }) })),
    setWireMaterial: (m) => set((state) => ({ wireMaterial: m, ...recalc({ ...state, wireMaterial: m }) })),
    setWireDiameterMm: (d) => set((state) => ({ wireDiameterMm: d, ...recalc({ ...state, wireDiameterMm: d }) })),
    setWireTotalLengthPx: (px) => set((state) => ({ wireTotalLengthPx: px, ...recalc({ ...state, wireTotalLengthPx: px }) })),
  };
});
