/**
 * The app's single motion vocabulary. Components take durations, easings and springs
 * from here instead of hard-coding them, so everything moves the same way.
 */
export const motionTokens = {
  duration: { instant: 0.08, fast: 0.16, normal: 0.24, slow: 0.48 },
  easing: {
    out: [0.22, 1, 0.36, 1],
    inOut: [0.4, 0, 0.2, 1],
  },
  distance: { xs: 4, sm: 8, md: 16 },
} as const;

export const springs = {
  /** Sliding selection pills (sidebar, segmented controls). */
  snappy: { type: "spring", stiffness: 420, damping: 36, mass: 0.9 },
  /** Dialogs and sheets landing. */
  gentle: { type: "spring", stiffness: 260, damping: 28 },
} as const;
