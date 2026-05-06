import type { CalculatedValues } from '../../engine/types';
import { formatVoltage, formatCurrent } from '../../utils/formatters';

interface LampProps { x: number; y: number; values?: CalculatedValues; multiplier: number; isSelected: boolean; onClick: (e: React.MouseEvent) => void; isFlowing: boolean; rotation?: number; realistic?: boolean; }

export function Lamp({ x, y, values, multiplier, isSelected, onClick, isFlowing, rotation, realistic }: LampProps) {
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

  // Realistic: glass bulb with filament inside
  if (realistic) {
    return (
      <g onClick={onClick} style={{ cursor: 'pointer' }}>
        <rect x={x - 32} y={y - 32} width={64} height={64} rx={5} fill="none" stroke={isSelected ? '#22c55e' : '#4a4560'} strokeWidth={1} />
        {hasFlow && <circle cx={x} cy={y} r={glowRadius} fill={`rgba(255, 220, 80, ${glowOpacity})`} filter="url(#lampGlow)" />}
        {/* Glass bulb — pear shape using path */}
        <path d={`M ${x - 10} ${y - 20} C ${x - 18} ${y - 8}, ${x - 18} ${y + 8}, ${x - 8} ${y + 16} L ${x - 4} ${y + 10} L ${x + 4} ${y + 10} L ${x + 8} ${y + 16} C ${x + 18} ${y + 8}, ${x + 18} ${y - 8}, ${x + 10} ${y - 20} Z`}
          fill={hasFlow ? `rgba(255, 240, 200, ${0.2 + brightness * 0.3})` : 'rgba(200, 210, 220, 0.15)'}
          stroke={isSelected ? '#f59e0b' : '#8b83a8'} strokeWidth={1.5} />
        {/* Base/screw */}
        <rect x={x - 6} y={y + 10} width={12} height={8} rx={1} fill="#718096" stroke="#4a5568" strokeWidth={0.5} />
        {/* Filament inside */}
        <path d={`M ${x - 4} ${y + 6} L ${x - 3} ${y - 6} L ${x - 1} ${y + 2} L ${x + 1} ${y - 6} L ${x + 3} ${y + 2} L ${x + 4} ${y - 4}`}
          fill="none" stroke={filamentColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <line x1={x - 43} y1={y} x2={x - 28} y2={y} stroke="#6b6580" strokeWidth={1.5} />
        <line x1={x + 28} y1={y} x2={x + 43} y2={y} stroke="#6b6580" strokeWidth={1.5} />
        <g transform={textTransform}>
          <text x={x - 28} y={y + 28} fill="#22c55e" fontSize={8} fontWeight="bold">{rLabel}</text>
          {values && (<>
            <text x={x - 22} y={y + 38} textAnchor="middle" fill="#22c55e" fontSize={9} fontWeight="bold">{formatVoltage(values.voltage)}</text>
            <text x={x + 22} y={y + 38} textAnchor="middle" fill="#fbbf24" fontSize={9} fontWeight="bold">{formatCurrent(values.current)}</text>
          </>)}
        </g>
      </g>
    );
  }

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <rect x={x - 32} y={y - 32} width={64} height={64} rx={5} fill="none" stroke={isSelected ? '#22c55e' : '#4a4560'} strokeWidth={1} />
      {hasFlow && <circle cx={x} cy={y} r={glowRadius} fill={`rgba(255, 220, 80, ${glowOpacity})`} filter="url(#lampGlow)" />}
      <circle cx={x} cy={y} r={16} fill={fillColor} stroke={isSelected ? '#f59e0b' : '#8b83a8'} strokeWidth={isSelected ? 3 : 2} />
      <line x1={x - 6} y1={y - 6} x2={x + 6} y2={y + 6} stroke={filamentColor} strokeWidth={2} />
      <line x1={x + 6} y1={y - 6} x2={x - 6} y2={y + 6} stroke={filamentColor} strokeWidth={2} />
      <line x1={x - 43} y1={y} x2={x - 28} y2={y} stroke="#6b6580" strokeWidth={1.5} />
      <line x1={x + 28} y1={y} x2={x + 43} y2={y} stroke="#6b6580" strokeWidth={1.5} />
      <g transform={textTransform}>
        <text x={x - 28} y={y + 28} fill="#22c55e" fontSize={8} fontWeight="bold">{rLabel}</text>
        {values && (<>
          <text x={x - 22} y={y + 38} textAnchor="middle" fill="#22c55e" fontSize={9} fontWeight="bold">{formatVoltage(values.voltage)}</text>
          <text x={x + 22} y={y + 38} textAnchor="middle" fill="#fbbf24" fontSize={9} fontWeight="bold">{formatCurrent(values.current)}</text>
        </>)}
      </g>
    </g>
  );
}
