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

// Canvas drop zone — where components should be placed
function getCanvasRect(): DOMRect {
  return DOMRect.fromRect({
    x: window.innerWidth * 0.35,
    y: window.innerHeight * 0.2,
    width: window.innerWidth * 0.4,
    height: window.innerHeight * 0.55,
  });
}

export function TutorialOverlay() {
  const { t } = useTranslation();
  const components = useFreeModeStore(s => s.components);
  const wires = useFreeModeStore(s => s.wires);
  const setActiveTool = useFreeModeStore(s => s.setActiveTool);
  const setWireLineType = useFreeModeStore(s => s.setWireLineType);

  const [done, setDone] = useState(() => localStorage.getItem(STORAGE_KEY) === '1');
  const [step, setStep] = useState(-1); // -1 = intro screen
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [areaRect, setAreaRect] = useState<DOMRect>(getCanvasRect());
  const timerRef = useRef(0);

  // Auto-advance
  useEffect(() => {
    if (done || step < 0) return;
    const genCount = components.filter(c => c.componentType === 'generator').length;
    const lampCount = components.filter(c => c.componentType === 'lamp').length;
    const hasCorner = wires.some(w => w.lineType === 'corner');

    if (step === 0) {
      setActiveTool('select');
      if (genCount > 0) setStep(1);
    } else if (step === 1) {
      setActiveTool('select');
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

  // Track element + area positions
  useEffect(() => {
    if (done || step < 0) return;

    const track = () => {
      const s = STEPS[step];
      const el = document.querySelector(`[data-tour="${s.target}"]`);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
      setAreaRect(getCanvasRect());
    };

    track();
    window.addEventListener('resize', track);
    timerRef.current = window.setInterval(track, 200) as unknown as number;
    return () => {
      window.removeEventListener('resize', track);
      clearInterval(timerRef.current);
    };
  }, [step, done]);

  useEffect(() => {
    if (done) localStorage.setItem(STORAGE_KEY, '1');
  }, [done]);

  if (done) return null;

  const s = step >= 0 ? STEPS[step] : null;
  const isLast = step === STEPS.length - 1;

  // Card position: top-left of canvas area, never overlaps the rectangle
  const cardStyle: React.CSSProperties = (() => {
    if (step < 0) {
      return { left: '50%', top: '40%', transform: 'translate(-50%, -50%)' };
    }
    // Card sits at top-left of the canvas, to the right of the toolbar
    return { left: 280, top: 16 };
  })();

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <svg className="absolute inset-0 w-full h-full pointer-events-none" width="100%" height="100%">
        <defs>
          <mask id="tut-mask">
            <rect width="100%" height="100%" fill="white" />
            {/* Spotlight on toolbar element */}
            {step >= 0 && targetRect && (
              <rect x={targetRect.left - 6} y={targetRect.top - 6}
                width={targetRect.width + 12} height={targetRect.height + 12}
                rx="8" fill="black" />
            )}
            {/* Canvas drop area — always visible from step 0 onwards */}
            {step >= 0 && (
              <rect x={areaRect.x} y={areaRect.y}
                width={areaRect.width} height={areaRect.height}
                rx="12" fill="black" />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#tut-mask)" />

        {/* Pulsing ring on toolbar target */}
        {step >= 0 && targetRect && (
          <rect x={targetRect.left - 6} y={targetRect.top - 6}
            width={targetRect.width + 12} height={targetRect.height + 12}
            rx="8" fill="none" stroke="#a78bfa" strokeWidth={2.5}
            strokeDasharray="8 4" opacity={0.9}>
            <animate attributeName="stroke-dashoffset" from="0" to="24" dur="1s" repeatCount="indefinite" />
          </rect>
        )}

        {/* Dashed border on canvas drop area */}
        {step >= 0 && (
          <rect x={areaRect.x} y={areaRect.y}
            width={areaRect.width} height={areaRect.height}
            rx="12" fill="none" stroke="#22c55e" strokeWidth={2}
            strokeDasharray="10 6" opacity={0.7}>
            <animate attributeName="stroke-dashoffset" from="0" to="32" dur="1.5s" repeatCount="indefinite" />
          </rect>
        )}
      </svg>

      {/* Instruction card */}
      <div className="absolute pointer-events-auto" style={cardStyle}>
        <div className="bg-[#2d2a3e] border border-purple-500/40 rounded-2xl shadow-2xl w-[360px] p-5">
          {step < 0 ? (
            <>
              <h3 className="text-xl font-bold text-purple-300 mb-2">{t('tutorial.welcomeTitle')}</h3>
              <p className="text-sm text-[#9ca3af] leading-relaxed mb-4">{t('tutorial.welcomeBody')}</p>
              <div className="flex gap-2">
                <button onClick={() => setDone(true)}
                  className="px-3 py-1.5 rounded-lg text-[10px] text-[#6b6580] hover:text-white transition-colors">
                  Skip
                </button>
                <div className="flex-1" />
                <button onClick={() => setStep(0)}
                  className="px-5 py-2 rounded-lg bg-purple-700 text-white text-sm font-bold
                             hover:bg-purple-600 transition-colors">
                  Let's go!
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-1.5 mb-3">
                {STEPS.map((_, i) => (
                  <div key={i} className={`h-1.5 rounded-full flex-1 transition-colors duration-300 ${
                    i <= step ? 'bg-purple-500' : 'bg-[#4a4560]'
                  }`} />
                ))}
              </div>
              <h3 className="text-base font-bold text-purple-300 mb-1.5">{t(s!.titleKey)}</h3>
              <p className="text-xs text-[#9ca3af] leading-relaxed mb-4">{t(s!.bodyKey)}</p>
              <div className="flex gap-2">
                <button onClick={() => setDone(true)}
                  className="px-3 py-1.5 rounded-lg text-[10px] text-[#6b6580] hover:text-white transition-colors">
                  Skip
                </button>
                <div className="flex-1" />
                <button onClick={() => isLast ? setDone(true) : setStep(s => s + 1)}
                  className="px-4 py-1.5 rounded-lg bg-purple-700 text-white text-xs font-bold
                             hover:bg-purple-600 transition-colors">
                  {isLast ? 'Done!' : 'Next'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
