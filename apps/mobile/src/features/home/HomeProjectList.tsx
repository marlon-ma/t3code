import { SpotIllustration } from "../../components/SpotIllustration";
import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import { useState } from "react";
import { View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { ProjectFavicon } from "../../components/ProjectFavicon";
import { SymbolView } from "../../components/ui/AppSymbol";
import { AppText as Text } from "../../components/ui/AppText";
import { EmptyState } from "../../components/ui/EmptyState";
import { ListSection } from "../../components/ui/ListSection";
import { RowPressable } from "../../components/ui/RowPressable";
import { cn } from "../../lib/cn";
import {
  countHomeActivity,
  describeHomeActivity,
  resolveHomeThreadActivity,
} from "./home-device-summary";
import type { HomeProjectSection } from "./homeThreadList";

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
  return (
    <RowPressable
      accessibilityRole="button"
      accessibilityLabel={`${props.thread.title}${activity === "attention" ? ", needs you" : activity === "working" ? ", working" : ""}`}
      onPress={() => props.onSelectThread(props.thread)}
      className="min-h-11 flex-row items-center gap-3 pl-4 pr-4"
    >
      <View className="w-7 items-center">
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
        <ListSection key={group.title ?? "active"} title={group.title}>
          {group.sections.map((section, index) => {
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
              <View key={scope.key} className={cn(index > 0 && "border-t border-border-subtle")}>
                <RowPressable
                  accessibilityRole="button"
                  accessibilityLabel={`${scope.title}, ${summary}`}
                  accessibilityState={{ expanded }}
                  onPress={() => toggle(scope.key)}
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
                  <View style={{ transform: [{ rotate: expanded ? "90deg" : "0deg" }] }}>
                    <SymbolView
                      name="chevron.right"
                      size={16}
                      tintColorClassName="accent-chevron"
                      type="monochrome"
                      weight="semibold"
                    />
                  </View>
                </RowPressable>
                {expanded ? (
                  <Animated.View entering={FadeIn.duration(150)} className="pb-2">
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
                        onPress={() => setShowAllKeys((current) => new Set(current).add(scope.key))}
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
              </View>
            );
          })}
        </ListSection>
      ))}
    </View>
  );
}
