export type PillTone = "success" | "warning" | "neutral";

export const PILL_TONE_CLASS: Record<PillTone, string> = {
  success: "bg-teal-deep/10 text-teal-deep",
  warning: "bg-amber/10 text-amber",
  neutral: "bg-panel-tint text-text-400",
};
