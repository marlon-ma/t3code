import {
  cubicBezier,
  Easing,
  FadeInDown,
  LinearTransition,
  ReduceMotion,
} from "react-native-reanimated";

/** Mobile counterpart of the web `--ease-emphasized` token: fast start, long settle. */
export const EASE_EMPHASIZED = Easing.bezier(0.2, 0, 0, 1);

/** The same curve for style-driven transitions and keyframes. */
export const CSS_EASE_EMPHASIZED = cubicBezier(0.2, 0, 0, 1);

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

/** Press feedback for a tappable surface: it gives a little under the finger and springs back. */
export const PRESS_SCALE_STYLE = {
  transform: [{ scale: 1 }],
  transitionProperty: ["transform", "backgroundColor"] as const,
  transitionDuration: 140,
  transitionTimingFunction: CSS_EASE_EMPHASIZED,
};

export const PRESSED_SCALE_STYLE = { transform: [{ scale: 0.97 }] };

/** Content arriving: it fades up a short way. Stagger siblings by passing each a later delay. */
export function riseIn(delay = 0) {
  return FadeInDown.delay(delay)
    .duration(420)
    .easing(EASE_EMPHASIZED)
    .withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] })
    .reduceMotion(ReduceMotion.System);
}
