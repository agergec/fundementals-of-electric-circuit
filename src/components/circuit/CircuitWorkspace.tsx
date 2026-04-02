import { useCircuitStore } from '../../store/circuitStore';
import { Generator } from '../elements/Generator';
import type { CircuitNode, ComponentNode } from '../../engine/types';
import { Lamp } from '../elements/Lamp';
import { Ammeter } from '../elements/Ammeter';
import { Voltmeter } from '../elements/Voltmeter';
import { Switch } from '../elements/Switch';
import { CurrentDots } from './CurrentDots';

// Layout tuning
const COMP_WIDTH = 90;       // horizontal space per component
const WIRE_PAD = 25;         // wire padding before/after parallel fork/merge

const GEN_X = 60;
const COMP_START_X = 160;
const WIRE_Y = 120; // top wire where components sit

type Wire = { x1: number; y1: number; x2: number; y2: number };

interface LayoutItem {
  id: string;
  x: number;
  y: number;
  node: ComponentNode;
}

interface LayoutResult {
  items: LayoutItem[];
  wires: Wire[];
  width: number;
  // Height above and below the center line (for proper parallel stacking)
  heightAbove: number;
  heightBelow: number;
  entryX: number;
  entryY: number;
  exitX: number;
  exitY: number;
}

function layoutNode(node: CircuitNode, x: number, y: number): LayoutResult {
  if (node.kind === 'component') {
    return {
      items: [{ id: node.id, x, y, node }],
      wires: [],
      width: COMP_WIDTH,
      heightAbove: 30,
      heightBelow: 50, // extra for labels
      entryX: x - 24,
      entryY: y,
      exitX: x + 24,
      exitY: y,
    };
  }

  if (node.kind === 'series') {
    const allItems: LayoutItem[] = [];
    const allWires: Wire[] = [];
    let currentX = x;
    let maxAbove = 30;
    let maxBelow = 50;

    const childLayouts: LayoutResult[] = [];
    for (const child of node.children) {
      const cl = layoutNode(child, currentX, y);
      childLayouts.push(cl);
      allItems.push(...cl.items);
      allWires.push(...cl.wires);
      currentX += cl.width;
      maxAbove = Math.max(maxAbove, cl.heightAbove);
      maxBelow = Math.max(maxBelow, cl.heightBelow);
    }

    // Connect consecutive children with wires
    for (let i = 0; i < childLayouts.length - 1; i++) {
      const from = childLayouts[i];
      const to = childLayouts[i + 1];
      allWires.push({
        x1: from.exitX,
        y1: from.exitY,
        x2: to.entryX,
        y2: to.entryY,
      });
    }

    const totalWidth = currentX - x;
    const first = childLayouts[0];
    const last = childLayouts[childLayouts.length - 1];

    return {
      items: allItems,
      wires: allWires,
      width: Math.max(totalWidth, COMP_WIDTH),
      heightAbove: maxAbove,
      heightBelow: maxBelow,
      entryX: first?.entryX ?? x,
      entryY: first?.entryY ?? y,
      exitX: last?.exitX ?? x,
      exitY: last?.exitY ?? y,
    };
  }

  if (node.kind === 'parallel') {
    // First pass: measure each branch at origin
    const branchMeasures = node.branches.map((branch) =>
      layoutNode(branch, 0, 0),
    );
    const maxWidth = Math.max(...branchMeasures.map((b) => b.width));

    // Compute Y positions by stacking branches with proper spacing
    // Each branch needs space: its heightAbove (from center up) + previous branch's heightBelow (from center down)
    const branchYPositions: number[] = [];
    let currentBranchY = 0;
    for (let i = 0; i < branchMeasures.length; i++) {
      if (i === 0) {
        currentBranchY = 0;
      } else {
        const prevBelow = branchMeasures[i - 1].heightBelow;
        const currAbove = branchMeasures[i].heightAbove;
        currentBranchY += prevBelow + currAbove + 10; // 10px gap
      }
      branchYPositions.push(currentBranchY);
    }

    // Center the branches around y
    const totalStackHeight = currentBranchY;
    const offsetY = y - totalStackHeight / 2;

    const forkX = x;
    const mergeX = x + maxWidth + WIRE_PAD * 2;

    const allItems: LayoutItem[] = [];
    const allWires: Wire[] = [];

    let overallAbove = 0;
    let overallBelow = 0;

    for (let i = 0; i < node.branches.length; i++) {
      const branchY = offsetY + branchYPositions[i];
      const bm = branchMeasures[i];
      const branchOffsetX = x + WIRE_PAD + (maxWidth - bm.width) / 2;

      const bl = layoutNode(node.branches[i], branchOffsetX, branchY);
      allItems.push(...bl.items);
      allWires.push(...bl.wires);

      // Fork wires
      allWires.push({ x1: forkX, y1: y, x2: forkX, y2: branchY });
      allWires.push({ x1: forkX, y1: branchY, x2: bl.entryX, y2: branchY });

      // Merge wires
      allWires.push({ x1: bl.exitX, y1: branchY, x2: mergeX, y2: branchY });
      allWires.push({ x1: mergeX, y1: branchY, x2: mergeX, y2: y });

      // Track extent
      const aboveDist = y - (branchY - bm.heightAbove);
      const belowDist = (branchY + bm.heightBelow) - y;
      overallAbove = Math.max(overallAbove, aboveDist);
      overallBelow = Math.max(overallBelow, belowDist);
    }

    return {
      items: allItems,
      wires: allWires,
      width: mergeX - forkX + WIRE_PAD,
      heightAbove: Math.max(overallAbove, 30),
      heightBelow: Math.max(overallBelow, 30),
      entryX: forkX,
      entryY: y,
      exitX: mergeX,
      exitY: y,
    };
  }

  return {
    items: [],
    wires: [],
    width: 0,
    heightAbove: 0,
    heightBelow: 0,
    entryX: x,
    entryY: y,
    exitX: x,
    exitY: y,
  };
}

export function CircuitWorkspace() {
  const {
    circuit,
    voltage,
    calculatedValues,
    selectedComponentId,
    selectComponent,
    toggleSwitch,
    totalResistance,
    totalCurrent,
  } = useCircuitStore();

  const isFlowing = totalCurrent > 0.0001;

  const layout = layoutNode(circuit, COMP_START_X, WIRE_Y);
  const endX = layout.exitX + 40;

  // Compute SVG bounds from actual layout extent
  let maxY = WIRE_Y;
  for (const item of layout.items) {
    maxY = Math.max(maxY, item.y + 60);
  }

  // Bottom return wire
  const returnY = Math.max(maxY + 40, WIRE_Y + 140);

  // Generator centered vertically between top wire and return wire
  const genY = (WIRE_Y + returnY) / 2;

  const svgWidth = Math.max(endX + 80, 650);
  const svgHeight = returnY + 70;

  // Clean rectangular loop:
  //   GEN(+) → right along WIRE_Y → components → right corner
  //     ↑                                            ↓
  //   GEN(−) ← left along returnY ← ← ← ← ← ← ← ←
  const loopWires: Wire[] = [
    // Generator + terminal up to top wire
    { x1: GEN_X, y1: genY - 30, x2: GEN_X, y2: WIRE_Y },
    // Top wire: generator to first component
    { x1: GEN_X, y1: WIRE_Y, x2: layout.entryX, y2: layout.entryY },
    // After last component to right corner
    { x1: layout.exitX, y1: layout.exitY, x2: endX, y2: WIRE_Y },
    // Right side: down
    { x1: endX, y1: WIRE_Y, x2: endX, y2: returnY },
    // Bottom wire: right to left
    { x1: endX, y1: returnY, x2: GEN_X, y2: returnY },
    // Generator - terminal down to bottom wire
    { x1: GEN_X, y1: genY + 30, x2: GEN_X, y2: returnY },
  ];

  const allWires = [...loopWires, ...layout.wires];
  const wireColor = isFlowing ? '#fbbf24' : '#6b7280';

  return (
    <div className="flex-1 overflow-auto p-4" onClick={() => selectComponent(null)}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="mx-auto"
        style={{ maxHeight: '80vh', minHeight: '400px' }}
      >
        <defs>
          <filter id="lampGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
          </filter>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(139,131,168,0.08)" strokeWidth="0.5" />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Wires */}
        {allWires.map((w, i) => (
          <line
            key={`w-${i}`}
            x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2}
            stroke={wireColor}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        ))}

        {/* Current dots */}
        {isFlowing && (
          <CurrentDots wires={allWires} current={totalCurrent} />
        )}

        {/* Generator */}
        <Generator x={GEN_X} y={genY} voltage={voltage} />

        {/* Components */}
        {layout.items.map((item) => {
          const comp = item.node;
          const vals = calculatedValues.get(item.id);
          const isSelected = selectedComponentId === item.id;

          const handleClick = (e: React.MouseEvent) => {
            e.stopPropagation();
            selectComponent(item.id);
          };

          switch (comp.componentType) {
            case 'lamp':
              return (
                <Lamp
                  key={item.id}
                  x={item.x} y={item.y}
                  values={vals}
                  multiplier={comp.resistanceMultiplier}
                  isSelected={isSelected}
                  onClick={handleClick}
                  isFlowing={isFlowing}
                />
              );
            case 'ammeter':
              return (
                <Ammeter
                  key={item.id}
                  x={item.x} y={item.y}
                  values={vals}
                  isSelected={isSelected}
                  onClick={handleClick}
                />
              );
            case 'voltmeter':
              return (
                <Voltmeter
                  key={item.id}
                  x={item.x} y={item.y}
                  values={vals}
                  isSelected={isSelected}
                  onClick={handleClick}
                />
              );
            case 'switch':
              return (
                <Switch
                  key={item.id}
                  x={item.x} y={item.y}
                  closed={!!comp.closed}
                  isSelected={isSelected}
                  onClick={handleClick}
                  onDoubleClick={(e: React.MouseEvent) => { e.stopPropagation(); toggleSwitch(item.id); }}
                />
              );
            default:
              return null;
          }
        })}

        {/* Total values overlay */}
        <g>
          <rect
            x={10} y={svgHeight - 65}
            width={200} height={55}
            rx={10} fill="rgba(30,27,46,0.95)"
            stroke="#4a4560" strokeWidth={1}
          />
          <text x={20} y={svgHeight - 42} fill="#8b83a8" fontSize={10} fontWeight="600">
            CIRCUIT TOTALS
          </text>
          <text x={20} y={svgHeight - 26} fill="#22c55e" fontSize={12} fontWeight="bold">
            R = {isFinite(totalResistance) ? `${totalResistance.toFixed(1)} Ω` : '∞ Ω'}
          </text>
          <text x={120} y={svgHeight - 26} fill="#ef4444" fontSize={12} fontWeight="bold">
            I = {totalCurrent.toFixed(3)} A
          </text>
        </g>
      </svg>
    </div>
  );
}
