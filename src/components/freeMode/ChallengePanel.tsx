import { useChallengeStore } from '../../store/challengeStore';
import { useFreeModeStore } from '../../store/freeModeStore';

export function ChallengePanel() {
  const { active, targetResistance, bestScore, message, messageType, newChallenge, checkResult } = useChallengeStore();
  const totalResistance = useFreeModeStore((s) => s.totalResistance);

  if (!active) return null;

  const colorMap = {
    success: 'border-green-500 bg-green-950/40 text-green-400',
    warning: 'border-amber-500 bg-amber-950/40 text-amber-400',
    info: 'border-blue-500 bg-blue-950/40 text-blue-400',
  };

  return (
    <div className="shrink-0 mx-4 mt-2 rounded-xl border border-purple-500/30 bg-purple-950/30 px-4 py-3 text-xs">
      <div className="flex items-center gap-3">
        <span className="text-purple-400 text-lg shrink-0">🎯</span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-purple-300 mb-1">Challenge Mode</div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2">
            <span className="text-[#8b83a8]">
              Target: <span className="text-purple-300 font-bold text-sm">{targetResistance} Ω</span> (±5%)
            </span>
            <span className="text-[#8b83a8]">
              Current: <span className="text-purple-300 font-bold text-sm">
                {isFinite(totalResistance) && totalResistance > 0 ? `${totalResistance.toFixed(2)} Ω` : '—'}
              </span>
            </span>
            <span className="text-[#8b83a8]">
              Best: <span className="text-purple-300 font-bold">{bestScore}</span>
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => checkResult(totalResistance)}
              className="px-3 py-1 rounded-lg bg-purple-700 text-white text-[10px] font-bold hover:bg-purple-600 transition-colors">
              Check
            </button>
            <button
              onClick={newChallenge}
              className="px-3 py-1 rounded-lg bg-purple-900/30 text-purple-400 text-[10px] font-bold hover:bg-purple-900/50 transition-colors border border-purple-700/30">
              New Challenge
            </button>
          </div>
        </div>
      </div>
      {message && (
        <div className={`mt-2 px-3 py-1.5 rounded-lg border text-[11px] font-semibold ${colorMap[messageType]}`}>
          {message}
        </div>
      )}
    </div>
  );
}
