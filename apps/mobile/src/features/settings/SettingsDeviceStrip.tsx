import { useAtomValue } from "@effect/atom-react";
import { useNavigation } from "@react-navigation/native";
import { resolveEnvironmentMachineKind } from "@t3tools/contracts";
import { View } from "react-native";

import { DeviceCard, DeviceCardStrip } from "../../components/DeviceCard";
import type { ConnectedEnvironmentSummary } from "../../state/remote-runtime-types";
import { serverEnvironment } from "../../state/server";
import { useRemoteConnections } from "../../state/use-remote-environment-registry";

function SettingsDeviceCard(props: {
  readonly environment: ConnectedEnvironmentSummary;
  readonly index: number;
}) {
  const navigation = useNavigation();
  const { environment } = props;
  const config = useAtomValue(serverEnvironment.configValueAtom(environment.environmentId));
  const connected = environment.isEnabled && environment.connectionState === "connected";
  return (
    <DeviceCard
      index={props.index}
      label={environment.environmentLabel}
      statusLabel={connected ? "Connected" : environment.isEnabled ? "Offline" : "Turned off"}
      kind={config ? resolveEnvironmentMachineKind(config) : null}
      status={connected ? "idle" : "offline"}
      accessibilityHint="Opens this environment's settings"
      onPress={() =>
        navigation.navigate("SettingsEnvironmentDetail", {
          environmentId: environment.environmentId,
        })
      }
    />
  );
}

/** Saved environments as cards above the Settings list; each opens that environment's page. */
export function SettingsDeviceStrip() {
  const { connectedEnvironments } = useRemoteConnections();
  if (connectedEnvironments.length === 0) return null;
  return (
    // Pulled up through the list's top padding so the cards sit exactly where Home's do.
    <View style={{ marginTop: -12 }}>
      <DeviceCardStrip bleed={20}>
        {connectedEnvironments.map((environment, index) => (
          <SettingsDeviceCard
            key={environment.environmentId}
            environment={environment}
            index={index}
          />
        ))}
      </DeviceCardStrip>
    </View>
  );
}
