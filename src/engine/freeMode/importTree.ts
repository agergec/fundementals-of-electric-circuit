import type { CircuitNode, FreeComponent, FreeWire } from '../types';
import type { WireMaterial } from '../../utils/constants';

const COMP_W = 80;
const WIRE_Y = 120;
const GEN_X = 80;
const SNAP = 40;
const snap = (v: number) => Math.round(v / SNAP) * SNAP;

/** Helper: minimal wire factory */
function wire(
  fromId: string, fromIdx: 0 | 1,
  toId: string, toIdx: 0 | 1,
  mat: WireMaterial, diam: number,
  lt: 'curved' | 'straight' | 'corner' = 'corner',
): FreeWire {
  return {
    id: genId('wire'),
    fromTerminal: `${fromId}:${fromIdx}`,
    toTerminal: `${toId}:${toIdx}`,
    material: mat,
    diameterMm: diam,
    lineType: lt,
    waypoints: [],
  };
}

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
  const info = layoutToFree(tree, 160, WIRE_Y, components, wires, wireMaterial, wireDiameterMm);

  // Generator → first component
  wires.push(wire(gen.id, 1, info.firstId, 0, wireMaterial, wireDiameterMm));

  // Last component exit to return wire → gen terminal 0 (-)
  const returnY = WIRE_Y + 160;
  const endX = info.exitX + 40;

  const cornerId1 = genId('junction');
  const cornerId2 = genId('junction');
  const corner1: FreeComponent = { id: cornerId1, componentType: 'junction', x: snap(endX), y: snap(WIRE_Y), rotation: 0, resistanceMultiplier: 1 };
  const corner2: FreeComponent = { id: cornerId2, componentType: 'junction', x: snap(endX), y: snap(returnY), rotation: 0, resistanceMultiplier: 1 };
  const corner3: FreeComponent = { id: genId('junction'), componentType: 'junction', x: snap(GEN_X), y: snap(returnY), rotation: 0, resistanceMultiplier: 1 };
  components.push(corner1, corner2, corner3);

  wires.push(wire(info.lastId, 1, cornerId1, 0, wireMaterial, wireDiameterMm, 'corner'));
  wires.push(wire(cornerId1, 0, cornerId2, 0, wireMaterial, wireDiameterMm));
  wires.push(wire(cornerId2, 0, corner3.id, 0, wireMaterial, wireDiameterMm));
  wires.push(wire(corner3.id, 0, gen.id, 0, wireMaterial, wireDiameterMm));

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
  mat: WireMaterial = 'copper',
  diam: number = 1.0,
): LayoutInfo {
  if (node.kind === 'component') {
    const comp: FreeComponent = {
      id: node.id,
      componentType: node.componentType,
      x: snap(x),
      y: snap(y),
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
      const info = layoutToFree(node.children[i], currentX, y, components, wires, mat, diam);
      if (i === 0) firstId = info.firstId;
      lastId = info.lastId;
      currentX += (info.exitX - currentX);
    }

    const seriesComponents = node.children
      .map((c) => extractComponentId(c))
      .filter((id): id is string => id !== null);
    for (let i = 0; i < seriesComponents.length - 1; i++) {
      wires.push(wire(seriesComponents[i], 1, seriesComponents[i + 1], 0, mat, diam));
    }

    return { firstId, lastId, exitX: currentX };
  }

  if (node.kind === 'parallel') {
    const forkX = x;
    const forkJunction: FreeComponent = {
      id: genId('junction'),
      componentType: 'junction',
      x: snap(forkX),
      y: snap(y),
      rotation: 0,
      resistanceMultiplier: 1,
    };
    components.push(forkJunction);

    let maxWidth = 0;
    const branchInfos: LayoutInfo[] = [];
    let branchY = y - (node.branches.length - 1) * 80;

    for (const branch of node.branches) {
      const info = layoutToFree(branch, forkX + 40, branchY, components, wires, mat, diam);
      branchInfos.push(info);
      maxWidth = Math.max(maxWidth, info.exitX - forkX - 40);
      branchY += 120;

      wires.push(wire(forkJunction.id, 0, info.firstId, 0, mat, diam, 'corner'));
    }

    const mergeX = forkX + 40 + maxWidth + 40;
    const mergeJunction: FreeComponent = {
      id: genId('junction'),
      componentType: 'junction',
      x: snap(mergeX),
      y: snap(y),
      rotation: 0,
      resistanceMultiplier: 1,
    };
    components.push(mergeJunction);

    for (const info of branchInfos) {
      wires.push(wire(info.lastId, 1, mergeJunction.id, 0, mat, diam, 'corner'));
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
