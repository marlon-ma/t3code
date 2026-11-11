import type { EnvironmentMachineKind } from "@t3tools/contracts";
import Svg, { Circle, Path } from "react-native-svg";
import { useResolveClassNames } from "uniwind";

import type { HomeDeviceStatus } from "./home-device-summary";

const ATTENTION_COLOR = "#FF6A1F";
const ON_SCREEN_COLOR = "#FFFFFF";

type DeviceShape = "laptop" | "mini" | "tower";

function deviceShape(kind: EnvironmentMachineKind | null): DeviceShape {
  if (kind === "laptop") return "laptop";
  if (kind === "mac-mini") return "mini";
  return "tower";
}

function colorOf(style: { readonly backgroundColor?: unknown }, fallback: string): string {
  return typeof style.backgroundColor === "string" ? style.backgroundColor : fallback;
}

/** Flat isometric device drawing; the screen or indicator carries the status colour. */
export function DeviceIllustration(props: {
  readonly kind: EnvironmentMachineKind | null;
  readonly status: HomeDeviceStatus;
  readonly width?: number;
}) {
  const ink = colorOf(useResolveClassNames("bg-foreground"), "#0B1F4B");
  const accent = colorOf(useResolveClassNames("bg-primary"), "#2251FF");
  const surface = colorOf(useResolveClassNames("bg-subtle-strong"), "#DCE6FF");
  const muted = colorOf(useResolveClassNames("bg-foreground-muted"), "#8E8E99");
  const paper = colorOf(useResolveClassNames("bg-screen"), "#FFFFFF");

  const active = props.status === "attention" || props.status === "working";
  const body = active ? ink : muted;
  const edge = active ? accent : surface;
  const signal =
    props.status === "attention" ? ATTENTION_COLOR : props.status === "working" ? accent : surface;
  const width = props.width ?? 80;
  const shape = deviceShape(props.kind);

  return (
    <Svg
      width={width}
      height={(width * 60) / 80}
      viewBox="0 0 80 60"
      fill="none"
      opacity={props.status === "offline" ? 0.5 : 1}
    >
      {shape === "laptop" ? (
        <>
          <Path d="M38 28 L74 40 L76 14 L40 2 Z" fill={body} />
          <Path d="M41.2 26.6 L71.6 36.8 L73.2 16.2 L42.8 6 Z" fill={signal} />
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
          <Path d="M8 42 L44 54 L74 40 L38 28 Z" fill={surface} />
          <Path d="M8 42 L44 54 L44 57 L8 45 Z" fill={body} />
          <Path d="M44 54 L74 40 L74 43 L44 57 Z" fill={edge} />
          <Path d="M30 43.5 L40 46.8 L47 43.5 L37 40.2 Z" fill={paper} />
        </>
      ) : shape === "mini" ? (
        <>
          <Path d="M40 24 L68 34 L40 44 L12 34 Z" fill={surface} />
          <Path d="M12 34 L40 44 L40 54 L12 44 Z" fill={body} />
          <Path d="M40 44 L68 34 L68 44 L40 54 Z" fill={edge} />
          <Path d="M40 30 L50 33.6 L40 37.2 L30 33.6 Z" fill={paper} />
          <Circle cx={19} cy={41.5} r={2.2} fill={active ? signal : paper} />
        </>
      ) : (
        <>
          <Path d="M40 6 L62 14 L40 22 L18 14 Z" fill={surface} />
          <Path d="M18 14 L40 22 L40 56 L18 48 Z" fill={body} />
          <Path d="M40 22 L62 14 L62 48 L40 56 Z" fill={edge} />
          <Path d="M22 22 L36 27 L36 30 L22 25 Z" fill={active ? signal : paper} />
          <Path d="M22 30 L36 35 L36 38 L22 33 Z" fill={paper} opacity={0.6} />
        </>
      )}
    </Svg>
  );
}
