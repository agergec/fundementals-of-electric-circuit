import { X, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCircuitStore } from '../../store/circuitStore';
import { useFreeModeStore } from '../../store/freeModeStore';
import { useModeStore } from '../../store/modeStore';
import { BASE_RESISTANCE, RESISTANCE_OPTIONS, WIRE_MATERIALS } from '../../utils/constants';
import type { WireMaterial } from '../../utils/constants';
import { formatVoltage, formatCurrent, formatResistance } from '../../utils/formatters';
import type { CircuitNode, ComponentNode } from '../../engine/types';

function findComponentById(node: CircuitNode, id: string): ComponentNode | null {
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
  const mode = useModeStore((s) => s.mode);

  if (mode === 'structured') {
    return <StructuredInfoPanel />;
  }
  return <FreeModeInfoPanel />;
}

function StructuredInfoPanel() {
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

  const values = calculatedValues[selectedComponentId];

  return (
    <InfoPanelContent
      componentType={component.componentType}
      componentId={selectedComponentId}
      resistanceMultiplier={component.resistanceMultiplier}
      closed={component.closed}
      values={values}
      onClose={() => selectComponent(null)}
      onRemove={() => { removeComponent(selectedComponentId); selectComponent(null); }}
      onToggleSwitch={() => toggleSwitch(selectedComponentId)}
      onSetResistance={(m) => setLampResistance(selectedComponentId, m)}
    />
  );
}

function FreeModeInfoPanel() {
  const { t } = useTranslation();
  const {
    selectedComponentId,
    selectComponent,
    selectWire,
    components,
    wires,
    calculatedValues,
    removeComponent,
    removeWire,
    toggleSwitch,
    setLampMultiplier,
    rotateComponent,
    setRotateText,
    setGeneratorVoltage,
    setFuseRating,
    resetFuse,
    setWireLineTypeById,
    setWireMaterialById,
    setWireDiameterMmById,
    selectedWireId,
  } = useFreeModeStore();

  // Wire selected?
  if (selectedWireId) {
    const wire = wires.find((w) => w.id === selectedWireId);
    if (!wire) return null;
    // Find connected components
    const [fCid] = wire.fromTerminal.split(':');
    const [tCid] = wire.toTerminal.split(':');
    const fc = components.find((c) => c.id === fCid);
    const tc = components.find((c) => c.id === tCid);

    return (
      <div className="absolute bottom-4 right-4 w-72 bg-[#2d2a3e] rounded-xl border border-[#4a4560] shadow-2xl p-4 z-10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-purple-400">{t('info.wire')}</h3>
          <button onClick={() => selectWire(null)} className="text-[#6b6580] hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="bg-[#1e1b2e] rounded-lg p-2 mb-3 text-xs text-[#8b83a8]">
          <p>{fc?.componentType} ↔ {tc?.componentType}</p>

          {/* Material dropdown */}
          <div className="mt-2 flex items-center gap-2">
            <label className="text-[10px] text-[#6b6580] uppercase w-14 shrink-0">{t('toolbar.material')}</label>
            <select
              value={wire.material}
              onChange={(e) => setWireMaterialById(selectedWireId, e.target.value as WireMaterial)}
              className="flex-1 bg-[#2d2a3e] text-purple-300 text-[11px] rounded px-2 py-1 border border-[#4a4560]
                         focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
            >
              {(Object.keys(WIRE_MATERIALS) as WireMaterial[]).map((mat) => (
                <option key={mat} value={mat}>{t(`toolbar.${mat}`)}</option>
              ))}
            </select>
          </div>

          {/* Diameter selector */}
          <div className="mt-2 flex items-center gap-2">
            <label className="text-[10px] text-[#6b6580] uppercase w-14 shrink-0">{t('toolbar.diameter')}</label>
            <select
              value={wire.diameterMm}
              onChange={(e) => setWireDiameterMmById(selectedWireId, Number(e.target.value))}
              className="flex-1 bg-[#2d2a3e] text-purple-300 text-[11px] rounded px-2 py-1 border border-[#4a4560]
                         focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
            >
              {[0.5, 0.8, 1.0, 1.5, 2.0, 2.5].map((d) => (
                <option key={d} value={d}>{d.toFixed(1)} mm</option>
              ))}
            </select>
          </div>

          <div className="mt-2">
            <div className="text-[10px] text-[#6b6580] uppercase mb-1">{t('toolbar.wireStyle')}</div>
            <div className="grid grid-cols-3 gap-1">
              {(['curved', 'straight', 'corner'] as const).map((lt) => (
                <button key={lt} onClick={() => setWireLineTypeById(selectedWireId, lt)}
                  className={`py-1 rounded text-[10px] font-bold transition-colors
                    ${wire.lineType === lt ? 'bg-purple-700 text-white' : 'bg-[#2d2a3e] text-[#8b83a8] hover:bg-[#3d3a4e]'}`}>
                  {t(`toolbar.${lt}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={() => { removeWire(selectedWireId); selectWire(null); }}
          className="flex items-center gap-2 w-full justify-center px-3 py-2 rounded-lg
                     bg-red-900/20 text-red-400 text-sm font-medium hover:bg-red-900/40
                     transition-colors border border-red-900/40"
        >
          <Trash2 size={14} />
          {t('info.removeWire')}
        </button>
      </div>
    );
  }

  // Component selected?
  if (!selectedComponentId) return null;
  const comp = components.find((c) => c.id === selectedComponentId);
  if (!comp) return null;

  const values = calculatedValues[selectedComponentId];

  return (
    <InfoPanelContent
      componentType={comp.componentType}
      componentId={selectedComponentId}
      resistanceMultiplier={comp.resistanceMultiplier}
      closed={comp.closed}
      values={values}
      onClose={() => selectComponent(null)}
      onRemove={() => { removeComponent(selectedComponentId); selectComponent(null); }}
      onToggleSwitch={() => toggleSwitch(selectedComponentId)}
      onSetResistance={(m) => setLampMultiplier(selectedComponentId, m)}
      onRotate={(dir) => rotateComponent(selectedComponentId, dir)}
      rotation={comp.rotation}
      rotateText={comp.rotateText}
      onToggleRotateText={() => setRotateText(selectedComponentId, !comp.rotateText)}
      onSetFuseRating={(r) => setFuseRating(selectedComponentId, r)}
      onResetFuse={() => resetFuse(selectedComponentId)}
      fuseRating={comp.currentRating}
      fuseBlown={comp.blown}
      onSetGeneratorVoltage={comp.componentType === 'generator' ? (v) => setGeneratorVoltage(selectedComponentId, v) : undefined}
      generatorVoltage={comp.voltage}
    />
  );
}

// ── Shared UI ──

interface InfoPanelContentProps {
  componentType: string;
  componentId: string;
  resistanceMultiplier: number;
  closed?: boolean;
  rotation?: number;
  values?: { voltage: number; current: number; resistance: number };
  onClose: () => void;
  onRemove: () => void;
  onToggleSwitch: () => void;
  onSetResistance: (multiplier: number) => void;
  onRotate?: (dir: number) => void;
  rotateText?: boolean;
  onToggleRotateText?: () => void;
  onSetFuseRating?: (r: number) => void;
  onResetFuse?: () => void;
  fuseRating?: number;
  fuseBlown?: boolean;
  onSetGeneratorVoltage?: (v: number) => void;
  generatorVoltage?: number;
}

function InfoPanelContent({
  componentType,
  resistanceMultiplier,
  closed,
  values,
  onClose,
  onRemove,
  onToggleSwitch,
  onSetResistance,
  onRotate,
  rotateText,
  onToggleRotateText,
  onSetFuseRating,
  onResetFuse,
  fuseRating,
  fuseBlown,
  onSetGeneratorVoltage,
  generatorVoltage,
}: InfoPanelContentProps) {
  const { t } = useTranslation();

  const typeColors: Record<string, string> = {
    lamp: 'text-yellow-400',
    ammeter: 'text-red-400',
    voltmeter: 'text-blue-400',
    switch: 'text-green-400',
    generator: 'text-amber-400',
  };

  return (
    <div className="absolute bottom-4 right-4 w-72 bg-[#2d2a3e] rounded-xl border border-[#4a4560] shadow-2xl p-4 z-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-bold ${typeColors[componentType] ?? 'text-white'}`}>
          {t(`info.${componentType}`)}
        </h3>
        <button onClick={onClose} className="text-[#6b6580] hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Generator voltage slider */}
      {componentType === 'generator' && onSetGeneratorVoltage && (
        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-[#6b6580] uppercase mb-1">
            <span>{t('info.voltage')}</span>
            <span className="text-amber-400 font-bold">{(generatorVoltage ?? 12).toFixed(1)} V</span>
          </div>
          <input type="range" min={0} max={24} step={0.5}
            value={generatorVoltage ?? 12}
            onChange={(e) => onSetGeneratorVoltage(Number(e.target.value))}
            className="w-full accent-amber-400 cursor-pointer" />
        </div>
      )}

      {/* Values */}
      {values && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-[#1e1b2e] rounded-lg p-2 text-center">
            <div className="text-[10px] text-[#6b6580] uppercase">{t('info.voltage')}</div>
            <div className="text-blue-400 font-bold text-sm">{formatVoltage(values.voltage)}</div>
          </div>
          <div className="bg-[#1e1b2e] rounded-lg p-2 text-center">
            <div className="text-[10px] text-[#6b6580] uppercase">{t('info.current')}</div>
            <div className="text-red-400 font-bold text-sm">{formatCurrent(values.current)}</div>
          </div>
          <div className="bg-[#1e1b2e] rounded-lg p-2 text-center">
            <div className="text-[10px] text-[#6b6580] uppercase">{t('info.resistance')}</div>
            <div className="text-green-400 font-bold text-sm">{formatResistance(values.resistance)}</div>
          </div>
        </div>
      )}

      {/* Lamp: preset buttons */}
      {componentType === 'lamp' && (
        <div className="mb-3">
          <div className="text-[10px] text-[#6b6580] uppercase mb-2">{t('info.resistance')}</div>
          <div className="flex flex-wrap gap-1">
            {RESISTANCE_OPTIONS.map((opt) => (
              <button key={opt.label} onClick={() => onSetResistance(opt.multiplier)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors
                  ${resistanceMultiplier === opt.multiplier ? 'bg-green-600 text-white' : 'bg-[#1e1b2e] text-[#8b83a8] hover:bg-[#3d3a4e]'}`}>
                {opt.label}
                <span className="text-[9px] ml-1 opacity-60">({(BASE_RESISTANCE * opt.multiplier).toFixed(1)}Ω)</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Resistor: slider */}
      {componentType === 'resistor' && (
        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-[#6b6580] uppercase mb-1">
            <span>{t('info.resistance')}</span>
            <span className="text-green-400 font-bold">{Math.round(BASE_RESISTANCE * resistanceMultiplier)} Ω</span>
          </div>
          <input type="range" min={1} max={50} step={1}
            value={Math.round(BASE_RESISTANCE * resistanceMultiplier)}
            onChange={(e) => onSetResistance(Number(e.target.value) / BASE_RESISTANCE)}
            className="w-full accent-green-400 cursor-pointer" />
          <div className="flex justify-between text-[10px] text-[#4a4560] mt-0.5">
            <span>1 Ω</span><span>50 Ω</span>
          </div>
        </div>
      )}

      {/* Fuse controls */}
      {componentType === 'fuse' && (
        <div className="mb-3">
          <div className="text-[10px] text-[#6b6580] uppercase mb-2">{t('info.fuseRating')}</div>
          <div className="flex flex-wrap gap-1 mb-2">
            {[0.5, 1, 2, 3, 5].map((r) => (
              <button key={r} onClick={() => onSetFuseRating?.(r)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors
                  ${fuseRating === r ? 'bg-amber-600 text-white' : 'bg-[#1e1b2e] text-[#8b83a8] hover:bg-[#3d3a4e]'}`}>
                {r}A
              </button>
            ))}
          </div>
          {fuseBlown && (
            <button onClick={onResetFuse}
              className="w-full px-3 py-2 rounded-lg text-sm font-bold transition-colors border
                         bg-green-900/30 text-green-400 border-green-700 hover:bg-green-900/50">
              {t('info.resetFuse')}
            </button>
          )}
        </div>
      )}

      {/* Switch toggle */}
      {componentType === 'switch' && (
        <div className="mb-3">
          <button
            onClick={onToggleSwitch}
            className={`w-full px-3 py-2 rounded-lg text-sm font-bold transition-colors border
              ${closed
                ? 'bg-green-900/30 text-green-400 border-green-700 hover:bg-green-900/50'
                : 'bg-red-900/30 text-red-400 border-red-700 hover:bg-red-900/50'
              }`}
          >
            {closed ? t('info.switchOn') : t('info.switchOff')}
          </button>
        </div>
      )}

      {/* Rotate buttons */}
      {onRotate && (
        <div className="mb-3">
          <div className="text-[10px] text-[#6b6580] uppercase mb-1">{t('info.rotate')}</div>
          <div className="grid grid-cols-2 gap-1 mb-2">
            <button onClick={() => onRotate(-90)}
              className="px-3 py-1.5 rounded-md text-xs font-bold transition-colors
                         bg-[#1e1b2e] text-[#8b83a8] border border-[#4a4560] hover:bg-[#3d3a4e]">
              ↺ -90°
            </button>
            <button onClick={() => onRotate(90)}
              className="px-3 py-1.5 rounded-md text-xs font-bold transition-colors
                         bg-[#1e1b2e] text-[#8b83a8] border border-[#4a4560] hover:bg-[#3d3a4e]">
              ↻ +90°
            </button>
          </div>
          {onToggleRotateText && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={rotateText ?? false}
                onChange={() => onToggleRotateText()}
                className="accent-purple-400 w-3.5 h-3.5" />
              <span className="text-[10px] text-[#8b83a8]">{t('info.rotateText')}</span>
            </label>
          )}
        </div>
      )}

      {/* Delete button */}
      <button
        onClick={onRemove}
        className="flex items-center gap-2 w-full justify-center px-3 py-2 rounded-lg
                   bg-red-900/20 text-red-400 text-sm font-medium hover:bg-red-900/40
                   transition-colors border border-red-900/40"
      >
        <Trash2 size={14} />
        {t('info.remove')}
      </button>
    </div>
  );
}
