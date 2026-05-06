import { memo, useRef, useCallback, useEffect } from 'react';
import type { FreeComponent, Point } from '../../engine/types';
import { getTerminalPos } from '../../store/freeModeStore';
import { buildPointList, buildRoundedPath, type Facing } from '../../engine/freeMode/router';

/** Blue (cold) → Amber (warm) → Red (hot) based on current */
function currentHeatColor(current: number): string {
  const t = Math.min(current / 3, 1);
  if (t < 0.5) {
    const s = t * 2;
    return lerpColor(0x3b, 0x82, 0xf6, 0xfb, 0xbf, 0x24, s);
  }
  const s = (t - 0.5) * 2;
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
  isDetached?: boolean;
  strokeWidth: number;
  wireResistance?: number;
  showResistance: boolean;
  lineType: 'curved' | 'straight' | 'corner';
  waypoints: Point[];
  isWiring?: boolean;
  onWaypointsDrag?: (wireId: string, waypoints: Point[]) => void;
  onWaypointsDragStart?: () => void;
  onClick: (id: string, e: React.MouseEvent) => void;
}

const SNAP = 40;

function snap(v: number): number {
  return Math.round(v / SNAP) * SNAP;
}

function facing(tx: number, ty: number, cx: number, cy: number): Facing {
  if (Math.abs(tx - cx) >= Math.abs(ty - cy)) return tx < cx ? 'L' : 'R';
  return ty < cy ? 'U' : 'D';
}

function buildCurvedPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const bow = Math.min(dist * 0.5, 40);
  const perpX = dist > 0 ? -dy / dist : 0;
  const perpY = dist > 0 ? dx / dist : 0;
  const cp1x = x1 + dx * 0.35 + perpX * bow;
  const cp1y = y1 + dy * 0.35 + perpY * bow;
  const cp2x = x2 - dx * 0.35 + perpX * bow;
  const cp2y = y2 - dy * 0.35 + perpY * bow;
  return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
}

export const FreeWire = memo(function FreeWire({
  wireId,
  fromTerminal,
  toTerminal,
  components,
  current,
  isSelected,
  isDetached,
  strokeWidth,
  wireResistance,
  showResistance,
  lineType,
  waypoints,
  isWiring,
  onWaypointsDrag,
  onWaypointsDragStart,
  onClick,
}: FreeWireProps) {
  const [fromCompId, fromIdx] = fromTerminal.split(':');
  const [toCompId, toIdx] = toTerminal.split(':');

  const fromPos = getTerminalPos(fromCompId, Number(fromIdx) as 0 | 1, components);
  const toPos = getTerminalPos(toCompId, Number(toIdx) as 0 | 1, components);

  const waypointDragRef = useRef<{ index: number; sx: number; sy: number; ox: number; oy: number } | null>(null);

  if (!fromPos || !toPos) return null;
  if (isDetached) return null;

  const fc = components.find(c => c.id === fromCompId);
  const tc = components.find(c => c.id === toCompId);
  const dir1: Facing = fc ? facing(fromPos.x, fromPos.y, fc.x, fc.y) : 'R';
  const dir2: Facing = tc ? facing(toPos.x, toPos.y, tc.x, tc.y) : 'L';

  // Build path based on line type
  let pathD: string;
  let points: Point[];

  if (lineType === 'curved') {
    pathD = buildCurvedPath(fromPos.x, fromPos.y, toPos.x, toPos.y);
    points = [fromPos, toPos];
  } else if (lineType === 'straight') {
    pathD = `M ${fromPos.x} ${fromPos.y} L ${toPos.x} ${toPos.y}`;
    points = [fromPos, toPos];
  } else {
    // Corner: use orthogonal router
    points = buildPointList(fromPos, dir1, toPos, dir2, waypoints);
    pathD = buildRoundedPath(points);
  }

  const isFlowing = current > 0.0001;
  const color = isFlowing ? currentHeatColor(current) : '#6b7280';

  // Keep mutable refs to avoid stale closures during drag
  const waypointsRef = useRef(waypoints);
  waypointsRef.current = waypoints;
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const dragHandlersRef = useRef<{ move: (e: MouseEvent) => void; up: () => void } | null>(null);

  // Waypoint drag — uses document-level events so drag works even
  // when the mouse leaves the wire path
  const handleWaypointDown = useCallback((e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    e.preventDefault();
    onWaypointsDragStart?.();
    const wp = pointsRef.current[index + 1];
    waypointDragRef.current = { index, sx: e.clientX, sy: e.clientY, ox: wp.x, oy: wp.y };

    const onMove = (ev: MouseEvent) => {
      const d = waypointDragRef.current;
      if (!d) return;
      const wps = waypointsRef.current;
      const pts = pointsRef.current;
      const current = wps.length > 0
        ? [...wps]
        : pts.slice(1, pts.length - 1).map(p => ({ x: p.x, y: p.y }));
      current[d.index] = {
        x: snap(d.ox + (ev.clientX - d.sx)),
        y: snap(d.oy + (ev.clientY - d.sy)),
      };
      onWaypointsDrag?.(wireId, current);
    };

    const onUp = () => {
      waypointDragRef.current = null;
      dragHandlersRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    dragHandlersRef.current = { move: onMove, up: onUp };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [wireId, onWaypointsDrag, onWaypointsDragStart]);

  // Clean up document listeners on unmount
  useEffect(() => {
    return () => {
      waypointDragRef.current = null;
      if (dragHandlersRef.current) {
        document.removeEventListener('mousemove', dragHandlersRef.current.move);
        document.removeEventListener('mouseup', dragHandlersRef.current.up);
        dragHandlersRef.current = null;
      }
    };
  }, []);

  const midX = (fromPos.x + toPos.x) / 2;
  const midY = (fromPos.y + toPos.y) / 2;

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

      {/* Waypoint drag handles (corner mode, selected, not wiring) */}
      {lineType === 'corner' && isSelected && !isWiring && (() => {
        const bendPoints = points.slice(1, points.length - 1);
        return bendPoints.map((wp, i) => (
          <circle key={i} cx={wp.x} cy={wp.y} r={5}
            fill="#a78bfa" stroke="#c4b5fd" strokeWidth={1.5}
            style={{ cursor: 'grab' }}
            onMouseDown={(e) => handleWaypointDown(e, i)}
          />
        ));
      })()}

      {/* Resistance label */}
      {showResistance && wireResistance !== undefined && wireResistance > 0 && (
        <text x={midX} y={midY - 8}
          textAnchor="middle" fill="#a78bfa" fontSize={8} fontWeight="bold">
          {wireResistance >= 1
            ? `${wireResistance.toFixed(2)} Ω`
            : `${(wireResistance * 1000).toFixed(1)} mΩ`}
        </text>
      )}
    </g>
  );
});
