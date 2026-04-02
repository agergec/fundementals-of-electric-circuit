import { X, Trash2 } from 'lucide-react';
import { useCircuitStore } from '../../store/circuitStore';
import { RESISTANCE_OPTIONS, BASE_RESISTANCE } from '../../utils/constants';
import { formatVoltage, formatCurrent, formatResistance } from '../../utils/formatters';
import type { ComponentNode } from '../../engine/types';

function findComponentById(node: any, id: string): ComponentNode | null {
  if (node.kind === 'component' && node.id === id) return node;
  if (node.kind === 'series') {
    for (const child of node.children) {
      const found = findComponentById(child, id);
      if (found) return found;
    }
  }
  if (node.kind === 'parallel') {
    for (const branch of node.branches) {
      const found = findComponentById(branch, id);
      if (found) return found;
    }
  }
  return null;
}

export function InfoPanel() {
  const {
    selectedComponentId,
    selectComponent,
    circuit,
    calculatedValues,
    setLampResistance,
    removeComponent,
    toggleSwitch,
  } = useCircuitStore();

  if (!selectedComponentId) return null;

  const component = findComponentById(circuit, selectedComponentId);
  if (!component) return null;

  const values = calculatedValues.get(selectedComponentId);

  const typeLabels: Record<string, string> = {
    lamp: 'Lamp',
    ammeter: 'Amperemeter',
    voltmeter: 'Voltmeter',
    switch: 'Switch',
  };

  const typeColors: Record<string, string> = {
    lamp: 'text-yellow-400',
    ammeter: 'text-red-400',
    voltmeter: 'text-blue-400',
    switch: 'text-green-400',
  };

  return (
    <div className="absolute bottom-4 right-4 w-72 bg-[#2d2a3e] rounded-xl border border-[#4a4560] shadow-2xl p-4 z-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-bold ${typeColors[component.componentType]}`}>
          {typeLabels[component.componentType]}
        </h3>
        <button
          onClick={() => selectComponent(null)}
          className="text-[#6b6580] hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Values */}
      {values && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-[#1e1b2e] rounded-lg p-2 text-center">
            <div className="text-[10px] text-[#6b6580] uppercase">Voltage</div>
            <div className="text-blue-400 font-bold text-sm">{formatVoltage(values.voltage)}</div>
          </div>
          <div className="bg-[#1e1b2e] rounded-lg p-2 text-center">
            <div className="text-[10px] text-[#6b6580] uppercase">Current</div>
            <div className="text-red-400 font-bold text-sm">{formatCurrent(values.current)}</div>
          </div>
          <div className="bg-[#1e1b2e] rounded-lg p-2 text-center">
            <div className="text-[10px] text-[#6b6580] uppercase">Resistance</div>
            <div className="text-green-400 font-bold text-sm">{formatResistance(values.resistance)}</div>
          </div>
        </div>
      )}

      {/* Resistance picker for lamps */}
      {component.componentType === 'lamp' && (
        <div className="mb-3">
          <div className="text-[10px] text-[#6b6580] uppercase mb-2">Resistance</div>
          <div className="flex flex-wrap gap-1">
            {RESISTANCE_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                onClick={() => setLampResistance(selectedComponentId, opt.multiplier)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors
                  ${
                    component.resistanceMultiplier === opt.multiplier
                      ? 'bg-green-600 text-white'
                      : 'bg-[#1e1b2e] text-[#8b83a8] hover:bg-[#3d3a4e]'
                  }`}
              >
                {opt.label}
                <span className="text-[9px] ml-1 opacity-60">
                  ({(BASE_RESISTANCE * opt.multiplier).toFixed(1)}Ω)
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Switch toggle */}
      {component.componentType === 'switch' && (
        <div className="mb-3">
          <button
            onClick={() => toggleSwitch(selectedComponentId)}
            className={`w-full px-3 py-2 rounded-lg text-sm font-bold transition-colors border
              ${component.closed
                ? 'bg-green-900/30 text-green-400 border-green-700 hover:bg-green-900/50'
                : 'bg-red-900/30 text-red-400 border-red-700 hover:bg-red-900/50'
              }`}
          >
            {component.closed ? 'Switch is ON — Click to Open' : 'Switch is OFF — Click to Close'}
          </button>
        </div>
      )}

      {/* Delete button */}
      <button
        onClick={() => {
          removeComponent(selectedComponentId);
          selectComponent(null);
        }}
        className="flex items-center gap-2 w-full justify-center px-3 py-2 rounded-lg
                   bg-red-900/20 text-red-400 text-sm font-medium hover:bg-red-900/40
                   transition-colors border border-red-900/40"
      >
        <Trash2 size={14} />
        Remove
      </button>
    </div>
  );
}
