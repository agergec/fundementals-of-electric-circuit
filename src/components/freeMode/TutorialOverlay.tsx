import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const STORAGE_KEY = 'circuitlab-tutorial-done';
const STEPS = [
  {
    target: 'toolbar-place',
    titleKey: 'tutorial.step1Title',
    bodyKey: 'tutorial.step1Body',
  },
  {
    target: 'toolbar-wire',
    titleKey: 'tutorial.step2Title',
    bodyKey: 'tutorial.step2Body',
  },
  {
    target: 'canvas',
    titleKey: 'tutorial.step3Title',
    bodyKey: 'tutorial.step3Body',
  },
  {
    target: 'done',
    titleKey: 'tutorial.step4Title',
    bodyKey: 'tutorial.step4Body',
  },
];

export function TutorialOverlay() {
  const { t } = useTranslation();
  const [done, setDone] = useState(() => localStorage.getItem(STORAGE_KEY) === '1');
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (done) localStorage.setItem(STORAGE_KEY, '1');
  }, [done]);

  if (done) return null;

  const s = STEPS[step];

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else setDone(true);
  };

  const handleSkip = () => setDone(true);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 pointer-events-auto" />

      {/* Card positioned based on step */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
        <div className="bg-[#2d2a3e] border border-purple-500/30 rounded-2xl shadow-2xl w-[380px] p-6">
          {/* Step dots */}
          <div className="flex gap-1.5 mb-4">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full flex-1 transition-colors ${
                i <= step ? 'bg-purple-500' : 'bg-[#4a4560]'
              }`} />
            ))}
          </div>

          <h3 className="text-lg font-bold text-purple-300 mb-2">{t(s.titleKey)}</h3>
          <p className="text-sm text-[#9ca3af] leading-relaxed mb-5">{t(s.bodyKey)}</p>

          <div className="flex gap-2">
            <button onClick={handleSkip}
              className="px-4 py-2 rounded-lg text-xs text-[#6b6580] hover:text-white transition-colors">
              Skip tutorial
            </button>
            <div className="flex-1" />
            <button onClick={handleNext}
              className="px-5 py-2 rounded-lg bg-purple-700 text-white text-sm font-bold
                         hover:bg-purple-600 transition-colors">
              {step < STEPS.length - 1 ? 'Next' : 'Got it!'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
