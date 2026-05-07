import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useFreeModeStore } from '../../store/freeModeStore';

const STORAGE_KEY = 'circuitlab-tutorial-done';

interface Step {
  target: string;
  titleKey: string;
  bodyKey: string;
  /** If true, waits for this condition in the store before allowing Next */
  waitFor?: () => boolean;
}

export function TutorialOverlay() {
  const { t } = useTranslation();
  const components = useFreeModeStore(s => s.components);
  const wires = useFreeModeStore(s => s.wires);
  const [done, setDone] = useState(() => localStorage.getItem(STORAGE_KEY) === '1');
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const frameRef = useRef<number>(0);

  const steps: Step[] = [
    {
      target: 'toolbar-generator',
      titleKey: 'tutorial.step1Title',
      bodyKey: 'tutorial.step1Body',
    },
    {
      target: 'toolbar-lamp',
      titleKey: 'tutorial.step2Title',
      bodyKey: 'tutorial.step2Body',
    },
    {
      target: 'toolbar-wire',
      titleKey: 'tutorial.step3Title',
      bodyKey: 'tutorial.step3Body',
    },
    {
      target: 'canvas',
      titleKey: 'tutorial.step4Title',
      bodyKey: 'tutorial.step4Body',
    },
  ];

  // Auto-select tools based on step
  const setActiveTool = useFreeModeStore(s => s.setActiveTool);

  // Auto-advance when user completes the current step's action
  useEffect(() => {
    if (done) return;
    const gens = components.filter(c => c.componentType === 'generator');
    const lamps = components.filter(c => c.componentType === 'lamp');

    if (step === 0) {
      setActiveTool('place-generator');
      if (gens.length > 0) setStep(1);
    }
    if (step === 1) {
      setActiveTool('place-lamp');
      if (lamps.length > 0) setStep(2);
    }
    if (step === 2) {
      setActiveTool('wire');
      if (wires.length > 0) setStep(3);
    }
    if (step === 3) {
      setActiveTool('select');
    }
  }, [components, wires, step, done, setActiveTool]);

  // Track target element position
  const updateTargetRect = useCallback(() => {
    if (done) return;
    const s = steps[step];
    const el = document.querySelector(`[data-tour="${s.target}"]`);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [step, done]);

  useEffect(() => {
    updateTargetRect();
    const onResize = () => updateTargetRect();
    window.addEventListener('resize', onResize);
    frameRef.current = window.setInterval(updateTargetRect, 300) as unknown as number;
    return () => {
      window.removeEventListener('resize', onResize);
      clearInterval(frameRef.current);
    };
  }, [updateTargetRect]);

  useEffect(() => {
    if (done) localStorage.setItem(STORAGE_KEY, '1');
  }, [done]);

  if (done) return null;

  const s = steps[step];
  const isLast = step === steps.length - 1;

  const handleNext = () => {
    if (isLast) setDone(true);
    else setStep(step + 1);
  };
  const handleSkip = () => setDone(true);

  // Spotlight ring around target
  const spotlight = targetRect ? {
    left: targetRect.left - 6,
    top: targetRect.top - 6,
    width: targetRect.width + 12,
    height: targetRect.height + 12,
    bottom: targetRect.bottom + 6,
  } : null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Backdrop with a "hole" cut for the spotlight */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" width="100%" height="100%">
        <defs>
          <mask id="tutorial-mask">
            <rect width="100%" height="100%" fill="white" />
            {spotlight && (
              <rect x={spotlight.left} y={spotlight.top} width={spotlight.width}
                height={spotlight.height} rx="8" fill="black" />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#tutorial-mask)" />
        {spotlight && (
          <rect x={spotlight.left} y={spotlight.top} width={spotlight.width}
            height={spotlight.height} rx="8" fill="none" stroke="#a78bfa" strokeWidth={2.5}
            strokeDasharray="8 4" opacity={0.8}>
            <animate attributeName="stroke-dashoffset" from="0" to="24" dur="1s" repeatCount="indefinite" />
          </rect>
        )}
      </svg>

      {/* Instruction card */}
      <div className="absolute pointer-events-auto"
        style={spotlight ? {
          left: Math.max(280, Math.min(spotlight.left + spotlight.width / 2 - 190, window.innerWidth - 400)),
          top: spotlight.bottom > window.innerHeight / 2
            ? spotlight.top - 220
            : spotlight.bottom + 16,
        } : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
        <div className="bg-[#2d2a3e] border border-purple-500/40 rounded-2xl shadow-2xl w-[380px] p-5">
          {/* Step dots */}
          <div className="flex gap-1.5 mb-3">
            {steps.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full flex-1 transition-colors duration-300 ${
                i <= step ? 'bg-purple-500' : 'bg-[#4a4560]'
              }`} />
            ))}
          </div>

          <h3 className="text-base font-bold text-purple-300 mb-1.5">{t(s.titleKey)}</h3>
          <p className="text-xs text-[#9ca3af] leading-relaxed mb-4">{t(s.bodyKey)}</p>

          <div className="flex gap-2">
            <button onClick={handleSkip}
              className="px-3 py-1.5 rounded-lg text-[10px] text-[#6b6580] hover:text-white transition-colors">
              Skip
            </button>
            <div className="flex-1" />
            <button onClick={handleNext}
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
