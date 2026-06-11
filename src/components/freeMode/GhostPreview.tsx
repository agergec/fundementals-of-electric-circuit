import type { FreeComponent } from '../../engine/types';
import { COMP_HALF_W } from './FreeComponent';
import { Generator } from '../elements/Generator';
import { Lamp } from '../elements/Lamp';
import { Amperemeter } from '../elements/Amperemeter';
import { Voltmeter } from '../elements/Voltmeter';
import { Switch } from '../elements/Switch';
import { Resistor } from '../elements/Resistor';
import { Fuse } from '../elements/Fuse';

interface GhostPreviewProps {
  type: FreeComponent['componentType'];
  x: number;
  y: number;
  rotation: number;
}

const noop = () => {};

/** Translucent preview of a component while placing or dragging from the toolbar */
export function GhostPreview({ type, x, y, rotation }: GhostPreviewProps) {
  const isJunction = type === 'junction';
  return (
    <g transform={`translate(${x}, ${y})`} opacity={0.45} pointerEvents="none">
      {!isJunction && (
        <g transform={`rotate(${rotation})`}>
          <circle cx={-COMP_HALF_W} cy={0} r={6} fill="#6b6580" stroke="#4a4560" strokeWidth={1.5} />
          <circle cx={COMP_HALF_W} cy={0} r={6} fill="#6b6580" stroke="#4a4560" strokeWidth={1.5} />
        </g>
      )}
      <g transform={`rotate(${rotation})`}>
        {type === 'generator' && <Generator x={0} y={0} />}
        {type === 'lamp' && <Lamp x={0} y={0} multiplier={1} isSelected={false} onClick={noop} isFlowing={false} />}
        {type === 'ammeter' && <Amperemeter x={0} y={0} isSelected={false} onClick={noop} />}
        {type === 'voltmeter' && <Voltmeter x={0} y={0} isSelected={false} onClick={noop} />}
        {type === 'switch' && <Switch x={0} y={0} closed isSelected={false} onClick={noop} onDoubleClick={noop} />}
        {type === 'resistor' && <Resistor x={0} y={0} multiplier={1} isSelected={false} onClick={noop} />}
        {type === 'fuse' && <Fuse x={0} y={0} isSelected={false} onClick={noop} />}
        {isJunction && <circle cx={0} cy={0} r={10} fill="#a78bfa" stroke="#c4b5fd" strokeWidth={2} />}
      </g>
    </g>
  );
}
