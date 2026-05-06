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
  onClick: (id: string, e: React.MouseEvent) => void;
}

function buildPath(
  x1: number, y1: number, x2: number, y2: number,
  lineType: 'curved' | 'straight' | 'corner',
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
    return buildCornerPath(x1, y1, x2, y2, c1x, c1y, c2x, c2y);
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
  c1x?: number, c1y?: number, c2x?: number, c2y?: number,
): { d: string; c1x: number; c1y: number; c2x: number; c2y: number } {
  const EXT = 18;
  const r = 8;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const dominantH = Math.abs(dx) > Math.abs(dy);

  // Default extension points (auto-computed)
  let ex1 = x1, ey1 = y1;
  if (dominantH) ex1 += dx > 0 ? EXT : -EXT;
  else           ey1 += dy > 0 ? EXT : -EXT;

  let ex2 = x2, ey2 = y2;
  if (dominantH) ex2 += dx > 0 ? -EXT : EXT;
  else           ey2 += dy > 0 ? -EXT : EXT;

  // Override with custom corner positions if provided
  const cx1 = c1x ?? ex1;
  const cy1 = c1y ?? ey1;
  const cx2 = c2x ?? ex2;
  const cy2 = c2y ?? ey2;

  let d: string;
  if (dominantH) {
    const s1 = dx > 0 ? cx1 - r : cx1 + r;
    const s2 = dx > 0 ? cx2 + r : cx2 - r;
    d = `M ${x1} ${y1} L ${s1} ${y1} Q ${cx1} ${y1} ${cx1} ${cy1} L ${cx2} ${cy2} Q ${cx2} ${y2} ${s2} ${y2} L ${x2} ${y2}`;
  } else {
    const s1 = dy > 0 ? cy1 - r : cy1 + r;
    const s2 = dy > 0 ? cy2 + r : cy2 - r;
    d = `M ${x1} ${y1} L ${x1} ${s1} Q ${x1} ${cy1} ${cx1} ${cy1} L ${cx2} ${cy2} Q ${x2} ${cy2} ${x2} ${s2} L ${x2} ${y2}`;
  }
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
  onClick,
}: FreeWireProps) {
  const [fromCompId, fromIdx] = fromTerminal.split(':');
  const [toCompId, toIdx] = toTerminal.split(':');

  const fromPos = getTerminalPos(fromCompId, Number(fromIdx) as 0 | 1, components);
  const toPos = getTerminalPos(toCompId, Number(toIdx) as 0 | 1, components);

  const corner1DragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const corner2DragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  if (!fromPos || !toPos) return null;

  const { d: pathD, c1x, c1y, c2x, c2y } = buildPath(fromPos.x, fromPos.y, toPos.x, toPos.y, lineType, corner1X, corner1Y, corner2X, corner2Y);

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
    if (c1) {
      const nx = c1.ox + (e.clientX - c1.sx);
      const ny = c1.oy + (e.clientY - c1.sy);
      onCornersDrag?.(wireId, nx, ny, c2x, c2y);
    }
    if (c2) {
      const nx = c2.ox + (e.clientX - c2.sx);
      const ny = c2.oy + (e.clientY - c2.sy);
      onCornersDrag?.(wireId, c1x, c1y, nx, ny);
    }
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
