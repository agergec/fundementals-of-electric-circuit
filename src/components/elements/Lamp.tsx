import type { CalculatedValues } from '../../engine/types';
import { formatVoltage, formatCurrent } from '../../utils/formatters';

interface LampProps { x: number; y: number; values?: CalculatedValues; multiplier: number; isSelected: boolean; onClick: (e: React.MouseEvent) => void; isFlowing: boolean; rotation?: number; pol0?: string; pol1?: string; }

export function Lamp({ x, y, values, multiplier, isSelected, onClick, isFlowing, rotation, pol0, pol1 }: LampProps) {
  const current = values ? values.current : 0;
  const hasFlow = isFlowing && current > 0.0001;
  const brightness = hasFlow ? Math.min(Math.log10(1 + current * 20) / Math.log10(41), 1) : 0;
  const glowRadius = 6 + brightness * 18;
  const glowOpacity = brightness * 0.8;
  const fillColor = hasFlow ? `rgb(255, ${Math.round(140 + brightness * 115)}, ${Math.round(20 + brightness * 180)})` : '#4a4560';
  const filamentColor = hasFlow ? `rgba(255, 255, 255, ${0.4 + brightness * 0.6})` : '#6b6580';
  const rot = rotation || 0;
  const textTransform = rot ? `rotate(${-rot} ${x} ${y})` : undefined;

  const rLabel = multiplier === 1 ? 'R' : multiplier < 1 ? `R/${Math.round(1 / multiplier)}` : `${multiplier}R`;
  const rLabelX = x - (rLabel.length > 2 ? 34 : 30);

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <rect x={x - 37} y={y - 26} width={74} height={52} rx={5} fill="none" stroke="#4a4560" strokeWidth={1} />
      {hasFlow && <circle cx={x} cy={y} r={glowRadius} fill={`rgba(255, 220, 80, ${glowOpacity})`} filter="url(#lampGlow)" />}
      <circle cx={x} cy={y} r={16} fill={fillColor} stroke={isSelected ? '#f59e0b' : '#8b83a8'} strokeWidth={isSelected ? 3 : 2} />
      <line x1={x - 6} y1={y - 6} x2={x + 6} y2={y + 6} stroke={filamentColor} strokeWidth={2} />
      <line x1={x + 6} y1={y - 6} x2={x - 6} y2={y + 6} stroke={filamentColor} strokeWidth={2} />
      <line x1={x - 48} y1={y} x2={x - 33} y2={y} stroke="#6b6580" strokeWidth={1.5} />
      <line x1={x + 33} y1={y} x2={x + 48} y2={y} stroke="#6b6580" strokeWidth={1.5} />
      {pol0 && <text x={x - 45} y={y} textAnchor="middle" fill={pol0 === '+' ? '#ef4444' : '#3b82f6'} fontSize={12} fontWeight="bold" dominantBaseline="central">{pol0}</text>}
      {pol1 && <text x={x + 45} y={y} textAnchor="middle" fill={pol1 === '+' ? '#ef4444' : '#3b82f6'} fontSize={12} fontWeight="bold" dominantBaseline="central">{pol1}</text>}
      <g transform={textTransform}>
        <text x={rLabelX} y={y + 22} fill="#22c55e" fontSize={8} fontWeight="bold">{rLabel}</text>
        {values && (
          <>
            <text x={x - 22} y={y + 38} textAnchor="middle" fill="#22c55e" fontSize={9} fontWeight="bold">{formatVoltage(values.voltage)}</text>
            <text x={x + 22} y={y + 38} textAnchor="middle" fill="#fbbf24" fontSize={9} fontWeight="bold">{formatCurrent(values.current)}</text>
          </>
        )}
      </g>
    </g>
  );
}
