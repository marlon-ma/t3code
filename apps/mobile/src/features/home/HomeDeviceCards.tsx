import type { EnvironmentId } from "@t3tools/contracts";
import { Pressable, ScrollView, View } from "react-native";

import { AppText as Text } from "../../components/ui/AppText";
import { WorkspaceHeading } from "../../components/ui/WorkspaceHeading";
import { cn } from "../../lib/cn";
import { DeviceIllustration } from "./DeviceIllustration";
import { describeHomeActivity, type HomeDeviceSummary } from "./home-device-summary";

function deviceStatusLabel(device: HomeDeviceSummary): string {
  return device.status === "offline" ? "Offline" : describeHomeActivity(device, "Idle");
}

export function HomeDeviceCards(props: {
  readonly devices: ReadonlyArray<HomeDeviceSummary>;
  readonly selectedEnvironmentId: EnvironmentId | null;
  readonly onEnvironmentChange: (environmentId: EnvironmentId | null) => void;
  /** List padding the scroller bleeds through so cards start where row content does. */
  readonly gutter: number;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -props.gutter }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, gap: 10 }}
    >
      {props.devices.map((device) => {
        const selected = device.environmentId === props.selectedEnvironmentId;
        const statusLabel = deviceStatusLabel(device);
        return (
          <Pressable
            key={device.environmentId}
            accessibilityRole="button"
            accessibilityLabel={`${device.label}, ${statusLabel}`}
            accessibilityHint={selected ? "Shows all devices" : "Shows only this device"}
            accessibilityState={{ selected }}
            onPress={() => props.onEnvironmentChange(selected ? null : device.environmentId)}
            className={cn(
              "w-30 rounded-2xl border-2 bg-grouped-card px-3 pb-3 pt-2",
              selected ? "border-foreground" : "border-transparent",
            )}
          >
            <View className="items-start">
              <DeviceIllustration kind={device.machineKind} status={device.status} width={76} />
            </View>
            <WorkspaceHeading className="mt-1 text-xs" numberOfLines={1}>
              {device.label}
            </WorkspaceHeading>
            <Text
              className={cn(
                "text-2xs",
                device.status === "attention"
                  ? "font-t3-bold text-warning-foreground"
                  : "text-foreground-muted",
              )}
              numberOfLines={1}
            >
              {statusLabel}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
