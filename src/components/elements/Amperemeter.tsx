import type { CalculatedValues } from '../../engine/types';
import { formatCurrent } from '../../utils/formatters';

interface AmperemeterProps { x: number; y: number; values?: CalculatedValues; isSelected: boolean; onClick: (e: React.MouseEvent) => void; rotation?: number; pol0?: string; pol1?: string; }

export function Amperemeter({ x, y, values, isSelected, onClick, rotation, pol0, pol1 }: AmperemeterProps) {
  const r = rotation || 0;
  const textTransform = r ? `rotate(${-r} ${x} ${y})` : undefined;

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <rect x={x - 37} y={y - 26} width={74} height={52} rx={5} fill="none" stroke="#4a4560" strokeWidth={1} />
      <circle cx={x} cy={y} r={16} fill="#1e293b" stroke={isSelected ? '#f59e0b' : '#ef4444'} strokeWidth={isSelected ? 3 : 2} />
      <line x1={x - 48} y1={y} x2={x - 33} y2={y} stroke="#6b6580" strokeWidth={1.5} />
      <line x1={x + 33} y1={y} x2={x + 48} y2={y} stroke="#6b6580" strokeWidth={1.5} />
      {pol0 && <text x={x - 45} y={y} textAnchor="middle" fill={pol0 === '+' ? '#ef4444' : '#3b82f6'} fontSize={12} fontWeight="bold" dominantBaseline="central">{pol0}</text>}
      {pol1 && <text x={x + 45} y={y} textAnchor="middle" fill={pol1 === '+' ? '#ef4444' : '#3b82f6'} fontSize={12} fontWeight="bold" dominantBaseline="central">{pol1}</text>}
      <g transform={textTransform}>
        <text x={x} y={y + 5} textAnchor="middle" fill="#ef4444" fontSize={14} fontWeight="bold">A</text>
        {values && <text x={x} y={y + 38} textAnchor="middle" fill="#fbbf24" fontSize={9} fontWeight="bold">{formatCurrent(values.current)}</text>}
      </g>
    </g>
  );
}
