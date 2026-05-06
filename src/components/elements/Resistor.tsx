interface ResistorProps { x: number; y: number; multiplier: number; isSelected: boolean; onClick: (e: React.MouseEvent) => void; rotation?: number; }

export function Resistor({ x, y, multiplier, isSelected, onClick, rotation }: ResistorProps) {
  const rot = rotation || 0;
  const textTransform = rot ? `rotate(${-rot} ${x} ${y})` : undefined;
  const rLabel = multiplier === 1 ? 'R' : multiplier < 1 ? `R/${Math.round(1 / multiplier)}` : `${multiplier}R`;

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <rect x={x - 32} y={y - 32} width={64} height={64} rx={5} fill="none" stroke={isSelected ? '#22c55e' : '#4a4560'} strokeWidth={1} />
      <line x1={x - 43} y1={y} x2={x - 28} y2={y} stroke="#6b6580" strokeWidth={1.5} />
      <line x1={x + 28} y1={y} x2={x + 43} y2={y} stroke="#6b6580" strokeWidth={1.5} />
      {/* Zigzag */}
      <polyline points={`${x - 20},${y - 10} ${x - 10},${y + 14} ${x},${y - 10} ${x + 10},${y + 14} ${x + 20},${y - 10}`}
        fill="none" stroke="#a78bfa" strokeWidth={2} strokeLinejoin="round" />
      <g transform={textTransform}>
        <text x={x} y={y + 38} textAnchor="middle" fill="#22c55e" fontSize={9} fontWeight="bold">{rLabel}</text>
      </g>
    </g>
  );
}
