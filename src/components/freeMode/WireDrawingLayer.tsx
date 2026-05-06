import { memo } from 'react';
import type { FreeComponent, TerminalId } from '../../engine/types';
import { getTerminalPos } from '../../store/freeModeStore';

interface WireDrawingLayerProps {
  pendingWire: { fromTerminal: TerminalId; toX: number; toY: number } | null;
  components: FreeComponent[];
  lineType: 'curved' | 'straight' | 'corner';
}

function buildPreviewPath(
  x1: number, y1: number, x2: number, y2: number,
  lineType: 'curved' | 'straight' | 'corner',
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (lineType === 'straight' || dist < 10) {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }

  if (lineType === 'corner') {
    const EXT = 18;
    const r = 8;
    const dominantH = Math.abs(dx) > Math.abs(dy);

    let ex1 = x1, ey1 = y1;
    if (dominantH) ex1 += dx > 0 ? EXT : -EXT;
    else           ey1 += dy > 0 ? EXT : -EXT;

    let ex2 = x2, ey2 = y2;
    if (dominantH) ex2 += dx > 0 ? -EXT : EXT;
    else           ey2 += dy > 0 ? -EXT : EXT;

    if (dominantH) {
      const s1 = dx > 0 ? ex1 - r : ex1 + r;
      const s2 = dx > 0 ? ex2 + r : ex2 - r;
      return `M ${x1} ${y1} L ${s1} ${y1} Q ${ex1} ${y1} ${ex1} ${ey1} L ${ex2} ${ey2} Q ${ex2} ${y2} ${s2} ${y2} L ${x2} ${y2}`;
    }
    const s1 = dy > 0 ? ey1 - r : ey1 + r;
    const s2 = dy > 0 ? ey2 + r : ey2 - r;
    return `M ${x1} ${y1} L ${x1} ${s1} Q ${x1} ${ey1} ${ex1} ${ey1} L ${ex2} ${ey2} Q ${x2} ${ey2} ${x2} ${s2} L ${x2} ${y2}`;
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

  const pathD = buildPreviewPath(fromPos.x, fromPos.y, pendingWire.toX, pendingWire.toY, lineType);

  return (
    <path d={pathD} stroke="#a78bfa" strokeWidth={2} strokeDasharray="6 3"
      strokeLinecap="round" fill="none" pointerEvents="none" />
  );
});
