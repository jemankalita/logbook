/**
 * Categorical palette for the dark theme, in fixed order. Validated against the
 * panel surface #202020 (lightness band, chroma, colour-blind separation, ≥3:1 contrast).
 */
export const PALETTE = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];

export function hashString(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function areaColor(name: string): string {
  return PALETTE[hashString(name.toLowerCase()) % PALETTE.length];
}
