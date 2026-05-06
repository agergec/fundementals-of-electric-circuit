import { formatCurrent } from '../../utils/formatters';

interface FuseProps { x: number; y: number; rating?: number; blown?: boolean; current?: number; isSelected: boolean; onClick: (e: React.MouseEvent) => void; rotation?: number; }

export function Fuse({ x, y, rating = 2, blown, current, isSelected, onClick, rotation }: FuseProps) {
  const rot = rotation || 0;
  const textTransform = rot ? `rotate(${-rot} ${x} ${y})` : undefined;
  const color = blown ? '#ef4444' : '#22c55e';

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <rect x={x - 32} y={y - 32} width={64} height={64} rx={5} fill="none" stroke={isSelected ? '#22c55e' : '#4a4560'} strokeWidth={1} />
      <line x1={x - 43} y1={y} x2={x - 28} y2={y} stroke="#6b6580" strokeWidth={1.5} />
      <line x1={x + 28} y1={y} x2={x + 43} y2={y} stroke="#6b6580" strokeWidth={1.5} />
      {/* Thin wire with break if blown */}
      <line x1={x - 20} y1={y} x2={x + 20} y2={y} stroke={color} strokeWidth={2} />
      {blown && (
        <>
          <circle cx={x + 6} cy={y} r={3} fill="#ef4444" />
          <line x1={x + 3} y1={y - 5} x2={x + 9} y2={y + 5} stroke="#ef4444" strokeWidth={1.5} />
        </>
      )}
      <g transform={textTransform}>
        <text x={x} y={y + 38} textAnchor="middle" fill={color} fontSize={9} fontWeight="bold">
          {blown ? 'BLOWN' : current !== undefined ? formatCurrent(current) : `${rating}A`}
        </text>
      </g>
    </g>
  );
}
