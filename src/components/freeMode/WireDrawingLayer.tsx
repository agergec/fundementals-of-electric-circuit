import { memo } from 'react';
import type { FreeComponent, TerminalId } from '../../engine/types';
import { getTerminalPos } from '../../store/freeModeStore';
import { buildPointList, buildRoundedPath, type Facing } from '../../engine/freeMode/router';

interface WireDrawingLayerProps {
  pendingWire: { fromTerminal: TerminalId; toX: number; toY: number } | null;
  components: FreeComponent[];
  lineType: 'curved' | 'straight' | 'corner';
}

function facing(tx: number, ty: number, cx: number, cy: number): Facing {
  if (Math.abs(tx - cx) >= Math.abs(ty - cy)) return tx < cx ? 'L' : 'R';
  return ty < cy ? 'U' : 'D';
}

function buildPreviewPath(
  x1: number, y1: number, x2: number, y2: number,
  lineType: 'curved' | 'straight' | 'corner',
  dir1: Facing,
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (lineType === 'straight' || dist < 10) {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }

  if (lineType === 'corner') {
    // Estimate the target facing: opposite of direction from target to source
    const dir2: Facing = Math.abs(dx) >= Math.abs(dy)
      ? (dx > 0 ? 'L' : 'R')
      : (dy > 0 ? 'U' : 'D');
    const points = buildPointList({ x: x1, y: y1 }, dir1, { x: x2, y: y2 }, dir2, []);
    return buildRoundedPath(points);
  }

  const bow = Math.min(dist * 0.5, 40);
  const perpX = dist > 0 ? -dy / dist : 0;
  const perpY = dist > 0 ? dx / dist : 0;
  const cp1x = x1 + dx * 0.35 + perpX * bow;
  const cp1y = y1 + dy * 0.35 + perpY * bow;
  const cp2x = x2 - dx * 0.35 + perpX * bow;
  const cp2y = y2 - dy * 0.35 + perpY * bow;
  return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
}

export const WireDrawingLayer = memo(function WireDrawingLayer({
  pendingWire,
  components,
  lineType,
}: WireDrawingLayerProps) {
  if (!pendingWire) return null;

  const [compId, idxStr] = pendingWire.fromTerminal.split(':');
  const fromPos = getTerminalPos(compId, Number(idxStr) as 0 | 1, components);
  if (!fromPos) return null;

  const srcComp = components.find(c => c.id === compId);
  const dir1: Facing = srcComp
    ? facing(fromPos.x, fromPos.y, srcComp.x, srcComp.y)
    : 'R';

  const pathD = buildPreviewPath(fromPos.x, fromPos.y, pendingWire.toX, pendingWire.toY, lineType, dir1);

  return (
    <path d={pathD} stroke="#a78bfa" strokeWidth={2} strokeDasharray="6 3"
      strokeLinecap="round" fill="none" pointerEvents="none" />
  );
});
