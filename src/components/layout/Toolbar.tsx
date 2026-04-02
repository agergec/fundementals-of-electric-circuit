import { Lightbulb, Gauge, ToggleLeft, GitBranch, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCircuitStore } from '../../store/circuitStore';
import { MAX_VOLTAGE, MIN_VOLTAGE, PIXEL_TO_METERS, WIRE_MATERIALS } from '../../utils/constants';
import type { WireMaterial } from '../../utils/constants';

export function Toolbar() {
  const { t } = useTranslation();
  const {
    addComponent,
    addAmperemeterNear,
    addVoltmeterAcross,
    addParallelBranch,
    selectedComponentId,
    voltage,
    setVoltage,
    resetCircuit,
    wireEnabled,
    wireMaterial,
    wireDiameterMm,
    wireTotalLengthPx,
    wireResistance,
    setWireEnabled,
    setWireMaterial,
    setWireDiameterMm,
  } = useCircuitStore();

  const hasSelection = !!selectedComponentId;

  return (
    <div className="w-64 bg-[#2d2a3e] border-r border-[#4a4560] p-4 flex flex-col gap-4 overflow-y-auto">
      {/* Voltage Control */}
      <section>
        <h3 className="text-xs font-semibold text-[#8b83a8] uppercase tracking-wider mb-2">
          {t('toolbar.generatorVoltage')}
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
          {t('toolbar.addToCircuit')}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <ToolButton
            icon={<Lightbulb size={18} />}
            label={hasSelection ? t('toolbar.lampSeries') : t('toolbar.lamp')}
            color="text-yellow-400"
            onClick={() => addComponent('lamp', selectedComponentId ?? undefined)}
          />
          <ToolButton
            icon={<ToggleLeft size={18} />}
            label={t('toolbar.switch')}
            color="text-green-400"
            onClick={() => addComponent('switch', selectedComponentId ?? undefined)}
          />
        </div>
      </section>

      {/* Measurement Tools */}
      <section>
        <h3 className="text-xs font-semibold text-[#8b83a8] uppercase tracking-wider mb-2">
          {t('toolbar.measurementTools')}
        </h3>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              if (hasSelection) {
                addAmperemeterNear(selectedComponentId);
              } else {
                addComponent('ammeter');
              }
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1e1b2e] text-sm font-medium
                       text-red-400 hover:bg-red-900/20 transition-colors border border-[#4a4560]"
          >
            <Gauge size={16} />
            <div className="text-left">
              <div>{t('toolbar.addAmperemeter')}</div>
              <div className="text-[9px] text-[#6b6580]">
                {hasSelection ? t('toolbar.inSeriesWithSelected') : t('toolbar.atEndOfCircuit')}
              </div>
            </div>
          </button>

          <button
            onClick={() => {
              if (hasSelection) {
                addVoltmeterAcross(selectedComponentId);
              } else {
                addComponent('voltmeter');
              }
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1e1b2e] text-sm font-medium
                       text-blue-400 hover:bg-blue-900/20 transition-colors border border-[#4a4560]"
          >
            <span className="font-bold text-base">V</span>
            <div className="text-left">
              <div>{t('toolbar.addVoltmeter')}</div>
              <div className="text-[9px] text-[#6b6580]">
                {hasSelection ? t('toolbar.voltmeterAcross') : t('toolbar.voltmeterSeries')}
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* Circuit Actions */}
      <section>
        <h3 className="text-xs font-semibold text-[#8b83a8] uppercase tracking-wider mb-2">
          {t('toolbar.actions')}
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
            {t('toolbar.addParallelBranch')}
          </button>
          <p className="text-[10px] text-[#6b6580] px-1">
            {t('toolbar.parallelHint')}
          </p>
        </div>
      </section>

      {/* Wire Settings */}
      <section>
        <h3 className="text-xs font-semibold text-[#8b83a8] uppercase tracking-wider mb-2">
          {t('toolbar.wireSettings')}
        </h3>
        <div className="bg-[#1e1b2e] rounded-lg p-3 flex flex-col gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={wireEnabled}
              onChange={(e) => setWireEnabled(e.target.checked)}
              className="accent-purple-400 w-4 h-4"
            />
            <span className="text-xs text-[#8b83a8]">{t('toolbar.enableWire')}</span>
          </label>

          {wireEnabled && (
            <>
              {/* Material */}
              <div>
                <div className="text-[10px] text-[#6b6580] uppercase mb-1">{t('toolbar.material')}</div>
                <div className="flex gap-1">
                  {(Object.keys(WIRE_MATERIALS) as WireMaterial[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setWireMaterial(m)}
                      className={`flex-1 py-1.5 rounded text-xs font-bold transition-colors
                        ${wireMaterial === m
                          ? 'bg-purple-700 text-white'
                          : 'bg-[#2d2a3e] text-[#8b83a8] hover:bg-[#3d3a4e]'
                        }`}
                    >
                      {t(`toolbar.${m}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Diameter slider */}
              <div>
                <div className="flex justify-between text-[10px] text-[#6b6580] uppercase mb-1">
                  <span>{t('toolbar.diameter')}</span>
                  <span className="text-purple-300 font-bold">{wireDiameterMm} mm</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={10}
                  step={0.1}
                  value={wireDiameterMm}
                  onChange={(e) => setWireDiameterMm(parseFloat(e.target.value))}
                  className="w-full accent-purple-400 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#6b6580] mt-0.5">
                  <span>0.1 mm</span>
                  <span>10 mm</span>
                </div>
              </div>

              {/* Wire info */}
              <div className="flex flex-col gap-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-[#6b6580]">{t('toolbar.estLength')}</span>
                  <span className="text-purple-300 font-bold">{(wireTotalLengthPx * PIXEL_TO_METERS).toFixed(2)} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6b6580]">{t('toolbar.wireR')}</span>
                  <span className="text-purple-300 font-bold">{wireResistance.toFixed(4)} Ω</span>
                </div>
              </div>
            </>
          )}
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
          {t('toolbar.resetCircuit')}
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
