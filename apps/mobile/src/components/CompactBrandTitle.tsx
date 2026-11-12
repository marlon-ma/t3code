import { NATIVE_WORKSPACE_COLUMNS_SUPPORTED } from "../native/NativeWorkspaceColumns";
import { useAtomValue } from "@effect/atom-react";
import Constants from "expo-constants";
import { useEffect, useState, type ComponentRef, type ReactNode } from "react";
import { Animated, Platform, View } from "react-native";

import { AppText as Text } from "./ui/AppText";
import { BuddyFace } from "../features/buddy/BuddyFace";
import { buddyLaunchAnchorAtom, buddyLaunchLandedAtom } from "../features/buddy/buddyLaunchState";
import { appAtomRegistry } from "../state/atom-registry";
import { IPAD_HOME_TITLE_OFFSET } from "../lib/layoutMetrics";
import { resolveMobileStageLabel } from "../lib/mobileBranding";
import { useAndroidControlSizing } from "./ui/useAndroidControlSizing";

const BRAND_MAX_FONT_SCALE = 1.4;

export function brandTitleOffset(): number {
  if (Platform.OS !== "ios") return 0;
  return Platform.isPad && !NATIVE_WORKSPACE_COLUMNS_SUPPORTED ? IPAD_HOME_TITLE_OFFSET : 0;
}

export function CompactBrandTitle(
  props: {
    readonly allowFontScaling?: boolean;
    readonly accessibilityLabel?: string;
    /** Fills the row and hides the stage badge when the full title does not fit. */
    readonly fit?: boolean;
    /** Replaces the wordmark beside the logo, so tabs can name themselves without moving it. */
    readonly label?: string;
  } = {},
) {
  const stageLabel = resolveMobileStageLabel(Constants.expoConfig?.extra?.appVariant);
  const titleOffset = brandTitleOffset();
  const { scale } = useAndroidControlSizing();
  const [availableWidth, setAvailableWidth] = useState<number | null>(null);
  // Measured only while the badge shows, so hiding it does not make it look like it fits.
  const [fullWidth, setFullWidth] = useState<number | null>(null);
  const landed = useAtomValue(buddyLaunchLandedAtom);
  const label = props.label ?? "Buddy";
  const showStage =
    label === "Buddy" &&
    (!props.fit || availableWidth === null || fullWidth === null || fullWidth <= availableWidth);

  const title = (
    <View
      onLayout={
        props.fit && showStage ? (event) => setFullWidth(event.nativeEvent.layout.width) : undefined
      }
      aria-level={1}
      accessibilityLabel={props.accessibilityLabel ?? "Buddy, Threads"}
      accessible
      role="heading"
      className="flex-row items-center gap-1.5"
      style={[
        { marginLeft: titleOffset },
        Platform.OS === "android" && { gap: 5.25 * scale },
        props.fit && { flexShrink: 0 },
      ]}
    >
      {/* Hidden until the launch face lands here, so the two never show together. */}
      <View
        ref={landed ? undefined : setLaunchAnchor}
        collapsable={false}
        style={landed ? undefined : { opacity: 0 }}
      >
        <BuddyFace size={Math.round(24 * scale)} />
      </View>
      {/* A logo beside a fixed-size wordmark: it may grow with Dynamic Type, not crowd the bar. */}
      <WordFadeIn key={label}>
        <Text
          allowFontScaling={props.allowFontScaling}
          maxFontSizeMultiplier={BRAND_MAX_FONT_SCALE}
          className="font-t3-bold text-foreground"
          style={{ fontSize: 21 * scale, letterSpacing: -0.5 * scale }}
        >
          {label}
        </Text>
      </WordFadeIn>
      {showStage ? (
        <View
          className="rounded-full bg-subtle px-1.5 py-0.5"
          style={
            Platform.OS === "android"
              ? { paddingHorizontal: 5.25 * scale, paddingVertical: 1.75 * scale }
              : undefined
          }
        >
          <Text
            allowFontScaling={props.allowFontScaling}
            maxFontSizeMultiplier={BRAND_MAX_FONT_SCALE}
            className="font-t3-bold text-foreground-muted uppercase"
            style={{ fontSize: 9 * scale, letterSpacing: 0.9 * scale }}
          >
            {stageLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );

  return props.fit ? (
    <View
      className="min-w-0 flex-1 flex-row items-center"
      onLayout={(event) => setAvailableWidth(event.nativeEvent.layout.width)}
    >
      {title}
    </View>
  ) : (
    title
  );
}

function setLaunchAnchor(view: ComponentRef<typeof View> | null) {
  if (view) appAtomRegistry.set(buddyLaunchAnchorAtom, view);
}

/** Native-driver animation blanks views re-hosted in the native header; use the JS style path. */
function WordFadeIn(props: { readonly children: ReactNode }) {
  const [opacity] = useState(() => new Animated.Value(0));
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- runs the Animated fade when a new word mounts
  useEffect(() => {
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [opacity]);
  return <Animated.View style={{ opacity }}>{props.children}</Animated.View>;
}
