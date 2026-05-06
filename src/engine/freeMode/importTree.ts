import type { CircuitNode, FreeComponent, FreeWire } from '../types';
import type { WireMaterial } from '../../utils/constants';

const COMP_W = 80;
const WIRE_Y = 120;
const GEN_X = 80;

interface ImportResult {
  components: FreeComponent[];
  wires: FreeWire[];
  voltage: number;
}

let nextId = 1000;
function genId(prefix: string): string { return `${prefix}-import-${nextId++}`; }

/**
 * Convert a structured circuit tree to free-mode components and wires.
 * Handles one level of series/parallel nesting (covers the built-in builder).
 */
export function importFromTree(
  tree: CircuitNode,
  voltage: number,
  wireMaterial: WireMaterial = 'copper',
  wireDiameterMm: number = 1.0,
): ImportResult {
  nextId = 1000;
  const components: FreeComponent[] = [];
  const wires: FreeWire[] = [];

  // Generator at standard position
  const gen: FreeComponent = {
    id: genId('generator'),
    componentType: 'generator',
    x: GEN_X,
    y: 240,
    rotation: 0,
    resistanceMultiplier: 1,
  };
  components.push(gen);

  // Layout the tree starting at COMP_START_X
  const info = layoutToFree(tree, 160, WIRE_Y, components, wires);

  // Complete the loop: generator → components → back to generator
  // Gen terminal 1 (+) to first component entry
  wires.push({
    id: genId('wire'),
    fromTerminal: `${gen.id}:1`,
    toTerminal: `${info.firstId}:0`,
    material: wireMaterial,
    diameterMm: wireDiameterMm,
    lineType: 'straight',
  });

  // Last component exit to return wire → gen terminal 0 (-)
  const returnY = WIRE_Y + 160;
  const endX = info.exitX + 40;

  const cornerId1 = genId('junction');
  const cornerId2 = genId('junction');
  const corner1: FreeComponent = { id: cornerId1, componentType: 'junction', x: endX, y: WIRE_Y, rotation: 0, resistanceMultiplier: 1 };
  const corner2: FreeComponent = { id: cornerId2, componentType: 'junction', x: endX, y: returnY, rotation: 0, resistanceMultiplier: 1 };
  const corner3: FreeComponent = { id: genId('junction'), componentType: 'junction', x: GEN_X, y: returnY, rotation: 0, resistanceMultiplier: 1 };
  components.push(corner1, corner2, corner3);

  wires.push({
    id: genId('wire'),
    fromTerminal: `${info.lastId}:1`,
    toTerminal: `${cornerId1}:0`,
    material: wireMaterial,
    diameterMm: wireDiameterMm,
    lineType: 'corner',
  });
  wires.push({
    id: genId('wire'),
    fromTerminal: `${cornerId1}:0`,
    toTerminal: `${cornerId2}:0`,
    material: wireMaterial,
    diameterMm: wireDiameterMm,
    lineType: 'straight',
  });
  wires.push({
    id: genId('wire'),
    fromTerminal: `${cornerId2}:0`,
    toTerminal: `${corner3.id}:0`,
    material: wireMaterial,
    diameterMm: wireDiameterMm,
    lineType: 'straight',
  });
  wires.push({
    id: genId('wire'),
    fromTerminal: `${corner3.id}:0`,
    toTerminal: `${gen.id}:0`,
    material: wireMaterial,
    diameterMm: wireDiameterMm,
    lineType: 'straight',
  });

  // Also connect gen top to first component top wire
  wires.push({
    id: genId('wire'),
    fromTerminal: `${gen.id}:1`,
    toTerminal: `${info.firstId}:0`,
    material: wireMaterial,
    diameterMm: wireDiameterMm,
    lineType: 'straight',
  });

  // Remove duplicate gen-to-first wire (we already added one above)
  // Actually let me keep just one. Remove the extra one.
  const dupIdx = wires.findIndex(w => w.fromTerminal === `${gen.id}:1` && w.toTerminal === `${info.firstId}:0`);
  if (dupIdx >= 0) {
    // Keep the first one, remove the second
    const secondIdx = wires.findIndex((w, i) => i > dupIdx && w.fromTerminal === `${gen.id}:1` && w.toTerminal === `${info.firstId}:0`);
    if (secondIdx >= 0) wires.splice(secondIdx, 1);
  }

  // Gen bottom to corner (left side return)
  wires.push({
    id: genId('wire'),
    fromTerminal: `${corner3.id}:0`,
    toTerminal: `${gen.id}:0`,
    material: wireMaterial,
    diameterMm: wireDiameterMm,
    lineType: 'straight',
  });

  return { components, wires, voltage };
}

interface LayoutInfo {
  firstId: string;
  lastId: string;
  exitX: number;
}

function layoutToFree(
  node: CircuitNode,
  x: number,
  y: number,
  components: FreeComponent[],
  wires: FreeWire[],
): LayoutInfo {
  if (node.kind === 'component') {
    const comp: FreeComponent = {
      id: node.id,
      componentType: node.componentType,
      x,
      y,
      rotation: 0,
      resistanceMultiplier: node.resistanceMultiplier,
      closed: node.closed,
    };
    components.push(comp);
    return { firstId: comp.id, lastId: comp.id, exitX: x + COMP_W };
  }

  if (node.kind === 'series') {
    let firstId = '';
    let lastId = '';
    let currentX = x;

    for (let i = 0; i < node.children.length; i++) {
      const info = layoutToFree(node.children[i], currentX, y, components, wires);
      if (i === 0) firstId = info.firstId;
      lastId = info.lastId;
      currentX += (info.exitX - currentX);
    }

    // Connect series children: child[i].terminal1 → child[i+1].terminal0
    const seriesComponents = node.children
      .map((c) => extractComponentId(c))
      .filter(Boolean);
    for (let i = 0; i < seriesComponents.length - 1; i++) {
      wires.push({
        id: genId('wire'),
        fromTerminal: `${seriesComponents[i]}:1`,
        toTerminal: `${seriesComponents[i + 1]}:0`,
        material: 'copper',
        diameterMm: 1.0,
        lineType: 'straight',
      });
    }

    return { firstId, lastId, exitX: currentX };
  }

  if (node.kind === 'parallel') {
    // Place branches vertically, use junctions for fork/merge
    const forkX = x;
    const forkJunction: FreeComponent = {
      id: genId('junction'),
      componentType: 'junction',
      x: forkX,
      y,
      rotation: 0,
      resistanceMultiplier: 1,
    };
    components.push(forkJunction);

    let maxWidth = 0;
    const branchInfos: LayoutInfo[] = [];
    let branchY = y - (node.branches.length - 1) * 80;

    for (const branch of node.branches) {
      const info = layoutToFree(branch, forkX + 40, branchY, components, wires);
      branchInfos.push(info);
      maxWidth = Math.max(maxWidth, info.exitX - forkX - 40);
      branchY += 120;

      // Wire fork junction → branch entry
      wires.push({
        id: genId('wire'),
        fromTerminal: `${forkJunction.id}:0`,
        toTerminal: `${info.firstId}:0`,
        material: 'copper',
        diameterMm: 1.0,
        lineType: 'corner',
      });
    }

    const mergeX = forkX + 40 + maxWidth + 40;
    const mergeJunction: FreeComponent = {
      id: genId('junction'),
      componentType: 'junction',
      x: mergeX,
      y,
      rotation: 0,
      resistanceMultiplier: 1,
    };
    components.push(mergeJunction);

    // Wire branch exits → merge junction
    for (const info of branchInfos) {
      wires.push({
        id: genId('wire'),
        fromTerminal: `${info.lastId}:1`,
        toTerminal: `${mergeJunction.id}:0`,
        material: 'copper',
        diameterMm: 1.0,
        lineType: 'corner',
      });
    }

    return { firstId: forkJunction.id, lastId: mergeJunction.id, exitX: mergeX + 40 };
  }

  return { firstId: '', lastId: '', exitX: x };
}

/** Extract the first component ID from a tree node (for wiring) */
function extractComponentId(node: CircuitNode): string | null {
  if (node.kind === 'component') return node.id;
  if (node.kind === 'series' && node.children.length > 0) return extractComponentId(node.children[0]);
  if (node.kind === 'parallel' && node.branches.length > 0) return extractComponentId(node.branches[0]);
  return null;
}
