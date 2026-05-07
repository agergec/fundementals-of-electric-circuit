import type { CalculatedValues } from '../../engine/types';
import { formatCurrent } from '../../utils/formatters';

interface AmperemeterProps { x: number; y: number; values?: CalculatedValues; isSelected: boolean; onClick: (e: React.MouseEvent) => void; rotation?: number; realistic?: boolean; }

export function Amperemeter({ x, y, values, isSelected, onClick, rotation, realistic }: AmperemeterProps) {
  const r = rotation || 0;
  const textTransform = r ? `rotate(${-r} ${x} ${y})` : undefined;

  if (realistic) {
    return (
      <g onClick={onClick} style={{ cursor: 'pointer' }}>
        <rect x={x - 32} y={y - 32} width={64} height={64} rx={5} fill="none" stroke={isSelected ? '#22c55e' : '#4a4560'} strokeWidth={1} />
        {/* Round meter body */}
        <circle cx={x} cy={y} r={20} fill="#f8fafc" stroke="#94a3b8" strokeWidth={2} />
        {/* Scale arc */}
        <path d={`M ${x - 12} ${y + 8} A 14 14 0 0 1 ${x + 12} ${y + 8}`} fill="none" stroke="#cbd5e1" strokeWidth={1} />
        {/* Tick marks */}
        <line x1={x - 10} y1={y + 10} x2={x - 10} y2={y + 6} stroke="#94a3b8" strokeWidth={0.8} />
        <line x1={x - 5} y1={y + 13} x2={x - 5} y2={y + 9} stroke="#94a3b8" strokeWidth={0.8} />
        <line x1={x} y1={y + 14} x2={x} y2={y + 10} stroke="#94a3b8" strokeWidth={0.8} />
        <line x1={x + 5} y1={y + 13} x2={x + 5} y2={y + 9} stroke="#94a3b8" strokeWidth={0.8} />
        <line x1={x + 10} y1={y + 10} x2={x + 10} y2={y + 6} stroke="#94a3b8" strokeWidth={0.8} />
        {/* Needle */}
        <line x1={x} y1={y + 6} x2={x - 8} y2={y - 6} stroke="#ef4444" strokeWidth={1.5} strokeLinecap="round" />
        <circle cx={x} cy={y + 6} r={2} fill="#1e293b" />
        <line x1={x - 43} y1={y} x2={x - 24} y2={y} stroke="#6b6580" strokeWidth={1.5} />
        <line x1={x + 24} y1={y} x2={x + 43} y2={y} stroke="#6b6580" strokeWidth={1.5} />
        <g transform={textTransform}>
          <text x={x} y={y - 20} textAnchor="middle" fill="#ef4444" fontSize={8} fontWeight="bold">A</text>
          {values && <text x={x} y={y + 38} textAnchor="middle" fill="#fbbf24" fontSize={9} fontWeight="bold">{formatCurrent(values.current)}</text>}
        </g>
      </g>
    );
  }

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <rect x={x - 32} y={y - 32} width={64} height={64} rx={5} fill="none" stroke={isSelected ? '#22c55e' : '#4a4560'} strokeWidth={1} />
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
