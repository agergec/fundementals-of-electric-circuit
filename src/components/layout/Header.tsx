import { Zap } from 'lucide-react';

export function Header() {
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
      <span className="text-xs text-[#8b83a8] mt-1">
        Build circuits. See the electricity flow!
      </span>
    </header>
  );
}
