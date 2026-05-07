interface ResistorProps { x: number; y: number; multiplier: number; isSelected: boolean; onClick: (e: React.MouseEvent) => void; rotation?: number; realistic?: boolean; }

export function Resistor({ x, y, multiplier, isSelected, onClick, rotation, realistic }: ResistorProps) {
  const rot = rotation || 0;
  const textTransform = rot ? `rotate(${-rot} ${x} ${y})` : undefined;
  const rLabel = multiplier === 1 ? 'R' : multiplier < 1 ? `R/${Math.round(1 / multiplier)}` : `${multiplier}R`;

  if (realistic) {
    // Color band colors based on multiplier
    const bands = ['#8B4513', '#000000', '#FF0000', '#FFD700'];
    if (multiplier >= 3) { bands[0] = '#FF6600'; bands[1] = '#000000'; }
    if (multiplier >= 10) { bands[0] = '#8B4513'; bands[1] = '#FF6600'; bands[2] = '#000000'; }
    return (
      <g onClick={onClick} style={{ cursor: 'pointer' }}>
        <rect x={x - 32} y={y - 32} width={64} height={64} rx={5} fill="none" stroke={isSelected ? '#22c55e' : '#4a4560'} strokeWidth={1} />
        {/* Cylinder body */}
        <rect x={x - 22} y={y - 8} width={44} height={16} rx={8} fill="#d4a76a" stroke="#b8860b" strokeWidth={1} />
        {/* Wire leads */}
        <line x1={x - 43} y1={y} x2={x - 26} y2={y} stroke="#9ca3af" strokeWidth={2} />
        <line x1={x + 26} y1={y} x2={x + 43} y2={y} stroke="#9ca3af" strokeWidth={2} />
        {/* Color bands */}
        <rect x={x - 14} y={y - 8} width={5} height={16} fill={bands[0]} opacity={0.9} />
        <rect x={x - 5} y={y - 8} width={5} height={16} fill={bands[1]} opacity={0.9} />
        <rect x={x + 4} y={y - 8} width={5} height={16} fill={bands[2]} opacity={0.9} />
        <rect x={x + 12} y={y - 8} width={4} height={16} fill={bands[3]} opacity={0.9} />
        <g transform={textTransform}>
          <text x={x - 28} y={y + 28} fill="#22c55e" fontSize={8} fontWeight="bold">{rLabel}</text>
        </g>
      </g>
    );
  }

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <rect x={x - 32} y={y - 32} width={64} height={64} rx={5} fill="none" stroke={isSelected ? '#22c55e' : '#4a4560'} strokeWidth={1} />
      <line x1={x - 43} y1={y} x2={x - 28} y2={y} stroke="#6b6580" strokeWidth={1.5} />
      <line x1={x + 28} y1={y} x2={x + 43} y2={y} stroke="#6b6580" strokeWidth={1.5} />
      <polyline points={`${x - 20},${y - 6} ${x - 10},${y + 8} ${x},${y - 6} ${x + 10},${y + 8} ${x + 20},${y - 6}`}
        fill="none" stroke="#a78bfa" strokeWidth={2} strokeLinejoin="round" />
      <g transform={textTransform}>
        <text x={x - 28} y={y + 28} fill="#22c55e" fontSize={8} fontWeight="bold">{rLabel}</text>
      </g>
    </g>
  );
}
