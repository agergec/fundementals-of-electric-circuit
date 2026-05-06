interface GeneratorProps { x: number; y: number; voltage?: number; rotation?: number; isSelected?: boolean; realistic?: boolean; }

export function Generator({ x, y, voltage = 12, rotation, isSelected, realistic }: GeneratorProps) {
  const r = rotation || 0;
  const textTransform = r ? `rotate(${-r} ${x} ${y})` : undefined;
  const borderColor = isSelected ? '#22c55e' : '#4a4560';

  // Realistic: battery with two cells
  if (realistic) {
    return (
      <g>
        <rect x={x - 32} y={y - 32} width={64} height={64} rx={5} fill="none" stroke={borderColor} strokeWidth={1} />
        {/* Battery body */}
        <rect x={x - 20} y={y - 22} width={32} height={36} rx={3} fill="#4a5568" stroke="#718096" strokeWidth={1.5} />
        {/* Positive terminal nub */}
        <rect x={x - 6} y={y - 28} width={12} height={6} rx={2} fill="#ef4444" />
        {/* Negative terminal */}
        <rect x={x - 4} y={y + 14} width={8} height={5} rx={1} fill="#3b82f6" />
        {/* Cell divider */}
        <line x1={x - 20} y1={y - 4} x2={x + 12} y2={y - 4} stroke="#718096" strokeWidth={1} />
        {/* Labels */}
        <text x={x - 24} y={y - 12} textAnchor="middle" fill="#ef4444" fontSize={10} fontWeight="bold">+</text>
        <text x={x + 24} y={y + 10} textAnchor="middle" fill="#3b82f6" fontSize={10} fontWeight="bold">−</text>
        {/* Terminal lines */}
        <line x1={x - 43} y1={y} x2={x - 28} y2={y} stroke="#6b6580" strokeWidth={1.5} />
        <line x1={x + 28} y1={y} x2={x + 43} y2={y} stroke="#6b6580" strokeWidth={1.5} />
        <g transform={textTransform}>
          <text x={x} y={y + 31} textAnchor="middle" fill="#22c55e" fontSize={9} fontWeight="bold">{voltage.toFixed(1)} V</text>
        </g>
      </g>
    );
  }

  return (
    <g>
      <rect x={x - 32} y={y - 32} width={64} height={64} rx={5} fill="none" stroke={borderColor} strokeWidth={1} />
      <circle cx={x} cy={y} r={18} fill="#1e293b" stroke="#f59e0b" strokeWidth={2.5} />
      <line x1={x - 43} y1={y} x2={x - 28} y2={y} stroke="#6b6580" strokeWidth={1.5} />
      <line x1={x + 28} y1={y} x2={x + 43} y2={y} stroke="#6b6580" strokeWidth={1.5} />
      <text x={x - 24} y={y - 14} textAnchor="middle" fill="#ef4444" fontSize={12} fontWeight="bold" dominantBaseline="central">+</text>
      <text x={x + 24} y={y - 14} textAnchor="middle" fill="#3b82f6" fontSize={12} fontWeight="bold" dominantBaseline="central">−</text>
      <g transform={textTransform}>
        <text x={x} y={y + 7} textAnchor="middle" fill="#f59e0b" fontSize={16} fontWeight="bold" fontFamily="monospace">G</text>
        <text x={x} y={y + 31} textAnchor="middle" fill="#22c55e" fontSize={9} fontWeight="bold">{voltage.toFixed(1)} V</text>
      </g>
    </g>
  );
}
