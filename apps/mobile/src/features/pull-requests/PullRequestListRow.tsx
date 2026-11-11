import {
  capitalizeTerm,
  sourceControlClients,
} from "@t3tools/client-runtime/source-control-clients";
import { memo } from "react";
import { Platform, Pressable, View } from "react-native";
import { AppText as Text } from "../../components/ui/AppText";
import { SymbolView } from "../../components/ui/AppSymbol";
import { Menu } from "../../components/ui/Menu";
import type { MenuProps } from "../../components/ui/Menu.types";
import { StatusDot } from "../../components/ui/StatusDot";
import { cn } from "../../lib/cn";
import { MOBILE_SHAPE } from "../../lib/designTokens";
import { RelativeTime } from "../../components/RelativeTime";
import {
  selectedThreadRowColors,
  THREAD_LIST_V2_SIDEBAR_ROW_STYLE,
  THREAD_LIST_V2_SIDEBAR_ROW_CONTAINER_STYLE,
} from "../threads/thread-list-v2-row-appearance";
import { PullRequestAvatar, PullRequestDiffStats } from "./PullRequestPresentation";
import {
  pullRequestLabelColor,
  pullRequestListReviewStatus,
  pullRequestListRowsAreEqual,
  type EnvironmentPullRequestListEntry,
} from "./pullRequestList";
import {
  pullRequestChecksStatus,
  pullRequestConflict,
  pullRequestListDot,
  pullRequestStatus,
} from "./pullRequestStatus";
import { PullRequestGlyph } from "./pullRequestGlyphs";

const GROUP_RADIUS =
  Platform.OS === "android" ? MOBILE_SHAPE.group.android : MOBILE_SHAPE.group.ios;

export const PullRequestListRow = memo(
  function PullRequestListRow(props: {
    readonly item: EnvironmentPullRequestListEntry;
    readonly onSelect: (item: EnvironmentPullRequestListEntry) => void;
    readonly selected: boolean;
    readonly sidebar: boolean;
    /** Position in the list: full-width rows draw one grouped card between them. */
    readonly first: boolean;
    readonly last: boolean;
    readonly busy: boolean;
    readonly getActions: (item: EnvironmentPullRequestListEntry) => MenuProps["actions"];
    readonly onAction: (item: EnvironmentPullRequestListEntry, action: string) => void;
  }) {
    const { item } = props;
    const foreground = props.selected
      ? selectedThreadRowColors.foregroundClassName
      : props.sidebar
        ? "text-drawer-foreground"
        : "text-foreground";
    const mutedForeground = props.selected
      ? selectedThreadRowColors.mutedForegroundClassName
      : props.sidebar
        ? "text-drawer-foreground-muted"
        : "text-foreground-muted";
    const tertiaryForeground = props.selected
      ? selectedThreadRowColors.mutedForegroundClassName
      : props.sidebar
        ? "text-drawer-foreground-muted"
        : "text-foreground-tertiary";
    const status = pullRequestStatus(item);
    const conflict = pullRequestConflict(item);
    const review = pullRequestListReviewStatus(item);
    const checks = item.checksState ? pullRequestChecksStatus(item.checksState) : null;
    const dot = pullRequestListDot(item);
    return (
      <View
        style={props.sidebar ? THREAD_LIST_V2_SIDEBAR_ROW_CONTAINER_STYLE : undefined}
        className={props.sidebar ? undefined : "px-4"}
      >
        <Menu
          shouldOpenOnLongPress
          title={`#${item.number} · ${item.repository}`}
          actions={props.getActions(item)}
          onPressAction={({ nativeEvent }) => props.onAction(item, nativeEvent.event)}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: props.selected, busy: props.busy }}
            accessibilityLabel={`${capitalizeTerm(sourceControlClients.get(item.provider).changeRequest.singular)} ${item.number}, ${item.title}, ${status.label}${conflict ? `, ${conflict.label.toLowerCase()}` : ""}, by ${item.author?.login ?? "unknown author"}${review ? `, ${review.accessibleLabel}` : ""}${item.checksState ? `, checks ${item.checksState}` : ""}${item.stack ? `, stack ${item.stack.position} of ${item.stack.size}` : ""}${item.labels.length ? `, ${item.labels.map((label) => label.name).join(", ")}` : ""}, ${item.additions} additions, ${item.deletions} deletions`}
            accessibilityHint="Double tap to open. Touch and hold for quick actions."
            onPress={() => props.onSelect(item)}
            disabled={props.busy}
            style={
              props.sidebar
                ? THREAD_LIST_V2_SIDEBAR_ROW_STYLE
                : {
                    borderTopLeftRadius: props.first ? GROUP_RADIUS : 0,
                    borderTopRightRadius: props.first ? GROUP_RADIUS : 0,
                    borderBottomLeftRadius: props.last ? GROUP_RADIUS : 0,
                    borderBottomRightRadius: props.last ? GROUP_RADIUS : 0,
                  }
            }
            className={cn(
              "flex-row gap-3 overflow-hidden",
              !props.sidebar && "border-continuous pl-4 active:bg-row-hover",
              !props.sidebar && !props.selected && "bg-grouped-card",
              props.sidebar && "bg-drawer",
              props.sidebar && !props.selected && "active:bg-thread-hover",
              props.selected && "bg-thread-selected",
              props.busy && "opacity-50",
            )}
          >
            {/* Centred on the repository line, which is as tall as its 16pt avatar. */}
            <View
              className={cn(
                "h-4 w-2 items-center justify-center self-start",
                !props.sidebar && "mt-2.5",
              )}
            >
              {"tone" in dot ? (
                <StatusDot tone={dot.tone} />
              ) : (
                <View className={cn("size-2 rounded-full", dot.className)} />
              )}
            </View>
            <View
              className={cn(
                "min-w-0 flex-1 gap-1",
                // The last row keeps a clear hairline so every row measures the same.
                !props.sidebar && "border-b py-2.5 pr-4",
                !props.sidebar && (props.last ? "border-transparent" : "border-border-subtle"),
              )}
            >
              <View className="flex-row items-center gap-1.5">
                <PullRequestAvatar actor={item.author} size={16} />
                <Text className={cn("min-w-0 flex-1 text-xs", mutedForeground)} numberOfLines={1}>
                  {item.repository} <Text className={tertiaryForeground}>#{item.number}</Text>
                </Text>
                {item.stack ? (
                  <View className="flex-row items-center gap-1">
                    <SymbolView
                      name={PullRequestGlyph.stack}
                      size={12}
                      tintColorClassName={
                        props.selected
                          ? selectedThreadRowColors.mutedIconTintClassName
                          : props.sidebar
                            ? "accent-drawer-foreground-muted"
                            : "accent-foreground-muted"
                      }
                    />
                    <Text className={cn("text-2xs tabular-nums", mutedForeground)}>
                      {item.stack.position}/{item.stack.size}
                    </Text>
                  </View>
                ) : null}
                <Text className={cn("text-2xs tabular-nums", tertiaryForeground)}>
                  <RelativeTime timestamp={item.updatedAt} />
                </Text>
              </View>
              <Text
                className={cn("text-base leading-5 font-t3-medium", foreground)}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {item.title}
              </Text>
              <View className="flex-row items-center gap-1.5">
                <View className="min-w-0 flex-1 flex-row items-center gap-1">
                  {item.labels.slice(0, 2).map((label) => {
                    const color = pullRequestLabelColor(label.color);
                    return (
                      <View
                        key={label.name}
                        className="min-w-0 shrink flex-row items-center gap-1 rounded-md bg-subtle px-1.5 py-0.5"
                        style={{
                          maxWidth: 160,
                          ...(color ? { backgroundColor: `${color}20` } : {}),
                        }}
                      >
                        {color ? (
                          <View
                            style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }}
                          />
                        ) : null}
                        <Text
                          className={cn("shrink text-2xs font-t3-medium", mutedForeground)}
                          numberOfLines={1}
                        >
                          {label.name}
                        </Text>
                      </View>
                    );
                  })}
                  {item.labels.length > 2 ? (
                    <Text className={cn("shrink-0 text-2xs", tertiaryForeground)}>
                      +{item.labels.length - 2}
                    </Text>
                  ) : null}
                </View>
                {conflict ? (
                  <View className="shrink-0" accessibilityLabel={conflict.label}>
                    <SymbolView
                      name={PullRequestGlyph.conflicting}
                      size={13}
                      tintColorClassName="accent-danger-foreground"
                    />
                  </View>
                ) : null}
                {checks ? (
                  <View className="shrink-0" accessibilityLabel={`Checks ${item.checksState}`}>
                    <SymbolView name={checks.icon} size={13} tintColorClassName={checks.tint} />
                  </View>
                ) : null}
                {review ? (
                  <View className="shrink-0" accessibilityLabel={review.accessibleLabel}>
                    <SymbolView name={review.icon} size={13} tintColorClassName={review.tint} />
                  </View>
                ) : null}
                {item.additions || item.deletions ? (
                  <PullRequestDiffStats
                    additions={item.additions}
                    deletions={item.deletions}
                    compact
                  />
                ) : null}
              </View>
            </View>
          </Pressable>
        </Menu>
      </View>
    );
  },
  (previous, next) =>
    pullRequestListRowsAreEqual(previous.item, next.item) &&
    previous.selected === next.selected &&
    previous.sidebar === next.sidebar &&
    previous.first === next.first &&
    previous.last === next.last &&
    previous.busy === next.busy &&
    previous.onSelect === next.onSelect &&
    previous.onAction === next.onAction &&
    previous.getActions === next.getActions,
);
