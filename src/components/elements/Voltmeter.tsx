import type { CalculatedValues } from '../../engine/types';
import { formatVoltage } from '../../utils/formatters';

interface VoltmeterProps { x: number; y: number; values?: CalculatedValues; isSelected: boolean; onClick: (e: React.MouseEvent) => void; rotation?: number; }

export function Voltmeter({ x, y, values, isSelected, onClick, rotation }: VoltmeterProps) {
  const r = rotation || 0;
  const textTransform = r ? `rotate(${-r} ${x} ${y})` : undefined;

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <rect x={x - 32} y={y - 32} width={64} height={64} rx={5} fill="none" stroke={isSelected ? '#22c55e' : '#4a4560'} strokeWidth={1} />
      <circle cx={x} cy={y} r={16} fill="#1e293b" stroke={isSelected ? '#f59e0b' : '#3b82f6'} strokeWidth={isSelected ? 3 : 2} />
      <line x1={x - 43} y1={y} x2={x - 28} y2={y} stroke="#6b6580" strokeWidth={1.5} />
      <line x1={x + 28} y1={y} x2={x + 43} y2={y} stroke="#6b6580" strokeWidth={1.5} />
      <g transform={textTransform}>
        <text x={x} y={y + 5} textAnchor="middle" fill="#3b82f6" fontSize={14} fontWeight="bold">V</text>
        {values && <text x={x} y={y + 38} textAnchor="middle" fill="#22c55e" fontSize={9} fontWeight="bold">{formatVoltage(values.voltage)}</text>}
      </g>
    </g>
  );
}
