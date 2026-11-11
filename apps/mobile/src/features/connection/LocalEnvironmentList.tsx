import type { EnvironmentId } from "@t3tools/contracts";
import type { ComponentProps } from "react";
import { View } from "react-native";

import { DeviceIllustration } from "../../components/DeviceIllustration";
import { AppText as Text } from "../../components/ui/AppText";
import { ConnectionEnvironmentRow } from "./ConnectionEnvironmentRow";

type EnvironmentRowProps = ComponentProps<typeof ConnectionEnvironmentRow>;

export function LocalEnvironmentList({
  environments,
  expandedId,
  onToggle,
  ...rowActions
}: Pick<
  EnvironmentRowProps,
  "onReconnect" | "onRemove" | "onSetEnabled" | "onUpdate" | "opensDetails"
> & {
  readonly environments: ReadonlyArray<EnvironmentRowProps["environment"]>;
  readonly expandedId: EnvironmentId | null;
  readonly onToggle: (environmentId: EnvironmentId) => void;
}) {
  if (environments.length === 0) {
    return (
      <View
        collapsable={false}
        className="items-center gap-3 rounded-[24px] border-continuous bg-grouped-card px-6 py-8"
      >
        <DeviceIllustration kind="laptop" status="offline" width={104} />
        <Text className="text-center text-sm leading-normal text-foreground-muted">
          No environments connected yet.{"\n"}Tap{" "}
          <Text className="font-t3-bold text-foreground">+</Text> to add one.
        </Text>
      </View>
    );
  }

  return (
    <View
      collapsable={false}
      className="overflow-hidden rounded-[24px] border-continuous bg-grouped-card"
    >
      {environments.map((environment) => (
        <View key={environment.environmentId} collapsable={false}>
          <ConnectionEnvironmentRow
            environment={environment}
            expanded={expandedId === environment.environmentId}
            onToggle={() => onToggle(environment.environmentId)}
            {...rowActions}
          />
        </View>
      ))}
    </View>
  );
}
