import { Easing, LinearTransition, ReduceMotion } from "react-native-reanimated";

/** Mobile counterpart of the web `--ease-emphasized` token: fast start, long settle. */
export const EASE_EMPHASIZED = Easing.bezier(0.2, 0, 0, 1);

/** One-shot state change, such as a lid opening or a drawing assembling. */
export const MOTION_SETTLE = {
  duration: 520,
  easing: EASE_EMPHASIZED,
  reduceMotion: ReduceMotion.System,
} as const;

/** The quicker way back: closing, dimming, leaving. */
export const MOTION_RETREAT = {
  duration: 300,
  easing: EASE_EMPHASIZED,
  reduceMotion: ReduceMotion.System,
} as const;

/** Neighbours making room: rows and cards glide to their new place instead of jumping. */
export const LAYOUT_MAKE_ROOM = LinearTransition.duration(260)
  .easing(EASE_EMPHASIZED)
  .reduceMotion(ReduceMotion.System);
