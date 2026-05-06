import { Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useModeStore } from '../../store/modeStore';
import type { CircuitMode } from '../../store/modeStore';

export function Header() {
  const { t, i18n } = useTranslation();
  const { mode, setMode } = useModeStore();

  return (
    <header className="flex items-center gap-3 px-6 py-3 bg-[#2d2a3e] border-b border-[#4a4560]">
      <div className="flex items-center gap-2">
        <div className="relative">
          <Zap size={28} className="text-amber-400" fill="currentColor" />
          <div className="absolute inset-0 animate-pulse">
            <Zap size={28} className="text-amber-300 opacity-50" fill="currentColor" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">
          Circuit<span className="text-amber-400">Lab</span>
        </h1>
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-lg bg-[#1e1b2e] border border-[#4a4560] overflow-hidden">
        {(['structured', 'free'] as CircuitMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1 text-xs font-bold transition-colors ${
              mode === m
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-[#6b6580] hover:text-[#8b83a8]'
            }`}
          >
            {t(`mode.${m}`)}
          </button>
        ))}
      </div>

      <span className="text-xs text-[#8b83a8] mt-1 flex-1">
        {t('header.tagline')}
      </span>
      {/* Language toggle */}
      <button
        onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'fr' : 'en')}
        className="flex items-center gap-1 px-3 py-1 rounded-md bg-[#1e1b2e] border border-[#4a4560]
                   text-xs font-bold text-[#8b83a8] hover:text-white hover:border-[#6b6580] transition-colors"
        title="Switch language / Changer de langue"
      >
        {i18n.language === 'en' ? '🇫🇷 FR' : '🇬🇧 EN'}
      </button>
    </header>
  );
}
