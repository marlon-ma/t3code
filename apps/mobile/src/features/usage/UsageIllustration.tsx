import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { useIllustrationPalette } from "../../components/illustrationPalette";
import { MOTION_SETTLE } from "../../lib/motion";

/** An isometric box: a diamond top face centred on (cx, cy) with its two visible sides below. */
function Box(props: {
  readonly cx: number;
  readonly cy: number;
  readonly w: number;
  readonly depth: number;
  readonly top: string;
  readonly left: string;
  readonly right: string;
}) {
  const { cx, cy, w, depth } = props;
  const h = w / 2;
  return (
    <>
      <Path
        d={`M${cx - w} ${cy} L${cx} ${cy + h} L${cx} ${cy + h + depth} L${cx - w} ${cy + depth} Z`}
        fill={props.left}
      />
      <Path
        d={`M${cx} ${cy + h} L${cx + w} ${cy} L${cx + w} ${cy + depth} L${cx} ${cy + h + depth} Z`}
        fill={props.right}
      />
      <Path
        d={`M${cx} ${cy - h} L${cx + w} ${cy} L${cx} ${cy + h} L${cx - w} ${cy} Z`}
        fill={props.top}
      />
    </>
  );
}

const BAR_HEIGHTS = [8, 16, 26] as const;

/** Flat isometric bar chart for the usage page's empty states; matches the spot drawings. */
export function UsageIllustration(props: { readonly width?: number }) {
  const { ink, accent, surface } = useIllustrationPalette();
  const width = props.width ?? 104;
  return (
    <Animated.View
      entering={FadeIn.duration(MOTION_SETTLE.duration)
        .easing(MOTION_SETTLE.easing)
        .reduceMotion(ReduceMotion.System)}
    >
      <Svg width={width} height={(width * 60) / 80} viewBox="0 0 80 60" fill="none">
        <Box cx={40} cy={37} w={34} depth={4} top={surface} left={ink} right={accent} />
        {BAR_HEIGHTS.map((height, index) => (
          <Box
            key={height}
            cx={24 + index * 16}
            cy={37 - height}
            w={7}
            depth={height}
            top={surface}
            left={ink}
            right={accent}
          />
        ))}
      </Svg>
    </Animated.View>
  );
}
