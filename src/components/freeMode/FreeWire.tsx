import { memo, useRef, useCallback } from 'react';
import type { FreeComponent } from '../../engine/types';
import { getTerminalPos } from '../../store/freeModeStore';

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
  cornerX?: number;
  cornerY?: number;
  isWiring?: boolean;
  onCornerDrag?: (wireId: string, cx: number, cy: number) => void;
  onClick: (id: string, e: React.MouseEvent) => void;
}

function buildPath(
  x1: number, y1: number, x2: number, y2: number,
  lineType: 'curved' | 'straight' | 'corner',
  cornerX?: number, cornerY?: number,
): { d: string; cx: number; cy: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (lineType === 'straight' || dist < 10) {
    return { d: `M ${x1} ${y1} L ${x2} ${y2}`, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 };
  }

  if (lineType === 'corner') {
    return buildCornerPath(x1, y1, x2, y2, cornerX, cornerY);
  }

  // curved — cubic bezier
  const bow = Math.min(dist * 0.5, 40);
  const perpX = dist > 0 ? -dy / dist : 0;
  const perpY = dist > 0 ? dx / dist : 0;
  const cp1x = x1 + dx * 0.35 + perpX * bow;
  const cp1y = y1 + dy * 0.35 + perpY * bow;
  const cp2x = x2 - dx * 0.35 + perpX * bow;
  const cp2y = y2 - dy * 0.35 + perpY * bow;
  return { d: `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 };
}

function buildCornerPath(
  x1: number, y1: number, x2: number, y2: number,
  cornerX?: number, cornerY?: number,
): { d: string; cx: number; cy: number } {
  const EXT = 18;
  const r = 8;

  // Determine extension direction from terminal relative to the other terminal
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dominantH = Math.abs(dx) > Math.abs(dy);

  // Extension from terminal 1: go outward (away from terminal 2)
  let ex1 = x1, ey1 = y1;
  if (dominantH) ex1 += dx > 0 ? EXT : -EXT;
  else           ey1 += dy > 0 ? EXT : -EXT;

  // Extension from terminal 2: go outward (away from terminal 1)
  let ex2 = x2, ey2 = y2;
  if (dominantH) ex2 += dx > 0 ? -EXT : EXT;
  else           ey2 += dy > 0 ? -EXT : EXT;

  // Corner (drag handle) position — midpoint of extensions
  const cx = cornerX ?? (ex1 + ex2) / 2;
  const cy = cornerY ?? (ey1 + ey2) / 2;

  // Build path: terminal1 → ext1 → (corner) → ext2 → terminal2
  // Two rounded corners at the extension points
  let d: string;
  if (dominantH) {
    // Extend horizontally, vertical connection
    const s1 = dx > 0 ? ex1 - r : ex1 + r;
    const s2 = dx > 0 ? ex2 + r : ex2 - r;
    d = `M ${x1} ${y1} L ${s1} ${y1} Q ${ex1} ${y1} ${ex1} ${ey1} L ${ex2} ${ey2} Q ${ex2} ${y2} ${s2} ${y2} L ${x2} ${y2}`;
  } else {
    // Extend vertically, horizontal connection
    const s1 = dy > 0 ? ey1 - r : ey1 + r;
    const s2 = dy > 0 ? ey2 + r : ey2 - r;
    d = `M ${x1} ${y1} L ${x1} ${s1} Q ${x1} ${ey1} ${ex1} ${ey1} L ${ex2} ${ey2} Q ${x2} ${ey2} ${x2} ${s2} L ${x2} ${y2}`;
  }
  return { d, cx, cy };
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
  cornerX,
  cornerY,
  isWiring,
  onCornerDrag,
  onClick,
}: FreeWireProps) {
  const [fromCompId, fromIdx] = fromTerminal.split(':');
  const [toCompId, toIdx] = toTerminal.split(':');

  const fromPos = getTerminalPos(fromCompId, Number(fromIdx) as 0 | 1, components);
  const toPos = getTerminalPos(toCompId, Number(toIdx) as 0 | 1, components);

  const cornerDragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  const handleCornerDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!fromPos || !toPos) return;
    const { cx: ccx, cy: ccy } = buildPath(fromPos.x, fromPos.y, toPos.x, toPos.y, lineType, cornerX, cornerY);
    cornerDragRef.current = { sx: e.clientX, sy: e.clientY, ox: ccx, oy: ccy };
  }, [fromPos, toPos, lineType, cornerX, cornerY]);

  const handleCornerMove = useCallback((e: React.MouseEvent) => {
    if (!cornerDragRef.current) return;
    const d = cornerDragRef.current;
    onCornerDrag?.(wireId, d.ox + (e.clientX - d.sx), d.oy + (e.clientY - d.sy));
  }, [wireId, onCornerDrag]);

  const handleCornerUp = useCallback(() => {
    cornerDragRef.current = null;
  }, []);

  if (!fromPos || !toPos) return null;

  const isFlowing = current > 0.0001;
  const color = isFlowing ? '#fbbf24' : '#6b7280';

  const { d: pathD, cx, cy } = buildPath(fromPos.x, fromPos.y, toPos.x, toPos.y, lineType, cornerX, cornerY);

  return (
    <g>
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

      {/* Corner drag handle */}
      {lineType === 'corner' && isSelected && !isWiring && (
        <circle cx={cx} cy={cy} r={6}
          fill="#a78bfa" stroke="#c4b5fd" strokeWidth={1.5}
          style={{ cursor: 'grab' }}
          onMouseDown={handleCornerDown}
          onMouseMove={handleCornerMove}
          onMouseUp={handleCornerUp}
          onMouseLeave={handleCornerUp}
        />
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
