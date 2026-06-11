import { useRef, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useFreeModeStore, getTerminalPos } from '../../store/freeModeStore';
import { FreeComponent } from './FreeComponent';
import { FreeWire } from './FreeWire';
import { WireDrawingLayer } from './WireDrawingLayer';
import { GhostPreview } from './GhostPreview';
import { BreadboardGrid } from './BreadboardGrid';
import { ChallengePanel } from './ChallengePanel';
import { HelpModal } from './HelpModal';
import { TutorialOverlay } from './TutorialOverlay';
import { ErrorBoundary } from './ErrorBoundary';
import {
  PIXEL_TO_METERS, GRID_SNAP, TERMINAL_SNAP_RADIUS, WIRE_HIT_RADIUS,
  MIN_SPLIT_WIRE_LEN, SNAP_TO_MIDPOINT_LEN,
} from '../../utils/constants';
import { computeFacing, buildPointList, type Facing } from '../../engine/freeMode/router';
import type { FreeComponent as FreeComponentT, FreeWire as FreeWireT, Point } from '../../engine/types';

const SNAP = GRID_SNAP;

/** Inline all computed CSS styles recursively so the SVG can be rendered to a canvas */
function inlineStyles(source: Element, target: Element) {
  const computed = getComputedStyle(source);
  const style = (target as HTMLElement).style;
  // Copy visual properties that matter for rendering
  for (const prop of ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap',
    'opacity', 'font-size', 'font-family', 'font-weight', 'text-anchor', 'dominant-baseline']) {
    const val = computed.getPropertyValue(prop);
    if (val && val !== 'auto' && val !== 'normal') style.setProperty(prop, val);
  }
  for (let i = 0; i < source.children.length; i++) {
    inlineStyles(source.children[i], target.children[i]);
  }
}

async function exportPng(svgEl: SVGSVGElement | null) {
  if (!svgEl) return;
  const rect = svgEl.getBoundingClientRect();
  const w = rect.width || 800;
  const h = rect.height || 600;

  // Clone and inline styles
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  inlineStyles(svgEl, clone);
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  clone.setAttribute('viewBox', `0 0 ${w} ${h}`);

  // Add a background rect
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', String(w));
  bg.setAttribute('height', String(h));
  bg.setAttribute('fill', '#1e1b2e');
  clone.insertBefore(bg, clone.firstChild);

  const data = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'circuit.png';
      a.click();
    }, 'image/png');
  };
  img.src = url;
}

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
  threshold = TERMINAL_SNAP_RADIUS,
  exclude?: string,
): { compId: string; index: 0 | 1 } | null {
  let best: { compId: string; index: 0 | 1 } | null = null;
  let bestDist = threshold;
  for (const c of components) {
    for (const idx of [0, 1] as const) {
      if (exclude === `${c.id}:${idx}`) continue;
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
    insertComponentOnWire,
    removeComponent,
    moveComponent,
    addWire,
    removeWire,
    setActiveTool,
    selectComponent,
    selectWire,
    setWireWaypoints,
    clearAttachedWaypoints,
    rewireEndpoint,
    toggleSwitch,
    startWire,
    updateWirePreview,
    cancelWire,
    undo,
    redo,
    pushHistory,
    breadboard,
    realisticView,
    draggingComponentType,
  } = useFreeModeStore();

  const isFlowing = totalCurrent > 0.0001;
  const isWiring = !!pendingWire;
  const [showHelp, setShowHelp] = useState(false);
  const [showAllIssues, setShowAllIssues] = useState(false);

  // ── Pan / Zoom ──
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState({ x: 40, y: 40, scale: 1 });

  // Pan drag
  const panDrag = useRef<{ startX: number; startY: number; panX: number; panY: number; moved: boolean } | null>(null);
  // Component drag
  const compDrag = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);
  // Endpoint drag for rewiring
  const endpointDrag = useRef<{ wireId: string; end: 'from' | 'to' } | null>(null);
  const [floatingEndpoint, setFloatingEndpoint] = useState<{ wireId: string; end: 'from' | 'to'; x: number; y: number } | null>(null);
  // Terminal hover highlight
  const [highlightComp, setHighlightComp] = useState<{ compId: string; index: 0 | 1 } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // Drop-on-wire highlight + placement ghost
  const [dragOverWire, setDragOverWire] = useState<string | null>(null);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number; rotation: number } | null>(null);
  // True between the mousedown that started a wire and its own mouseup, so that
  // releasing the initial click doesn't cancel the pending wire (click-then-click flow)
  const wireJustStarted = useRef(false);

  const centerOnComponent = (id: string) => {
    const comp = components.find(c => c.id === id);
    if (!comp || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    setView(v => ({
      ...v,
      x: rect.width / 2 - comp.x * v.scale,
      y: rect.height / 2 - comp.y * v.scale,
    }));
  };

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

    // Ghost preview follows the cursor in click-to-place mode
    if (activeTool.startsWith('place-') && !draggingComponentType) {
      const rect = svg.getBoundingClientRect();
      const c = toCanvas(e.clientX, e.clientY, rect, view);
      updateGhost(activeTool.slice(6) as FreeComponentT['componentType'], c.x, c.y);
    }

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
      if (!cd.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
        cd.moved = true;
        setIsDragging(true);
        // Manual bends would go stale as the component moves — let wires auto-route
        clearAttachedWaypoints(cd.id);
      }
      if (cd.moved) {
        moveComponent(cd.id, cd.origX + dx, cd.origY + dy);
      }
    }

    // Wire preview / endpoint drag + terminal highlight
    if (pendingWire || endpointDrag.current) {
      const rect = svg.getBoundingClientRect();
      const c = toCanvas(e.clientX, e.clientY, rect, view);
      const nearest = findClosestTerminal(c.x, c.y, components, TERMINAL_SNAP_RADIUS, pendingWire?.fromTerminal);
      // Magnetic snap: lock the preview endpoint onto the nearest terminal
      const snapPos = nearest ? getTerminalPos(nearest.compId, nearest.index, components) : null;
      const px = snapPos?.x ?? c.x;
      const py = snapPos?.y ?? c.y;
      if (pendingWire) updateWirePreview(px, py);
      if (endpointDrag.current) {
        setFloatingEndpoint(prev => prev ? { ...prev, x: px, y: py } : null);
      }
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
        const nearest = findClosestTerminal(c.x, c.y, components);
        if (nearest) {
          const tid = `${nearest.compId}:${nearest.index}`;
          rewireEndpoint(endpointDrag.current.wireId, endpointDrag.current.end, tid);
        }
      }
      endpointDrag.current = null;
      setFloatingEndpoint(null);
      return;
    }

    // Complete wire if drawing
    if (pendingWire) {
      const svg = svgRef.current;
      let completed = false;
      if (svg) {
        const rect = svg.getBoundingClientRect();
        const c = toCanvas(e.clientX, e.clientY, rect, view);
        const nearest = findClosestTerminal(c.x, c.y, components);
        if (nearest) {
          const tid = `${nearest.compId}:${nearest.index}`;
          if (tid !== pendingWire.fromTerminal) {
            addWire(pendingWire.fromTerminal, tid);
            completed = true;
          }
        }
      }
      // Releasing the click that started the wire keeps it pending (click-then-click);
      // any later release that doesn't complete on a terminal cancels.
      if (!completed && !wireJustStarted.current) cancelWire();
      wireJustStarted.current = false;
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

  // Leaving the canvas ends pans/drags but keeps a pending wire alive,
  // so briefly crossing the edge mid-draw doesn't lose the student's wire
  const onSvgMouseLeave = () => {
    const cd = compDrag.current;
    if (cd?.moved) {
      const comp = components.find(c => c.id === cd.id);
      if (comp) moveComponent(cd.id, snap(comp.x), snap(comp.y));
    }
    compDrag.current = null;
    panDrag.current = null;
    endpointDrag.current = null;
    setFloatingEndpoint(null);
    setIsDragging(false);
    setHighlightComp(null);
    setGhostPos(null);
  };

  const onSvgContextMenu = (e: React.MouseEvent<SVGSVGElement>) => {
    if (pendingWire) {
      e.preventDefault();
      cancelWire();
    }
  };

  // ── Canvas click ──
  const onCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (panDrag.current?.moved || compDrag.current?.moved) return;
    if (e.target !== svgRef.current && !(e.target as Element).classList.contains('canvas-bg')) return;

    // Click-to-place: one-shot, then back to select with the new component selected
    if (activeTool.startsWith('place-')) {
      placeAtClick(activeTool.slice(6) as FreeComponentT['componentType'], e.clientX, e.clientY);
      return;
    }

    if (activeTool === 'select') {
      selectComponent(null);
      selectWire(null);
    }
  };

  const placeAtClick = (type: FreeComponentT['componentType'], clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const c = toCanvas(clientX, clientY, rect, view);
    const id = placeAt(type, c.x, c.y);
    if (id) selectComponent(id);
    setActiveTool('select');
    setGhostPos(null);
    setDragOverWire(null);
  };

  // ── Component interaction ──

  const handleComponentMouseDown = (id: string, e: React.MouseEvent) => {
    if (activeTool === 'wire') {
      // In wire mode, grabbing a junction body starts a wire from its central
      // terminal — its tiny 10-14px hit ring is otherwise hidden under the drag rect
      const comp = components.find(c => c.id === id);
      if (comp?.componentType === 'junction') handleTerminalMouseDown(id, 0, e);
      return;
    }
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
      // Clicking the source terminal again (including the click that started this
      // wire) keeps the wire pending — cancel is background click / right click / Esc
      if (pendingWire.fromTerminal !== tid) {
        addWire(pendingWire.fromTerminal, tid);
        setHighlightComp(null);
      }
      return;
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
    wireJustStarted.current = true;
  };

  // ── Endpoint drag (rewire) ──

  const handleEndpointDrag = (wireId: string, end: 'from' | 'to', e: React.MouseEvent) => {
    e.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const c = toCanvas(e.clientX, e.clientY, rect, view);
    endpointDrag.current = { wireId, end };
    setFloatingEndpoint({ wireId, end, x: c.x, y: c.y });
  };

  // ── Wire interaction ──

  const handleWireClick = (id: string, e: React.MouseEvent) => {
    // Clicking directly on a wire in place mode inserts the component into it
    if (activeTool.startsWith('place-')) {
      placeAtClick(activeTool.slice(6) as FreeComponentT['componentType'], e.clientX, e.clientY);
      return;
    }
    if (activeTool === 'select') selectWire(id);
  };

  // ── Drag from toolbar / placement ──

  /** Point-to-segment distance plus the projection of the point onto the segment */
  function projectToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq < 0.01 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const x = ax + t * dx, y = ay + t * dy;
    return { dist: Math.hypot(px - x, py - y), x, y };
  }

  interface WireHit {
    wireId: string;
    ax: number; ay: number; bx: number; by: number; // best segment
    px: number; py: number; // projection of the point onto it
  }

  /** Polyline matching the wire's RENDERED path (hit test must agree with what the student sees) */
  function wireHitPolyline(w: FreeWireT, fp: Point, tp: Point, d1: Facing, d2: Facing): Point[] {
    const lt = w.lineType || 'straight';
    if (lt === 'corner') return buildPointList(fp, d1, tp, d2, w.waypoints || []);
    if (lt === 'curved') {
      // Sample the same cubic bezier FreeWire renders (buildCurvedPath)
      const dx = tp.x - fp.x, dy = tp.y - fp.y;
      const dist = Math.hypot(dx, dy);
      const bow = Math.min(dist * 0.5, 40);
      const px = dist > 0 ? -dy / dist : 0;
      const py = dist > 0 ? dx / dist : 0;
      const c1 = { x: fp.x + dx * 0.35 + px * bow, y: fp.y + dy * 0.35 + py * bow };
      const c2 = { x: tp.x - dx * 0.35 + px * bow, y: tp.y - dy * 0.35 + py * bow };
      const pts: Point[] = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8, u = 1 - t;
        pts.push({
          x: u * u * u * fp.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * tp.x,
          y: u * u * u * fp.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * tp.y,
        });
      }
      return pts;
    }
    return [fp, tp];
  }

  /** Find the closest wire segment to a canvas point, within threshold. */
  function findWireNearPoint(cx: number, cy: number, threshold = WIRE_HIT_RADIUS): WireHit | null {
    let best: WireHit | null = null;
    let bestDist = threshold;
    for (const w of wires) {
      const [fcId] = w.fromTerminal.split(':');
      const [tcId] = w.toTerminal.split(':');
      const fp = getTerminalPos(fcId, Number(w.fromTerminal.split(':')[1]) as 0 | 1, components);
      const tp = getTerminalPos(tcId, Number(w.toTerminal.split(':')[1]) as 0 | 1, components);
      if (!fp || !tp) continue;
      const fc = components.find(c => c.id === fcId);
      const tc = components.find(c => c.id === tcId);
      const d1 = fc ? computeFacing(fp.x, fp.y, fc.x, fc.y) : 'R';
      const d2 = tc ? computeFacing(tp.x, tp.y, tc.x, tc.y) : 'L';
      const pts = wireHitPolyline(w, fp, tp, d1, d2);
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const pr = projectToSegment(cx, cy, a.x, a.y, b.x, b.y);
        if (pr.dist < bestDist) {
          bestDist = pr.dist;
          best = { wireId: w.id, ax: a.x, ay: a.y, bx: b.x, by: b.y, px: pr.x, py: pr.y };
        }
      }
    }
    return best;
  }

  /**
   * Where would a component land if placed at (cx, cy)?
   * On a wire: aligned to the wire line, rotated to its direction, kept clear of
   * the wire's endpoints. Off-wire (or wire too short to split): plain grid snap.
   */
  function computePlacement(
    type: FreeComponentT['componentType'], cx: number, cy: number,
  ): { x: number; y: number; rotation: number; wireId: string | null } {
    const hit = findWireNearPoint(cx, cy);
    if (hit) {
      const w = wires.find(wr => wr.id === hit.wireId);
      const fp = w ? getTerminalPos(w.fromTerminal.split(':')[0], Number(w.fromTerminal.split(':')[1]) as 0 | 1, components) : null;
      const tp = w ? getTerminalPos(w.toTerminal.split(':')[0], Number(w.toTerminal.split(':')[1]) as 0 | 1, components) : null;
      if (fp && tp) {
        const wireLen = Math.hypot(tp.x - fp.x, tp.y - fp.y);
        if (wireLen >= MIN_SPLIT_WIRE_LEN) {
          const horizontal = Math.abs(hit.bx - hit.ax) >= Math.abs(hit.by - hit.ay);
          const rotation = type === 'junction' || horizontal ? 0 : 90;
          if (wireLen < SNAP_TO_MIDPOINT_LEN) {
            // Short wire: exact midpoint (no grid snap — symmetry beats grid here,
            // a snapped midpoint can butt the component against a wire endpoint)
            return { x: Math.round((fp.x + tp.x) / 2), y: Math.round((fp.y + tp.y) / 2), rotation, wireId: hit.wireId };
          }
          // Snap along the segment axis only, so the component sits exactly on the wire line,
          // and keep it at least one grid cell away from the segment ends
          if (horizontal) {
            const lo = Math.min(hit.ax, hit.bx) + SNAP, hi = Math.max(hit.ax, hit.bx) - SNAP;
            const x = lo <= hi ? Math.max(lo, Math.min(hi, snap(hit.px))) : Math.round((hit.ax + hit.bx) / 2);
            return { x, y: Math.round(hit.py), rotation, wireId: hit.wireId };
          }
          const lo = Math.min(hit.ay, hit.by) + SNAP, hi = Math.max(hit.ay, hit.by) - SNAP;
          const y = lo <= hi ? Math.max(lo, Math.min(hi, snap(hit.py))) : Math.round((hit.ay + hit.by) / 2);
          return { x: Math.round(hit.px), y, rotation, wireId: hit.wireId };
        }
      }
    }
    return { x: snap(cx), y: snap(cy), rotation: 0, wireId: null };
  }

  /** Place a component at canvas coords, splitting a wire when dropped onto one. */
  const placeAt = (type: FreeComponentT['componentType'], cx: number, cy: number): string | null => {
    const p = computePlacement(type, cx, cy);
    return p.wireId
      ? insertComponentOnWire(type, p.x, p.y, p.wireId, p.rotation)
      : placeComponent(type, p.x, p.y);
  };

  const ghostType: FreeComponentT['componentType'] | null =
    draggingComponentType ?? (activeTool.startsWith('place-') ? activeTool.slice(6) as FreeComponentT['componentType'] : null);

  const updateGhost = (type: FreeComponentT['componentType'], cx: number, cy: number) => {
    const p = computePlacement(type, cx, cy);
    setGhostPos(prev =>
      prev && prev.x === p.x && prev.y === p.y && prev.rotation === p.rotation
        ? prev
        : { x: p.x, y: p.y, rotation: p.rotation },
    );
    setDragOverWire(p.wireId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const c = toCanvas(e.clientX, e.clientY, rect, view);
    if (draggingComponentType) {
      updateGhost(draggingComponentType, c.x, c.y);
    } else {
      setDragOverWire(findWireNearPoint(c.x, c.y)?.wireId ?? null);
    }
  };

  const handleDragLeave = () => { setDragOverWire(null); setGhostPos(null); };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverWire(null);
    setGhostPos(null);
    const compType = e.dataTransfer.getData('component-type') as FreeComponentT['componentType'];
    if (!compType) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const c = toCanvas(e.clientX, e.clientY, rect, view);
    const id = placeAt(compType, c.x, c.y);
    if (id) selectComponent(id);
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
    <ErrorBoundary>
    <div className="flex-1 flex flex-col overflow-hidden">
      <TutorialOverlay />
      <ChallengePanel />
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

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
      {validationIssues.length > 0 && (() => {
        const levelOrder: Record<string, number> = { error: 0, warning: 1, info: 2 };
        const sorted = [...validationIssues].sort((a, b) => (levelOrder[a.level] ?? 3) - (levelOrder[b.level] ?? 3));
        const visible = showAllIssues ? sorted : sorted.slice(0, 2);
        const hidden = sorted.length - visible.length;
        return (
          <div className="flex flex-col gap-1 px-4 pt-3 shrink-0">
            {visible.map((issue, i) => {
              const colors = issue.level === 'error'
                ? 'bg-red-950/60 border-red-500 text-red-400'
                : issue.level === 'warning'
                ? 'bg-amber-950/60 border-amber-500 text-amber-400'
                : 'bg-blue-950/60 border-blue-500 text-blue-400';
              const icon = issue.level === 'error' ? '⚡' : issue.level === 'warning' ? '⚠' : 'ℹ';
              const target = issue.ids.find(id => components.some(c => c.id === id));
              return (
                <button key={i} type="button"
                  onClick={() => {
                    if (!target) return;
                    selectComponent(target);
                    centerOnComponent(target);
                  }}
                  className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs text-left w-full ${colors}
                              ${target ? 'cursor-pointer hover:brightness-125' : 'cursor-default'}`}>
                  <span className="shrink-0 font-bold">{icon}</span>
                  <div>
                    <span className="font-bold">{t(issue.key)}: </span>
                    <span className="text-[#9ca3af]">{t(issue.detailKey)}</span>
                    {issue.hintKey && (
                      <div className="mt-0.5 text-[11px] italic opacity-90">💡 {t(issue.hintKey)}</div>
                    )}
                  </div>
                </button>
              );
            })}
            {sorted.length > 2 && (
              <button type="button" onClick={() => setShowAllIssues(v => !v)}
                className="self-start px-2 py-0.5 text-[11px] font-semibold text-[#8b83a8] hover:text-white transition-colors">
                {showAllIssues ? `▾ ${t('circuit.showLess')}` : `▸ ${t('circuit.moreIssues', { count: hidden })}`}
              </button>
            )}
          </div>
        );
      })()}

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
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <svg
          ref={svgRef}
          width="100%" height="100%"
          style={{ cursor: isWiring ? 'crosshair' : isDragging ? 'grabbing' : 'grab', display: 'block' }}
          onMouseDown={onSvgMouseDown}
          onMouseMove={onSvgMouseMove}
          onMouseUp={onSvgMouseUp}
          onMouseLeave={onSvgMouseLeave}
          onContextMenu={onSvgContextMenu}
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
                isSelected={selectedWireId === w.id || dragOverWire === w.id}
                isDetached={floatingEndpoint?.wireId === w.id}
                strokeWidth={wireStrokeWidth}
                wireResistance={wireResistances[w.id]}
                lineType={w.lineType || 'straight'}
                waypoints={w.waypoints || []}
                isWiring={isWiring}
                onWaypointsDrag={setWireWaypoints}
                onWaypointsDragStart={pushHistory}
                showResistance={wireEnabled}
                onClick={handleWireClick}
              />
            ))}

            <WireDrawingLayer pendingWire={pendingWire} components={components} lineType={wireLineType} />

            {/* Placement ghost (click-to-place and toolbar drag) */}
            {ghostType && ghostPos && (
              <GhostPreview type={ghostType} x={ghostPos.x} y={ghostPos.y} rotation={ghostPos.rotation} />
            )}

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
                realisticView={realisticView}
                highlightTerminal={getHighlightFor(comp.id)}
              />
            ))}

            {/* Endpoint drag handles — rendered on top of everything so they catch mousedown
                before component terminal dots */}
            {selectedWireId && !isWiring && (() => {
              const sw = wires.find(w => w.id === selectedWireId);
              if (!sw) return null;
              const [fcId] = sw.fromTerminal.split(':');
              const [tcId] = sw.toTerminal.split(':');
              const fp = getTerminalPos(fcId, Number(sw.fromTerminal.split(':')[1]) as 0 | 1, components);
              const tp = getTerminalPos(tcId, Number(sw.toTerminal.split(':')[1]) as 0 | 1, components);
              return (
                <>
                  {fp && (
                    <>
                      <circle cx={fp.x} cy={fp.y} r={7} fill="#22c55e" stroke="#4ade80" strokeWidth={1.5} opacity={0.8}
                        style={{ pointerEvents: 'none' }} />
                      <circle cx={fp.x} cy={fp.y} r={14} fill="transparent" style={{ cursor: 'grab' }}
                        onMouseDown={(e) => { e.stopPropagation(); handleEndpointDrag(selectedWireId, 'from', e); }} />
                    </>
                  )}
                  {tp && (
                    <>
                      <circle cx={tp.x} cy={tp.y} r={7} fill="#22c55e" stroke="#4ade80" strokeWidth={1.5} opacity={0.8}
                        style={{ pointerEvents: 'none' }} />
                      <circle cx={tp.x} cy={tp.y} r={14} fill="transparent" style={{ cursor: 'grab' }}
                        onMouseDown={(e) => { e.stopPropagation(); handleEndpointDrag(selectedWireId, 'to', e); }} />
                    </>
                  )}
                </>
              );
            })()}

            {/* Floating wire — shown during endpoint drag, the wire end follows the mouse */}
            {floatingEndpoint && (() => {
              const sw = wires.find(w => w.id === floatingEndpoint.wireId);
              if (!sw) return null;
              const anchoredEnd = floatingEndpoint.end === 'from' ? 'to' : 'from';
              const anchoredTid = anchoredEnd === 'from' ? sw.fromTerminal : sw.toTerminal;
              const [acId] = anchoredTid.split(':');
              const ap = getTerminalPos(acId, Number(anchoredTid.split(':')[1]) as 0 | 1, components);
              if (!ap) return null;
              return (
                <path
                  d={`M ${ap.x} ${ap.y} L ${floatingEndpoint.x} ${floatingEndpoint.y}`}
                  stroke="#a78bfa" strokeWidth={2} strokeDasharray="6 3"
                  strokeLinecap="round" fill="none" pointerEvents="none"
                />
              );
            })()}
          </g>
        </svg>

        {/* Zoom & export controls */}
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
          <button onClick={() => exportPng(svgRef.current)}
            className="w-8 h-8 rounded-lg bg-[#2d2a3e] border border-[#4a4560] text-[#8b83a8]
                       hover:text-white hover:border-[#6b6580] transition-colors text-[10px] font-bold flex items-center justify-center"
            title="Export as PNG">📷</button>
          <button onClick={() => setShowHelp(true)}
            className="w-8 h-8 rounded-lg bg-[#2d2a3e] border border-[#4a4560] text-[#8b83a8]
                       hover:text-white hover:border-[#6b6580] transition-colors text-xs font-bold flex items-center justify-center"
            title="Help">?</button>
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
    </ErrorBoundary>
  );
}
