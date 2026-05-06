interface SwitchProps { x: number; y: number; closed: boolean; isSelected: boolean; onClick: (e: React.MouseEvent) => void; onDoubleClick: (e: React.MouseEvent) => void; rotation?: number; }

export function Switch({ x, y, closed, isSelected, onClick, onDoubleClick, rotation }: SwitchProps) {
  const rot = rotation || 0;
  const textTransform = rot ? `rotate(${-rot} ${x} ${y})` : undefined;
  const borderColor = isSelected ? '#22c55e' : '#4a4560';
  const armLen = closed ? 14 : 10;

  return (
    <g onClick={onClick} onDoubleClick={onDoubleClick} style={{ cursor: 'pointer' }}>
      <rect x={x - 20} y={y - 22} width={40} height={44} rx={5} fill="none" stroke={borderColor} strokeWidth={1} />
      <line x1={x - 28} y1={y} x2={x - 20} y2={y} stroke="#6b6580" strokeWidth={1.5} />
      <line x1={x + 20} y1={y} x2={x + 28} y2={y} stroke="#6b6580" strokeWidth={1.5} />
      <circle cx={x - armLen} cy={y} r={4} fill={closed ? '#22c55e' : '#ef4444'} />
      <circle cx={x + armLen} cy={y} r={4} fill={closed ? '#22c55e' : '#ef4444'} />
      <line x1={x - armLen} y1={y} x2={closed ? x + armLen : x + 8} y2={closed ? y : y - 16}
        stroke={closed ? '#22c55e' : '#ef4444'} strokeWidth={3} strokeLinecap="round" />
      <g transform={textTransform}>
        <text x={x} y={y + 22} textAnchor="middle" fill={closed ? '#22c55e' : '#ef4444'} fontSize={9} fontWeight="bold">{closed ? 'ON' : 'OFF'}</text>
      </g>
    </g>
  );
}
