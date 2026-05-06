import { create } from 'zustand';

interface ChallengeState {
  active: boolean;
  targetResistance: number;
  tolerance: number; // percentage
  score: number;
  bestScore: number;
  message: string | null;
  messageType: 'success' | 'info' | 'warning';

  newChallenge: () => void;
  checkResult: (actualR: number) => void;
  setActive: (a: boolean) => void;
}

/** Generate a random integer target within achievable range */
function randomTarget(): number {
  // Target ranges: easy to build with 1-3 10Ω components
  const options = [
    5, 10, 15, 20, 25, 30, // single or pair
    3, 6, 8, 12, 18, 24, // fractions
  ];
  return options[Math.floor(Math.random() * options.length)];
}

function calcStars(actual: number, target: number): number {
  const err = Math.abs(actual - target) / target;
  if (err <= 0.02) return 3;
  if (err <= 0.05) return 2;
  if (err <= 0.10) return 1;
  return 0;
}

function calcScore(actual: number, target: number): number {
  const err = Math.abs(actual - target) / target;
  return Math.max(0, Math.round((1 - err) * 1000));
}

export const useChallengeStore = create<ChallengeState>((set) => ({
  active: false,
  targetResistance: 10,
  tolerance: 5,
  score: 0,
  bestScore: 0,
  message: null,
  messageType: 'info',

  newChallenge: () => set({
    active: true,
    targetResistance: randomTarget(),
    tolerance: 5,
    score: 0,
    message: null,
  }),

  checkResult: (actualR) => {
    set((s) => {
      const target = s.targetResistance;
      const stars = calcStars(actualR, target);
      const pts = calcScore(actualR, target);
      const best = Math.max(s.bestScore, pts);

      let message: string;
      let messageType: ChallengeState['messageType'];
      if (stars === 3) {
        message = `Perfect! ${actualR.toFixed(1)}Ω matches ${target}Ω`;
        messageType = 'success';
      } else if (stars >= 1) {
        message = `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)} ${actualR.toFixed(1)}Ω (target: ${target}Ω)`;
        messageType = 'success';
      } else if (actualR > 0 && isFinite(actualR)) {
        message = `${actualR.toFixed(1)}Ω is too far from ${target}Ω`;
        messageType = 'warning';
      } else {
        message = 'Wire your circuit and check again';
        messageType = 'info';
      }

      return { score: pts, bestScore: best, message, messageType };
    });
  },

  setActive: (a) => set({ active: a, message: null }),
}));
