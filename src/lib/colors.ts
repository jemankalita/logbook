/** A fixed palette that reads well on the dark theme; names map to a stable color. */
export const PALETTE = ["#4f8cff", "#39d353", "#f59e0b", "#ec4899", "#a78bfa", "#22d3ee", "#f97316", "#84cc16", "#ef4444", "#14b8a6"];

export function hashString(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function areaColor(name: string): string {
  return PALETTE[hashString(name.toLowerCase()) % PALETTE.length];
}
