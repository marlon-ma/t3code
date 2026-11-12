import { useAtom, useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { LegendList } from "@legendapp/list/react-native";
import { useNavigation } from "@react-navigation/native";
import * as Option from "effect/Option";
import { AsyncResult } from "effect/reactivity";
import * as Linking from "expo-linking";
import { memo, useMemo, type ReactNode } from "react";
import { Platform, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppActivityIndicator } from "../../components/ui/AppActivityIndicator";
import { SymbolView, type AppSymbolName } from "../../components/ui/AppSymbol";
import { AppText as Text } from "../../components/ui/AppText";
import { Chip } from "../../components/ui/Chip";
import * as Dialog from "../../components/ui/Dialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { Menu } from "../../components/ui/Menu";
import type { MenuProps } from "../../components/ui/Menu.types";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { useContentTopInset } from "../../components/ui/useBarInset";
import { cn } from "../../lib/cn";
import { MOBILE_SHAPE } from "../../lib/designTokens";
import { NativeScrollView } from "../../native/NativeScrollViewMarker";
import { useNativeColumnLayoutMetrics } from "../../native/native-layout-metrics";
import { useWorkspaceState } from "../../state/workspace";
import { useWorkspaceTabs } from "../layout/workspace/WorkspaceTabsContext";
import {
  trendingFeedAtom,
  trendingFeedKey,
  trendingPeriodAtom,
  trendingSourceAtom,
} from "./trendingAtoms";
import type { TrendingItem, TrendingPeriod, TrendingSource } from "./trendingFeed";

const GROUP_RADIUS =
  Platform.OS === "android" ? MOBILE_SHAPE.group.android : MOBILE_SHAPE.group.ios;

const SOURCES: readonly {
  readonly value: TrendingSource;
  readonly label: string;
  readonly icon: AppSymbolName;
}[] = [
  { value: "github", label: "GitHub", icon: "chevron.left.forwardslash.chevron.right" },
  { value: "hackerNews", label: "Hacker News", icon: { ios: "flame.fill", android: "bolt" } },
  { value: "reddit", label: "Reddit", icon: "bubble.left.and.bubble.right" },
  { value: "x", label: "X", icon: "magnifyingglass" },
];

const PERIODS = [
  { value: "daily", label: "Today" },
  { value: "weekly", label: "This week" },
  { value: "monthly", label: "This month" },
] as const;

const PERIOD_PHRASE: Record<TrendingPeriod, string> = {
  daily: "today",
  weekly: "this week",
  monthly: "this month",
};

type TrendingAction = "open" | "discussion" | "clone" | "explain";

function itemActions(item: TrendingItem): MenuProps["actions"] {
  return [
    { id: "open", title: item.repository ? "Open on GitHub" : "Open", image: "safari" },
    ...(item.discussionUrl
      ? [{ id: "discussion", title: "Open discussion", image: "bubble.left.and.bubble.right" }]
      : []),
    ...(item.repository
      ? [{ id: "clone", title: "Clone as project", image: "folder.badge.plus" }]
      : []),
    ...(item.detail.kind === "x"
      ? []
      : [{ id: "explain", title: "Ask an agent to explain", image: "text.bubble" }]),
  ];
}

function explainPrompt(item: TrendingItem): string {
  if (item.repository) {
    return `Explain what ${item.repository.owner}/${item.repository.name} does, how it is built, and why people are excited about it right now. Point out anything worth borrowing for my own projects.`;
  }
  return [
    `Read ${item.url} and explain what it is about and why people are discussing it.`,
    item.discussionUrl ? `The discussion is at ${item.discussionUrl}.` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

const openUrl = (url: string) =>
  void Linking.openURL(url).catch(() => Dialog.alert("Could not open link", url));

function compactCount(value: number): string {
  if (value < 1000) return String(value);
  const scaled = value / 1000;
  return `${scaled >= 100 ? Math.round(scaled) : Number(scaled.toFixed(1))}k`;
}

/** Stars gained over the period; the heat bars compare rows by it. */
const heatOf = (item: TrendingItem) => (item.detail.kind === "github" ? item.detail.gained : null);

function accessibilityLabelOf(item: TrendingItem, rank: number, period: TrendingPeriod): string {
  const detail = item.detail;
  const facts =
    detail.kind === "github"
      ? [
          detail.language,
          detail.stars === null ? null : `${detail.stars} stars`,
          detail.gained === null ? null : `${detail.gained} stars ${PERIOD_PHRASE[period]}`,
        ]
      : detail.kind === "hackerNews"
        ? [detail.host, `${detail.points} points`, `${detail.comments} comments`]
        : detail.kind === "reddit"
          ? [detail.subreddit, detail.host]
          : ["Search on X"];
  return [detail.kind === "x" ? null : `Number ${rank}`, item.title, item.description, ...facts]
    .filter(Boolean)
    .join(", ");
}

export function TrendingScreen(props: {
  readonly header: ReactNode;
  readonly renderFrame?: (list: ReactNode) => ReactNode;
}) {
  const navigation = useNavigation();
  const workspace = useWorkspaceTabs()!;
  const { environments } = useWorkspaceState();
  const insets = useSafeAreaInsets();
  const contentTopInset = useContentTopInset();
  const columnSafeBottom = useNativeColumnLayoutMetrics()?.safeArea.bottom;
  const bottomSafeArea =
    Platform.OS === "ios" ? (columnSafeBottom ?? insets.bottom) : insets.bottom;
  const [source, setSource] = useAtom(trendingSourceAtom);
  const [period, setPeriod] = useAtom(trendingPeriodAtom);
  const feed = trendingFeedAtom(trendingFeedKey(source, period));
  const result = useAtomValue(feed);
  const refresh = useAtomRefresh(feed);
  const items = AsyncResult.getOrElse(result, () => [] as TrendingItem[]);
  const error = AsyncResult.isFailure(result)
    ? (Option.getOrNull(AsyncResult.error(result))?.message ?? "Could not load what's trending.")
    : null;
  const maxHeat = useMemo(
    () => items.reduce((max, item) => Math.max(max, heatOf(item) ?? 0), 0),
    [items],
  );
  const ranked = source !== "x";

  const onAction = (item: TrendingItem, action: TrendingAction) => {
    if (action === "open") return openUrl(item.url);
    if (action === "discussion")
      return item.discussionUrl ? openUrl(item.discussionUrl) : undefined;
    if (action === "explain") {
      const repo = item.repository;
      // The new-task link finds the project, or offers to clone it, before the prompt lands.
      return openUrl(
        Linking.createURL("new", {
          queryParams: {
            prompt: explainPrompt(item),
            ...(repo ? { repo: `${repo.owner}/${repo.name}` } : {}),
          },
        }),
      );
    }
    const repo = item.repository;
    const environment =
      environments.find((candidate) => candidate.connectionState === "connected") ??
      environments[0];
    if (!repo) return;
    if (!environment) {
      Dialog.alert("Could not clone", "Connect an environment first.");
      return;
    }
    navigation.navigate("AddProjectDestination", {
      environmentId: String(environment.environmentId),
      remoteUrl: `https://github.com/${repo.owner}/${repo.name}.git`,
      repositoryTitle: `${repo.owner}/${repo.name}`,
      repositoryName: repo.name,
    });
  };

  const list = (
    <View className="flex-1 bg-screen">
      <LegendList
        data={items}
        extraData={`${items.length}:${period}:${maxHeat}`}
        keyExtractor={(item) => item.id}
        getItemType={(_item, index) => (ranked && index === 0 ? "hero" : "row")}
        estimatedItemSize={96}
        recycleItems
        refreshControl={
          <RefreshControl
            refreshing={result.waiting && items.length > 0}
            onRefresh={refresh}
            progressViewOffset={Platform.OS === "ios" ? 60 : undefined}
          />
        }
        alwaysBounceVertical
        showsVerticalScrollIndicator={Platform.OS !== "android"}
        renderScrollComponent={Platform.OS === "ios" ? NativeScrollView : undefined}
        contentInsetAdjustmentBehavior="never"
        contentInset={Platform.OS === "ios" ? { top: contentTopInset } : undefined}
        contentContainerStyle={{
          paddingBottom: Math.max(bottomSafeArea, workspace.bottomClearance),
        }}
        ListHeaderComponentStyle={{ zIndex: 1 }}
        ListHeaderComponent={
          <>
            {props.header}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2 px-4 pb-3"
            >
              {SOURCES.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  icon={option.icon}
                  selected={source === option.value}
                  onPress={() => setSource(option.value)}
                />
              ))}
            </ScrollView>
            {ranked ? (
              <View className="px-4 pb-4">
                <SegmentedControl
                  options={PERIODS}
                  selected={period}
                  onSelect={setPeriod}
                  size="compact"
                  role="tab"
                />
              </View>
            ) : (
              <Text className="px-5 pb-3 text-xs text-foreground-tertiary">
                X has no free way to read posts, so these open live searches in X.
              </Text>
            )}
          </>
        }
        renderItem={({ item, index }) =>
          ranked && index === 0 ? (
            <TrendingHero item={item} period={period} onAction={onAction} />
          ) : (
            <TrendingRow
              item={item}
              rank={index + 1}
              ranked={ranked}
              period={period}
              heat={maxHeat > 0 ? (heatOf(item) ?? 0) / maxHeat : null}
              first={index === (ranked ? 1 : 0)}
              last={index === items.length - 1}
              onAction={onAction}
            />
          )
        }
        ListEmptyComponent={
          result.waiting ? (
            <View className="items-center py-12">
              <AppActivityIndicator colorClassName="accent-icon" />
            </View>
          ) : (
            <View className="px-8 py-12">
              <EmptyState
                title={error ? "Couldn't load what's trending" : "Nothing trending"}
                detail={error ?? "Pull to refresh."}
                actionLabel="Try again"
                onAction={refresh}
                variant="plain"
              />
            </View>
          )
        }
      />
    </View>
  );
  return props.renderFrame ? props.renderFrame(list) : list;
}

function ItemMenu(props: {
  readonly item: TrendingItem;
  readonly onAction: (item: TrendingItem, action: TrendingAction) => void;
  readonly children: ReactNode;
}) {
  return (
    <Menu
      title={props.item.title}
      actions={itemActions(props.item)}
      onPressAction={({ nativeEvent }) =>
        props.onAction(props.item, nativeEvent.event as TrendingAction)
      }
    >
      {props.children}
    </Menu>
  );
}

function RepositoryTitle(props: { readonly title: string; readonly large?: boolean }) {
  const slash = props.title.indexOf("/");
  if (slash < 0) {
    return (
      <Text className="text-base font-t3-medium text-foreground" numberOfLines={2}>
        {props.title}
      </Text>
    );
  }
  return (
    <Text
      numberOfLines={props.large ? 2 : 1}
      className={cn(
        "text-foreground",
        props.large ? "text-2xl leading-7 font-t3-bold" : "text-base font-t3-bold",
      )}
    >
      <Text className="font-t3-medium text-foreground-tertiary">
        {props.title.slice(0, slash + 1)}
      </Text>
      {props.title.slice(slash + 1)}
    </Text>
  );
}

function LanguageDot(props: { readonly color: string | null; readonly size?: number }) {
  const size = props.size ?? 8;
  return (
    <View
      className={cn("rounded-full", props.color ? null : "bg-icon-subtle")}
      style={{
        width: size,
        height: size,
        backgroundColor: props.color ?? undefined,
      }}
    />
  );
}

function Fact(props: { readonly icon?: AppSymbolName; readonly children: ReactNode }) {
  return (
    <View className="flex-row items-center gap-1">
      {props.icon ? (
        <SymbolView name={props.icon} size={11} tintColorClassName="accent-icon-muted" />
      ) : null}
      <Text className="text-xs tabular-nums text-foreground-muted" numberOfLines={1}>
        {props.children}
      </Text>
    </View>
  );
}

/** Stars gained, the number GitHub ranks by. */
function GainBadge(props: { readonly gained: number }) {
  return (
    <View className="flex-row items-center gap-1 rounded-full bg-adaptive-emerald-500-a12-a16 px-2 py-0.5">
      <SymbolView name="arrow.up" size={10} tintColorClassName="accent-adaptive-emerald-600-400" />
      <Text className="text-xs font-t3-bold tabular-nums text-adaptive-emerald-700-300">
        {compactCount(props.gained)}
      </Text>
    </View>
  );
}

function PointsBadge(props: { readonly points: number }) {
  return (
    <View className="min-w-11 items-center self-start rounded-xl bg-adaptive-amber-500-a12-a16 px-1.5 py-1">
      <Text className="text-sm font-t3-bold tabular-nums text-adaptive-amber-700-400">
        {compactCount(props.points)}
      </Text>
      <Text className="text-2xs text-adaptive-amber-700-400">pts</Text>
    </View>
  );
}

function SubredditTag(props: { readonly name: string }) {
  return (
    <View className="self-start rounded-full bg-adaptive-rose-500-a12-a16 px-2 py-0.5">
      <Text className="text-2xs font-t3-bold text-adaptive-rose-700-300">{props.name}</Text>
    </View>
  );
}

function HeatBar(props: { readonly heat: number; readonly color: string | null }) {
  return (
    <View className="mt-1 h-1 overflow-hidden rounded-full bg-subtle">
      <View
        className={cn("h-full rounded-full", props.color ? null : "bg-icon-muted")}
        style={{
          width: `${Math.max(4, Math.round(props.heat * 100))}%`,
          backgroundColor: props.color ?? undefined,
        }}
      />
    </View>
  );
}

/** The leader gets a card of its own: the rank, the name, and why it is here. */
const TrendingHero = memo(function TrendingHero(props: {
  readonly item: TrendingItem;
  readonly period: TrendingPeriod;
  readonly onAction: (item: TrendingItem, action: TrendingAction) => void;
}) {
  const { item } = props;
  const detail = item.detail;
  const stripe = detail.kind === "github" ? detail.languageColor : null;
  return (
    <View className="px-4 pb-4">
      <ItemMenu item={item} onAction={props.onAction}>
        <View
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabelOf(item, 1, props.period)}
          accessibilityHint="Double tap for actions."
          style={{ borderRadius: GROUP_RADIUS }}
          className="border-continuous overflow-hidden bg-grouped-card"
        >
          <View
            className={cn(
              "h-1",
              stripe
                ? null
                : detail.kind === "reddit"
                  ? "bg-adaptive-rose-500-400"
                  : detail.kind === "hackerNews"
                    ? "bg-adaptive-amber-500-a25-400-a25"
                    : "bg-icon-muted",
            )}
            style={stripe ? { backgroundColor: stripe } : undefined}
          />
          <Text
            aria-hidden
            className="absolute right-5 top-2 font-t3-extrabold text-foreground opacity-[0.06]"
            style={{ fontSize: 96, lineHeight: 110 }}
          >
            1
          </Text>
          <View className="gap-2.5 px-5 pb-5 pt-4">
            <View className="flex-row items-center gap-2">
              <View className="rounded-full bg-foreground px-2 py-0.5">
                <Text className="text-2xs font-t3-extrabold text-screen">#1</Text>
              </View>
              <Text className="text-xs font-t3-medium uppercase tracking-wider text-foreground-tertiary">
                Top {PERIOD_PHRASE[props.period]}
              </Text>
            </View>
            {detail.kind === "reddit" && detail.subreddit ? (
              <SubredditTag name={detail.subreddit} />
            ) : null}
            {detail.kind === "github" ? (
              <RepositoryTitle title={item.title} large />
            ) : (
              <Text className="text-xl leading-6 font-t3-bold text-foreground" numberOfLines={3}>
                {item.title}
              </Text>
            )}
            {item.description ? (
              <Text className="text-sm leading-5 text-foreground-muted" numberOfLines={3}>
                {item.description}
              </Text>
            ) : null}
            {detail.kind === "github" ? (
              <View className="mt-1 flex-row items-end justify-between gap-3">
                <View className="flex-1 flex-row flex-wrap items-center gap-x-3 gap-y-1">
                  {detail.language ? (
                    <View className="flex-row items-center gap-1.5">
                      <LanguageDot color={detail.languageColor} />
                      <Text className="text-xs text-foreground-muted">{detail.language}</Text>
                    </View>
                  ) : null}
                  {detail.stars !== null ? (
                    <Fact icon="star">{compactCount(detail.stars)}</Fact>
                  ) : null}
                  {detail.forks !== null ? (
                    <Fact icon="arrow.triangle.branch">{compactCount(detail.forks)}</Fact>
                  ) : null}
                </View>
                {detail.gained !== null ? (
                  <View className="items-end">
                    <Text className="text-2xl font-t3-extrabold tabular-nums text-adaptive-emerald-600-400">
                      +{compactCount(detail.gained)}
                    </Text>
                    <Text className="text-2xs text-foreground-tertiary">
                      stars {PERIOD_PHRASE[props.period]}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : detail.kind === "hackerNews" ? (
              <View className="mt-1 flex-row items-end justify-between gap-3">
                <View className="flex-1 gap-1">
                  {detail.host ? <Fact icon="globe">{detail.host}</Fact> : null}
                  <Fact icon="bubble.left">{`${detail.comments} comments`}</Fact>
                </View>
                <View className="items-end">
                  <Text className="text-2xl font-t3-extrabold tabular-nums text-adaptive-amber-700-400">
                    {compactCount(detail.points)}
                  </Text>
                  <Text className="text-2xs text-foreground-tertiary">points</Text>
                </View>
              </View>
            ) : detail.kind === "reddit" && (detail.host || detail.author) ? (
              <View className="flex-row flex-wrap gap-x-3 gap-y-1">
                {detail.host ? <Fact icon="link">{detail.host}</Fact> : null}
                {detail.author ? <Fact>{detail.author}</Fact> : null}
              </View>
            ) : null}
          </View>
        </View>
      </ItemMenu>
    </View>
  );
});

const TrendingRow = memo(function TrendingRow(props: {
  readonly item: TrendingItem;
  readonly rank: number;
  readonly ranked: boolean;
  readonly period: TrendingPeriod;
  /** This row's share of the most stars gained, for the bar under GitHub rows. */
  readonly heat: number | null;
  readonly first: boolean;
  readonly last: boolean;
  readonly onAction: (item: TrendingItem, action: TrendingAction) => void;
}) {
  const { item } = props;
  const detail = item.detail;
  const podium = props.rank <= 3;
  return (
    <View className="px-4">
      <ItemMenu item={item} onAction={props.onAction}>
        <View
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabelOf(item, props.rank, props.period)}
          accessibilityHint="Double tap for actions."
          style={{
            borderTopLeftRadius: props.first ? GROUP_RADIUS : 0,
            borderTopRightRadius: props.first ? GROUP_RADIUS : 0,
            borderBottomLeftRadius: props.last ? GROUP_RADIUS : 0,
            borderBottomRightRadius: props.last ? GROUP_RADIUS : 0,
          }}
          className="border-continuous flex-row overflow-hidden bg-grouped-card pl-3"
        >
          <View className="w-9 pt-3">
            {props.ranked ? (
              <Text
                className={cn(
                  "text-lg font-t3-extrabold tabular-nums",
                  podium ? "text-foreground" : "text-foreground-tertiary",
                )}
              >
                {String(props.rank).padStart(2, "0")}
              </Text>
            ) : (
              <View className="mt-0.5 size-7 items-center justify-center rounded-full bg-subtle">
                <SymbolView name="magnifyingglass" size={13} tintColorClassName="accent-icon" />
              </View>
            )}
          </View>
          <View
            className={cn(
              "min-w-0 flex-1 flex-row gap-3 border-b py-3 pr-4",
              props.last ? "border-transparent" : "border-border-subtle",
            )}
          >
            <View className="min-w-0 flex-1 gap-1">
              {detail.kind === "reddit" && detail.subreddit ? (
                <SubredditTag name={detail.subreddit} />
              ) : null}
              {detail.kind === "github" ? (
                <RepositoryTitle title={item.title} />
              ) : (
                <Text
                  className="text-base leading-5 font-t3-medium text-foreground"
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
              )}
              {item.description ? (
                <Text className="text-sm text-foreground-muted" numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}
              {detail.kind === "github" ? (
                <View className="flex-row items-center gap-3">
                  {detail.language ? (
                    <View className="flex-row items-center gap-1.5">
                      <LanguageDot color={detail.languageColor} />
                      <Text className="text-xs text-foreground-muted">{detail.language}</Text>
                    </View>
                  ) : null}
                  {detail.stars !== null ? (
                    <Fact icon="star">{compactCount(detail.stars)}</Fact>
                  ) : null}
                  <View className="flex-1" />
                  {detail.gained !== null ? <GainBadge gained={detail.gained} /> : null}
                </View>
              ) : detail.kind === "hackerNews" ? (
                <View className="flex-row items-center gap-3">
                  {detail.host ? <Fact icon="globe">{detail.host}</Fact> : null}
                  <Fact icon="bubble.left">{String(detail.comments)}</Fact>
                </View>
              ) : detail.kind === "reddit" && detail.host ? (
                <Fact icon="link">{detail.host}</Fact>
              ) : null}
              {props.heat !== null && detail.kind === "github" ? (
                <HeatBar heat={props.heat} color={detail.languageColor} />
              ) : null}
            </View>
            {detail.kind === "hackerNews" ? <PointsBadge points={detail.points} /> : null}
            {detail.kind === "x" ? (
              <View className="justify-center">
                <SymbolView
                  name="arrow.up.right"
                  size={13}
                  tintColorClassName="accent-icon-muted"
                />
              </View>
            ) : null}
          </View>
        </View>
      </ItemMenu>
    </View>
  );
});
