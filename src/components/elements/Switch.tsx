interface SwitchProps { x: number; y: number; closed: boolean; isSelected: boolean; onClick: (e: React.MouseEvent) => void; onDoubleClick: (e: React.MouseEvent) => void; rotation?: number; realistic?: boolean; }

export function Switch({ x, y, closed, isSelected, onClick, onDoubleClick, rotation, realistic }: SwitchProps) {
  const rot = rotation || 0;
  const textTransform = rot ? `rotate(${-rot} ${x} ${y})` : undefined;
  const borderColor = isSelected ? '#22c55e' : '#4a4560';
  const armLen = closed ? 14 : 10;

  if (realistic) {
    return (
      <g onClick={onClick} onDoubleClick={onDoubleClick} style={{ cursor: 'pointer' }}>
        <rect x={x - 32} y={y - 32} width={64} height={64} rx={5} fill="none" stroke={borderColor} strokeWidth={1} />
        {/* Base */}
        <rect x={x - 20} y={y - 10} width={40} height={20} rx={4} fill="#374151" stroke="#6b7280" strokeWidth={1} />
        {/* Toggle lever */}
        <line x1={x} y1={y - (closed ? 2 : 8)} x2={x - (closed ? 10 : -10)} y2={y - (closed ? 18 : 18)}
          stroke="#9ca3af" strokeWidth={4} strokeLinecap="round" />
        {/* Contact points */}
        <circle cx={x - 12} cy={y + 6} r={3} fill={closed ? '#22c55e' : '#6b7280'} />
        <circle cx={x + 12} cy={y + 6} r={3} fill={closed ? '#22c55e' : '#6b7280'} />
        <circle cx={x} cy={y + 2} r={3} fill={closed ? '#22c55e' : '#6b7280'} />
        <line x1={x - 43} y1={y} x2={x - 22} y2={y} stroke="#6b6580" strokeWidth={1.5} />
        <line x1={x + 22} y1={y} x2={x + 43} y2={y} stroke="#6b6580" strokeWidth={1.5} />
        <g transform={textTransform}>
          <text x={x} y={y + 33} textAnchor="middle" fill={closed ? '#22c55e' : '#ef4444'} fontSize={9} fontWeight="bold">{closed ? 'ON' : 'OFF'}</text>
        </g>
      </g>
    );
  }

  return (
    <g onClick={onClick} onDoubleClick={onDoubleClick} style={{ cursor: 'pointer' }}>
      <rect x={x - 32} y={y - 32} width={64} height={64} rx={5} fill="none" stroke={borderColor} strokeWidth={1} />
      <line x1={x - 43} y1={y} x2={x - 28} y2={y} stroke="#6b6580" strokeWidth={1.5} />
      <line x1={x + 28} y1={y} x2={x + 43} y2={y} stroke="#6b6580" strokeWidth={1.5} />
      <circle cx={x - armLen} cy={y} r={4} fill={closed ? '#22c55e' : '#ef4444'} />
      <circle cx={x + armLen} cy={y} r={4} fill={closed ? '#22c55e' : '#ef4444'} />
      <line x1={x - armLen} y1={y} x2={closed ? x + armLen : x + 8} y2={closed ? y : y - 16}
        stroke={closed ? '#22c55e' : '#ef4444'} strokeWidth={3} strokeLinecap="round" />
      <g transform={textTransform}>
        <text x={x} y={y + 38} textAnchor="middle" fill={closed ? '#22c55e' : '#ef4444'} fontSize={9} fontWeight="bold">{closed ? 'ON' : 'OFF'}</text>
      </g>
    </g>
  );
}
