import type { EnvironmentMachineKind } from "@t3tools/contracts";
import { useEffect } from "react";
import Animated, {
  interpolate,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, G, Path } from "react-native-svg";

import { MOTION_RETREAT, MOTION_SETTLE } from "../lib/motion";
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

function lidQuad(open: number, left: number, right: number, near: number, far: number): string {
  "worklet";
  const angle = (open * Math.PI) / 2;
  const dx = Math.cos(angle) * LID_SHUT.x + Math.sin(angle) * LID_OPEN.x;
  const dy = Math.cos(angle) * LID_SHUT.y + Math.sin(angle) * LID_OPEN.y;
  const hx = HINGE_RIGHT.x - HINGE_LEFT.x;
  const hy = HINGE_RIGHT.y - HINGE_LEFT.y;
  const point = (across: number, up: number) =>
    `${HINGE_LEFT.x + across * hx + up * dx} ${HINGE_LEFT.y + across * hy + up * dy}`;
  return `M${point(left, near)} L${point(right, near)} L${point(right, far)} L${point(left, far)} Z`;
}

/**
 * Flat isometric device drawing; the screen or indicator carries the status colour. A laptop
 * opens its lid when it comes online and shuts it when it drops off; other machines power up.
 */
export function DeviceIllustration(props: {
  readonly kind: EnvironmentMachineKind | null;
  readonly status: DeviceIllustrationStatus;
  readonly width?: number;
  /** Milliseconds to wait before the first open, to stagger a row of devices. */
  readonly delay?: number;
  /** Change this to make an online device dip its lid and reopen, as when it is picked. */
  readonly nudge?: number;
}) {
  const { ink, accent, surface, muted, paper } = useIllustrationPalette();
  const online = props.status !== "offline";
  // Starts shut so the first frame is the closed machine, then opens to its real state.
  const open = useSharedValue(0);
  const { delay = 0, nudge = 0 } = props;

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- drives the UI-thread lid animation from the device's connection state
  useEffect(() => {
    open.set(
      online
        ? withDelay(open.get() === 0 ? delay : 0, withTiming(1, MOTION_SETTLE))
        : withTiming(0, MOTION_RETREAT),
    );
  }, [delay, online, open]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- replays the lid dip on the UI thread when the caller nudges the device
  useEffect(() => {
    if (nudge === 0 || !online) return;
    open.set(withSequence(withTiming(0.55, MOTION_RETREAT), withTiming(1, MOTION_SETTLE)));
  }, [nudge, online, open]);

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
  const lampProps = useAnimatedProps(() => ({
    opacity: interpolate(open.get(), [0.5, 1], [0, 1], "clamp"),
  }));

  const active = props.status === "attention" || props.status === "working";
  // Only an unreachable device loses its ink; an idle one is on, just not busy.
  const body = online ? ink : muted;
  const edge = active ? accent : surface;
  const signal =
    props.status === "attention" ? ATTENTION_COLOR : props.status === "working" ? accent : surface;
  const width = props.width ?? 80;
  const shape = deviceShape(props.kind);

  return (
    <Svg width={width} height={(width * 60) / 80} viewBox="0 0 80 60" fill="none">
      {shape === "laptop" ? (
        <>
          <Path d="M8 42 L44 54 L74 40 L38 28 Z" fill={surface} />
          <Path d="M8 42 L44 54 L44 57 L8 45 Z" fill={body} />
          <Path d="M44 54 L74 40 L74 43 L44 57 Z" fill={edge} />
          <Path d="M30 43.5 L40 46.8 L47 43.5 L37 40.2 Z" fill={paper} />
          <AnimatedPath animatedProps={lidProps} fill={body} />
          <AnimatedPath animatedProps={screenProps} fill={signal} />
          <AnimatedG animatedProps={screenContentProps}>
            {props.status === "attention" ? (
              <Circle cx={57.5} cy={21.5} r={5.2} fill={ON_SCREEN_COLOR} />
            ) : null}
            {props.status === "working" ? (
              <Path
                d="M47 12.5 L60 16.8 M47 18.5 L67 25.2 M47 24.5 L56 27.5"
                stroke={ON_SCREEN_COLOR}
                strokeWidth={2}
                strokeLinecap="round"
              />
            ) : null}
          </AnimatedG>
        </>
      ) : shape === "mini" ? (
        <AnimatedG animatedProps={powerProps}>
          <Path d="M40 24 L68 34 L40 44 L12 34 Z" fill={surface} />
          <Path d="M12 34 L40 44 L40 54 L12 44 Z" fill={body} />
          <Path d="M40 44 L68 34 L68 44 L40 54 Z" fill={edge} />
          <Path d="M40 30 L50 33.6 L40 37.2 L30 33.6 Z" fill={paper} />
          <AnimatedG animatedProps={lampProps}>
            <Circle cx={19} cy={41.5} r={2.2} fill={active ? signal : paper} />
          </AnimatedG>
        </AnimatedG>
      ) : (
        <AnimatedG animatedProps={powerProps}>
          <Path d="M40 6 L62 14 L40 22 L18 14 Z" fill={surface} />
          <Path d="M18 14 L40 22 L40 56 L18 48 Z" fill={body} />
          <Path d="M40 22 L62 14 L62 48 L40 56 Z" fill={edge} />
          <AnimatedG animatedProps={lampProps}>
            <Path d="M22 22 L36 27 L36 30 L22 25 Z" fill={active ? signal : paper} />
            <Path d="M22 30 L36 35 L36 38 L22 33 Z" fill={paper} opacity={0.6} />
          </AnimatedG>
        </AnimatedG>
      )}
    </Svg>
  );
}
