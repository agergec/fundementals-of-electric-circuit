import { create } from 'zustand';
import type { FreeComponent, FreeWire, ToolType, TerminalId } from '../engine/types';
import type { CalculatedValues } from '../engine/types';
import { terminalId } from '../engine/types';
import type { WireMaterial } from '../utils/constants';
import { DEFAULT_VOLTAGE } from '../utils/constants';
import { solveFreeCircuit } from '../engine/freeMode/solver';
import { validateCircuit } from '../engine/freeMode/validate';
import { importFromTree } from '../engine/freeMode/importTree';
import type { CircuitNode } from '../engine/types';

// ── ID generator ──
let nextId = 1;
function genId(prefix: string): string {
  return `${prefix}-${nextId++}`;
}

// ── Helpers ──

function makeComponent(
  type: FreeComponent['componentType'],
  x: number,
  y: number,
): FreeComponent {
  return {
    id: genId(type),
    componentType: type,
    x,
    y,
    rotation: 0,
    resistanceMultiplier: 1,
    closed: type === 'switch' ? true : undefined,
    currentRating: type === 'fuse' ? 2 : undefined,
    voltage: type === 'generator' ? DEFAULT_VOLTAGE : undefined,
  };
}

const MAX_HISTORY = 50;

function pushStack(
  stack: { components: FreeComponent[]; wires: FreeWire[] }[],
  components: FreeComponent[],
  wires: FreeWire[],
) {
  const entry = { components, wires };
  if (stack.length >= MAX_HISTORY) return [...stack.slice(1), entry];
  return [...stack, entry];
}

// ── Store ──

interface FreeModeStore {
  // State
  components: FreeComponent[];
  wires: FreeWire[];
  activeTool: ToolType;
  selectedComponentId: string | null;
  selectedWireId: string | null;
  voltage: number;
  wireEnabled: boolean;
  wireMaterial: WireMaterial;
  wireDiameterMm: number;
  wireLineType: 'curved' | 'straight' | 'corner';
  breadboard: boolean;
  toggleBreadboard: () => void;
  realisticView: boolean;
  toggleRealisticView: () => void;
  calculatedValues: Record<string, CalculatedValues>;
  totalResistance: number;
  totalCurrent: number;
  wireResistances: Record<string, number>;
  totalWireResistance: number;
  terminalPolarities: Record<string, '+' | '-'>;
  solverErrorKey: string | null;
  validationIssues: { level: string; key: string; detailKey: string; ids: string[] }[];
  errorIds: string[];
  pendingWire: { fromTerminal: TerminalId; toX: number; toY: number } | null;

  // Undo/redo
  undoStack: { components: FreeComponent[]; wires: FreeWire[] }[];
  redoStack: { components: FreeComponent[]; wires: FreeWire[] }[];
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;

  // Actions
  placeComponent: (type: FreeComponent['componentType'], x: number, y: number) => void;
  insertComponentOnWire: (type: FreeComponent['componentType'], x: number, y: number, wireId: string) => void;
  removeComponent: (id: string) => void;
  moveComponent: (id: string, x: number, y: number) => void;
  addWire: (from: TerminalId, to: TerminalId) => void;
  removeWire: (id: string) => void;
  setActiveTool: (tool: ToolType) => void;
  selectComponent: (id: string | null) => void;
  selectWire: (id: string | null) => void;
  toggleSwitch: (id: string) => void;
  setLampMultiplier: (id: string, multiplier: number) => void;
  setVoltage: (v: number) => void;
  setWireEnabled: (enabled: boolean) => void;
  setWireMaterial: (material: WireMaterial) => void;
  setWireDiameterMm: (d: number) => void;
  setWireLineType: (t: 'curved' | 'straight' | 'corner') => void;
  setWireLineTypeById: (wireId: string, t: 'curved' | 'straight' | 'corner') => void;
  setWireMaterialById: (wireId: string, material: WireMaterial) => void;
  setWireDiameterMmById: (wireId: string, d: number) => void;
  setWireWaypoints: (wireId: string, waypoints: { x: number; y: number }[]) => void;
  rewireEndpoint: (wireId: string, end: 'from' | 'to', newTerminal: string) => void;
  startWire: (from: TerminalId, mouseX: number, mouseY: number) => void;
  updateWirePreview: (mouseX: number, mouseY: number) => void;
  cancelWire: () => void;
  rotateComponent: (id: string, dir: number) => void;
  setRotateText: (id: string, enabled: boolean) => void;
  setFuseRating: (id: string, rating: number) => void;
  resetFuse: (id: string) => void;
  setGeneratorVoltage: (id: string, v: number) => void;
  resetCircuit: () => void;
  saveCircuit: () => void;
  loadCircuit: () => void;
  importFromStructured: (tree: CircuitNode, voltage: number) => void;
}

function createDefaultComponents(): FreeComponent[] {
  return []; // empty canvas — student places everything
}

export const useFreeModeStore = create<FreeModeStore>((set) => ({
  components: createDefaultComponents(),
  wires: [],
  activeTool: 'select',
  selectedComponentId: null,
  selectedWireId: null,
  voltage: DEFAULT_VOLTAGE,
  wireEnabled: false,
  wireMaterial: 'copper',
  wireDiameterMm: 1.0,
  wireLineType: 'straight',
  breadboard: false,
  toggleBreadboard: () => set((s) => ({ breadboard: !s.breadboard })),
  realisticView: false,
  toggleRealisticView: () => set((s) => ({ realisticView: !s.realisticView })),
  calculatedValues: {},
  totalResistance: Infinity,
  totalCurrent: 0,
  wireResistances: {},
  totalWireResistance: 0,
  terminalPolarities: {},
  solverErrorKey: null,
  validationIssues: [],
  errorIds: [],
  pendingWire: null,
  undoStack: [],
  redoStack: [],

  // ── History ──

  undo: () => set((s) => {
    if (s.undoStack.length === 0) return {};
    const prev = s.undoStack[s.undoStack.length - 1];
    return {
      components: prev.components,
      wires: prev.wires,
      undoStack: s.undoStack.slice(0, -1),
      redoStack: [...s.redoStack, { components: s.components, wires: s.wires }],
      selectedComponentId: null,
      selectedWireId: null,
      ...recalc({ ...s, components: prev.components, wires: prev.wires }),
    };
  }),

  redo: () => set((s) => {
    if (s.redoStack.length === 0) return {};
    const next = s.redoStack[s.redoStack.length - 1];
    return {
      components: next.components,
      wires: next.wires,
      redoStack: s.redoStack.slice(0, -1),
      undoStack: [...s.undoStack, { components: s.components, wires: s.wires }],
      selectedComponentId: null,
      selectedWireId: null,
      ...recalc({ ...s, components: next.components, wires: next.wires }),
    };
  }),

  pushHistory: () => set((s) => ({
    undoStack: pushStack(s.undoStack, s.components, s.wires),
    redoStack: [],
  })),

  // ── Actions ──

  placeComponent: (type, x, y) => {
    const comp = makeComponent(type, x, y);
    set((s) => {
      const components = [...s.components, comp];
      return {
        components,
        undoStack: pushStack(s.undoStack, s.components, s.wires),
        redoStack: [],
        ...recalc({ ...s, components }),
      };
    });
  },

  insertComponentOnWire: (type, x, y, wireId) => {
    const comp = makeComponent(type, x, y);
    set((s) => {
      const splitWire = s.wires.find(w => w.id === wireId);
      if (!splitWire) return {};
      const wires = s.wires.filter(w => w.id !== wireId);
      // Create two new wires connecting through the new component
      const wireA: FreeWire = {
        id: genId('wire'),
        fromTerminal: splitWire.fromTerminal,
        toTerminal: terminalId(comp.id, 0),
        material: splitWire.material,
        diameterMm: splitWire.diameterMm,
        lineType: splitWire.lineType,
        waypoints: [],
      };
      const wireB: FreeWire = {
        id: genId('wire'),
        fromTerminal: terminalId(comp.id, comp.componentType === 'junction' ? 0 : 1),
        toTerminal: splitWire.toTerminal,
        material: splitWire.material,
        diameterMm: splitWire.diameterMm,
        lineType: splitWire.lineType,
        waypoints: [],
      };
      const components = [...s.components, comp];
      wires.push(wireA, wireB);
      return {
        components,
        wires,
        undoStack: pushStack(s.undoStack, s.components, s.wires),
        redoStack: [],
        ...recalc({ ...s, components, wires }),
      };
    });
  },

  removeComponent: (id) => {
    set((s) => {
      const components = s.components.filter((c) => c.id !== id);
      const tid0 = terminalId(id, 0);
      const tid1 = terminalId(id, 1);
      const wires = s.wires.filter(
        (w) => w.fromTerminal !== tid0 && w.fromTerminal !== tid1 &&
               w.toTerminal !== tid0 && w.toTerminal !== tid1,
      );
      const selectedComponentId = s.selectedComponentId === id ? null : s.selectedComponentId;
      return {
        components,
        wires,
        selectedComponentId,
        undoStack: pushStack(s.undoStack, s.components, s.wires),
        redoStack: [],
        ...recalc({ ...s, components, wires }),
      };
    });
  },

  moveComponent: (id, x, y) => {
    set((s) => {
      const components = s.components.map((c) =>
        c.id === id ? { ...c, x, y } : c,
      );
      return { components, ...recalc({ ...s, components }) };
    });
  },

  addWire: (from, to) => {
    set((s) => {
      const exists = s.wires.some(
        (w) =>
          (w.fromTerminal === from && w.toTerminal === to) ||
          (w.fromTerminal === to && w.toTerminal === from),
      );
      if (exists) return { pendingWire: null };

      const wire: FreeWire = {
        id: genId('wire'),
        fromTerminal: from,
        toTerminal: to,
        material: s.wireMaterial,
        diameterMm: s.wireDiameterMm,
        lineType: s.wireLineType,
        waypoints: [],
      };
      const wires = [...s.wires, wire];
      return {
        wires,
        pendingWire: null,
        activeTool: 'select' as ToolType,
        undoStack: pushStack(s.undoStack, s.components, s.wires),
        redoStack: [],
        ...recalc({ ...s, wires }),
      };
    });
  },

  removeWire: (id) => {
    set((s) => {
      const wires = s.wires.filter((w) => w.id !== id);
      const selectedWireId = s.selectedWireId === id ? null : s.selectedWireId;
      return {
        wires,
        selectedWireId,
        undoStack: pushStack(s.undoStack, s.components, s.wires),
        redoStack: [],
        ...recalc({ ...s, wires }),
      };
    });
  },

  setActiveTool: (tool) => set({ activeTool: tool, pendingWire: null }),

  selectComponent: (id) => set({ selectedComponentId: id, selectedWireId: null }),

  selectWire: (id) => set({ selectedWireId: id, selectedComponentId: null }),

  toggleSwitch: (id) => {
    set((s) => {
      const components = s.components.map((c) =>
        c.id === id && c.componentType === 'switch'
          ? { ...c, closed: !c.closed }
          : c,
      );
      return {
        components,
        undoStack: pushStack(s.undoStack, s.components, s.wires),
        redoStack: [],
        ...recalc({ ...s, components }),
      };
    });
  },

  setLampMultiplier: (id, multiplier) => {
    set((s) => {
      const components = s.components.map((c) =>
        c.id === id && (c.componentType === 'lamp' || c.componentType === 'resistor')
          ? { ...c, resistanceMultiplier: multiplier }
          : c,
      );
      return {
        components,
        undoStack: pushStack(s.undoStack, s.components, s.wires),
        redoStack: [],
        ...recalc({ ...s, components }),
      };
    });
  },

  setVoltage: (v) => set((s) => ({ voltage: v, ...recalc({ ...s, voltage: v }) })),

  setWireEnabled: (enabled) => set((s) => ({
    wireEnabled: enabled,
    ...recalc({ ...s, wireEnabled: enabled }),
  })),

  setWireMaterial: (material) => set((s) => ({
    wireMaterial: material,
    ...recalc({ ...s, wireMaterial: material }),
  })),

  setWireDiameterMm: (d) => set((s) => ({
    wireDiameterMm: d,
    ...recalc({ ...s, wireDiameterMm: d }),
  })),

  setWireLineType: (t) => set({ wireLineType: t }),

  setWireLineTypeById: (wireId, t) => set((s) => {
    const wires = s.wires.map((w) =>
      w.id === wireId ? { ...w, lineType: t } : w,
    );
    return { wires, ...recalc({ ...s, wires }) };
  }),

  setWireMaterialById: (wireId, material) => set((s) => {
    const wires = s.wires.map((w) =>
      w.id === wireId ? { ...w, material } : w,
    );
    return { wires, ...recalc({ ...s, wires }) };
  }),

  setWireDiameterMmById: (wireId, d) => set((s) => {
    const wires = s.wires.map((w) =>
      w.id === wireId ? { ...w, diameterMm: d } : w,
    );
    return { wires, ...recalc({ ...s, wires }) };
  }),

  setWireWaypoints: (wireId, waypoints) => set((s) => {
    const wires = s.wires.map((w) =>
      w.id === wireId ? { ...w, waypoints } : w,
    );
    return {
      wires,
      redoStack: [],
      ...recalc({ ...s, wires }),
    };
  }),

  rewireEndpoint: (wireId, end, newTerminal) => set((s) => {
    const wires = s.wires.map((w) => {
      if (w.id !== wireId) return w;
      // Clear waypoints on rewire so the wire auto-routes to the new endpoint
      if (end === 'from') return { ...w, fromTerminal: newTerminal, waypoints: [] };
      return { ...w, toTerminal: newTerminal, waypoints: [] };
    });
    return {
      wires,
      undoStack: pushStack(s.undoStack, s.components, s.wires),
      redoStack: [],
      ...recalc({ ...s, wires }),
    };
  }),

  startWire: (from, mouseX, mouseY) => {
    set({
      activeTool: 'wire',
      pendingWire: { fromTerminal: from, toX: mouseX, toY: mouseY },
    });
  },

  updateWirePreview: (mouseX, mouseY) => {
    set((s) => {
      if (!s.pendingWire) return {};
      return { pendingWire: { ...s.pendingWire, toX: mouseX, toY: mouseY } };
    });
  },

  cancelWire: () => set({ pendingWire: null, activeTool: 'select' }),

  resetCircuit: () => {
    nextId = 1;
    const components = createDefaultComponents();
    set({
      components,
      wires: [],
      activeTool: 'select',
      selectedComponentId: null,
      selectedWireId: null,
      voltage: DEFAULT_VOLTAGE,
      wireEnabled: false,
      wireMaterial: 'copper',
      wireDiameterMm: 1.0,
      pendingWire: null,
      undoStack: [],
      redoStack: [],
      ...recalcRaw(components, [], DEFAULT_VOLTAGE),
    });
  },

  rotateComponent: (id, dir) => set((s) => {
    const components = s.components.map((c) =>
      c.id === id ? { ...c, rotation: ((c.rotation + dir) % 360 + 360) % 360 } : c,
    );
    return {
      components,
      undoStack: pushStack(s.undoStack, s.components, s.wires),
      redoStack: [],
      ...recalc({ ...s, components }),
    };
  }),

  setRotateText: (id, enabled) => set((s) => {
    const components = s.components.map((c) =>
      c.id === id ? { ...c, rotateText: enabled } : c,
    );
    return { components };
  }),

  setFuseRating: (id, rating) => set((s) => {
    const components = s.components.map((c) =>
      c.id === id ? { ...c, currentRating: rating } : c,
    );
    return { components, ...recalc({ ...s, components }) };
  }),

  resetFuse: (id) => set((s) => {
    const components = s.components.map((c) =>
      c.id === id ? { ...c, blown: false } : c,
    );
    return { components, ...recalc({ ...s, components }) };
  }),

  setGeneratorVoltage: (id, v) => set((s) => {
    const components = s.components.map((c) =>
      c.id === id ? { ...c, voltage: v } : c,
    );
    return { components, ...recalc({ ...s, components }) };
  }),

  saveCircuit: () => {
    const s = useFreeModeStore.getState();
    const data = {
      version: 2,
      components: s.components,
      wires: s.wires,
      voltage: s.voltage,
      wireEnabled: s.wireEnabled,
      wireMaterial: s.wireMaterial,
      wireDiameterMm: s.wireDiameterMm,
    };
    try {
      localStorage.setItem('circuitlab-free-save', JSON.stringify(data));
    } catch { /* quota exceeded, silently fail */ }
  },

  loadCircuit: () => {
    try {
      const raw = localStorage.getItem('circuitlab-free-save');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data.components || !data.wires) return;
      // Update nextId beyond existing IDs
      let maxNum = 0;
      for (const c of data.components) {
        const m = c.id.match(/\d+$/);
        if (m) maxNum = Math.max(maxNum, Number(m[0]));
      }
      for (const w of data.wires) {
        const m = w.id.match(/\d+$/);
        if (m) maxNum = Math.max(maxNum, Number(m[0]));
      }
      nextId = maxNum + 1;
      // Migrate v1 wires (corner1/2) to v2 (waypoints[])
      const wires = (data.wires as any[]).map((w: any) => {
        if (w.waypoints) return w; // already v2
        const wp: { x: number; y: number }[] = [];
        if (w.corner1X != null && w.corner2X != null) {
          wp.push({ x: w.corner1X, y: w.corner1Y }, { x: w.corner2X, y: w.corner2Y });
        }
        const { corner1X, corner1Y, corner2X, corner2Y, ...rest } = w;
        return { ...rest, waypoints: wp, lineType: rest.lineType ?? 'straight' };
      });
      set({
        components: data.components,
        wires,
        voltage: data.voltage ?? DEFAULT_VOLTAGE,
        wireEnabled: data.wireEnabled ?? false,
        wireMaterial: data.wireMaterial ?? 'copper',
        wireDiameterMm: data.wireDiameterMm ?? 1.0,
        undoStack: [],
        redoStack: [],
        selectedComponentId: null,
        selectedWireId: null,
        activeTool: 'select',
        pendingWire: null,
        ...recalcRaw(data.components, data.wires, data.voltage ?? DEFAULT_VOLTAGE),
      });
    } catch { /* corrupted data, silently fail */ }
  },

  importFromStructured: (tree, voltage) => {
    const s = useFreeModeStore.getState();
    const result = importFromTree(tree, voltage, s.wireMaterial, s.wireDiameterMm);
    nextId = Math.max(nextId, 2000);
    set({
      components: result.components,
      wires: result.wires,
      voltage: result.voltage,
      activeTool: 'select',
      selectedComponentId: null,
      selectedWireId: null,
      pendingWire: null,
      undoStack: [],
      redoStack: [],
      ...recalcRaw(result.components, result.wires, result.voltage),
    });
  },
}));

// ── Recalculation ──

function recalc(
  s: Pick<
    FreeModeStore,
    'components' | 'wires' | 'voltage' | 'wireEnabled' | 'wireMaterial' | 'wireDiameterMm'
  >,
): Partial<FreeModeStore> {
  // Use single generator's actual voltage, fall back to global voltage
  const gens = s.components.filter(c => c.componentType === 'generator');
  const voltage = gens.length === 1 ? (gens[0].voltage ?? s.voltage) : s.voltage;
  return recalcRaw(s.components, s.wires, voltage, s.wireEnabled);
}

function recalcRaw(
  components: FreeComponent[],
  wires: FreeWire[],
  voltage: number,
  wireEnabled = false,
): Partial<FreeModeStore> {
  let result: ReturnType<typeof solveFreeCircuit>;
  try {
    result = solveFreeCircuit(components, wires, voltage, wireEnabled);
  } catch {
    return { solverErrorKey: 'freeMode.tooComplex' };
  }

  // Blow fuses that exceeded their rating
  let updatedComponents = components;
  if (result.blownFuses.length > 0) {
    updatedComponents = components.map((c) =>
      result.blownFuses.includes(c.id) ? { ...c, blown: true } : c,
    );
    // Re-solve with blown fuses
    const blownResult = solveFreeCircuit(updatedComponents, wires, voltage, wireEnabled);
    if (blownResult.success) {
      const blownValidation = validateCircuit(updatedComponents, wires, blownResult, voltage);
      return {
        components: updatedComponents,
        calculatedValues: blownResult.values,
        totalResistance: blownResult.totalResistance,
        totalCurrent: blownResult.totalCurrent,
        wireResistances: blownResult.wireResistances,
        totalWireResistance: blownResult.totalWireResistance,
        terminalPolarities: blownResult.polarities,
        solverErrorKey: null,
        validationIssues: blownValidation.issues,
        errorIds: [...blownValidation.errorIds],
      };
    }
  }

  const validation = validateCircuit(updatedComponents, wires, result, voltage);

  if (!result.success) {
    return {
      calculatedValues: {},
      totalResistance: result.totalResistance,
      totalCurrent: 0,
      wireResistances: result.wireResistances,
      totalWireResistance: result.totalWireResistance,
      terminalPolarities: {},
      solverErrorKey: result.errorKey ?? null,
      validationIssues: validation.issues,
      errorIds: [...validation.errorIds],
    };
  }

  return {
    calculatedValues: result.values,
    totalResistance: result.totalResistance,
    totalCurrent: result.totalCurrent,
    wireResistances: result.wireResistances,
    totalWireResistance: result.totalWireResistance,
    terminalPolarities: result.polarities,
    solverErrorKey: null,
    validationIssues: validation.issues,
    errorIds: [...validation.errorIds],
  };
}

// ── Selectors ──

export function getTerminalPos(
  id: string,
  index: 0 | 1,
  components: FreeComponent[],
): { x: number; y: number } | null {
  const comp = components.find((c) => c.id === id);
  if (!comp) return null;
  return computeTerminalPos(comp, index);
}

export function computeTerminalPos(
  comp: FreeComponent,
  index: 0 | 1,
): { x: number; y: number } {
  // Junction has single central terminal
  if (comp.componentType === 'junction') return { x: comp.x, y: comp.y };

  const r = ((comp.rotation || 0) % 360 + 360) % 360;
  const cx = comp.x, cy = comp.y;
  const half = comp.componentType === 'switch' ? 40 : 40;
  const sign = index === 0 ? -1 : 1;
  if (r === 0)   return { x: cx + sign * half, y: cy };
  if (r === 90)  return { x: cx, y: cy + sign * half };
  if (r === 180) return { x: cx - sign * half, y: cy };
  return { x: cx, y: cy - sign * half };
}
