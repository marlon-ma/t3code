import { useAtomValue } from "@effect/atom-react";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, G, Rect } from "react-native-svg";

import { appAtomRegistry } from "../../state/atom-registry";
import { useBuddyTheme } from "./BuddyFace";
import { buddyLaunchAnchorAtom, buddyLaunchLandedAtom } from "./buddyLaunchState";

const AnimatedRect = Animated.createAnimatedComponent(Rect);

// The first frame must match the native splash: assets/buddy/splash.png at imageWidth 220
// on the screen colour, both set in app.config.ts.
const FACE_SIZE = 220;
const EYES = [
  { key: "left", width: 94, height: 224, x: -28, y: -18, rotate: 13 },
  { key: "right", width: 76, height: 196, x: 122, y: -34, rotate: 11 },
] as const;

const HOLD_MS = 620;
const ANCHOR_WAIT_MS = 900;
const TRAVEL_MS = 600;

const rgb = (color: readonly [number, number, number]) => `rgb(${color.join(",")})`;

function Eye(props: {
  readonly eye: (typeof EYES)[number];
  readonly open: SharedValue<number>;
  readonly fill: string;
}) {
  const { eye, open } = props;
  const animatedProps = useAnimatedProps(() => {
    const height = eye.height * open.get();
    return { height, y: -height / 2 };
  });
  return (
    <G transform={`translate(${eye.x} ${eye.y}) rotate(${eye.rotate})`}>
      <AnimatedRect
        x={-eye.width / 2}
        width={eye.width}
        rx={eye.width / 2}
        fill={props.fill}
        animatedProps={animatedProps}
      />
    </G>
  );
}

function BuddyLaunchOverlay(props: { readonly ready: boolean; readonly onDone: () => void }) {
  const { ready, onDone } = props;
  const anchor = useAtomValue(buddyLaunchAnchorAtom);
  const reduceMotion = useReducedMotion();
  const theme = useBuddyTheme();
  const window = useWindowDimensions();
  const [phase, setPhase] = useState<"hold" | "seek" | "leaving">("hold");

  const open = useSharedValue(1);
  const travel = useSharedValue(0);
  const fade = useSharedValue(1);
  const landing = useSharedValue({ x: 0, y: 0, scale: 1 });

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- blinks, then holds the big face briefly once the native splash is gone
  useEffect(() => {
    if (!ready || phase !== "hold") return;
    if (!reduceMotion) {
      open.set(
        withDelay(
          220,
          withSequence(
            withTiming(0.08, { duration: 80 }),
            withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic) }),
          ),
        ),
      );
    }
    const timer = setTimeout(() => setPhase("seek"), reduceMotion ? 200 : HOLD_MS);
    return () => clearTimeout(timer);
  }, [ready, phase, reduceMotion, open]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- starts the flight once the header face can be measured
  useEffect(() => {
    if (phase !== "seek") return;
    const finish = () => {
      appAtomRegistry.set(buddyLaunchLandedAtom, true);
      fade.set(withTiming(0, { duration: 160 }, () => runOnJS(onDone)()));
    };
    const leaveInPlace = () => {
      setPhase("leaving");
      appAtomRegistry.set(buddyLaunchLandedAtom, true);
      fade.set(withTiming(0, { duration: 240 }, () => runOnJS(onDone)()));
    };
    if (reduceMotion) {
      leaveInPlace();
      return;
    }
    if (!anchor) {
      // No header face on the first screen (a deep link, say): fade out where it is.
      const timer = setTimeout(leaveInPlace, ANCHOR_WAIT_MS);
      return () => clearTimeout(timer);
    }
    anchor.measureInWindow((x, y, width, height) => {
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const onScreen =
        width > 0 &&
        centerX > 0 &&
        centerX < window.width &&
        centerY > 0 &&
        centerY < window.height;
      if (!onScreen) {
        leaveInPlace();
        return;
      }
      setPhase("leaving");
      landing.set({
        x: centerX - window.width / 2,
        y: centerY - window.height / 2,
        scale: width / FACE_SIZE,
      });
      travel.set(
        withTiming(1, { duration: TRAVEL_MS, easing: Easing.bezier(0.65, 0, 0.35, 1) }, () =>
          runOnJS(finish)(),
        ),
      );
    });
  }, [phase, anchor, reduceMotion, window.width, window.height, fade, travel, landing, onDone]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: fade.get() }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, travel.get() * 1.35),
  }));
  const faceStyle = useAnimatedStyle(() => {
    const t = travel.get();
    const to = landing.get();
    return {
      transform: [
        { translateX: to.x * t },
        { translateY: to.y * t },
        { scale: 1 + (to.scale - 1) * t },
      ],
    };
  });
  const screen = rgb(theme.eye);

  return (
    <Animated.View
      accessibilityElementsHidden
      pointerEvents={phase === "leaving" ? "none" : "auto"}
      style={[StyleSheet.absoluteFill, styles.center, containerStyle]}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: screen }, backdropStyle]}
      />
      <Animated.View style={faceStyle}>
        <Svg width={FACE_SIZE} height={FACE_SIZE} viewBox="-327 -327 654 654">
          <Circle r={322} fill={rgb(theme.body)} />
          {EYES.map((eye) => (
            <Eye key={eye.key} eye={eye} open={open} fill={screen} />
          ))}
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Carries the native splash into the app: Buddy's big face blinks, then shrinks onto the
 * header face while the app appears behind it.
 */
export function BuddyLaunch(props: { readonly ready: boolean }) {
  const [done, setDone] = useState(Platform.OS !== "ios");
  return done ? null : <BuddyLaunchOverlay ready={props.ready} onDone={() => setDone(true)} />;
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
