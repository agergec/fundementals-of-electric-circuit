import { useRef, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useFreeModeStore, getTerminalPos } from '../../store/freeModeStore';
import { FreeComponent } from './FreeComponent';
import { FreeWire } from './FreeWire';
import { WireDrawingLayer } from './WireDrawingLayer';
import { BreadboardGrid } from './BreadboardGrid';
import { ChallengePanel } from './ChallengePanel';
import { PIXEL_TO_METERS } from '../../utils/constants';
import type { FreeComponent as FreeComponentT } from '../../engine/types';

const SNAP = 40;



function snap(v: number): number {
  return Math.round(v / SNAP) * SNAP;
}

/** Convert screen coords to canvas coords */
function toCanvas(
  clientX: number, clientY: number,
  rect: DOMRect, view: { x: number; y: number; scale: number },
) {
  return {
    x: (clientX - rect.left - view.x) / view.scale,
    y: (clientY - rect.top - view.y) / view.scale,
  };
}

/** Find the closest terminal to canvas point (within threshold) */
function findClosestTerminal(
  cx: number, cy: number,
  components: FreeComponentT[],
  threshold = 18,
): { compId: string; index: 0 | 1 } | null {
  let best: { compId: string; index: 0 | 1 } | null = null;
  let bestDist = threshold;
  for (const c of components) {
    for (const idx of [0, 1] as const) {
      const p = getTerminalPos(c.id, idx, components);
      if (!p) continue;
      const d = Math.sqrt((cx - p.x) ** 2 + (cy - p.y) ** 2);
      if (d < bestDist) {
        bestDist = d;
        best = { compId: c.id, index: idx };
      }
    }
  }
  return best;
}

export function FreeCanvas() {
  const { t } = useTranslation();
  const {
    components,
    wires,
    activeTool,
    selectedComponentId,
    selectedWireId,
    voltage,
    wireEnabled,
    wireMaterial,
    wireDiameterMm,
    wireLineType,
    calculatedValues,
    totalResistance,
    totalCurrent,
    wireResistances,
    totalWireResistance,
    terminalPolarities,
    solverErrorKey,
    validationIssues,
    errorIds,
    pendingWire,
    placeComponent,
    removeComponent,
    moveComponent,
    addWire,
    removeWire,
    setActiveTool,
    selectComponent,
    selectWire,
    setWireCorners,
    rewireEndpoint,
    toggleSwitch,
    startWire,
    updateWirePreview,
    cancelWire,
    undo,
    redo,
    pushHistory,
    breadboard,
  } = useFreeModeStore();

  const isFlowing = totalCurrent > 0.0001;
  const isWiring = !!pendingWire;

  // ── Pan / Zoom ──
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState({ x: 40, y: 40, scale: 1 });

  // Pan drag
  const panDrag = useRef<{ startX: number; startY: number; panX: number; panY: number; moved: boolean } | null>(null);
  // Component drag
  const compDrag = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);
  // Endpoint drag for rewiring
  const endpointDrag = useRef<{ wireId: string; end: 'from' | 'to' } | null>(null);
  // Terminal hover highlight
  const [highlightComp, setHighlightComp] = useState<{ compId: string; index: 0 | 1 } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fitToView = useCallback(() => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const cw = rect.width || 700;
    const ch = rect.height || 500;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of components) {
      minX = Math.min(minX, c.x - 100);
      minY = Math.min(minY, c.y - 100);
      maxX = Math.max(maxX, c.x + 100);
      maxY = Math.max(maxY, c.y + 100);
    }
    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 800; maxY = 400; }
    const contentW = maxX - minX + 120;
    const contentH = maxY - minY + 120;
    const pad = 60;
    const scaleX = (cw - pad * 2) / contentW;
    const scaleY = (ch - pad * 2) / contentH;
    const newScale = Math.min(scaleX, scaleY, 1.4);
    setView({
      x: (cw - contentW * newScale) / 2 - minX * newScale + pad,
      y: (ch - contentH * newScale) / 2 - minY * newScale + pad,
      scale: newScale,
    });
  }, [components]);

  // Wheel zoom
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) {
        const rect = el.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const factor = e.deltaY < 0 ? 1.08 : 0.92;
        setView(v => {
          const newScale = Math.max(0.15, Math.min(5, v.scale * factor));
          const ratio = newScale / v.scale;
          return { x: cx - (cx - v.x) * ratio, y: cy - (cy - v.y) * ratio, scale: newScale };
        });
      } else {
        setView(v => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ── Mouse handlers ──

  const onSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    // Only start pan on background clicks (not on components or terminals)
    const target = e.target as Element;
    if (target.closest('g[data-comp]') || target.closest('g[data-term]')) return;
    panDrag.current = { startX: e.clientX, startY: e.clientY, panX: view.x, panY: view.y, moved: false };
  };

  const onSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;

    // Pan
    const pd = panDrag.current;
    if (pd) {
      const dx = e.clientX - pd.startX;
      const dy = e.clientY - pd.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) { pd.moved = true; setIsDragging(true); }
      if (pd.moved) setView(v => ({ ...v, x: pd.panX + dx, y: pd.panY + dy }));
    }

    // Component drag
    const cd = compDrag.current;
    if (cd) {
      const dx = (e.clientX - cd.startX) / view.scale;
      const dy = (e.clientY - cd.startY) / view.scale;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) { cd.moved = true; setIsDragging(true); }
      if (cd.moved) {
        moveComponent(cd.id, cd.origX + dx, cd.origY + dy);
      }
    }

    // Wire preview + terminal highlight
    if (pendingWire) {
      const rect = svg.getBoundingClientRect();
      const c = toCanvas(e.clientX, e.clientY, rect, view);
      updateWirePreview(c.x, c.y);
      // Highlight nearest terminal
      const nearest = findClosestTerminal(c.x, c.y, components);
      setHighlightComp(nearest);
    } else {
      setHighlightComp(null);
    }
  };

  const onSvgMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
    // Complete endpoint rewiring
    if (endpointDrag.current) {
      const svg = svgRef.current;
      if (svg) {
        const rect = svg.getBoundingClientRect();
        const c = toCanvas(e.clientX, e.clientY, rect, view);
        const nearest = findClosestTerminal(c.x, c.y, components, 24);
        if (nearest) {
          const tid = `${nearest.compId}:${nearest.index}`;
          rewireEndpoint(endpointDrag.current.wireId, endpointDrag.current.end, tid);
        }
      }
      endpointDrag.current = null;
      return;
    }

    // Complete wire if drawing
    if (pendingWire) {
      const svg = svgRef.current;
      if (svg) {
        const rect = svg.getBoundingClientRect();
        const c = toCanvas(e.clientX, e.clientY, rect, view);
        const nearest = findClosestTerminal(c.x, c.y, components, 20);
        if (nearest) {
          const tid = `${nearest.compId}:${nearest.index}`;
          if (tid !== pendingWire.fromTerminal) {
            addWire(pendingWire.fromTerminal, tid);
          }
        }
      }
      cancelWire();
    }

    const cd = compDrag.current;
    if (cd?.moved) {
      const comp = components.find(c => c.id === cd.id);
      if (comp) moveComponent(cd.id, snap(comp.x), snap(comp.y));
    }
    compDrag.current = null;
    panDrag.current = null;
    setIsDragging(false);
    setHighlightComp(null);
  };

  // ── Canvas click ──
  const onCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (panDrag.current?.moved || compDrag.current?.moved) return;
    if (e.target !== svgRef.current && !(e.target as Element).classList.contains('canvas-bg')) return;

    if (activeTool === 'select') {
      selectComponent(null);
      selectWire(null);
    }
  };

  // ── Component interaction ──

  const handleComponentMouseDown = (id: string, e: React.MouseEvent) => {
    if (activeTool === 'wire') return;
    pushHistory(); // snapshot before drag
    const comp = components.find(c => c.id === id);
    if (!comp) return;
    compDrag.current = { id, startX: e.clientX, startY: e.clientY, origX: comp.x, origY: comp.y, moved: false };
    selectComponent(id);
  };

  const handleComponentClick = (id: string) => {
    if (activeTool === 'wire') return;
    if (activeTool.startsWith('place-')) return;
    if (compDrag.current?.moved) return;
    selectComponent(id);
  };

  const handleComponentDoubleClick = (id: string) => {
    toggleSwitch(id);
  };

  // ── Terminal interaction ──

  const handleTerminalClick = (compId: string, index: 0 | 1, e: React.MouseEvent) => {
    e.stopPropagation();
    if (pendingWire) {
      const tid = `${compId}:${index}`;
      if (pendingWire.fromTerminal !== tid) {
        addWire(pendingWire.fromTerminal, tid);
      }
      cancelWire();
    }
    setHighlightComp(null);
  };

  const handleTerminalMouseDown = (compId: string, index: 0 | 1, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (pendingWire) return;
    const tid = `${compId}:${index}`;
    const pos = getTerminalPos(compId, index, components);
    startWire(tid, pos?.x ?? 0, pos?.y ?? 0);
  };

  // ── Endpoint drag (rewire) ──

  const handleEndpointDrag = (wireId: string, end: 'from' | 'to', e: React.MouseEvent) => {
    e.stopPropagation();
    endpointDrag.current = { wireId, end };
  };

  // ── Wire interaction ──

  const handleWireClick = (id: string) => {
    if (activeTool === 'select') selectWire(id);
  };

  // ── Drag from toolbar ──

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const compType = e.dataTransfer.getData('component-type') as FreeComponentT['componentType'];
    if (!compType) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const c = toCanvas(e.clientX, e.clientY, rect, view);
    placeComponent(compType, snap(c.x), snap(c.y));
  };

  // ── Keyboard shortcuts ──

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelWire();
        setActiveTool('select');
        compDrag.current = null;
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !e.metaKey && !e.ctrlKey) {
        if (selectedComponentId) removeComponent(selectedComponentId);
        if (selectedWireId) removeWire(selectedWireId);
      } else if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === 'z' && (e.metaKey || e.ctrlKey) && e.shiftKey) || (e.key === 'y' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancelWire, setActiveTool, selectedComponentId, selectedWireId, removeComponent, removeWire, undo, redo]);

  // ── Highlight terminal for each component ──

  function getHighlightFor(compId: string): 0 | 1 | null {
    if (highlightComp?.compId === compId) return highlightComp.index;
    // Also highlight the source terminal during wire drawing
    if (pendingWire) {
      const [srcId, srcIdx] = pendingWire.fromTerminal.split(':');
      if (srcId === compId) return Number(srcIdx) as 0 | 1;
    }
    return null;
  }

  // ── Wire info ──

  const totalWirePx = wires.reduce((sum, w) => {
    const [fId, fIdx] = w.fromTerminal.split(':');
    const [tId, tIdx] = w.toTerminal.split(':');
    const from = getTerminalPos(fId, Number(fIdx) as 0 | 1, components);
    const to = getTerminalPos(tId, Number(tIdx) as 0 | 1, components);
    if (!from || !to) return sum;
    return sum + Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2);
  }, 0);

  const wireStrokeWidth = wireEnabled ? 1 + ((wireDiameterMm - 0.1) / 9.9) * 9 : 2.5;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ChallengePanel />

      {/* Tool indicator */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-1.5 bg-[#2d2a3e] border-b border-[#4a4560]">
        <span className="text-[10px] font-semibold text-[#6b6580] uppercase tracking-wider">
          {t('freeMode.tool')}:
        </span>
        <span className={`text-xs font-bold ${
          activeTool === 'select' ? 'text-white' : activeTool === 'wire' ? 'text-purple-400' : 'text-amber-400'
        }`}>
          {activeTool === 'select' ? t('freeMode.selectTool') :
           activeTool === 'wire' ? t('freeMode.wireTool') :
           activeTool === 'place-generator' ? t('freeMode.placeGenerator') :
           activeTool === 'place-lamp' ? t('freeMode.placeLamp') :
           activeTool === 'place-switch' ? t('freeMode.placeSwitch') :
           activeTool === 'place-ammeter' ? t('freeMode.placeAmmeter') :
           activeTool === 'place-voltmeter' ? t('freeMode.placeVoltmeter') :
           activeTool === 'place-resistor' ? t('freeMode.placeResistor') :
          activeTool === 'place-fuse' ? t('freeMode.placeFuse') :
          activeTool === 'place-junction' ? t('freeMode.placeJunction') : ''}
        </span>
        {activeTool === 'wire' && <span className="text-[10px] text-[#8b83a8]">— {t('freeMode.clickTerminal')}</span>}
        {activeTool.startsWith('place-') && <span className="text-[10px] text-[#8b83a8]">— {t('freeMode.clickToPlace')}</span>}
        {components.filter(c => c.componentType === 'generator').length > 1 && (
          <span className="text-[10px] text-purple-400 font-bold ml-2">MNA</span>
        )}
        <span className="text-[10px] text-[#4a4560] ml-auto">{t('freeMode.pressEsc')}</span>
      </div>

      {/* Validation issue banners */}
      {validationIssues.length > 0 && (
        <div className="flex flex-col gap-1 px-4 pt-3 shrink-0">
          {validationIssues.map((issue, i) => {
            const colors = issue.level === 'error'
              ? 'bg-red-950/60 border-red-500 text-red-400'
              : issue.level === 'warning'
              ? 'bg-amber-950/60 border-amber-500 text-amber-400'
              : 'bg-blue-950/60 border-blue-500 text-blue-400';
            const icon = issue.level === 'error' ? '⚡' : issue.level === 'warning' ? '⚠' : 'ℹ';
            return (
              <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs ${colors}`}>
                <span className="shrink-0 font-bold">{icon}</span>
                <div>
                  <span className="font-bold">{t(issue.key)}: </span>
                  <span className="text-[#9ca3af]">{t(issue.detailKey)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Solver error banner */}
      {solverErrorKey && !validationIssues.length && (
        <div className="shrink-0 mx-4 mt-2 rounded-lg border border-red-500 bg-red-950/60 px-3 py-2 text-xs text-red-400">
          {t(solverErrorKey)}
        </div>
      )}

      {/* Wire resistance info panel */}
      {wireEnabled && totalWireResistance > 0 && (
        <div className="shrink-0 mx-4 mt-2 rounded-xl border border-purple-500/30 bg-purple-950/30 px-4 py-3 text-xs">
          <div className="flex items-start gap-3">
            <span className="text-purple-400 text-base mt-0.5 shrink-0">⚗</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-purple-300 mb-1">{t('circuit.wireInfoTitle')}</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span className="text-[#8b83a8]">{t('circuit.wireInfoMaterial')}: <span className="text-purple-300 font-semibold">{t(`toolbar.${wireMaterial}`)}</span></span>
                <span className="text-[#8b83a8]">{t('circuit.wireInfoDiameter')}: <span className="text-purple-300 font-semibold">{wireDiameterMm.toFixed(1)} mm</span></span>
                <span className="text-[#8b83a8]">{t('circuit.wireInfoLength')}: <span className="text-purple-300 font-semibold">{(totalWirePx * PIXEL_TO_METERS * 100).toFixed(0)} cm</span></span>
                <span className="text-[#8b83a8]">{t('circuit.wireInfoR')}: <span className="text-purple-300 font-semibold">{totalWireResistance.toFixed(4)} Ω</span></span>
                {totalCurrent > 0 && (
                  <span className="text-[#8b83a8]">{t('circuit.wireInfoVoltageDrop')}: <span className="text-amber-400 font-semibold">{(totalWireResistance * totalCurrent).toFixed(3)} V</span></span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SVG Canvas */}
      <div className="flex-1 relative overflow-hidden"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <svg
          ref={svgRef}
          width="100%" height="100%"
          style={{ cursor: isWiring ? 'crosshair' : isDragging ? 'grabbing' : 'grab', display: 'block' }}
          onMouseDown={onSvgMouseDown}
          onMouseMove={onSvgMouseMove}
          onMouseUp={onSvgMouseUp}
          onMouseLeave={onSvgMouseUp}
          onClick={onCanvasClick}
        >
          <defs>
            <filter id="lampGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
            </filter>
            {/* Terminal glow */}
            <filter id="termGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
            </filter>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(139,131,168,0.08)" strokeWidth="0.5" />
            </pattern>
          </defs>

          <rect className="canvas-bg" width="100%" height="100%" fill="url(#grid)" />

          <g transform={`translate(${view.x}, ${view.y}) scale(${view.scale})`}>
            {breadboard && <BreadboardGrid />}
            {/* Wires */}
            {wires.map((w) => (
              <FreeWire
                key={w.id}
                wireId={w.id}
                fromTerminal={w.fromTerminal}
                toTerminal={w.toTerminal}
                components={components}
                current={totalCurrent}
                isSelected={selectedWireId === w.id}
                strokeWidth={wireStrokeWidth}
                wireResistance={wireResistances[w.id]}
                lineType={w.lineType || 'straight'}
                corner1X={w.corner1X}
                corner1Y={w.corner1Y}
                corner2X={w.corner2X}
                corner2Y={w.corner2Y}
                isWiring={isWiring}
                onCornersDrag={setWireCorners}
                onEndpointDrag={handleEndpointDrag}
                showResistance={wireEnabled}
                onClick={handleWireClick}
              />
            ))}

            <WireDrawingLayer pendingWire={pendingWire} components={components} lineType={wireLineType} />

            {/* Components */}
            {components.map((comp) => (
              <FreeComponent
                key={comp.id}
                component={comp}
                values={calculatedValues[comp.id]}
                isSelected={selectedComponentId === comp.id}
                isFlowing={isFlowing}
                isWiring={isWiring}
                voltage={voltage}
                onComponentClick={handleComponentClick}
                onComponentMouseDown={handleComponentMouseDown}
                onTerminalClick={handleTerminalClick}
                onTerminalMouseDown={handleTerminalMouseDown}
                onDoubleClick={handleComponentDoubleClick}
                polarities={terminalPolarities}
                hasError={errorIds.includes(comp.id)}
                highlightTerminal={getHighlightFor(comp.id)}
              />
            ))}
          </g>
        </svg>

        {/* Zoom controls */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1">
          <button onClick={() => setView(v => ({ ...v, scale: Math.min(5, v.scale * 1.2) }))}
            className="w-8 h-8 rounded-lg bg-[#2d2a3e] border border-[#4a4560] text-[#8b83a8]
                       hover:text-white hover:border-[#6b6580] transition-colors text-lg font-bold flex items-center justify-center">+</button>
          <button onClick={() => setView(v => ({ ...v, scale: Math.max(0.15, v.scale * 0.83) }))}
            className="w-8 h-8 rounded-lg bg-[#2d2a3e] border border-[#4a4560] text-[#8b83a8]
                       hover:text-white hover:border-[#6b6580] transition-colors text-lg font-bold flex items-center justify-center">−</button>
          <button onClick={fitToView}
            className="w-8 h-8 rounded-lg bg-[#2d2a3e] border border-[#4a4560] text-[#8b83a8]
                       hover:text-white hover:border-[#6b6580] transition-colors text-xs font-bold flex items-center justify-center"
            title="Fit to view">⊡</button>
        </div>

        <div className="absolute bottom-3 left-3 text-[10px] text-[#4a4560] select-none">
          {Math.round(view.scale * 100)}%
        </div>
      </div>

      {/* Circuit Totals */}
      <div className="shrink-0 flex items-center gap-6 px-6 py-2 bg-[#2d2a3e] border-t border-[#4a4560]">
        <span className="text-[10px] font-semibold text-[#8b83a8] uppercase tracking-wider shrink-0">
          {t('circuit.totals')}
        </span>
        <span className="text-sm font-bold text-green-400">
          R = {isFinite(totalResistance) ? `${totalResistance.toFixed(2)} Ω` : '∞ Ω'}
        </span>
        <span className="text-sm font-bold text-red-400">
          I = {totalCurrent.toFixed(3)} A
        </span>
        {wireEnabled && totalWireResistance > 0 && (
          <span className="text-sm font-bold text-purple-400">
            {t('circuit.wireResistance')} = {totalWireResistance.toFixed(3)} Ω
          </span>
        )}
      </div>
    </div>
  );
}
