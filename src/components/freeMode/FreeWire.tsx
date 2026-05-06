import { memo, useRef } from 'react';
import type { FreeComponent } from '../../engine/types';
import { getTerminalPos } from '../../store/freeModeStore';

/** Blue (cold) → Amber (warm) → Red (hot) based on current */
function currentHeatColor(current: number): string {
  // Clamp to [0, 3] amps
  const t = Math.min(current / 3, 1);
  // Three-stop gradient: blue(#3b82f6) → amber(#fbbf24) → red(#ef4444)
  if (t < 0.5) {
    const s = t * 2; // 0→1 over 0 to 1.5A
    return lerpColor(0x3b, 0x82, 0xf6, 0xfb, 0xbf, 0x24, s);
  }
  const s = (t - 0.5) * 2; // 0→1 over 1.5A to 3A
  return lerpColor(0xfb, 0xbf, 0x24, 0xef, 0x44, 0x44, s);
}

function lerpColor(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number, t: number): string {
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

interface FreeWireProps {
  wireId: string;
  fromTerminal: string;
  toTerminal: string;
  components: FreeComponent[];
  current: number;
  isSelected: boolean;
  strokeWidth: number;
  wireResistance?: number;
  showResistance: boolean;
  lineType: 'curved' | 'straight' | 'corner';
  corner1X?: number;
  corner1Y?: number;
  corner2X?: number;
  corner2Y?: number;
  isWiring?: boolean;
  onCornersDrag?: (wireId: string, c1x: number, c1y: number, c2x: number, c2y: number) => void;
  onEndpointDrag?: (wireId: string, end: 'from' | 'to', e: React.MouseEvent) => void;
  onClick: (id: string, e: React.MouseEvent) => void;
}

type Facing = 'L' | 'R' | 'U' | 'D';

function buildPath(
  x1: number, y1: number, x2: number, y2: number,
  lineType: 'curved' | 'straight' | 'corner',
  dir1?: Facing, dir2?: Facing,
  c1x?: number, c1y?: number, c2x?: number, c2y?: number,
): { d: string; c1x: number; c1y: number; c2x: number; c2y: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (lineType === 'straight' || dist < 10) {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    return { d: `M ${x1} ${y1} L ${x2} ${y2}`, c1x: mx, c1y: my, c2x: mx, c2y: my };
  }

  if (lineType === 'corner') {
    return buildCornerPath(x1, y1, x2, y2, dir1, dir2, c1x, c1y, c2x, c2y);
  }

  const bow = Math.min(dist * 0.5, 40);
  const perpX = dist > 0 ? -dy / dist : 0;
  const perpY = dist > 0 ? dx / dist : 0;
  const mbx = x1 + dx * 0.35 + perpX * bow;
  const mby = y1 + dy * 0.35 + perpY * bow;
  const mbx2 = x2 - dx * 0.35 + perpX * bow;
  const mby2 = y2 - dy * 0.35 + perpY * bow;
  return { d: `M ${x1} ${y1} C ${mbx} ${mby}, ${mbx2} ${mby2}, ${x2} ${y2}`, c1x: mbx, c1y: mby, c2x: mbx2, c2y: mby2 };
}

function buildCornerPath(
  x1: number, y1: number, x2: number, y2: number,
  dir1?: Facing, dir2?: Facing,
  c1x?: number, c1y?: number, c2x?: number, c2y?: number,
): { d: string; c1x: number; c1y: number; c2x: number; c2y: number } {
  const EXT = 20;
  const r = 6;

  // Default facing: outward from midpoint
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const d1: Facing = dir1 ?? (Math.abs(x1 - mx) >= Math.abs(y1 - my) ? (x1 < mx ? 'L' : 'R') : (y1 < my ? 'U' : 'D'));
  const d2: Facing = dir2 ?? (Math.abs(x2 - mx) >= Math.abs(y2 - my) ? (x2 < mx ? 'L' : 'R') : (y2 < my ? 'U' : 'D'));

  // Extend each terminal in its facing direction
  const ext = (x: number, y: number, d: Facing) => {
    if (d === 'L') return { x: x - EXT, y };
    if (d === 'R') return { x: x + EXT, y };
    if (d === 'U') return { x, y: y - EXT };
    return { x, y: y + EXT };
  };

  const e1 = ext(x1, y1, d1);
  const e2 = ext(x2, y2, d2);

  // Use custom corner if provided, else auto
  const cx1 = c1x ?? e1.x;
  const cy1 = c1y ?? e1.y;
  const cx2 = c2x ?? e2.x;
  const cy2 = c2y ?? e2.y;

  // Path: terminal → extension → corner → corner → extension → terminal
  const segOut = (x: number, y: number, d: Facing, cx: number, cy: number) => {
    if (d === 'L') return `L ${cx + r} ${y}`;
    if (d === 'R') return `L ${cx - r} ${y}`;
    if (d === 'U') return `L ${x} ${cy + r}`;
    return `L ${x} ${cy - r}`; // D
  };

  const s1 = segOut(x1, y1, d1, cx1, cy1);

  // Connecting segments between the two corner points
  let connect = '';
  if ((d1 === 'L' || d1 === 'R') && (d2 === 'L' || d2 === 'R')) {
    // Both horizontal-facing: vertical connection between Y levels
    const top = Math.min(cy1, cy2);
    const bot = Math.max(cy1, cy2);
    if (bot - top < 4) {
      connect = `L ${cx2} ${cy2}`;
    } else {
      connect = `Q ${cx1} ${cy1} ${cx1} ${cy1 + (cy2 > cy1 ? r : -r)} L ${cx2} ${cy2 + (cy2 > cy1 ? -r : r)} Q ${cx2} ${cy2} ${cx2} ${cy2}`;
    }
  } else if ((d1 === 'U' || d1 === 'D') && (d2 === 'U' || d2 === 'D')) {
    // Both vertical-facing: horizontal connection
    const left = Math.min(cx1, cx2);
    const right = Math.max(cx1, cx2);
    if (right - left < 4) {
      connect = `L ${cx2} ${cy2}`;
    } else {
      connect = `Q ${cx1} ${cy1} ${cx1 + (cx2 > cx1 ? r : -r)} ${cy1} L ${cx2 + (cx2 > cx1 ? -r : r)} ${cy2} Q ${cx2} ${cy2} ${cx2} ${cy2}`;
    }
  } else {
    // Mixed: one horizontal, one vertical — simple diagonal connection
    connect = `L ${cx2} ${cy2}`;
  }

  const s2x = d2 === 'L' ? cx2 + r : d2 === 'R' ? cx2 - r : cx2;
  const s2y = d2 === 'U' ? cy2 + r : d2 === 'D' ? cy2 - r : cy2;

  const d = `M ${x1} ${y1} ${s1} ${connect} L ${s2x} ${s2y} L ${x2} ${y2}`;
  return { d, c1x: cx1, c1y: cy1, c2x: cx2, c2y: cy2 };
}

export const FreeWire = memo(function FreeWire({
  wireId,
  fromTerminal,
  toTerminal,
  components,
  current,
  isSelected,
  strokeWidth,
  wireResistance,
  showResistance,
  lineType,
  corner1X,
  corner1Y,
  corner2X,
  corner2Y,
  isWiring,
  onCornersDrag,
  onEndpointDrag,
  onClick,
}: FreeWireProps) {
  const [fromCompId, fromIdx] = fromTerminal.split(':');
  const [toCompId, toIdx] = toTerminal.split(':');

  const fromPos = getTerminalPos(fromCompId, Number(fromIdx) as 0 | 1, components);
  const toPos = getTerminalPos(toCompId, Number(toIdx) as 0 | 1, components);

  const corner1DragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const corner2DragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  if (!fromPos || !toPos) return null;

  // Determine terminal facing direction from component center
  const fc = components.find(c => c.id === fromCompId);
  const tc = components.find(c => c.id === toCompId);
  function facing(tx: number, ty: number, cx: number, cy: number): Facing {
    if (Math.abs(tx - cx) >= Math.abs(ty - cy)) return tx < cx ? 'L' : 'R';
    return ty < cy ? 'U' : 'D';
  }
  const dir1 = fc ? facing(fromPos.x, fromPos.y, fc.x, fc.y) : 'R';
  const dir2 = tc ? facing(toPos.x, toPos.y, tc.x, tc.y) : 'L';

  const { d: pathD, c1x, c1y, c2x, c2y } = buildPath(fromPos.x, fromPos.y, toPos.x, toPos.y, lineType, dir1, dir2, corner1X, corner1Y, corner2X, corner2Y);

  const isFlowing = current > 0.0001;
  const color = isFlowing ? currentHeatColor(current) : '#6b7280';

  const handleCorner1Down = (e: React.MouseEvent) => {
    e.stopPropagation();
    corner1DragRef.current = { sx: e.clientX, sy: e.clientY, ox: c1x, oy: c1y };
  };
  const handleCorner2Down = (e: React.MouseEvent) => {
    e.stopPropagation();
    corner2DragRef.current = { sx: e.clientX, sy: e.clientY, ox: c2x, oy: c2y };
  };
  const handleCornerMove = (e: React.MouseEvent) => {
    const c1 = corner1DragRef.current;
    const c2 = corner2DragRef.current;
    if (c1) onCornersDrag?.(wireId, c1.ox + (e.clientX - c1.sx), c1.oy + (e.clientY - c1.sy), c2x, c2y);
    if (c2) onCornersDrag?.(wireId, c1x, c1y, c2.ox + (e.clientX - c2.sx), c2.oy + (e.clientY - c2.sy));
  };
  const handleCornerUp = () => {
    corner1DragRef.current = null;
    corner2DragRef.current = null;
  };

  return (
    <g onMouseMove={handleCornerMove} onMouseUp={handleCornerUp} onMouseLeave={handleCornerUp}>
      {/* Hit area */}
      <path d={pathD} stroke="transparent" strokeWidth={14} fill="none"
        style={{ cursor: 'pointer' }}
        onClick={(e) => { e.stopPropagation(); onClick(wireId, e); }}
      />

      {/* Visible wire */}
      <path d={pathD}
        stroke={isSelected ? '#a78bfa' : color}
        strokeWidth={isSelected ? strokeWidth + 2 : strokeWidth}
        strokeLinecap="round" fill="none"
        style={{ cursor: 'pointer' }}
        onClick={(e) => { e.stopPropagation(); onClick(wireId, e); }}
      />

      {/* Two corner drag handles */}
      {lineType === 'corner' && isSelected && !isWiring && (
        <>
          <circle cx={c1x} cy={c1y} r={5}
            fill="#a78bfa" stroke="#c4b5fd" strokeWidth={1.5}
            style={{ cursor: 'grab' }}
            onMouseDown={handleCorner1Down}
          />
          <circle cx={c2x} cy={c2y} r={5}
            fill="#a78bfa" stroke="#c4b5fd" strokeWidth={1.5}
            style={{ cursor: 'grab' }}
            onMouseDown={handleCorner2Down}
          />
        </>
      )}

      {/* Endpoint drag handles — visible when selected */}
      {isSelected && !isWiring && (
        <>
          <circle cx={fromPos.x} cy={fromPos.y} r={7}
            fill="#22c55e" stroke="#4ade80" strokeWidth={1.5} opacity={0.8}
            style={{ cursor: 'grab' }}
            onMouseDown={(e) => { e.stopPropagation(); onEndpointDrag?.(wireId, 'from', e); }}
          />
          <circle cx={toPos.x} cy={toPos.y} r={7}
            fill="#22c55e" stroke="#4ade80" strokeWidth={1.5} opacity={0.8}
            style={{ cursor: 'grab' }}
            onMouseDown={(e) => { e.stopPropagation(); onEndpointDrag?.(wireId, 'to', e); }}
          />
        </>
      )}

      {/* Resistance label */}
      {showResistance && wireResistance !== undefined && wireResistance > 0 && (
        <text x={(fromPos.x + toPos.x) / 2} y={(fromPos.y + toPos.y) / 2 - 8}
          textAnchor="middle" fill="#a78bfa" fontSize={8} fontWeight="bold">
          {wireResistance >= 1
            ? `${wireResistance.toFixed(2)} Ω`
            : `${(wireResistance * 1000).toFixed(1)} mΩ`}
        </text>
      )}
    </g>
  );
});
