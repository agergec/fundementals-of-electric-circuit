interface GeneratorProps { x: number; y: number; voltage: number; rotation?: number; pol0?: string; pol1?: string; }

export function Generator({ x, y, voltage, rotation }: GeneratorProps) {
  const r = rotation || 0;
  const textTransform = r ? `rotate(${-r} ${x} ${y})` : undefined;

  return (
    <g>
      {/* Square border 74×74 */}
      <rect x={x - 37} y={y - 37} width={74} height={74} rx={5} fill="none" stroke="#4a4560" strokeWidth={1} />
      <circle cx={x} cy={y} r={18} fill="#1e293b" stroke="#f59e0b" strokeWidth={2.5} />
      <line x1={x - 48} y1={y} x2={x - 33} y2={y} stroke="#6b6580" strokeWidth={1.5} />
      <line x1={x + 33} y1={y} x2={x + 48} y2={y} stroke="#6b6580" strokeWidth={1.5} />
      {/* Generator always shows polarity — terminal 0 = +, terminal 1 = − */}
      <text x={x - 45} y={y} textAnchor="middle" fill="#ef4444" fontSize={12} fontWeight="bold" dominantBaseline="central">+</text>
      <text x={x + 45} y={y} textAnchor="middle" fill="#3b82f6" fontSize={12} fontWeight="bold" dominantBaseline="central">−</text>
      <g transform={textTransform}>
        <text x={x} y={y + 7} textAnchor="middle" fill="#f59e0b" fontSize={16} fontWeight="bold" fontFamily="monospace">G</text>
        <text x={x} y={y + 33} textAnchor="middle" fill="#22c55e" fontSize={10} fontWeight="bold">{voltage.toFixed(1)} V</text>
      </g>
    </g>
  );
}
