import { useState } from "react";
import { View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";

import { cn } from "../../lib/cn";
import { CSS_EASE_EMPHASIZED } from "../../lib/motion";

/** What something is doing right now, as the one colour vocabulary every screen shares. */
export type ActivityTone = "attention" | "failed" | "working" | "idle" | "offline";

const TONE_CLASS_NAMES: Record<ActivityTone, string> = {
  attention: "bg-warning-foreground",
  failed: "bg-danger-foreground",
  working: "bg-primary",
  idle: "bg-emerald-500",
  offline: "bg-foreground-muted/50",
};

/** Tones worth a glance when something turns into them. */
const RINGING_TONES: ReadonlySet<ActivityTone> = new Set(["attention", "failed", "working"]);

const RING_STYLE = {
  animationName: {
    from: { opacity: 0.5, transform: [{ scale: 1 }] },
    to: { opacity: 0, transform: [{ scale: 3 }] },
  },
  animationDuration: 900,
  animationTimingFunction: CSS_EASE_EMPHASIZED,
  animationIterationCount: 2,
  animationFillMode: "forwards" as const,
};

const DOT_STYLE = { transitionProperty: "backgroundColor" as const, transitionDuration: 220 };

/**
 * A status as a dot: orange needs you, red has failed, blue is working, green is fine, grey is
 * unreachable. A dot that changes into a tone that matters rings twice; it does not ring when it
 * first appears, so a list scrolling into view stays still.
 */
export function StatusDot(props: { readonly tone: ActivityTone; readonly size?: number }) {
  const size = props.size ?? 8;
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(props.tone);
  const [rings, setRings] = useState(0);
  if (shown !== props.tone) {
    setShown(props.tone);
    if (RINGING_TONES.has(props.tone)) setRings(rings + 1);
  }
  return (
    <View style={{ width: size, height: size }}>
      {rings > 0 && !reduceMotion && RINGING_TONES.has(props.tone) ? (
        <Animated.View
          key={rings}
          pointerEvents="none"
          className={cn("absolute inset-0 rounded-full", TONE_CLASS_NAMES[props.tone])}
          style={RING_STYLE}
        />
      ) : null}
      <Animated.View
        className={cn("rounded-full", TONE_CLASS_NAMES[props.tone])}
        style={[{ width: size, height: size }, DOT_STYLE]}
      />
    </View>
  );
}
