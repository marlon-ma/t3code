import { Pressable } from "react-native";
import type { EnvironmentMachineKind } from "@t3tools/contracts";
import type { EnvironmentConnectionPhase } from "@t3tools/client-runtime/connection";
import { EnvironmentMachineSymbol } from "../../components/EnvironmentMachineSymbol";
import { AppText as Text } from "../../components/ui/AppText";
import { SymbolView } from "../../components/ui/AppSymbol";

import { StatusDot } from "../../components/ui/StatusDot";
import { connectionActivityTone } from "../connection/connectionTone";

export function DraftEnvironmentControl(props: {
  readonly label: string;
  readonly connectionState: EnvironmentConnectionPhase;
  readonly machineKind: EnvironmentMachineKind;
  readonly disabled: boolean;
  readonly onChooseEnvironment: () => void;
}) {
  const disconnected = props.connectionState !== "connected";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Choose environment, ${props.label}, ${disconnected ? "Offline" : "Connected"}`}
      disabled={props.disabled}
      onPress={props.onChooseEnvironment}
      className="flex-row items-center gap-1.5 rounded-xl px-3 py-2 active:opacity-65"
    >
      <EnvironmentMachineSymbol
        kind={props.machineKind}
        size={13}
        tintColorClassName="accent-icon-muted"
      />
      <StatusDot tone={connectionActivityTone(props.connectionState)} size={6} />
      <Text className="shrink text-sm text-foreground-muted" numberOfLines={1}>
        on {props.label}
      </Text>
      <SymbolView name="chevron.right" size={11} tintColorClassName="accent-icon-muted" />
    </Pressable>
  );
}
