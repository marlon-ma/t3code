import { NativeScrollView } from "../../native/NativeScrollViewMarker";
import { useSearchToolbarInset } from "../../components/ui/useBarInset";
import { ScreenScrollView as ScrollView } from "../../components/ui/ScreenScrollView";
import { LegendList } from "@legendapp/list/react-native";
import { type StaticScreenProps, useNavigation } from "@react-navigation/native";
import {
  filterThirdPartyLicenseEntries,
  findThirdPartyLicenseEntry,
  formatLicenseBundles,
  thirdPartyLicenseEntryKey,
  type ThirdPartyLicenseEntry,
} from "@t3tools/shared/thirdPartyLicenses";
import { useMemo, useState } from "react";
import { Linking, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SpotIllustration } from "../../components/SpotIllustration";
import { SymbolView } from "../../components/ui/AppSymbol";
import { EmptyState } from "../../components/ui/EmptyState";
import { AppText as Text } from "../../components/ui/AppText";
import { ListRow } from "../../components/ui/ListRow";
import { MOBILE_SHAPE } from "../../lib/designTokens";
import { SettingsScreen } from "./components/SettingsScreen";

import { getMobileThirdPartyLicenses } from "./mobileThirdPartyLicenses";

function useMobileThirdPartyLicenses() {
  return useMemo(() => {
    try {
      return getMobileThirdPartyLicenses();
    } catch {
      return null;
    }
  }, []);
}

const GROUP_RADIUS =
  Platform.OS === "android" ? MOBILE_SHAPE.group.android : MOBILE_SHAPE.group.ios;

// Each row draws its own slice of the grouped card, since the list is virtualized.
function LicenseRow(props: {
  readonly entry: ThirdPartyLicenseEntry;
  readonly first: boolean;
  readonly last: boolean;
  readonly onPress: () => void;
}) {
  return (
    <View
      className={
        props.first
          ? "overflow-hidden border-continuous"
          : "overflow-hidden border-t border-border-subtle border-continuous"
      }
      style={{
        borderTopLeftRadius: props.first ? GROUP_RADIUS : 0,
        borderTopRightRadius: props.first ? GROUP_RADIUS : 0,
        borderBottomLeftRadius: props.last ? GROUP_RADIUS : 0,
        borderBottomRightRadius: props.last ? GROUP_RADIUS : 0,
      }}
    >
      <ListRow
        label={props.entry.name}
        description={[props.entry.version, props.entry.license].filter(Boolean).join(" · ")}
        onPress={props.onPress}
      />
    </View>
  );
}

export function SettingsOpenSourceLicensesRouteScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const search = {
    value: query,
    onChangeText: setQuery,
    placeholder: "Search packages",
    accessibilityLabel: "Search open-source licenses",
    clearAccessibilityLabel: "Clear package search",
  };
  const searchInset = useSearchToolbarInset(search);
  const manifest = useMobileThirdPartyLicenses();
  const entries = manifest?.entries ?? [];
  const filteredEntries = filterThirdPartyLicenseEntries(entries, query);
  const renderItem = ({
    item,
    index,
  }: {
    readonly item: ThirdPartyLicenseEntry;
    readonly index: number;
  }) => (
    <LicenseRow
      entry={item}
      first={index === 0}
      last={index === filteredEntries.length - 1}
      onPress={() =>
        navigation.navigate("SettingsOpenSourceLicense", {
          entryKey: thirdPartyLicenseEntryKey(item),
        })
      }
    />
  );

  if (!manifest) {
    return (
      <SettingsScreen title="Open source licenses">
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-base text-foreground-muted">
            License notices are unavailable in this build.
          </Text>
        </View>
      </SettingsScreen>
    );
  }

  return (
    <SettingsScreen title="Open source licenses" search={search}>
      <LegendList
        renderScrollComponent={NativeScrollView}
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom:
            searchInset + (Platform.OS === "ios" ? 18 : Math.max(insets.bottom, 18) + 18),
        }}
        contentInsetAdjustmentBehavior="automatic"
        data={filteredEntries}
        estimatedItemSize={78}
        // The last row's rounding depends on how many rows the search leaves.
        extraData={filteredEntries.length}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        keyExtractor={thirdPartyLicenseEntryKey}
        ListEmptyComponent={
          <EmptyState
            variant="plain"
            illustration={<SpotIllustration kind="search" />}
            title="No results"
            detail="No licenses match that search."
          />
        }
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />
    </SettingsScreen>
  );
}

type LicenseDetailProps = StaticScreenProps<{ readonly entryKey: string }>;

export function SettingsOpenSourceLicenseRouteScreen({ route }: LicenseDetailProps) {
  const insets = useSafeAreaInsets();
  const manifest = useMobileThirdPartyLicenses();
  const entry = manifest
    ? findThirdPartyLicenseEntry(manifest.entries, route.params.entryKey)
    : undefined;
  const sourceUrl = entry?.sourceUrl?.match(/^https?:\/\//) ? entry.sourceUrl : null;

  if (!entry) {
    return (
      <SettingsScreen title="License notice">
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-base text-foreground-muted">
            This license notice is unavailable.
          </Text>
        </View>
      </SettingsScreen>
    );
  }

  return (
    <SettingsScreen title="License notice">
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-5 px-5 pt-4"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 18) + 18 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-2 px-1">
          <Text className="text-2xl font-workspace text-foreground">{entry.name}</Text>
          <Text className="text-base leading-normal text-foreground-muted">
            {[entry.version, entry.license, formatLicenseBundles(entry.bundles)]
              .filter((value): value is string => Boolean(value))
              .join(" · ")}
          </Text>
          {sourceUrl ? (
            <Pressable
              accessibilityHint="Opens the project website"
              accessibilityRole="link"
              onPress={() => void Linking.openURL(sourceUrl)}
              className="min-h-12 flex-row items-center gap-2 self-start py-2 active:opacity-60"
            >
              <Text className="font-t3-medium text-primary-text">Project source</Text>
              <SymbolView
                name="arrow.up.right"
                size={16}
                tintColorClassName={"accent-primary-text"}
                type="monochrome"
                weight="semibold"
              />
            </Pressable>
          ) : null}
        </View>

        <View
          className="overflow-hidden border-continuous bg-grouped-card p-4"
          style={{ borderRadius: GROUP_RADIUS }}
        >
          <Text selectable className="font-mono text-base leading-normal text-foreground">
            {entry.noticeText}
          </Text>
        </View>
      </ScrollView>
    </SettingsScreen>
  );
}
