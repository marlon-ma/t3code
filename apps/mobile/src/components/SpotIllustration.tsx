import { useEffect } from "react";
import Animated, {
  interpolate,
  useAnimatedProps,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, G, Path } from "react-native-svg";

import { MOTION_SETTLE } from "../lib/motion";
import { useIllustrationPalette } from "./illustrationPalette";

export type SpotIllustrationKind =
  | "threads"
  | "project"
  | "archive"
  | "terminal"
  | "pullRequest"
  | "file"
  | "search";

const ON_ACCENT_COLOR = "#FFFFFF";

const AnimatedG = Animated.createAnimatedComponent(G);

/** One piece of a drawing; pieces settle into place bottom first, each a beat after the last. */
function Layer(props: {
  readonly progress: SharedValue<number>;
  readonly order: number;
  readonly children: React.ReactNode;
}) {
  const { order, progress } = props;
  const animatedProps = useAnimatedProps(() => {
    const local = interpolate(progress.get(), [order * 0.22, order * 0.22 + 0.56], [0, 1], "clamp");
    return { opacity: local, y: (1 - local) * -7 };
  });
  return <AnimatedG animatedProps={animatedProps}>{props.children}</AnimatedG>;
}

/** An isometric slab: a diamond top face centred on (cx, cy) with two visible sides below it. */
function Tile(props: {
  readonly cx: number;
  readonly cy: number;
  readonly w: number;
  readonly h: number;
  readonly depth: number;
  readonly top: string;
  readonly left: string;
  readonly right: string;
}) {
  const { cx, cy, w, h, depth } = props;
  return (
    <>
      <Path
        d={`M${cx} ${cy - h} L${cx + w} ${cy} L${cx} ${cy + h} L${cx - w} ${cy} Z`}
        fill={props.top}
      />
      <Path
        d={`M${cx - w} ${cy} L${cx} ${cy + h} L${cx} ${cy + h + depth} L${cx - w} ${cy + depth} Z`}
        fill={props.left}
      />
      <Path
        d={`M${cx} ${cy + h} L${cx + w} ${cy} L${cx + w} ${cy + depth} L${cx} ${cy + h + depth} Z`}
        fill={props.right}
      />
    </>
  );
}

/** Flat isometric drawing for empty and placeholder states; shares the device drawings' palette. */
export function SpotIllustration(props: {
  readonly kind: SpotIllustrationKind;
  readonly width?: number;
}) {
  const { ink, accent, surface, paper } = useIllustrationPalette();
  const width = props.width ?? 104;
  const progress = useSharedValue(0);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- plays the one-shot assemble animation on the UI thread when the drawing mounts
  useEffect(() => {
    progress.set(withTiming(1, { ...MOTION_SETTLE, duration: 700 }));
  }, [progress]);
  const sides = { left: ink, right: accent };

  return (
    <Svg width={width} height={(width * 60) / 80} viewBox="0 0 80 60" fill="none">
      {props.kind === "threads" ? (
        <>
          <Layer progress={progress} order={0}>
            <Tile cx={32} cy={38} w={24} h={9} depth={4} top={surface} {...sides} />
          </Layer>
          <Layer progress={progress} order={1}>
            <Tile cx={48} cy={22} w={24} h={9} depth={4} top={accent} left={ink} right={surface} />
            <Path
              d="M38 18.2 L52 23.4 M34 21.8 L44 25.6"
              stroke={ON_ACCENT_COLOR}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Layer>
        </>
      ) : props.kind === "project" ? (
        <>
          <Layer progress={progress} order={0}>
            <Tile cx={40} cy={42} w={28} h={10} depth={4} top={surface} {...sides} />
          </Layer>
          <Layer progress={progress} order={1}>
            <Tile cx={40} cy={31} w={28} h={10} depth={4} top={surface} {...sides} />
          </Layer>
          <Layer progress={progress} order={2}>
            <Tile cx={40} cy={20} w={28} h={10} depth={4} top={accent} left={ink} right={surface} />
            <Path d="M40 15.5 L52 20 L40 24.5 L28 20 Z" fill={ON_ACCENT_COLOR} />
          </Layer>
        </>
      ) : props.kind === "archive" ? (
        <>
          <Layer progress={progress} order={0}>
            <Tile cx={40} cy={22} w={25} h={10} depth={22} top={surface} {...sides} />
            <Path d="M15 22 L40 32 L40 37 L15 27 Z" fill={paper} opacity={0.22} />
          </Layer>
          <Layer progress={progress} order={1}>
            <Path d="M22 34 L33 38.4 L33 42.4 L22 38 Z" fill={paper} />
          </Layer>
        </>
      ) : props.kind === "terminal" ? (
        <>
          <Layer progress={progress} order={0}>
            <Tile cx={40} cy={20} w={27} h={10} depth={22} top={surface} {...sides} />
          </Layer>
          <Layer progress={progress} order={1}>
            <Path
              d="M19 28.5 L25 33.4 L19 35.6 M28 38.6 L35 41.4"
              stroke={paper}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Layer>
        </>
      ) : props.kind === "pullRequest" ? (
        <>
          <Layer progress={progress} order={0}>
            <Tile cx={26} cy={36} w={14} h={6} depth={10} top={surface} {...sides} />
          </Layer>
          <Layer progress={progress} order={1}>
            <Tile cx={54} cy={20} w={14} h={6} depth={10} top={accent} left={ink} right={surface} />
          </Layer>
          <Layer progress={progress} order={2}>
            <Path d="M27 33 L53 21" stroke={ink} strokeWidth={2.4} strokeLinecap="round" />
          </Layer>
        </>
      ) : props.kind === "file" ? (
        <>
          <Layer progress={progress} order={0}>
            <Tile cx={36} cy={38} w={22} h={12} depth={2} top={surface} {...sides} />
          </Layer>
          <Layer progress={progress} order={1}>
            <Tile cx={44} cy={26} w={22} h={12} depth={2} top={paper} {...sides} />
            <Path
              d="M36 22 L50 27.6 M32 25.6 L46 31.2 M34 29 L42 32.2"
              stroke={ink}
              strokeWidth={1.8}
              strokeLinecap="round"
            />
          </Layer>
        </>
      ) : (
        <>
          <Layer progress={progress} order={0}>
            <Tile cx={40} cy={40} w={28} h={10} depth={4} top={surface} {...sides} />
          </Layer>
          <Layer progress={progress} order={1}>
            <Path d="M46 31 L55 40" stroke={accent} strokeWidth={4.5} strokeLinecap="round" />
            <Circle cx={38} cy={23} r={11} fill={paper} stroke={ink} strokeWidth={4} />
          </Layer>
        </>
      )}
    </Svg>
  );
}
