import type { CalculatedValues } from '../../engine/types';
import { formatVoltage, formatCurrent } from '../../utils/formatters';

interface LampProps {
  x: number;
  y: number;
  values?: CalculatedValues;
  multiplier: number;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  isFlowing: boolean;
}

export function Lamp({ x, y, values, multiplier, isSelected, onClick, isFlowing }: LampProps) {
  const current = values ? values.current : 0;
  const hasFlow = isFlowing && current > 0.0001;

  // Brightness proportional to current: use logarithmic scale so even small
  // currents are visible, and high currents don't all look the same.
  // At 0.1A → ~0.3 brightness, at 0.5A → ~0.6, at 2A → ~0.9
  const brightness = hasFlow
    ? Math.min(Math.log10(1 + current * 20) / Math.log10(41), 1)
    : 0;

  const glowRadius = 6 + brightness * 18;
  const glowOpacity = brightness * 0.8;

  // Color interpolation: dim orange → bright warm white
  const r = 255;
  const g = Math.round(140 + brightness * 115); // 140 → 255
  const b = Math.round(20 + brightness * 180);  // 20 → 200
  const fillColor = hasFlow ? `rgb(${r}, ${g}, ${b})` : '#4a4560';
  const filamentColor = hasFlow ? `rgba(255, 255, 255, ${0.4 + brightness * 0.6})` : '#6b6580';

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      {/* Glow effect */}
      {hasFlow && (
        <circle
          cx={x}
          cy={y}
          r={glowRadius}
          fill={`rgba(255, 220, 80, ${glowOpacity})`}
          filter="url(#lampGlow)"
        />
      )}

      {/* Bulb body */}
      <circle
        cx={x}
        cy={y}
        r={16}
        fill={fillColor}
        stroke={isSelected ? '#f59e0b' : '#8b83a8'}
        strokeWidth={isSelected ? 3 : 2}
      />

      {/* Filament cross */}
      <line x1={x - 6} y1={y - 6} x2={x + 6} y2={y + 6} stroke={filamentColor} strokeWidth={2} />
      <line x1={x + 6} y1={y - 6} x2={x - 6} y2={y + 6} stroke={filamentColor} strokeWidth={2} />

      {/* Polarity signs */}
      <text x={x - 22} y={y - 14} fill="#ef4444" fontSize={8} fontWeight="bold">+</text>
      <text x={x + 18} y={y - 14} fill="#3b82f6" fontSize={8} fontWeight="bold">−</text>

      {/* Resistance label */}
      <text x={x} y={y + 30} textAnchor="middle" fill="#22c55e" fontSize={10} fontWeight="bold">
        {multiplier === 1 ? 'R' : multiplier < 1 ? `R/${Math.round(1 / multiplier)}` : `${multiplier}R`}
      </text>

      {/* Values */}
      {values && (
        <>
          <text x={x} y={y - 24} textAnchor="middle" fill="#3b82f6" fontSize={9} fontWeight="bold">
            {formatVoltage(values.voltage)}
          </text>
          <text x={x} y={y + 42} textAnchor="middle" fill="#ef4444" fontSize={9} fontWeight="bold">
            {formatCurrent(values.current)}
          </text>
        </>
      )}
    </g>
  );
}
