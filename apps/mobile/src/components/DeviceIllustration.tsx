import type { EnvironmentMachineKind } from "@t3tools/contracts";
import { useEffect } from "react";
import Animated, {
  Easing,
  interpolate,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { G, Path } from "react-native-svg";

import { EASE_EMPHASIZED, MOTION_RETREAT, MOTION_SETTLE } from "../lib/motion";
import { useIllustrationPalette } from "./illustrationPalette";

const ATTENTION_COLOR = "#FF6A1F";
const ON_SCREEN_COLOR = "#FFFFFF";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

/** What the drawing's screen or indicator reports. */
export type DeviceIllustrationStatus = "attention" | "working" | "idle" | "offline";

type DeviceShape = "laptop" | "mini" | "tower";

function deviceShape(kind: EnvironmentMachineKind | null): DeviceShape {
  if (kind === "laptop") return "laptop";
  if (kind === "mac-mini") return "mini";
  return "tower";
}

// The lid swings on the base's back edge. In this projection a point on its far edge is the
// hinge plus a mix of two offsets: lying on the keyboard (shut) and standing upright (open).
const HINGE_LEFT = { x: 38, y: 28 };
const HINGE_RIGHT = { x: 74, y: 40 };
const LID_SHUT = { x: -30, y: 12 };
const LID_OPEN = { x: 2, y: -26 };
// Below this the lid is seen from behind, so the screen stays hidden until it swings past.
const LID_EDGE_ON = 0.44;

/** A flat face of the drawing: a corner plus the two edges leaving it, in view-box units. */
interface Plane {
  readonly ox: number;
  readonly oy: number;
  readonly ax: number;
  readonly ay: number;
  readonly ux: number;
  readonly uy: number;
}

function lidPlane(open: number): Plane {
  "worklet";
  const angle = (open * Math.PI) / 2;
  return {
    ox: HINGE_LEFT.x,
    oy: HINGE_LEFT.y,
    ax: HINGE_RIGHT.x - HINGE_LEFT.x,
    ay: HINGE_RIGHT.y - HINGE_LEFT.y,
    ux: Math.cos(angle) * LID_SHUT.x + Math.sin(angle) * LID_OPEN.x,
    uy: Math.cos(angle) * LID_SHUT.y + Math.sin(angle) * LID_OPEN.y,
  };
}

function planePoint(plane: Plane, across: number, up: number): string {
  "worklet";
  return `${plane.ox + across * plane.ax + up * plane.ux} ${plane.oy + across * plane.ay + up * plane.uy}`;
}

function lidQuad(open: number, left: number, right: number, near: number, far: number): string {
  "worklet";
  const plane = lidPlane(open);
  return `M${planePoint(plane, left, near)} L${planePoint(plane, right, near)} L${planePoint(plane, right, far)} L${planePoint(plane, left, far)} Z`;
}

/** Where a face sits on its plane, in fractions of the plane's two edges. */
interface FaceSpec {
  readonly plane: Plane | null;
  readonly eyes: readonly [number, number];
  readonly eyeUp: number;
  /** Half the height of an open eye, and half the width of a smiling one. */
  readonly eyeHeight: number;
  readonly eyeWidth: number;
  /** How far a full glance slides the eyes sideways. */
  readonly glance: number;
  readonly mouthUp: number;
  readonly mouthWidth: number;
  readonly mouthDepth: number;
  readonly stroke: number;
}

const FACES: Record<DeviceShape, FaceSpec> = {
  // The laptop's face is on its screen, so its plane is the moving lid.
  laptop: {
    plane: null,
    eyes: [0.37, 0.65],
    eyeUp: 0.58,
    eyeHeight: 0.105,
    eyeWidth: 0.07,
    glance: 0.09,
    mouthUp: 0.3,
    mouthWidth: 0.075,
    mouthDepth: 0.07,
    stroke: 2.6,
  },
  mini: {
    plane: { ox: 12, oy: 44, ax: 28, ay: 10, ux: 0, uy: -10 },
    eyes: [0.36, 0.64],
    eyeUp: 0.56,
    eyeHeight: 0.17,
    eyeWidth: 0.075,
    glance: 0.08,
    mouthUp: 0.2,
    mouthWidth: 0.06,
    mouthDepth: 0.1,
    stroke: 2,
  },
  tower: {
    plane: { ox: 18, oy: 48, ax: 22, ay: 8, ux: 0, uy: -34 },
    eyes: [0.3, 0.7],
    eyeUp: 0.72,
    eyeHeight: 0.062,
    eyeWidth: 0.12,
    glance: 0.1,
    mouthUp: 0.56,
    mouthWidth: 0.11,
    mouthDepth: 0.035,
    stroke: 2.4,
  },
};

/**
 * Both eyes as one path. `arc` bends each from an upright bar into a curve: 1 is a smile,
 * -1 the shallow droop of a machine that is asleep. `blink` squeezes the bar shut.
 */
function eyesPath(
  plane: Plane,
  face: FaceSpec,
  scale: number,
  blink: number,
  arc: number,
  look: number,
): string {
  "worklet";
  const bend = Math.abs(arc);
  const curve = arc > 0 ? 1 : -0.5;
  const height = face.eyeHeight * scale;
  const halfWidth = face.eyeWidth * bend;
  const bar = height * blink * (1 - bend);
  const foot = face.eyeUp - bar - curve * height * 0.4 * bend;
  const head = face.eyeUp + bar - curve * height * 0.4 * bend;
  const peak = face.eyeUp + curve * height * 1.3 * bend;
  let d = "";
  for (const eye of face.eyes) {
    const x = eye + look * face.glance;
    d += `M${planePoint(plane, x - halfWidth, foot)} Q${planePoint(plane, x, peak)} ${planePoint(plane, x + halfWidth, head)} `;
  }
  return d;
}

function mouthPath(plane: Plane, face: FaceSpec): string {
  "worklet";
  return `M${planePoint(plane, 0.5 - face.mouthWidth, face.mouthUp)} Q${planePoint(plane, 0.5, face.mouthUp - face.mouthDepth * 2)} ${planePoint(plane, 0.5 + face.mouthWidth, face.mouthUp)}`;
}

const QUICK = { reduceMotion: ReduceMotion.System } as const;

function quick(duration: number) {
  return { ...QUICK, duration, easing: EASE_EMPHASIZED };
}

/**
 * Flat isometric device drawing with a face; the screen or the eyes carry the status colour. A
 * laptop opens its lid when it comes online and shuts it when it drops off; other machines wake
 * up. An online device blinks and glances now and then, reads while it works, and hops with a
 * smile when nudged.
 */
export function DeviceIllustration(props: {
  readonly kind: EnvironmentMachineKind | null;
  readonly status: DeviceIllustrationStatus;
  readonly width?: number;
  /** Milliseconds to wait before the first open, to stagger a row of devices. */
  readonly delay?: number;
  /** Change this to make an online device hop and smile, as when it is picked. */
  readonly nudge?: number;
}) {
  const { ink, accent, surface, muted, paper } = useIllustrationPalette();
  const online = props.status !== "offline";
  // Starts shut so the first frame is the closed machine, then opens to its real state.
  const open = useSharedValue(0);
  const blink = useSharedValue(1);
  const arc = useSharedValue(-1);
  const look = useSharedValue(0);
  const lift = useSharedValue(0);
  const squash = useSharedValue(1);
  const sway = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const { delay = 0, nudge = 0 } = props;

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- drives the UI-thread lid animation from the device's connection state
  useEffect(() => {
    open.set(
      online
        ? withDelay(open.get() === 0 ? delay : 0, withTiming(1, MOTION_SETTLE))
        : withTiming(0, MOTION_RETREAT),
    );
  }, [delay, online, open]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- wakes or puts to sleep the UI-thread face with the device's connection state
  useEffect(() => {
    arc.set(online ? withDelay(arc.get() === -1 ? delay + 260 : 0, withTiming(0, quick(320))) : -1);
  }, [arc, delay, online]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- plays the hop and smile on the UI thread when the caller nudges the device
  useEffect(() => {
    if (nudge === 0 || !online) return;
    blink.set(withSequence(withTiming(0.15, quick(70)), withTiming(1, quick(140))));
    arc.set(withSequence(withTiming(1, quick(150)), withDelay(950, withTiming(0, quick(240)))));
    look.set(withTiming(0, quick(120)));
    lift.set(
      withSequence(
        withTiming(1.5, quick(80)),
        withTiming(-8, { ...QUICK, duration: 190, easing: Easing.out(Easing.quad) }),
        withSpring(0, { ...QUICK, duration: 460, dampingRatio: 0.55 }),
      ),
    );
    squash.set(
      withSequence(
        withTiming(0.92, quick(80)),
        withTiming(1.05, quick(190)),
        withSpring(1, { ...QUICK, duration: 460, dampingRatio: 0.55 }),
      ),
    );
  }, [arc, blink, lift, look, nudge, online, squash]);

  const needsYou = props.status === "attention";
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- shakes the drawing on the UI thread the moment the device starts needing the user
  useEffect(() => {
    if (!needsYou) return;
    sway.set(
      withDelay(
        delay + 500,
        withSequence(
          withTiming(-3, quick(60)),
          withTiming(3, quick(90)),
          withTiming(-2, quick(90)),
          withTiming(0, quick(120)),
        ),
      ),
    );
  }, [delay, needsYou, sway]);

  const working = props.status === "working";
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- schedules short bursts of life (a blink, a glance, a read) instead of a loop that repaints every frame
  useEffect(() => {
    if (!online || reduceMotion) return;
    let timer: ReturnType<typeof setTimeout>;
    const act = () => {
      const roll = Math.random();
      const shut = withTiming(0.1, quick(70));
      const reopen = withTiming(1, quick(130));
      if (working) {
        // Reading: the eyes travel a line, then flick back to the start of the next.
        look.set(
          withSequence(
            withTiming(-1, quick(260)),
            withTiming(1, { ...QUICK, duration: 1100, easing: Easing.inOut(Easing.quad) }),
            withTiming(0, quick(240)),
          ),
        );
        blink.set(withDelay(1380, withSequence(shut, reopen)));
      } else if (roll < 0.25) {
        const side = roll < 0.125 ? -1 : 1;
        look.set(
          withSequence(withTiming(side, quick(240)), withDelay(700, withTiming(0, quick(300)))),
        );
      } else if (roll < 0.4) {
        blink.set(withSequence(shut, reopen, shut, reopen));
      } else {
        blink.set(withSequence(shut, reopen));
      }
      timer = setTimeout(act, (working ? 2600 : 3200) + Math.random() * 3200);
    };
    timer = setTimeout(act, delay + 1400 + Math.random() * 2400);
    return () => clearTimeout(timer);
  }, [blink, delay, look, online, reduceMotion, working]);

  const shape = deviceShape(props.kind);
  const face = FACES[shape];
  // Wide eyed when it needs you, narrowed while it concentrates.
  const eyeScale = needsYou ? 1.3 : working ? 0.8 : 1;

  const lidProps = useAnimatedProps(() => ({ d: lidQuad(open.get(), 0, 1, 0, 1) }));
  const screenProps = useAnimatedProps(() => ({
    d: lidQuad(open.get(), 0.085, 0.93, 0.093, 0.885),
    opacity: interpolate(open.get(), [LID_EDGE_ON, 0.62], [0, 1], "clamp"),
  }));
  const screenContentProps = useAnimatedProps(() => ({
    opacity: interpolate(open.get(), [0.85, 1], [0, 1], "clamp"),
  }));
  const powerProps = useAnimatedProps(() => ({
    opacity: interpolate(open.get(), [0, 1], [0.45, 1]),
    y: interpolate(open.get(), [0, 1], [3, 0]),
  }));
  const eyesProps = useAnimatedProps(() => ({
    d: eyesPath(
      face.plane ?? lidPlane(open.get()),
      face,
      eyeScale,
      blink.get(),
      arc.get(),
      look.get(),
    ),
  }));
  const mouthProps = useAnimatedProps(() => ({
    d: mouthPath(face.plane ?? lidPlane(open.get()), face),
    opacity: interpolate(arc.get(), [0.2, 1], [0, 1], "clamp"),
  }));
  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sway.get() }, { translateY: lift.get() }, { scaleY: squash.get() }],
  }));

  const active = props.status === "attention" || props.status === "working";
  // Only an unreachable device loses its ink; an idle one is on, just not busy.
  const body = online ? ink : muted;
  const edge = active ? accent : surface;
  const signal =
    props.status === "attention" ? ATTENTION_COLOR : props.status === "working" ? accent : surface;
  const width = props.width ?? 80;
  const height = (width * 60) / 80;
  // A laptop's eyes are drawn on its lit screen. The other machines' eyes sit on the dark
  // front, where the accent is too close to the ink to read, so only "needs you" colours them.
  const eyeColor =
    shape === "laptop" ? (active ? ON_SCREEN_COLOR : ink) : needsYou ? signal : paper;
  const faceMarks = (
    <>
      <AnimatedPath
        animatedProps={eyesProps}
        stroke={eyeColor}
        strokeWidth={face.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <AnimatedPath
        animatedProps={mouthProps}
        stroke={eyeColor}
        strokeWidth={face.stroke * 0.8}
        strokeLinecap="round"
      />
    </>
  );

  return (
    <Animated.View style={[{ width, height, transformOrigin: "50% 100%" }, bodyStyle]}>
      <Svg width={width} height={height} viewBox="0 0 80 60" fill="none">
        {shape === "laptop" ? (
          <>
            <Path d="M8 42 L44 54 L74 40 L38 28 Z" fill={surface} />
            <Path d="M8 42 L44 54 L44 57 L8 45 Z" fill={body} />
            <Path d="M44 54 L74 40 L74 43 L44 57 Z" fill={edge} />
            <Path d="M30 43.5 L40 46.8 L47 43.5 L37 40.2 Z" fill={paper} />
            <AnimatedPath animatedProps={lidProps} fill={body} />
            <AnimatedPath animatedProps={screenProps} fill={signal} />
            <AnimatedG animatedProps={screenContentProps}>{faceMarks}</AnimatedG>
          </>
        ) : shape === "mini" ? (
          <AnimatedG animatedProps={powerProps}>
            <Path d="M40 24 L68 34 L40 44 L12 34 Z" fill={surface} />
            <Path d="M12 34 L40 44 L40 54 L12 44 Z" fill={body} />
            <Path d="M40 44 L68 34 L68 44 L40 54 Z" fill={edge} />
            <Path d="M40 30 L50 33.6 L40 37.2 L30 33.6 Z" fill={paper} />
            {faceMarks}
          </AnimatedG>
        ) : (
          <AnimatedG animatedProps={powerProps}>
            <Path d="M40 6 L62 14 L40 22 L18 14 Z" fill={surface} />
            <Path d="M18 14 L40 22 L40 56 L18 48 Z" fill={body} />
            <Path d="M40 22 L62 14 L62 48 L40 56 Z" fill={edge} />
            {faceMarks}
          </AnimatedG>
        )}
      </Svg>
    </Animated.View>
  );
}
