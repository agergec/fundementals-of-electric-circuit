interface SwitchProps { x: number; y: number; closed: boolean; isSelected: boolean; onClick: (e: React.MouseEvent) => void; onDoubleClick: (e: React.MouseEvent) => void; rotation?: number; pol0?: string; pol1?: string; }

export function Switch({ x, y, closed, isSelected, onClick, onDoubleClick, rotation, pol0, pol1 }: SwitchProps) {
  const rot = rotation || 0;
  const textTransform = rot ? `rotate(${-rot} ${x} ${y})` : undefined;

  return (
    <g onClick={onClick} onDoubleClick={onDoubleClick} style={{ cursor: 'pointer' }}>
      <circle cx={x - 12} cy={y} r={4} fill={closed ? '#22c55e' : '#ef4444'} />
      <circle cx={x + 12} cy={y} r={4} fill={closed ? '#22c55e' : '#ef4444'} />
      <line x1={x - 12} y1={y} x2={closed ? x + 12 : x + 6} y2={closed ? y : y - 14} stroke={closed ? '#22c55e' : '#ef4444'} strokeWidth={3} strokeLinecap="round" />
      {isSelected && <rect x={x - 20} y={y - 20} width={40} height={40} fill="none" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 2" rx={6} />}
      {pol0 && <text x={x - 22} y={y} textAnchor="middle" fill={pol0 === '+' ? '#ef4444' : '#3b82f6'} fontSize={12} fontWeight="bold" dominantBaseline="central">{pol0}</text>}
      {pol1 && <text x={x + 22} y={y} textAnchor="middle" fill={pol1 === '+' ? '#ef4444' : '#3b82f6'} fontSize={12} fontWeight="bold" dominantBaseline="central">{pol1}</text>}
      <g transform={textTransform}>
        <text x={x} y={y + 24} textAnchor="middle" fill={closed ? '#22c55e' : '#ef4444'} fontSize={9} fontWeight="bold">{closed ? 'ON' : 'OFF'}</text>
      </g>
    </g>
  );
}
