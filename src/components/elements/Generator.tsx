interface GeneratorProps {
  x: number;
  y: number;
  voltage: number;
}

export function Generator({ x, y, voltage }: GeneratorProps) {
  return (
    <g>
      {/* Battery body */}
      <rect
        x={x - 20}
        y={y - 30}
        width={40}
        height={60}
        rx={6}
        fill="#1e293b"
        stroke="#f59e0b"
        strokeWidth={2}
      />

      {/* Positive terminal */}
      <line x1={x - 8} y1={y - 10} x2={x + 8} y2={y - 10} stroke="#ef4444" strokeWidth={3} />
      <line x1={x} y1={y - 16} x2={x} y2={y - 4} stroke="#ef4444" strokeWidth={3} />

      {/* Negative terminal */}
      <line x1={x - 8} y1={y + 10} x2={x + 8} y2={y + 10} stroke="#3b82f6" strokeWidth={3} />

      {/* Voltage label */}
      <text x={x} y={y + 50} textAnchor="middle" fill="#f59e0b" fontSize={12} fontWeight="bold">
        {voltage.toFixed(1)} V
      </text>

      {/* +/- labels */}
      <text x={x + 26} y={y - 6} fill="#ef4444" fontSize={12} fontWeight="bold">+</text>
      <text x={x + 26} y={y + 14} fill="#3b82f6" fontSize={12} fontWeight="bold">−</text>
    </g>
  );
}
