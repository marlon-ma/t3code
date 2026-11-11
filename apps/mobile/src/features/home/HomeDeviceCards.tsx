import type { EnvironmentId } from "@t3tools/contracts";
import { ScrollView } from "react-native";

import { DeviceCard } from "../../components/DeviceCard";
import { describeHomeActivity, type HomeDeviceSummary } from "./home-device-summary";

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
      {props.devices.map((device, index) => {
        const selected = device.environmentId === props.selectedEnvironmentId;
        return (
          <DeviceCard
            key={device.environmentId}
            index={index}
            label={device.label}
            statusLabel={
              device.status === "offline" ? "Offline" : describeHomeActivity(device, "Idle")
            }
            detail={
              device.status === "attention" || device.status === "working"
                ? describeHomeActivity(device, "")
                : undefined
            }
            kind={device.machineKind}
            status={device.status}
            selected={selected}
            accessibilityHint={selected ? "Shows all devices" : "Shows only this device"}
            onPress={() => props.onEnvironmentChange(selected ? null : device.environmentId)}
          />
        );
      })}
    </ScrollView>
  );
}
