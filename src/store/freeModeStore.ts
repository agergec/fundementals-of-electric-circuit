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
  setWireCorners: (wireId: string, c1x: number, c1y: number, c2x: number, c2y: number) => void;
  startWire: (from: TerminalId, mouseX: number, mouseY: number) => void;
  updateWirePreview: (mouseX: number, mouseY: number) => void;
  cancelWire: () => void;
  rotateComponent: (id: string, dir: number) => void;
  setRotateText: (id: string, enabled: boolean) => void;
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
        c.id === id && c.componentType === 'lamp'
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

  setWireCorners: (wireId, c1x, c1y, c2x, c2y) => set((s) => {
    const wires = s.wires.map((w) =>
      w.id === wireId ? { ...w, corner1X: c1x, corner1Y: c1y, corner2X: c2x, corner2Y: c2y } : w,
    );
    return { wires };
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

  saveCircuit: () => {
    const s = useFreeModeStore.getState();
    const data = {
      version: 1,
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
      set({
        components: data.components,
        wires: data.wires,
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
  return recalcRaw(s.components, s.wires, s.voltage);
}

function recalcRaw(
  components: FreeComponent[],
  wires: FreeWire[],
  voltage: number,
): Partial<FreeModeStore> {
  const result = solveFreeCircuit(components, wires, voltage);
  const validation = validateCircuit(components, wires, result, voltage);

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
  const half = comp.componentType === 'switch' ? 20 : 45;
  const sign = index === 0 ? -1 : 1;
  if (r === 0)   return { x: cx + sign * half, y: cy };
  if (r === 90)  return { x: cx, y: cy + sign * half };
  if (r === 180) return { x: cx - sign * half, y: cy };
  return { x: cx, y: cy - sign * half };
}
