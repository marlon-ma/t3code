import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import { useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { ProjectFavicon } from "../../components/ProjectFavicon";
import { SymbolView } from "../../components/ui/AppSymbol";
import { AppText as Text } from "../../components/ui/AppText";
import { EmptyState } from "../../components/ui/EmptyState";
import { RowPressable } from "../../components/ui/RowPressable";
import { cn } from "../../lib/cn";
import {
  countHomeActivity,
  describeHomeActivity,
  resolveHomeThreadActivity,
} from "./home-device-summary";
import type { HomeProjectSection } from "./homeThreadList";

const VISIBLE_THREADS_PER_PROJECT = 6;

function threadCountLabel(count: number): string {
  if (count === 0) return "No threads";
  return count === 1 ? "1 thread" : `${count} threads`;
}

function ProjectThreadRow(props: {
  readonly thread: EnvironmentThreadShell;
  readonly onSelectThread: (thread: EnvironmentThreadShell) => void;
}) {
  const activity = resolveHomeThreadActivity(props.thread);
  return (
    <RowPressable
      accessibilityRole="button"
      accessibilityLabel={`${props.thread.title}${activity === "attention" ? ", needs you" : activity === "working" ? ", working" : ""}`}
      onPress={() => props.onSelectThread(props.thread)}
      className="min-h-11 flex-row items-center gap-3 pl-12 pr-4"
    >
      <View
        className={cn(
          "size-2 rounded-full",
          activity === "attention"
            ? "bg-warning-foreground"
            : activity === "working"
              ? "bg-primary"
              : "border border-foreground-muted",
        )}
      />
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
  readonly onShowAllThreads: (projectKey: string) => void;
}) {
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(() => new Set());
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
        title={searching ? "No results" : "No projects yet"}
        detail={
          searching
            ? `No projects or threads matching "${props.searchQuery}".`
            : "Add a project to start a coding session in it."
        }
        variant="plain"
      />
    );
  }

  return (
    <View className="mx-4 overflow-hidden rounded-2xl bg-grouped-card">
      {props.sections.map((section, index) => {
        const { scope, threads } = section;
        // A search lists its matches open, so results are visible without a tap per project.
        const expanded = searching || expandedKeys.has(scope.key);
        const counts = countHomeActivity(threads);
        const hiddenCount = Math.max(0, threads.length - VISIBLE_THREADS_PER_PROJECT);
        return (
          <View key={scope.key} className={cn(index > 0 && "border-t border-border-subtle")}>
            <View className="flex-row items-center">
              <RowPressable
                accessibilityRole="button"
                accessibilityLabel={`${scope.title}, ${describeHomeActivity(counts, threadCountLabel(threads.length))}`}
                accessibilityState={{ expanded }}
                onPress={() => toggle(scope.key)}
                className="min-h-15 flex-1 flex-row items-center gap-3 py-2 pl-4"
              >
                <View style={{ transform: [{ rotate: expanded ? "90deg" : "0deg" }] }}>
                  <SymbolView
                    name="chevron.right"
                    size={12}
                    tintColorClassName="accent-chevron"
                    type="monochrome"
                    weight="semibold"
                  />
                </View>
                <ProjectFavicon
                  environmentId={scope.representative.environmentId}
                  projectTitle={scope.title}
                  workspaceRoot={scope.representative.workspaceRoot}
                  faviconPath={scope.representative.faviconPath}
                  projectIcon={scope.representative.projectIcon}
                  size={28}
                />
                <View className="flex-1">
                  <Text className="font-t3-medium text-base" numberOfLines={1}>
                    {scope.title}
                  </Text>
                  <Text
                    className={cn(
                      "text-2xs",
                      counts.attentionCount > 0
                        ? "font-t3-bold text-warning-foreground"
                        : "text-foreground-muted",
                    )}
                    numberOfLines={1}
                  >
                    {describeHomeActivity(counts, threadCountLabel(threads.length))}
                  </Text>
                </View>
              </RowPressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`New thread in ${scope.title}`}
                onPress={() => props.onNewThreadInProject(scope.representative)}
                className="size-12 items-center justify-center"
              >
                <SymbolView
                  name="square.and.pencil"
                  size={18}
                  tintColorClassName="accent-foreground-muted"
                  type="monochrome"
                />
              </Pressable>
            </View>
            {expanded ? (
              <Animated.View entering={FadeIn.duration(150)} className="pb-2">
                {threads.slice(0, VISIBLE_THREADS_PER_PROJECT).map((thread) => (
                  <ProjectThreadRow
                    key={`${thread.environmentId}:${thread.id}`}
                    thread={thread}
                    onSelectThread={props.onSelectThread}
                  />
                ))}
                {threads.length === 0 ? (
                  <Text className="py-2 pl-12 pr-4 text-sm text-foreground-muted">
                    No threads yet
                  </Text>
                ) : null}
                {hiddenCount > 0 ? (
                  <RowPressable
                    accessibilityRole="button"
                    accessibilityLabel={`Show all ${threads.length} threads in ${scope.title}`}
                    onPress={() => props.onShowAllThreads(scope.key)}
                    className="min-h-11 flex-row items-center pl-12 pr-4"
                  >
                    <Text className="text-sm text-foreground-muted">Show all {threads.length}</Text>
                  </RowPressable>
                ) : null}
              </Animated.View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
