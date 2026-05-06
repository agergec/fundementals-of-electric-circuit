interface GeneratorProps { x: number; y: number; voltage?: number; rotation?: number; isSelected?: boolean; }

export function Generator({ x, y, voltage = 12, rotation, isSelected }: GeneratorProps) {
  const r = rotation || 0;
  const textTransform = r ? `rotate(${-r} ${x} ${y})` : undefined;
  const borderColor = isSelected ? '#22c55e' : '#4a4560';

  return (
    <g>
      <rect x={x - 32} y={y - 32} width={64} height={64} rx={5} fill="none" stroke={borderColor} strokeWidth={1} />
      <circle cx={x} cy={y} r={18} fill="#1e293b" stroke="#f59e0b" strokeWidth={2.5} />
      <line x1={x - 43} y1={y} x2={x - 28} y2={y} stroke="#6b6580" strokeWidth={1.5} />
      <line x1={x + 28} y1={y} x2={x + 43} y2={y} stroke="#6b6580" strokeWidth={1.5} />
      {/* Polarity inside border — rotates with body */}
      <text x={x - 24} y={y - 14} textAnchor="middle" fill="#ef4444" fontSize={12} fontWeight="bold" dominantBaseline="central">+</text>
      <text x={x + 24} y={y - 14} textAnchor="middle" fill="#3b82f6" fontSize={12} fontWeight="bold" dominantBaseline="central">−</text>
      <g transform={textTransform}>
        <text x={x} y={y + 7} textAnchor="middle" fill="#f59e0b" fontSize={16} fontWeight="bold" fontFamily="monospace">G</text>
        <text x={x} y={y + 31} textAnchor="middle" fill="#22c55e" fontSize={9} fontWeight="bold">{voltage.toFixed(1)} V</text>
      </g>
    </g>
  );
}
