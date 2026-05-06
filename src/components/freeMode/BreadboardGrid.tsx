import { memo } from 'react';

const COLS = 30;
const ROWS = 20;
const SPACING = 40;

export const BreadboardGrid = memo(function BreadboardGrid() {
  const holes = [];
  const startX = 40;
  const startY = 40;

  // Power rails
  const railW = COLS * SPACING + 20;

  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      const cx = startX + col * SPACING;
      const cy = startY + row * SPACING;
      const isGap = row === 9 || row === 10; // center gap
      if (!isGap) {
        holes.push(
          <circle key={`h-${col}-${row}`} cx={cx} cy={cy} r={3.5}
            fill="#1e1b2e" stroke="#4a4560" strokeWidth={0.8} />,
        );
      }
    }
  }

  return (
    <g>
      {/* Top power rail + */}
      <rect x={startX - 5} y={startY - 20} width={railW} height={14} rx={3}
        fill="#ef444415" stroke="#ef4444" strokeWidth={1} />
      <text x={startX + railW / 2} y={startY - 9} textAnchor="middle"
        fill="#ef4444" fontSize={8} fontWeight="bold">+</text>
      {Array.from({ length: COLS }, (_, i) => (
        <circle key={`tr-${i}`} cx={startX + i * SPACING} cy={startY - 13} r={2}
          fill="#ef444440" stroke="#ef4444" strokeWidth={0.5} />
      ))}

      {/* Bottom power rail - */}
      <rect x={startX - 5} y={startY + ROWS * SPACING + 6} width={railW} height={14} rx={3}
        fill="#3b82f615" stroke="#3b82f6" strokeWidth={1} />
      <text x={startX + railW / 2} y={startY + ROWS * SPACING + 18} textAnchor="middle"
        fill="#3b82f6" fontSize={8} fontWeight="bold">−</text>
      {Array.from({ length: COLS }, (_, i) => (
        <circle key={`br-${i}`} cx={startX + i * SPACING} cy={startY + ROWS * SPACING + 13} r={2}
          fill="#3b82f640" stroke="#3b82f6" strokeWidth={0.5} />
      ))}

      {/* Grid holes */}
      {holes}

      {/* Breadboard label */}
      <text x={startX + railW / 2} y={startY + ROWS * SPACING + 40} textAnchor="middle"
        fill="#4a4560" fontSize={9}>Breadboard View</text>
    </g>
  );
});
