import { Lightbulb, ToggleLeft, RotateCcw, Zap, MousePointer2, Cable } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCircuitStore } from '../../store/circuitStore';
import { useFreeModeStore } from '../../store/freeModeStore';
import { useModeStore } from '../../store/modeStore';
import { MAX_VOLTAGE, MIN_VOLTAGE, PIXEL_TO_METERS, WIRE_MATERIALS } from '../../utils/constants';
import type { WireMaterial } from '../../utils/constants';



export function Toolbar() {
  const mode = useModeStore((s) => s.mode);
  if (mode === 'free') return <FreeModeToolbar />;
  return <StructuredToolbar />;
}

// ── Structured Mode Toolbar (unchanged) ──

function StructuredToolbar() {
  const { t } = useTranslation();
  const {
    circuit,
    voltage,
    addComponent,
    addAmperemeterNear,
    addVoltmeterAcross,
    addParallelBranch,
    addAmmeterParallelBranch,
    selectedComponentId,
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
  const { setMode } = useModeStore();
  const importToFree = useFreeModeStore((s) => s.importFromStructured);

  const handleImportToFree = () => {
    importToFree(circuit, voltage);
    setMode('free');
  };

  const hasSelection = !!selectedComponentId;

  return (
    <div className="w-60 bg-[#2d2a3e] border-r border-[#4a4560] p-3 flex flex-col gap-3 overflow-y-auto">
      <VoltageSection voltage={voltage} setVoltage={setVoltage} />

      {/* Component Palette */}
      <section>
        <Label>{t('toolbar.addToCircuit')}</Label>
        {hasSelection && (
          <div className="mb-2 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400">
            ↳ {t('toolbar.inSeriesWithSelected')}
          </div>
        )}
        <div className="grid grid-cols-2 gap-1.5">
          <ComponentChip
            icon={<Lightbulb size={16} />}
            label={t('toolbar.lamp')}
            color="yellow"
            onClick={() => addComponent('lamp', selectedComponentId ?? undefined)}
          />
          <ComponentChip
            icon={<ToggleLeft size={16} />}
            label={t('toolbar.switch')}
            color="green"
            onClick={() => addComponent('switch', selectedComponentId ?? undefined)}
          />
          <ComponentChip
            icon={<span className="font-black text-sm leading-none">A</span>}
            label={t('toolbar.addAmperemeter').replace(/^Ajouter un |^Add /, '')}
            color="red"
            badge={hasSelection ? 'en série' : undefined}
            onClick={() => {
              if (hasSelection) addAmperemeterNear(selectedComponentId);
              else addComponent('ammeter');
            }}
          />
          <ComponentChip
            icon={<span className="font-black text-sm leading-none">V</span>}
            label={t('toolbar.addVoltmeter').replace(/^Ajouter un |^Add /, '')}
            color="blue"
            badge={hasSelection ? 'parallèle' : 'en série'}
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
          <div className="grid grid-cols-2 gap-1.5">
            <ComponentChip icon={<Lightbulb size={18} />} label={t('toolbar.lamp')} color="purple" badge="parallèle"
              onClick={() => addParallelBranch(selectedComponentId)} />
            <ComponentChip icon={<span className="font-black text-lg leading-none">A</span>} label={t('info.amperemeter')} color="red" badge="parallèle"
              onClick={() => addAmmeterParallelBranch(selectedComponentId)} />
          </div>
        )}
      </section>

      <WireSettingsSection
        wireEnabled={wireEnabled} wireMaterial={wireMaterial} wireDiameterMm={wireDiameterMm}
        wireTotalLengthPx={wireTotalLengthPx} wireResistance={wireResistance}
        setWireEnabled={setWireEnabled} setWireMaterial={setWireMaterial} setWireDiameterMm={setWireDiameterMm}
      />

      <div className="mt-auto pt-1 flex flex-col gap-1">
        <button onClick={handleImportToFree}
          className="flex items-center gap-2 px-3 py-2 w-full justify-center rounded-xl
                     bg-purple-900/20 text-purple-400 text-xs font-semibold hover:bg-purple-900/40
                     transition-colors border border-purple-900/30">
          {t('toolbar.importToFree')}
        </button>
        <button onClick={resetCircuit}
          className="flex items-center gap-2 px-3 py-2 w-full justify-center rounded-xl
                     bg-red-900/20 text-red-500 text-xs font-semibold hover:bg-red-900/40
                     transition-colors border border-red-900/30">
          <RotateCcw size={12} />
          {t('toolbar.resetCircuit')}
        </button>
      </div>
    </div>
  );
}

// ── Free Mode Toolbar ──

function FreeModeToolbar() {
  const { t } = useTranslation();
  const {
    activeTool,
    setActiveTool,
    voltage,
    setVoltage,
    resetCircuit,
    saveCircuit,
    loadCircuit,
    wireEnabled,
    wireMaterial,
    wireDiameterMm,
    wireLineType,
    totalWireResistance,
    setWireEnabled,
    setWireMaterial,
    setWireDiameterMm,
    setWireLineType,
  } = useFreeModeStore();

  return (
    <div className="w-60 bg-[#2d2a3e] border-r border-[#4a4560] p-3 flex flex-col gap-3 overflow-y-auto">
      <VoltageSection voltage={voltage} setVoltage={setVoltage} />

      {/* Tools */}
      <section>
        <Label>{t('toolbar.tools')}</Label>
        <div className="grid grid-cols-2 gap-1.5">
          <ToolChip
            icon={<MousePointer2 size={16} />}
            label={t('freeMode.selectTool')}
            active={activeTool === 'select'}
            onClick={() => setActiveTool('select')}
          />
          <ToolChip
            icon={<Cable size={16} />}
            label={t('freeMode.wireTool')}
            active={activeTool === 'wire'}
            onClick={() => setActiveTool('wire')}
          />
        </div>
      </section>

      {/* Component palette */}
      <section>
        <Label>{t('toolbar.addToCircuit')}</Label>
        <div className="grid grid-cols-2 gap-1.5">
          <PlaceChip icon={<span className="font-black text-sm leading-none font-mono">G</span>} label={t('freeMode.placeGenerator')}
            active={activeTool === 'place-generator'} compType="generator"
            onClick={() => setActiveTool('place-generator')} />
          <PlaceChip icon={<Lightbulb size={16} />} label={t('toolbar.lamp')}
            active={activeTool === 'place-lamp'} compType="lamp"
            onClick={() => setActiveTool('place-lamp')} />
          <PlaceChip icon={<ToggleLeft size={16} />} label={t('toolbar.switch')}
            active={activeTool === 'place-switch'} compType="switch"
            onClick={() => setActiveTool('place-switch')} />
          <PlaceChip icon={<span className="font-black text-sm leading-none">A</span>} label={t('info.amperemeter')}
            active={activeTool === 'place-ammeter'} compType="ammeter"
            onClick={() => setActiveTool('place-ammeter')} />
          <PlaceChip icon={<span className="font-black text-sm leading-none">V</span>} label={t('info.voltmeter')}
            active={activeTool === 'place-voltmeter'} compType="voltmeter"
            onClick={() => setActiveTool('place-voltmeter')} />
          <PlaceChip icon={<span className="font-black text-xs leading-none">●</span>} label={t('freeMode.placeJunction')}
            active={activeTool === 'place-junction'} compType="junction"
            onClick={() => setActiveTool('place-junction')} />
        </div>
      </section>

      {/* Wire line type */}
      <section>
        <Label>{t('toolbar.wireStyle')}</Label>
        <div className="grid grid-cols-3 gap-1">
          {(['curved', 'straight', 'corner'] as const).map((lt) => (
            <button key={lt} onClick={() => setWireLineType(lt)}
              className={`py-1.5 rounded-lg text-[10px] font-bold transition-colors
                ${wireLineType === lt ? 'bg-purple-700 text-white' : 'bg-[#2d2a3e] text-[#8b83a8] hover:bg-[#3d3a4e]'}`}>
              {t(`toolbar.${lt}`)}
            </button>
          ))}
        </div>
      </section>

      <WireSettingsSection
        wireEnabled={wireEnabled} wireMaterial={wireMaterial} wireDiameterMm={wireDiameterMm}
        wireTotalLengthPx={0} wireResistance={totalWireResistance}
        setWireEnabled={setWireEnabled} setWireMaterial={setWireMaterial} setWireDiameterMm={setWireDiameterMm}
      />

      <div className="mt-auto pt-1 flex flex-col gap-1">
        <div className="grid grid-cols-2 gap-1">
          <button onClick={saveCircuit}
            className="flex items-center gap-1 px-2 py-1.5 justify-center rounded-lg
                       bg-green-900/20 text-green-400 text-[10px] font-semibold hover:bg-green-900/40
                       transition-colors border border-green-900/30">
            💾 {t('toolbar.save')}
          </button>
          <button onClick={() => { loadCircuit(); }}
            className="flex items-center gap-1 px-2 py-1.5 justify-center rounded-lg
                       bg-blue-900/20 text-blue-400 text-[10px] font-semibold hover:bg-blue-900/40
                       transition-colors border border-blue-900/30">
            📂 {t('toolbar.load')}
          </button>
        </div>
        <button onClick={resetCircuit}
          className="flex items-center gap-2 px-3 py-2 w-full justify-center rounded-xl
                     bg-red-900/20 text-red-500 text-xs font-semibold hover:bg-red-900/40
                     transition-colors border border-red-900/30">
          <RotateCcw size={12} />
          {t('toolbar.resetCircuit')}
        </button>
      </div>
    </div>
  );
}

// ── Shared sub-components ──

function VoltageSection({ voltage, setVoltage }: { voltage: number; setVoltage: (v: number) => void }) {
  const { t } = useTranslation();
  return (
    <section>
      <Label>{t('toolbar.generatorVoltage')}</Label>
      <div className="bg-[#1e1b2e] rounded-xl p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-amber-400 font-bold text-xl tracking-tight">{voltage.toFixed(1)} V</span>
          <Zap size={14} className="text-amber-400 opacity-60" />
        </div>
        <input type="range" min={MIN_VOLTAGE} max={MAX_VOLTAGE} step={0.5} value={voltage}
          onChange={(e) => setVoltage(parseFloat(e.target.value))}
          className="w-full accent-amber-400 cursor-pointer" />
        <div className="flex justify-between text-[10px] text-[#4a4560] mt-1">
          <span>0 V</span><span>24 V</span>
        </div>
      </div>
    </section>
  );
}

interface WireSettingsProps {
  wireEnabled: boolean;
  wireMaterial: WireMaterial;
  wireDiameterMm: number;
  wireTotalLengthPx: number;
  wireResistance: number;
  setWireEnabled: (e: boolean) => void;
  setWireMaterial: (m: WireMaterial) => void;
  setWireDiameterMm: (d: number) => void;
}

function WireSettingsSection({ wireEnabled, wireMaterial, wireDiameterMm, wireTotalLengthPx, wireResistance, setWireEnabled, setWireMaterial, setWireDiameterMm }: WireSettingsProps) {
  const { t } = useTranslation();
  return (
    <section>
      <Label>{t('toolbar.wireSettings')}</Label>
      <div className="bg-[#1e1b2e] rounded-xl p-3 flex flex-col gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={wireEnabled}
            onChange={(e) => setWireEnabled(e.target.checked)}
            className="accent-purple-400 w-4 h-4" />
          <span className="text-xs text-[#8b83a8]">{t('toolbar.enableWire')}</span>
        </label>
        {wireEnabled && (
          <>
            <div>
              <div className="text-[10px] text-[#6b6580] uppercase mb-1">{t('toolbar.material')}</div>
              <div className="grid grid-cols-2 gap-1">
                {(Object.keys(WIRE_MATERIALS) as WireMaterial[]).map((m) => (
                  <button key={m} onClick={() => setWireMaterial(m)}
                    className={`py-1.5 rounded-lg text-[10px] font-bold transition-colors
                      ${wireMaterial === m ? 'bg-purple-700 text-white' : 'bg-[#2d2a3e] text-[#8b83a8] hover:bg-[#3d3a4e]'}`}>
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
              <input type="range" min={0.1} max={10} step={0.1} value={wireDiameterMm}
                onChange={(e) => setWireDiameterMm(parseFloat(e.target.value))}
                className="w-full accent-purple-400 cursor-pointer" />
              <div className="flex justify-between text-[10px] text-[#4a4560] mt-0.5">
                <span>0.1 mm</span><span>10 mm</span>
              </div>
            </div>
            <div className="flex flex-col gap-1 text-[10px] bg-[#2d2a3e] rounded-lg p-2">
              {wireTotalLengthPx > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#6b6580]">{t('toolbar.estLength')}</span>
                  <span className="text-purple-300 font-bold">{(wireTotalLengthPx * PIXEL_TO_METERS).toFixed(2)} m</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#6b6580]">{t('toolbar.wireR')}</span>
                <span className="text-purple-300 font-bold">{wireResistance.toFixed(4)} Ω</span>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

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

function ComponentChip({ icon, label, color, badge, onClick }: {
  icon: React.ReactNode; label: string; color: keyof typeof chipColors; badge?: string; onClick: () => void;
}) {
  const c = chipColors[color];
  return (
    <button onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl
                  border transition-all active:scale-95 ${c.bg} ${c.text}`}>
      {badge && <span className={`absolute top-1.5 right-1.5 text-[8px] font-bold px-1 rounded ${c.badge}`}>{badge}</span>}
      <span className={c.text}>{icon}</span>
      <span className={`text-[10px] font-semibold leading-tight text-center ${c.text} opacity-90`}>{label}</span>
    </button>
  );
}

function ToolChip({ icon, label, active, onClick }: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl
                  border transition-all active:scale-95
                  ${active
                    ? 'bg-purple-500/30 border-purple-400 text-purple-200'
                    : 'bg-[#1e1b2e] border-[#4a4560] text-[#8b83a8] hover:bg-[#3d3a4e]'
                  }`}>
      <span>{icon}</span>
      <span className="text-[10px] font-semibold leading-tight text-center">{label}</span>
    </button>
  );
}

function PlaceChip({ icon, label, active, onClick, compType }: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void; compType: string;
}) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('component-type', compType);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <button onClick={onClick} draggable onDragStart={handleDragStart}
      className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl
                  border transition-all active:scale-95 cursor-grab
                  ${active
                    ? 'bg-amber-500/30 border-amber-400 text-amber-200'
                    : 'bg-[#1e1b2e] border-[#4a4560] text-[#8b83a8] hover:bg-[#3d3a4e]'
                  }`}>
      <span>{icon}</span>
      <span className="text-[10px] font-semibold leading-tight text-center">{label}</span>
    </button>
  );
}




