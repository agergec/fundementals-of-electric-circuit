import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFreeModeStore } from '../../store/freeModeStore';

const STORAGE_KEY = 'circuitlab-tutorial-done';

const STEPS = [
  { target: 'toolbar-generator', titleKey: 'tutorial.step1Title', bodyKey: 'tutorial.step1Body' },
  { target: 'toolbar-lamp', titleKey: 'tutorial.step2Title', bodyKey: 'tutorial.step2Body' },
  { target: 'toolbar-wire', titleKey: 'tutorial.step3Title', bodyKey: 'tutorial.step3Body' },
  { target: 'toolbar-corner', titleKey: 'tutorial.step4Title', bodyKey: 'tutorial.step4Body' },
  { target: 'canvas-spot', titleKey: 'tutorial.step5Title', bodyKey: 'tutorial.step5Body' },
];

export function TutorialOverlay() {
  const { t } = useTranslation();
  const components = useFreeModeStore(s => s.components);
  const wires = useFreeModeStore(s => s.wires);
  const setActiveTool = useFreeModeStore(s => s.setActiveTool);
  const setWireLineType = useFreeModeStore(s => s.setWireLineType);

  const [done, setDone] = useState(() => localStorage.getItem(STORAGE_KEY) === '1');
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const timerRef = useRef(0);

  // Auto-select tool and auto-advance
  useEffect(() => {
    if (done) return;
    const genCount = components.filter(c => c.componentType === 'generator').length;
    const lampCount = components.filter(c => c.componentType === 'lamp').length;
    const hasCorner = wires.some(w => w.lineType === 'corner');

    if (step === 0) {
      setActiveTool('place-generator');
      if (genCount > 0) setStep(1);
    } else if (step === 1) {
      setActiveTool('place-lamp');
      if (lampCount > 0) setStep(2);
    } else if (step === 2) {
      setActiveTool('wire');
      if (wires.length > 0) setStep(3);
    } else if (step === 3) {
      setActiveTool('select');
      setWireLineType('corner');
      if (hasCorner) setStep(4);
    } else {
      setActiveTool('select');
    }
  }, [components, wires, step, done, setActiveTool, setWireLineType]);

  // Track target element position
  useEffect(() => {
    if (done) return;

    const track = () => {
      const el = document.querySelector(`[data-tour="${STEPS[step].target}"]`);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        // Fallback for canvas targets: center of canvas
        setTargetRect(DOMRect.fromRect({
          x: window.innerWidth * 0.4, y: window.innerHeight * 0.25,
          width: window.innerWidth * 0.35, height: window.innerHeight * 0.45,
        }));
      }
    };

    track();
    window.addEventListener('resize', track);
    timerRef.current = window.setInterval(track, 200) as unknown as number;
    return () => {
      window.removeEventListener('resize', track);
      clearInterval(timerRef.current);
    };
  }, [step, done]);

  // Persist done
  useEffect(() => {
    if (done) localStorage.setItem(STORAGE_KEY, '1');
  }, [done]);

  if (done) return null;

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // Card positioning: if target is in toolbar, card goes to its right
  const isToolbarTarget = targetRect && targetRect.left < 280;
  const cardStyle = targetRect ? (isToolbarTarget ? {
    left: targetRect.right + 24,
    top: Math.max(80, targetRect.top - 40),
  } : {
    left: Math.max(280, Math.min(targetRect.left + targetRect.width / 2 - 190, window.innerWidth - 400)),
    top: targetRect.bottom > window.innerHeight / 2
      ? targetRect.top - 230
      : targetRect.bottom + 16,
  }) : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Backdrop with spotlight hole */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" width="100%" height="100%">
        <defs>
          <mask id="tut-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect x={targetRect.left - 6} y={targetRect.top - 6}
                width={targetRect.width + 12} height={targetRect.height + 12}
                rx="8" fill="black" />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#tut-mask)" />
        {targetRect && (
          <rect x={targetRect.left - 6} y={targetRect.top - 6}
            width={targetRect.width + 12} height={targetRect.height + 12}
            rx="8" fill="none" stroke="#a78bfa" strokeWidth={2.5}
            strokeDasharray="8 4" opacity={0.9}>
            <animate attributeName="stroke-dashoffset" from="0" to="24" dur="1s" repeatCount="indefinite" />
          </rect>
        )}
      </svg>

      {/* Instruction card */}
      <div className="absolute pointer-events-auto" style={cardStyle}>
        <div className="bg-[#2d2a3e] border border-purple-500/40 rounded-2xl shadow-2xl w-[360px] p-5">
          <div className="flex gap-1.5 mb-3">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full flex-1 transition-colors duration-300 ${
                i <= step ? 'bg-purple-500' : 'bg-[#4a4560]'
              }`} />
            ))}
          </div>
          <h3 className="text-base font-bold text-purple-300 mb-1.5">{t(s.titleKey)}</h3>
          <p className="text-xs text-[#9ca3af] leading-relaxed mb-4">{t(s.bodyKey)}</p>
          <div className="flex gap-2">
            <button onClick={() => setDone(true)}
              className="px-3 py-1.5 rounded-lg text-[10px] text-[#6b6580] hover:text-white transition-colors">
              Skip
            </button>
            <div className="flex-1" />
            <button onClick={() => isLast ? setDone(true) : setStep(s => s + 1)}
              className="px-4 py-1.5 rounded-lg bg-purple-700 text-white text-xs font-bold
                         hover:bg-purple-600 transition-colors">
              {isLast ? 'Got it!' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
