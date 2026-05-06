import { useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function HelpModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [section, setSection] = useState<number | null>(null);
  const sections: { title: string; icon: string; items: string[] }[] = t('help.sections', { returnObjects: true }) as any;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#2d2a3e] border border-[#4a4560] rounded-2xl shadow-2xl w-[560px] max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#4a4560] shrink-0">
          <h2 className="text-lg font-bold text-purple-300">{t('help.title')}</h2>
          <button onClick={onClose} className="text-[#6b6580] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
          {Array.isArray(sections) && sections.map((sec, i) => (
            <div key={i} className="bg-[#1e1b2e] rounded-xl border border-[#4a4560]/50 overflow-hidden">
              <button
                onClick={() => setSection(section === i ? null : i)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-lg shrink-0">{sec.icon}</span>
                <span className="text-sm font-semibold text-[#c4b5fd] flex-1">{sec.title}</span>
                <span className="text-[10px] text-[#6b6580]"
                  style={{ transform: section === i ? 'rotate(90deg)' : '' }}>▶</span>
              </button>
              {section === i && (
                <div className="px-4 pb-3 flex flex-col gap-2">
                  {sec.items.map((item, j) => (
                    <div key={j} className="text-xs text-[#9ca3af] leading-relaxed">• {item}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
