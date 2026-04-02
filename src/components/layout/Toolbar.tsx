import { Lightbulb, Gauge, ToggleLeft, GitBranch, RotateCcw } from 'lucide-react';
import { useCircuitStore } from '../../store/circuitStore';
import { MAX_VOLTAGE, MIN_VOLTAGE } from '../../utils/constants';

export function Toolbar() {
  const {
    addComponent,
    addAmmeterNear,
    addVoltmeterAcross,
    addParallelBranch,
    selectedComponentId,
    voltage,
    setVoltage,
    resetCircuit,
  } = useCircuitStore();

  const hasSelection = !!selectedComponentId;

  return (
    <div className="w-64 bg-[#2d2a3e] border-r border-[#4a4560] p-4 flex flex-col gap-4 overflow-y-auto">
      {/* Voltage Control */}
      <section>
        <h3 className="text-xs font-semibold text-[#8b83a8] uppercase tracking-wider mb-2">
          Generator Voltage
        </h3>
        <div className="bg-[#1e1b2e] rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-amber-400 font-bold text-lg">{voltage.toFixed(1)} V</span>
          </div>
          <input
            type="range"
            min={MIN_VOLTAGE}
            max={MAX_VOLTAGE}
            step={0.5}
            value={voltage}
            onChange={(e) => setVoltage(parseFloat(e.target.value))}
            className="w-full accent-amber-400 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-[#6b6580] mt-1">
            <span>{MIN_VOLTAGE}V</span>
            <span>{MAX_VOLTAGE}V</span>
          </div>
        </div>
      </section>

      {/* Add Components */}
      <section>
        <h3 className="text-xs font-semibold text-[#8b83a8] uppercase tracking-wider mb-2">
          Add to Circuit
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <ToolButton
            icon={<Lightbulb size={18} />}
            label={hasSelection ? 'Lamp (series)' : 'Lamp'}
            color="text-yellow-400"
            onClick={() => addComponent('lamp', selectedComponentId ?? undefined)}
          />
          <ToolButton
            icon={<ToggleLeft size={18} />}
            label="Switch"
            color="text-green-400"
            onClick={() => addComponent('switch', selectedComponentId ?? undefined)}
          />
        </div>
      </section>

      {/* Measurement Tools — context-aware */}
      <section>
        <h3 className="text-xs font-semibold text-[#8b83a8] uppercase tracking-wider mb-2">
          Measurement Tools
        </h3>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              if (hasSelection) {
                addAmmeterNear(selectedComponentId);
              } else {
                addComponent('ammeter');
              }
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1e1b2e] text-sm font-medium
                       text-red-400 hover:bg-red-900/20 transition-colors border border-[#4a4560]"
          >
            <Gauge size={16} />
            <div className="text-left">
              <div>Add Ammeter</div>
              <div className="text-[9px] text-[#6b6580]">
                {hasSelection ? 'In series with selected' : 'At end of circuit'}
              </div>
            </div>
          </button>

          <button
            onClick={() => {
              if (hasSelection) {
                addVoltmeterAcross(selectedComponentId);
              }
            }}
            disabled={!hasSelection}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1e1b2e] text-sm font-medium
                       text-blue-400 hover:bg-blue-900/20 disabled:opacity-30 disabled:cursor-not-allowed
                       transition-colors border border-[#4a4560]"
          >
            <span className="font-bold text-base">V</span>
            <div className="text-left">
              <div>Add Voltmeter</div>
              <div className="text-[9px] text-[#6b6580]">
                {hasSelection ? 'Across selected component' : 'Select a component first'}
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* Circuit Actions */}
      <section>
        <h3 className="text-xs font-semibold text-[#8b83a8] uppercase tracking-wider mb-2">
          Actions
        </h3>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              if (selectedComponentId) {
                addParallelBranch(selectedComponentId);
              }
            }}
            disabled={!hasSelection}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1e1b2e] text-sm font-medium
                       text-purple-300 hover:bg-purple-900/30 disabled:opacity-30 disabled:cursor-not-allowed
                       transition-colors border border-[#4a4560]"
          >
            <GitBranch size={16} />
            Add Parallel Branch
          </button>
          <p className="text-[10px] text-[#6b6580] px-1">
            Select a component, then click to split into parallel branches.
          </p>
        </div>
      </section>

      {/* Reset */}
      <div className="mt-auto">
        <button
          onClick={resetCircuit}
          className="flex items-center gap-2 px-3 py-2 w-full justify-center rounded-lg
                     bg-red-900/20 text-red-400 text-sm font-medium hover:bg-red-900/40
                     transition-colors border border-red-900/40"
        >
          <RotateCcw size={14} />
          Reset Circuit
        </button>
      </div>
    </div>
  );
}

function ToolButton({
  icon,
  label,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-2 py-3 rounded-lg bg-[#1e1b2e]
                  hover:bg-[#3d3a4e] transition-colors border border-[#4a4560]
                  hover:border-[#6b6580] ${color}`}
    >
      {icon}
      <span className="text-[10px] font-medium text-[#8b83a8]">{label}</span>
    </button>
  );
}
