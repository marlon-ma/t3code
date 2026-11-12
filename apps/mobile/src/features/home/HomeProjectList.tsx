import { SpotIllustration } from "../../components/SpotIllustration";
import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Platform, View } from "react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";

import { ProjectFavicon } from "../../components/ProjectFavicon";
import { SymbolView } from "../../components/ui/AppSymbol";
import { AppText as Text } from "../../components/ui/AppText";
import { EmptyState } from "../../components/ui/EmptyState";
import { RowPressable } from "../../components/ui/RowPressable";
import { StatusDot } from "../../components/ui/StatusDot";
import { cn } from "../../lib/cn";
import { useDeadlinePassed } from "../../lib/clock";
import { MOBILE_SHAPE } from "../../lib/designTokens";
import { CSS_EASE_EMPHASIZED, LAYOUT_MAKE_ROOM } from "../../lib/motion";
import {
  countHomeActivity,
  describeHomeActivity,
  homeThreadDoneUntilMs,
  resolveHomeThreadActivity,
} from "./home-device-summary";
import type { HomeProjectScope, HomeProjectSection } from "./homeThreadList";

const VISIBLE_THREADS_PER_PROJECT = 4;

function threadCountLabel(count: number): string {
  if (count === 0) return "No threads";
  return count === 1 ? "1 thread" : `${count} threads`;
}

function ProjectThreadRow(props: {
  readonly thread: EnvironmentThreadShell;
  readonly onSelectThread: (thread: EnvironmentThreadShell) => void;
}) {
  const activity = resolveHomeThreadActivity(props.thread);
  const doneUntilMs = homeThreadDoneUntilMs(props.thread);
  const doneExpired = useDeadlinePassed(doneUntilMs);
  const justDone = doneUntilMs !== null && !doneExpired;
  return (
    <RowPressable
      accessibilityRole="button"
      accessibilityLabel={`${props.thread.title}${activity === "attention" ? ", needs you" : activity === "working" ? ", working" : justDone ? ", done" : ""}`}
      onPress={() => props.onSelectThread(props.thread)}
      className="min-h-11 flex-row items-center gap-3 pl-4 pr-4"
    >
      <View className="w-7 items-center">
        {activity === "attention" || activity === "working" || justDone ? (
          <StatusDot tone={activity} />
        ) : (
          <View className="size-2 rounded-full border border-foreground-muted" />
        )}
      </View>
      <Text className="flex-1 text-sm" numberOfLines={1}>
        {props.thread.title}
      </Text>
    </RowPressable>
  );
}

export function HomeProjectList(props: {
  readonly sections: ReadonlyArray<HomeProjectSection>;
  readonly searchQuery: string;
  readonly onSelectThread: (thread: EnvironmentThreadShell) => void;
  readonly onNewThreadInProject: (project: EnvironmentProject) => void;
  /** Opens the add-project flow; absent where projects can't be added from here. */
  readonly onAddProject?: () => void;
  /** Long-pressing a project row renames it. */
  readonly onRenameProject?: (scope: HomeProjectScope) => void;
}) {
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [showAllKeys, setShowAllKeys] = useState<ReadonlySet<string>>(() => new Set());
  const searching = props.searchQuery.trim().length > 0;
  const toggle = (key: string) =>
    setExpandedKeys((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  if (props.sections.length === 0) {
    return (
      <EmptyState
        illustration={<SpotIllustration kind={searching ? "search" : "project"} />}
        title={searching ? "No results" : "No projects yet"}
        detail={
          searching
            ? `No projects or threads matching "${props.searchQuery}".`
            : "Add a project to start a coding session in it."
        }
        {...(!searching && props.onAddProject
          ? { actionLabel: "New project", onAction: props.onAddProject }
          : {})}
        variant="plain"
      />
    );
  }

  // Like Settings: projects with work first, the untouched ones in their own titled group.
  const groups = searching
    ? [{ title: undefined, sections: props.sections }]
    : [
        {
          title: undefined,
          sections: props.sections.filter((section) => section.threads.length > 0),
        },
        {
          title: "No threads yet",
          sections: props.sections.filter((section) => section.threads.length === 0),
        },
      ].filter((group) => group.sections.length > 0);

  return (
    <View className="gap-5 px-4">
      {groups.map((group) => (
        // ListSection's look, built from animated views so the card resizes with its rows.
        <Animated.View key={group.title ?? "active"} layout={LAYOUT_MAKE_ROOM} className="gap-2">
          {group.title ? (
            <Text textRole="footnote" className="px-2 font-workspace text-foreground-muted">
              {group.title}
            </Text>
          ) : null}
          <Animated.View
            layout={LAYOUT_MAKE_ROOM}
            className="overflow-hidden border-continuous bg-grouped-card"
            style={{
              borderRadius:
                Platform.OS === "android" ? MOBILE_SHAPE.group.android : MOBILE_SHAPE.group.ios,
            }}
          >
            {group.sections.map((section) => {
              const { scope, threads } = section;
              // A search lists its matches open, so results are visible without a tap per project.
              const expanded = searching || expandedKeys.has(scope.key);
              const counts = countHomeActivity(threads);
              const visibleThreads = showAllKeys.has(scope.key)
                ? threads
                : threads.slice(0, VISIBLE_THREADS_PER_PROJECT);
              const hiddenCount = threads.length - visibleThreads.length;
              const summary = describeHomeActivity(counts, threadCountLabel(threads.length));
              return (
                <Animated.View key={scope.key} layout={LAYOUT_MAKE_ROOM}>
                  <RowPressable
                    accessibilityRole="button"
                    accessibilityLabel={`${scope.title}, ${summary}`}
                    accessibilityState={{ expanded }}
                    accessibilityActions={
                      props.onRenameProject
                        ? [{ name: "rename", label: "Rename project" }]
                        : undefined
                    }
                    onAccessibilityAction={(event) => {
                      if (event.nativeEvent.actionName === "rename") props.onRenameProject?.(scope);
                    }}
                    onPress={() => toggle(scope.key)}
                    onLongPress={
                      props.onRenameProject
                        ? () => {
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            props.onRenameProject?.(scope);
                          }
                        : undefined
                    }
                    className="min-h-14 flex-row items-center gap-3 px-4 py-3"
                  >
                    <ProjectFavicon
                      environmentId={scope.representative.environmentId}
                      projectTitle={scope.title}
                      workspaceRoot={scope.representative.workspaceRoot}
                      faviconPath={scope.representative.faviconPath}
                      projectIcon={scope.representative.projectIcon}
                      size={28}
                    />
                    <Text className="min-w-0 flex-1 text-base" numberOfLines={1}>
                      {scope.title}
                    </Text>
                    {threads.length > 0 ? (
                      <Text
                        className={cn(
                          "shrink-0 text-sm",
                          counts.attentionCount > 0
                            ? "font-t3-bold text-warning-foreground"
                            : "text-foreground-muted",
                        )}
                        numberOfLines={1}
                      >
                        {counts.attentionCount > 0 || counts.workingCount > 0
                          ? summary
                          : threads.length}
                      </Text>
                    ) : null}
                    <Animated.View
                      style={{
                        transform: [{ rotate: expanded ? "90deg" : "0deg" }],
                        transitionProperty: "transform",
                        transitionDuration: 260,
                        transitionTimingFunction: CSS_EASE_EMPHASIZED,
                      }}
                    >
                      <SymbolView
                        name="chevron.right"
                        size={16}
                        tintColorClassName="accent-chevron"
                        type="monochrome"
                        weight="semibold"
                      />
                    </Animated.View>
                  </RowPressable>
                  {expanded ? (
                    <Animated.View
                      entering={FadeIn.delay(90).duration(160).reduceMotion(ReduceMotion.System)}
                      className="pb-2"
                    >
                      {visibleThreads.map((thread) => (
                        <ProjectThreadRow
                          key={`${thread.environmentId}:${thread.id}`}
                          thread={thread}
                          onSelectThread={props.onSelectThread}
                        />
                      ))}
                      {hiddenCount > 0 ? (
                        <RowPressable
                          accessibilityRole="button"
                          accessibilityLabel={`Show all ${threads.length} threads in ${scope.title}`}
                          onPress={() =>
                            setShowAllKeys((current) => new Set(current).add(scope.key))
                          }
                          className="min-h-11 flex-row items-center pl-14 pr-4"
                        >
                          <Text className="text-sm text-foreground-muted">
                            Show all {threads.length}
                          </Text>
                        </RowPressable>
                      ) : null}
                      <RowPressable
                        accessibilityRole="button"
                        accessibilityLabel={`New thread in ${scope.title}`}
                        onPress={() => props.onNewThreadInProject(scope.representative)}
                        className="min-h-11 flex-row items-center gap-3 pl-4 pr-4"
                      >
                        <View className="w-7 items-center">
                          <SymbolView
                            name="plus"
                            size={16}
                            tintColorClassName="accent-primary-text"
                            type="monochrome"
                            weight="semibold"
                          />
                        </View>
                        <Text className="text-sm text-primary-text">New thread</Text>
                      </RowPressable>
                    </Animated.View>
                  ) : null}
                </Animated.View>
              );
            })}
          </Animated.View>
        </Animated.View>
      ))}
      {props.onAddProject && !searching ? (
        <Animated.View
          layout={LAYOUT_MAKE_ROOM}
          className="overflow-hidden border-continuous bg-grouped-card"
          style={{
            borderRadius:
              Platform.OS === "android" ? MOBILE_SHAPE.group.android : MOBILE_SHAPE.group.ios,
          }}
        >
          <RowPressable
            accessibilityRole="button"
            accessibilityLabel="New project"
            accessibilityHint="Pick a device, then start a project or open a folder on it"
            onPress={props.onAddProject}
            className="min-h-13 flex-row items-center gap-3 px-4 py-3"
          >
            <View className="size-8 items-center justify-center rounded-lg bg-primary/10">
              <SymbolView
                name="folder.badge.plus"
                size={16}
                tintColorClassName="accent-primary-text"
                type="monochrome"
                weight="semibold"
              />
            </View>
            <Text className="flex-1 font-workspace text-[15px] font-semibold text-primary-text">
              New project
            </Text>
          </RowPressable>
        </Animated.View>
      ) : null}
    </View>
  );
}
