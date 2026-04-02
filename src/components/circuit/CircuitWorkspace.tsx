import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCircuitStore } from '../../store/circuitStore';
import { Generator } from '../elements/Generator';
import type { CircuitNode, ComponentNode } from '../../engine/types';
import { PIXEL_TO_METERS } from '../../utils/constants';
import { Lamp } from '../elements/Lamp';
import { Amperemeter } from '../elements/Amperemeter';
import { Voltmeter } from '../elements/Voltmeter';
import { Switch } from '../elements/Switch';
import { CurrentDots } from './CurrentDots';

interface CircuitIssue {
  level: 'error' | 'warning' | 'info';
  title: string;
  detail: string;
}

function getCircuitIssues(
  voltage: number,
  totalResistance: number,
  totalCurrent: number,
  t: (k: string) => string,
): CircuitIssue[] {
  const issues: CircuitIssue[] = [];

  if (voltage === 0) {
    issues.push({ level: 'info', title: t('circuit.generatorOff'), detail: t('circuit.generatorOffDetail') });
    return issues;
  }

  if (totalResistance === 0) {
    issues.push({ level: 'error', title: t('circuit.shortCircuit'), detail: t('circuit.shortCircuitDetail') });
  } else if (!isFinite(totalResistance) || (totalCurrent === 0 && voltage > 0)) {
    issues.push({ level: 'warning', title: t('circuit.openCircuit'), detail: t('circuit.openCircuitDetail') });
  }

  return issues;
}

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
  const { t } = useTranslation();
  const {
    circuit,
    voltage,
    calculatedValues,
    selectedComponentId,
    selectComponent,
    toggleSwitch,
    totalResistance,
    totalCurrent,
    wireEnabled,
    wireDiameterMm,
    wireResistance,
    setWireTotalLengthPx,
  } = useCircuitStore();

  const isFlowing = totalCurrent > 0.0001;
  const issues = getCircuitIssues(voltage, totalResistance, totalCurrent, t);

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
  const wireStrokeWidth = wireEnabled ? 1 + ((wireDiameterMm - 0.1) / 9.9) * 9 : 2.5;

  // Sync total wire pixel length to store for wire resistance calculation
  const totalPx = allWires.reduce(
    (sum, w) => sum + Math.sqrt((w.x2 - w.x1) ** 2 + (w.y2 - w.y1) ** 2), 0,
  );
  const prevPxRef = useRef(0);
  useEffect(() => {
    if (Math.abs(totalPx - prevPxRef.current) > 0.5) {
      prevPxRef.current = totalPx;
      setWireTotalLengthPx(totalPx);
    }
  }, [totalPx, setWireTotalLengthPx]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden" onClick={() => selectComponent(null)}>
      {/* Issue banners — shown above the circuit */}
      {issues.length > 0 && (
        <div className="flex flex-col gap-1 px-4 pt-3 shrink-0">
          {issues.map((issue, i) => {
            const colors =
              issue.level === 'error'
                ? 'bg-red-950/60 border-red-500 text-red-400'
                : issue.level === 'warning'
                ? 'bg-amber-950/60 border-amber-500 text-amber-400'
                : 'bg-blue-950/60 border-blue-500 text-blue-400';
            const icon = issue.level === 'error' ? '⚡' : issue.level === 'warning' ? '⚠' : 'ℹ';
            return (
              <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs ${colors}`}>
                <span className="shrink-0 font-bold">{icon}</span>
                <div>
                  <span className="font-bold">{issue.title}: </span>
                  <span className="text-[#9ca3af]">{issue.detail}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex-1 overflow-auto p-4">
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
            strokeWidth={wireStrokeWidth}
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
          const vals = calculatedValues[item.id];
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
                <Amperemeter
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

        {/* Wire resistance visual component on bottom wire */}
        {wireEnabled && wireResistance > 0 && (() => {
          const wx = (GEN_X + endX) / 2;
          const wy = returnY;
          const hw = 28; const hh = 12;
          // Zigzag path
          const zx = wx - hw; const peaks = 6;
          const step = (hw * 2) / peaks;
          let d = `M ${zx} ${wy}`;
          for (let i = 0; i <= peaks; i++) {
            d += ` L ${zx + i * step} ${wy + (i % 2 === 0 ? -hh : hh)}`;
          }
          d += ` L ${wx + hw} ${wy}`;
          return (
            <g>
              {/* Cover the wire underneath */}
              <line x1={wx - hw - 6} y1={wy} x2={wx + hw + 6} y2={wy} stroke="#1e1b2e" strokeWidth={8} />
              {/* Zigzag resistor */}
              <path d={d} fill="none" stroke="#a78bfa" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              {/* Label above */}
              <text x={wx} y={wy - hh - 6} textAnchor="middle" fill="#a78bfa" fontSize={9} fontWeight="bold">
                {t('circuit.wireResistance')} = {wireResistance.toFixed(3)} Ω
              </text>
              <text x={wx} y={wy + hh + 14} textAnchor="middle" fill="#7c3aed" fontSize={8}>
                {(totalPx * PIXEL_TO_METERS).toFixed(1)} m
              </text>
            </g>
          );
        })()}
      </svg>
      </div>

      {/* Circuit Totals — bottom bar */}
      <div className="shrink-0 flex items-center gap-6 px-6 py-2 bg-[#2d2a3e] border-t border-[#4a4560]">
        <span className="text-[10px] font-semibold text-[#8b83a8] uppercase tracking-wider shrink-0">
          {t('circuit.totals')}
        </span>
        <span className="text-sm font-bold text-green-400">
          R = {isFinite(totalResistance) ? `${totalResistance.toFixed(2)} Ω` : '∞ Ω'}
        </span>
        <span className="text-sm font-bold text-red-400">
          I = {totalCurrent.toFixed(3)} A
        </span>
        {wireEnabled && wireResistance > 0 && (
          <span className="text-sm font-bold text-purple-400">
            {t('circuit.wireResistance')} = {wireResistance.toFixed(3)} Ω
            <span className="text-[10px] font-normal text-[#6b6580] ml-1">
              ({(totalPx * PIXEL_TO_METERS).toFixed(1)} m)
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
