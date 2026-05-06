import { memo } from 'react';
import type { FreeComponent as FreeComponentT, CalculatedValues } from '../../engine/types';
import { Generator } from '../elements/Generator';
import { Lamp } from '../elements/Lamp';
import { Amperemeter } from '../elements/Amperemeter';
import { Voltmeter } from '../elements/Voltmeter';
import { Switch } from '../elements/Switch';

const COMP_HALF_W = 40;

interface FreeComponentProps {
  component: FreeComponentT;
  values?: CalculatedValues;
  isSelected: boolean;
  isFlowing: boolean;
  isWiring: boolean;
  voltage: number;
  onComponentClick: (id: string, e: React.MouseEvent) => void;
  onComponentMouseDown: (id: string, e: React.MouseEvent) => void;
  onTerminalClick: (componentId: string, index: 0 | 1, e: React.MouseEvent) => void;
  onTerminalMouseDown: (componentId: string, index: 0 | 1, e: React.MouseEvent) => void;
  onDoubleClick?: (id: string, e: React.MouseEvent) => void;
  highlightTerminal?: 0 | 1 | null;
  polarities?: Record<string, '+' | '-'>;
  hasError?: boolean;
}

function terminalOffset(componentType: string, index: 0 | 1, rotation: number): { tx: number; ty: number } {
  if (componentType === 'junction') return { tx: 0, ty: 0 };
  const r = ((rotation % 360) + 360) % 360;
  const half = componentType === 'switch' ? 28 : COMP_HALF_W;
  const sign = index === 0 ? -1 : 1;
  if (r === 0)   return { tx: sign * half, ty: 0 };
  if (r === 90)  return { tx: 0, ty: sign * half };
  if (r === 180) return { tx: -sign * half, ty: 0 };
  return { tx: 0, ty: -sign * half };
}

export const FreeComponent = memo(function FreeComponent({
  component, values, isSelected, isFlowing, isWiring, voltage,
  onComponentClick, onComponentMouseDown, onTerminalClick, onTerminalMouseDown,
  onDoubleClick, highlightTerminal, polarities, hasError,
}: FreeComponentProps) {
  const { id, componentType, x, y, rotation, resistanceMultiplier, closed, rotateText } = component;
  const isJunction = componentType === 'junction';
  const elemRotation = rotateText ? undefined : rotation;
  const pol0 = polarities?.[`${id}:0`];
  const pol1 = polarities?.[`${id}:1`];

  const bodyMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || isWiring) return;
    e.stopPropagation();
    onComponentMouseDown(id, e);
  };

  const bodyClick = (e: React.MouseEvent) => { e.stopPropagation(); onComponentClick(id, e); };
  const bodyDblClick = (e: React.MouseEvent) => { e.stopPropagation(); onDoubleClick?.(id, e); };

  const dragW = componentType === 'switch' ? 40 : componentType === 'junction' ? 20 : componentType === 'generator' ? 64 : 58;
  const dragH = componentType === 'switch' ? 44 : componentType === 'junction' ? 20 : componentType === 'generator' ? 64 : 58;

  return (
    <g transform={`translate(${x}, ${y})`} data-comp={id}>
      {hasError && (
        <circle cx={0} cy={0} r={isJunction ? 16 : COMP_HALF_W}
          fill="none" stroke="#ef4444" strokeWidth={2.5} strokeDasharray="6 3" opacity={0.9}>
          <animate attributeName="stroke-dashoffset" from="0" to="18" dur="0.8s" repeatCount="indefinite" />
        </circle>
      )}

      {(isJunction ? [] : [0, 1] as const).map((idx) => {
        const { tx, ty } = terminalOffset(componentType, idx, rotation);
        const hl = highlightTerminal === idx;
        return (
          <g key={idx} data-term={idx}>
            <circle cx={tx} cy={ty} r={isWiring ? 16 : 10} fill="transparent" style={{ cursor: 'crosshair' }}
              onClick={(e) => { e.stopPropagation(); onTerminalClick(id, idx, e); }}
              onMouseDown={(e) => { e.stopPropagation(); onTerminalMouseDown(id, idx, e); }}
            />
            <circle cx={tx} cy={ty} r={hl ? 7 : 6}
              fill={hl ? '#a78bfa' : '#6b6580'} stroke={hl ? '#c4b5fd' : '#4a4560'} strokeWidth={1.5} />
          </g>
        );
      })}

      {isJunction && (
        <circle cx={0} cy={0} r={14} fill="transparent" style={{ cursor: 'crosshair' }}
          onMouseDown={(e) => { e.stopPropagation(); onTerminalMouseDown(id, 0, e); }} />
      )}

      <rect x={-dragW / 2} y={-dragH / 2} width={dragW} height={dragH} rx={5}
        fill="transparent" style={{ cursor: isWiring ? 'crosshair' : isJunction ? 'crosshair' : 'grab' }}
        onMouseDown={bodyMouseDown} onClick={bodyClick} onDoubleClick={bodyDblClick} />

      <g transform={`rotate(${rotation})`} style={{ pointerEvents: 'none' }}>
        {componentType === 'generator' && <Generator x={0} y={0} voltage={voltage} rotation={elemRotation} isSelected={isSelected} />}
        {componentType === 'lamp' && <Lamp x={0} y={0} values={values} multiplier={resistanceMultiplier} isSelected={isSelected} onClick={bodyClick} isFlowing={isFlowing} rotation={elemRotation} />}
        {componentType === 'ammeter' && <Amperemeter x={0} y={0} values={values} isSelected={isSelected} onClick={bodyClick} rotation={elemRotation} />}
        {componentType === 'voltmeter' && <Voltmeter x={0} y={0} values={values} isSelected={isSelected} onClick={bodyClick} rotation={elemRotation} />}
        {componentType === 'switch' && <Switch x={0} y={0} closed={!!closed} isSelected={isSelected} onClick={bodyClick} onDoubleClick={bodyDblClick} rotation={elemRotation} />}
        {isJunction && <circle cx={0} cy={0} r={10} fill="#a78bfa" stroke="#c4b5fd" strokeWidth={2} />}

        {(componentType as string) !== 'generator' && [0, 1].map((idx) => {
          const p = idx === 0 ? pol0 : pol1;
          if (!p) return null;
          const inset = componentType === 'switch' ? 14 : 24;
          const sx = idx === 0 ? -inset : inset;
          const sy = componentType === 'switch' ? -10 : -14;
          return (
            <text key={`pol-${idx}`} x={sx} y={sy}
              textAnchor="middle" dominantBaseline="central"
              fill={p === '+' ? '#ef4444' : '#3b82f6'}
              fontSize={12} fontWeight="bold"
              style={{ pointerEvents: 'none' }}>
              {p}
            </text>
          );
        })}
      </g>
    </g>
  );
});
