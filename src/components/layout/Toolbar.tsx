import { Lightbulb, ToggleLeft, GitBranch, RotateCcw, Zap } from 'lucide-react';
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
    addAmmeterParallelBranch,
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
    <div className="w-60 bg-[#2d2a3e] border-r border-[#4a4560] p-3 flex flex-col gap-3 overflow-y-auto">

      {/* Voltage Control */}
      <section>
        <Label>{t('toolbar.generatorVoltage')}</Label>
        <div className="bg-[#1e1b2e] rounded-xl p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-amber-400 font-bold text-xl tracking-tight">{voltage.toFixed(1)} V</span>
            <Zap size={14} className="text-amber-400 opacity-60" />
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
          <div className="flex justify-between text-[10px] text-[#4a4560] mt-1">
            <span>0 V</span>
            <span>24 V</span>
          </div>
        </div>
      </section>

      {/* Component Palette — unified grid */}
      <section>
        <Label>{t('toolbar.addToCircuit')}</Label>

        {/* Context hint */}
        {hasSelection && (
          <div className="mb-2 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400">
            ↳ {t('toolbar.inSeriesWithSelected')}
          </div>
        )}

        <div className="grid grid-cols-2 gap-1.5">
          {/* Lamp */}
          <ComponentChip
            icon={<Lightbulb size={16} />}
            label={t('toolbar.lamp')}
            color="yellow"
            onClick={() => addComponent('lamp', selectedComponentId ?? undefined)}
          />
          {/* Switch */}
          <ComponentChip
            icon={<ToggleLeft size={16} />}
            label={t('toolbar.switch')}
            color="green"
            onClick={() => addComponent('switch', selectedComponentId ?? undefined)}
          />
          {/* Amperemeter */}
          <ComponentChip
            icon={<span className="font-black text-sm leading-none">A</span>}
            label={t('toolbar.addAmperemeter').replace(/^Ajouter un |^Add /, '')}
            color="red"
            badge={hasSelection ? '→ série' : undefined}
            onClick={() => {
              if (hasSelection) addAmperemeterNear(selectedComponentId);
              else addComponent('ammeter');
            }}
          />
          {/* Voltmeter */}
          <ComponentChip
            icon={<span className="font-black text-sm leading-none">V</span>}
            label={t('toolbar.addVoltmeter').replace(/^Ajouter un |^Add /, '')}
            color="blue"
            badge={hasSelection ? '∥ para.' : '→ série'}
            onClick={() => {
              if (hasSelection) addVoltmeterAcross(selectedComponentId);
              else addComponent('voltmeter');
            }}
          />
        </div>
      </section>

      {/* Parallel branches */}
      <section>
        <Label>{t('toolbar.actions')}</Label>

        {!hasSelection ? (
          <p className="text-[10px] text-[#4a4560] text-center py-2 italic">
            {t('toolbar.parallelHint')}
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {/* Split button: Lamp branch | Ammeter branch */}
            <div className="flex gap-1.5">
              <ParallelBranchChip
                color="purple"
                label={t('toolbar.lamp')}
                icon={<Lightbulb size={12} />}
                onClick={() => addParallelBranch(selectedComponentId)}
              />
              <ParallelBranchChip
                color="red"
                label={t('toolbar.addAmperemeter').replace(/^Ajouter un |^Add /, '')}
                icon={<span className="font-black text-[11px] leading-none">A</span>}
                onClick={() => addAmmeterParallelBranch(selectedComponentId)}
              />
            </div>
            <p className="text-[10px] text-[#4a4560] text-center">
              + {t('toolbar.addParallelBranch').replace(/ \(.*\)$/, '')}
            </p>
          </div>
        )}
      </section>

      {/* Wire Settings */}
      <section>
        <Label>{t('toolbar.wireSettings')}</Label>
        <div className="bg-[#1e1b2e] rounded-xl p-3 flex flex-col gap-3">
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
              <div>
                <div className="text-[10px] text-[#6b6580] uppercase mb-1">{t('toolbar.material')}</div>
                <div className="grid grid-cols-2 gap-1">
                  {(Object.keys(WIRE_MATERIALS) as WireMaterial[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setWireMaterial(m)}
                      className={`py-1.5 rounded-lg text-[10px] font-bold transition-colors
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

              <div>
                <div className="flex justify-between text-[10px] text-[#6b6580] uppercase mb-1">
                  <span>{t('toolbar.diameter')}</span>
                  <span className="text-purple-300 font-bold">{wireDiameterMm.toFixed(1)} mm</span>
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
                <div className="flex justify-between text-[10px] text-[#4a4560] mt-0.5">
                  <span>0.1 mm</span>
                  <span>10 mm</span>
                </div>
              </div>

              <div className="flex flex-col gap-1 text-[10px] bg-[#2d2a3e] rounded-lg p-2">
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
      <div className="mt-auto pt-1">
        <button
          onClick={resetCircuit}
          className="flex items-center gap-2 px-3 py-2 w-full justify-center rounded-xl
                     bg-red-900/20 text-red-500 text-xs font-semibold hover:bg-red-900/40
                     transition-colors border border-red-900/30"
        >
          <RotateCcw size={12} />
          {t('toolbar.resetCircuit')}
        </button>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-semibold text-[#6b6580] uppercase tracking-widest mb-2">
      {children}
    </h3>
  );
}

const chipColors = {
  yellow: { bg: 'bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/40', text: 'text-yellow-300', badge: 'bg-yellow-500/30 text-yellow-200' },
  green:  { bg: 'bg-green-500/20 hover:bg-green-500/30 border-green-500/40',   text: 'text-green-300',  badge: 'bg-green-500/30 text-green-200' },
  red:    { bg: 'bg-red-500/20 hover:bg-red-500/30 border-red-500/40',         text: 'text-red-300',    badge: 'bg-red-500/30 text-red-200' },
  blue:   { bg: 'bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/40',      text: 'text-blue-300',   badge: 'bg-blue-500/30 text-blue-200' },
  purple: { bg: 'bg-purple-500/20 hover:bg-purple-500/30 border-purple-500/40',text: 'text-purple-300', badge: 'bg-purple-500/30 text-purple-200' },
} as const;

function ComponentChip({
  icon, label, color, badge, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  color: keyof typeof chipColors;
  badge?: string;
  onClick: () => void;
}) {
  const c = chipColors[color];
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl
                  border transition-all active:scale-95 ${c.bg} ${c.text}`}
    >
      {badge && (
        <span className={`absolute top-1.5 right-1.5 text-[8px] font-bold px-1 rounded ${c.badge}`}>
          {badge}
        </span>
      )}
      <span className={c.text}>{icon}</span>
      <span className={`text-[10px] font-semibold leading-tight text-center ${c.text} opacity-90`}>{label}</span>
    </button>
  );
}

function ParallelBranchChip({
  icon, label, color, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  color: keyof typeof chipColors;
  onClick: () => void;
}) {
  const c = chipColors[color];
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border
                  transition-all active:scale-95 ${c.bg} ${c.text}`}
    >
      <div className="flex items-center gap-1">
        <GitBranch size={12} className="opacity-70" />
        <span>{icon}</span>
      </div>
      <span className={`text-[9px] font-semibold leading-tight text-center ${c.text} opacity-90`}>{label}</span>
    </button>
  );
}
