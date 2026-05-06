import type { CalculatedValues } from '../../engine/types';
import { formatCurrent } from '../../utils/formatters';

interface AmperemeterProps { x: number; y: number; values?: CalculatedValues; isSelected: boolean; onClick: (e: React.MouseEvent) => void; rotation?: number; }

export function Amperemeter({ x, y, values, isSelected, onClick, rotation }: AmperemeterProps) {
  const r = rotation || 0;
  const textTransform = r ? `rotate(${-r} ${x} ${y})` : undefined;

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <rect x={x - 29} y={y - 29} width={58} height={58} rx={5} fill="none" stroke={isSelected ? '#22c55e' : '#4a4560'} strokeWidth={1} />
      <circle cx={x} cy={y} r={16} fill="#1e293b" stroke={isSelected ? '#f59e0b' : '#ef4444'} strokeWidth={isSelected ? 3 : 2} />
      <line x1={x - 43} y1={y} x2={x - 28} y2={y} stroke="#6b6580" strokeWidth={1.5} />
      <line x1={x + 28} y1={y} x2={x + 43} y2={y} stroke="#6b6580" strokeWidth={1.5} />
      <g transform={textTransform}>
        <text x={x} y={y + 5} textAnchor="middle" fill="#ef4444" fontSize={14} fontWeight="bold">A</text>
        {values && <text x={x} y={y + 38} textAnchor="middle" fill="#fbbf24" fontSize={9} fontWeight="bold">{formatCurrent(values.current)}</text>}
      </g>
    </g>
  );
}
