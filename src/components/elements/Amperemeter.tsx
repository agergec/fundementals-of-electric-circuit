import type { CalculatedValues } from '../../engine/types';
import { formatCurrent } from '../../utils/formatters';

interface AmperemeterProps {
  x: number;
  y: number;
  values?: CalculatedValues;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
}

export function Amperemeter({ x, y, values, isSelected, onClick }: AmperemeterProps) {
  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <circle
        cx={x}
        cy={y}
        r={16}
        fill="#1e293b"
        stroke={isSelected ? '#f59e0b' : '#ef4444'}
        strokeWidth={isSelected ? 3 : 2}
      />
      <text x={x} y={y + 5} textAnchor="middle" fill="#ef4444" fontSize={14} fontWeight="bold">
        A
      </text>
      {/* Polarity signs */}
      <text x={x - 22} y={y - 14} fill="#ef4444" fontSize={8} fontWeight="bold">+</text>
      <text x={x + 18} y={y - 14} fill="#3b82f6" fontSize={8} fontWeight="bold">−</text>
      {values && (
        <text x={x} y={y + 32} textAnchor="middle" fill="#ef4444" fontSize={10} fontWeight="bold">
          {formatCurrent(values.current)}
        </text>
      )}
    </g>
  );
}
