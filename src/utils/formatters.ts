export function formatVoltage(v: number): string {
  if (Math.abs(v) < 0.01) return '0 V';
  if (Math.abs(v) < 1) return `${(v * 1000).toFixed(0)} mV`;
  return `${v.toFixed(2)} V`;
}

export function formatCurrent(i: number): string {
  if (Math.abs(i) < 0.001) return '0 A';
  if (Math.abs(i) < 0.01) return `${(i * 1000).toFixed(1)} mA`;
  if (Math.abs(i) < 1) return `${(i * 1000).toFixed(0)} mA`;
  return `${i.toFixed(2)} A`;
}

export function formatResistance(r: number): string {
  if (!isFinite(r)) return '∞ Ω';
  if (r === 0) return '0 Ω';
  if (r < 1) return `${(r * 1000).toFixed(0)} mΩ`;
  return `${r.toFixed(1)} Ω`;
}
