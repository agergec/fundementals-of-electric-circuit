interface SwitchProps {
  x: number;
  y: number;
  closed: boolean;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
}

export function Switch({ x, y, closed, isSelected, onClick, onDoubleClick }: SwitchProps) {
  return (
    <g onClick={onClick} onDoubleClick={onDoubleClick} style={{ cursor: 'pointer' }}>
      {/* Base contacts */}
      <circle cx={x - 12} cy={y} r={4} fill={closed ? '#22c55e' : '#ef4444'} />
      <circle cx={x + 12} cy={y} r={4} fill={closed ? '#22c55e' : '#ef4444'} />

      {/* Switch arm */}
      <line
        x1={x - 12}
        y1={y}
        x2={closed ? x + 12 : x + 6}
        y2={closed ? y : y - 14}
        stroke={closed ? '#22c55e' : '#ef4444'}
        strokeWidth={3}
        strokeLinecap="round"
      />

      {/* Polarity signs */}
      <text x={x - 20} y={y - 14} fill="#ef4444" fontSize={8} fontWeight="bold">+</text>
      <text x={x + 16} y={y - 14} fill="#3b82f6" fontSize={8} fontWeight="bold">−</text>

      {/* Selection ring */}
      {isSelected && (
        <rect
          x={x - 20}
          y={y - 20}
          width={40}
          height={40}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={2}
          strokeDasharray="4 2"
          rx={6}
        />
      )}

      {/* Label */}
      <text x={x} y={y + 24} textAnchor="middle" fill={closed ? '#22c55e' : '#ef4444'} fontSize={9} fontWeight="bold">
        {closed ? 'ON' : 'OFF'}
      </text>
    </g>
  );
}
