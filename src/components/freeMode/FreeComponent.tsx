import { memo } from 'react';
import type { FreeComponent as FreeComponentT, CalculatedValues } from '../../engine/types';
import { Generator } from '../elements/Generator';
import { Lamp } from '../elements/Lamp';
import { Amperemeter } from '../elements/Amperemeter';
import { Voltmeter } from '../elements/Voltmeter';
import { Switch } from '../elements/Switch';
import { formatVoltage, formatCurrent } from '../../utils/formatters';

const COMP_HALF_W = 45;

interface FreeComponentProps {
  component: FreeComponentT;
  values?: CalculatedValues;
  isSelected: boolean;
  isFlowing: boolean;
  isWiring: boolean;
  voltage: number;
  polarities?: Record<string, '+' | '-'>;
  hasError?: boolean;
  onComponentClick: (id: string, e: React.MouseEvent) => void;
  onComponentMouseDown: (id: string, e: React.MouseEvent) => void;
  onTerminalClick: (componentId: string, index: 0 | 1, e: React.MouseEvent) => void;
  onTerminalMouseDown: (componentId: string, index: 0 | 1, e: React.MouseEvent) => void;
  onDoubleClick?: (id: string, e: React.MouseEvent) => void;
  highlightTerminal?: 0 | 1 | null;
}

/** Get terminal offset for a component type and rotation angle */
function terminalOffset(
  componentType: string,
  index: 0 | 1,
  rotation: number,
): { tx: number; ty: number } {
  // Junction: single terminal at center
  if (componentType === 'junction') return { tx: 0, ty: 0 };

  const r = ((rotation % 360) + 360) % 360;
  const half = componentType === 'switch' ? 20 : COMP_HALF_W;

  const sign = index === 0 ? -1 : 1;
  if (r === 0)   return { tx: sign * half, ty: 0 };
  if (r === 90)  return { tx: 0, ty: sign * half };
  if (r === 180) return { tx: -sign * half, ty: 0 };
  return { tx: 0, ty: -sign * half }; // 270
}

export const FreeComponent = memo(function FreeComponent({
  component,
  values,
  isSelected,
  isFlowing,
  isWiring,
  voltage,
  onComponentClick,
  onComponentMouseDown,
  onTerminalClick,
  onTerminalMouseDown,
  onDoubleClick,
  highlightTerminal,
  polarities,
  hasError,
}: FreeComponentProps) {
  const { id, componentType, x, y, rotation, resistanceMultiplier, closed, rotateText } = component;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onComponentClick(id, e);
  };

  const handleBodyMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (!isWiring) {
      onComponentMouseDown(id, e);
    }
  };

  const handleJunctionWireDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onTerminalMouseDown(id, 0, e);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDoubleClick?.(id, e);
  };

  const isJunction = componentType === 'junction';
  const bodyCursor = isWiring ? 'crosshair' : isJunction ? 'crosshair' : 'grab';
  const termHit = isJunction ? 14 : (isWiring ? 16 : 10);
  // Pass rotation to elements for counter-rotation only if text shouldn't rotate
  const elemRotation = rotateText ? undefined : rotation;

  // Terminal polarity from generator connection
  const pol0 = polarities?.[`${id}:0`];
  const pol1 = polarities?.[`${id}:1`];

  return (
    <g transform={`translate(${x}, ${y})`} data-comp={id}>
      {/* Error ring — red animated dash */}
      {hasError && (
        <circle cx={0} cy={0} r={isJunction ? 16 : COMP_HALF_W}
          fill="none" stroke="#ef4444" strokeWidth={2.5}
          strokeDasharray="6 3" opacity={0.9}
        >
          <animate attributeName="stroke-dashoffset" from="0" to="18" dur="0.8s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Selection ring */}
      {isSelected && !isJunction && (
        <rect x={-COMP_HALF_W - 8} y={-42} width={COMP_HALF_W * 2 + 16} height={84}
          fill="none" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 2" rx={8} />
      )}

      {/* Terminal dots — always upright. Junction terminal handled by body */}
      {(isJunction ? [] : [0, 1] as const).map((idx) => {
        const { tx, ty } = terminalOffset(componentType, idx, rotation);
        const isHighlighted = highlightTerminal === idx;
        return (
          <g key={idx} data-term={idx}>
            <circle cx={tx} cy={ty} r={termHit} fill="transparent" style={{ cursor: 'crosshair' }}
              onClick={(e) => { e.stopPropagation(); onTerminalClick(id, idx, e); }}
              onMouseDown={(e) => { e.stopPropagation(); onTerminalMouseDown(id, idx, e); }}
            />
            <circle cx={tx} cy={ty}
              r={isHighlighted ? 7 : 6}
              fill={isHighlighted ? '#a78bfa' : '#6b6580'}
              stroke={isHighlighted ? '#c4b5fd' : '#4a4560'}
              strokeWidth={1.5}
            />
          </g>
        );
      })}

      {/* Component body — rotated */}
      {/* Junction: wiring ring (outer), body rotates for visual only */}
      {isJunction && (
        <circle cx={0} cy={0} r={14} fill="transparent" style={{ cursor: 'crosshair' }}
          onMouseDown={handleJunctionWireDown}
        />
      )}

      <g transform={`rotate(${rotation})`}
        onClick={handleClick}
        onMouseDown={handleBodyMouseDown}
        onDoubleClick={handleDoubleClick}
        style={{ cursor: bodyCursor }}
      >
        {componentType === 'generator' && <Generator x={0} y={0} voltage={voltage} rotation={elemRotation} pol0={pol0} pol1={pol1} />}
        {componentType === 'lamp' && (
          <Lamp x={0} y={0} values={values} multiplier={resistanceMultiplier} isSelected={false} onClick={handleClick} isFlowing={isFlowing} rotation={elemRotation} pol0={pol0} pol1={pol1} />
        )}
        {componentType === 'ammeter' && (
          <Amperemeter x={0} y={0} values={values} isSelected={false} onClick={handleClick} rotation={elemRotation} pol0={pol0} pol1={pol1} />
        )}
        {componentType === 'voltmeter' && (
          <Voltmeter x={0} y={0} values={values} isSelected={false} onClick={handleClick} rotation={elemRotation} pol0={pol0} pol1={pol1} />
        )}
        {componentType === 'switch' && (
          <Switch x={0} y={0} closed={!!closed} isSelected={false} onClick={handleClick} onDoubleClick={handleDoubleClick} rotation={elemRotation} pol0={pol0} pol1={pol1} />
        )}
        {isJunction && (
          <circle cx={0} cy={0} r={10} fill="#a78bfa" stroke="#c4b5fd" strokeWidth={2} style={{ cursor: 'grab' }} />
        )}
      </g>

      {/* Text labels — always upright */}
      {isSelected && values && componentType !== 'generator' && !isJunction && (
        <text x={0} y={52} textAnchor="middle" fill="#8b83a8" fontSize={9}>
          V={formatVoltage(values.voltage)} I={formatCurrent(values.current)}
        </text>
      )}
    </g>
  );
});
