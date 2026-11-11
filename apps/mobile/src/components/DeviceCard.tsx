import type { EnvironmentMachineKind } from "@t3tools/contracts";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { cn } from "../lib/cn";
import { DeviceIllustration, type DeviceIllustrationStatus } from "./DeviceIllustration";
import { AppText as Text } from "./ui/AppText";
import { StatusDot } from "./ui/StatusDot";
import { WorkspaceHeading } from "./ui/WorkspaceHeading";

/** A device as a small card: its drawing and its name behind a status dot. */
export function DeviceCard(props: {
  readonly label: string;
  /** Read out with the name; on screen the dot's colour carries it. */
  readonly statusLabel: string;
  /** What is going on when something is, such as "2 need you"; a quiet device shows none. */
  readonly detail?: string;
  readonly kind: EnvironmentMachineKind | null;
  readonly status: DeviceIllustrationStatus;
  readonly selected?: boolean;
  /** Position in its row; later cards open a beat after earlier ones. */
  readonly index?: number;
  readonly accessibilityHint?: string;
  readonly onPress: () => void;
}) {
  // Each press replays the lid dip, so picking a device answers on the drawing itself.
  const [nudge, setNudge] = useState(0);
  const tint =
    props.status === "attention"
      ? "bg-warning"
      : props.status === "working"
        ? "bg-primary/10"
        : "bg-grouped-card";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${props.label}, ${props.statusLabel}`}
      accessibilityHint={props.accessibilityHint}
      accessibilityState={props.selected === undefined ? undefined : { selected: props.selected }}
      onPress={() => {
        setNudge((count) => count + 1);
        props.onPress();
      }}
      className={cn(
        "w-40 rounded-3xl px-3.5 pb-3.5 pt-2.5 active:opacity-70",
        // The chosen device is marked by a wash of the accent, not an outline.
        props.selected && props.status !== "attention" ? "bg-primary/12" : tint,
      )}
    >
      <View className="items-start">
        <DeviceIllustration
          kind={props.kind}
          status={props.status}
          width={92}
          delay={(props.index ?? 0) * 90}
          nudge={nudge}
        />
      </View>
      <View className="mt-1.5 flex-row items-center gap-1.5">
        <StatusDot tone={props.status} />
        <WorkspaceHeading className="min-w-0 flex-1 text-sm" numberOfLines={1}>
          {props.label}
        </WorkspaceHeading>
      </View>
      {props.detail ? (
        <Text
          className={cn(
            "text-2xs",
            props.status === "attention"
              ? "font-t3-bold text-warning-foreground"
              : "text-foreground-muted",
          )}
          numberOfLines={1}
        >
          {props.detail}
        </Text>
      ) : null}
    </Pressable>
  );
}
