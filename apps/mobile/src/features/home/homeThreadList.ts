import { buildProjectGroups } from "@t3tools/client-runtime/state/project-grouping";
import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import {
  getThreadSortTimestamp,
  toSortableTimestamp,
} from "@t3tools/client-runtime/state/thread-sort";
import type {
  EnvironmentId,
  ScopedProjectRef,
  SidebarProjectGroupingMode,
  SidebarProjectSortOrder,
} from "@t3tools/contracts";
import * as Arr from "effect/Array";
import * as Order from "effect/Order";

import { scopedProjectKey } from "../../lib/scopedEntities";
import type { PendingNewTask } from "../../state/use-pending-new-tasks";

export type HomeProjectSortOrder = Exclude<SidebarProjectSortOrder, "manual">;

export interface HomeProjectScope {
  readonly key: string;
  readonly title: string;
  readonly representative: EnvironmentProject;
  readonly projects: ReadonlyArray<EnvironmentProject>;
  readonly projectRefs: ReadonlyArray<ScopedProjectRef>;
  readonly pinned: boolean;
  readonly archived: boolean;
}

function getProjectSortTimestamp(
  project: EnvironmentProject,
  sortOrder: HomeProjectSortOrder,
): number {
  return sortOrder === "created_at"
    ? (toSortableTimestamp(project.createdAt) ?? Number.NEGATIVE_INFINITY)
    : (toSortableTimestamp(project.updatedAt) ??
        toSortableTimestamp(project.createdAt) ??
        Number.NEGATIVE_INFINITY);
}

export function buildHomeProjectScopes(input: {
  readonly projects: ReadonlyArray<EnvironmentProject>;
  readonly environmentId: EnvironmentId | null;
  readonly projectGroupingMode: SidebarProjectGroupingMode;
}): ReadonlyArray<HomeProjectScope> {
  const projects = input.projects.filter(
    (project) => input.environmentId === null || project.environmentId === input.environmentId,
  );
  return buildProjectGroups({
    projects,
    groupScratchProjects: true,
    settings: {
      sidebarProjectGroupingMode: input.projectGroupingMode,
      sidebarProjectGroupingOverrides: {},
    },
  }).map((group) => {
    return {
      key: group.key,
      title: group.label,
      representative: group.representative,
      projects: group.members.map((member) => member.project),
      projectRefs: group.memberProjectRefs,
      pinned: group.pinned,
      archived: group.archived,
    };
  });
}

export function findHomeProjectScope(
  scopes: ReadonlyArray<HomeProjectScope>,
  key: string | null,
): HomeProjectScope | null {
  if (key === null) {
    return null;
  }
  return (
    scopes.find((scope) => scope.key === key) ??
    scopes.find((scope) =>
      scope.projectRefs.some(
        (projectRef) => scopedProjectKey(projectRef.environmentId, projectRef.projectId) === key,
      ),
    ) ??
    null
  );
}

export function sortHomeProjectScopes(input: {
  readonly scopes: ReadonlyArray<HomeProjectScope>;
  readonly threads: ReadonlyArray<EnvironmentThreadShell>;
  readonly pendingTasks: ReadonlyArray<PendingNewTask>;
  readonly projectSortOrder: HomeProjectSortOrder;
}): ReadonlyArray<HomeProjectScope> {
  const scopeKeyByProjectRef = new Map(
    input.scopes.flatMap((scope) =>
      scope.projectRefs.map(
        (projectRef) =>
          [scopedProjectKey(projectRef.environmentId, projectRef.projectId), scope.key] as const,
      ),
    ),
  );
  const latestActivityByScope = new Map<string, number>();
  const recordActivity = (scopeKey: string | undefined, timestamp: number) => {
    if (!scopeKey || !Number.isFinite(timestamp)) return;
    latestActivityByScope.set(
      scopeKey,
      Math.max(latestActivityByScope.get(scopeKey) ?? Number.NEGATIVE_INFINITY, timestamp),
    );
  };

  for (const thread of input.threads) {
    if (thread.archivedAt !== null) continue;
    recordActivity(
      scopeKeyByProjectRef.get(scopedProjectKey(thread.environmentId, thread.projectId)),
      getThreadSortTimestamp(thread, input.projectSortOrder),
    );
  }
  for (const pendingTask of input.pendingTasks) {
    recordActivity(
      scopeKeyByProjectRef.get(scopedProjectKey(pendingTask.environmentId, pendingTask.projectId)),
      Date.parse(pendingTask.createdAt),
    );
  }

  return Arr.sort(
    input.scopes,
    Order.mapInput(
      Order.Struct({
        timestamp: Order.flip(Order.Number),
        title: Order.String,
        key: Order.String,
      }),
      (scope: HomeProjectScope) => ({
        timestamp:
          latestActivityByScope.get(scope.key) ??
          Math.max(
            ...scope.projects.map((project) =>
              getProjectSortTimestamp(project, input.projectSortOrder),
            ),
          ),
        title: scope.title,
        key: scope.key,
      }),
    ),
  );
}

export interface HomeProjectSection {
  readonly scope: HomeProjectScope;
  /** Unarchived threads of the scope, most recently active first. */
  readonly threads: ReadonlyArray<EnvironmentThreadShell>;
}

export function buildHomeProjectSections(input: {
  readonly scopes: ReadonlyArray<HomeProjectScope>;
  readonly threads: ReadonlyArray<EnvironmentThreadShell>;
  readonly searchQuery: string;
  /** "activity" lists only projects with threads, most recently active first; "all" keeps every project in the given order. */
  readonly order: "activity" | "all";
}): ReadonlyArray<HomeProjectSection> {
  const query = input.searchQuery.trim().toLowerCase();
  const threadsByProjectKey = new Map<string, EnvironmentThreadShell[]>();
  for (const thread of input.threads) {
    if (thread.archivedAt !== null) continue;
    const key = scopedProjectKey(thread.environmentId, thread.projectId);
    const bucket = threadsByProjectKey.get(key);
    if (bucket) bucket.push(thread);
    else threadsByProjectKey.set(key, [thread]);
  }
  const sections = input.scopes.flatMap((scope): HomeProjectSection[] => {
    const scopeThreads = scope.projectRefs.flatMap(
      (ref) => threadsByProjectKey.get(scopedProjectKey(ref.environmentId, ref.projectId)) ?? [],
    );
    const titleMatches = query.length === 0 || scope.title.toLowerCase().includes(query);
    const threads = titleMatches
      ? scopeThreads
      : scopeThreads.filter((thread) => thread.title.toLowerCase().includes(query));
    if (!titleMatches && threads.length === 0) return [];
    return [
      {
        scope,
        threads: Arr.sort(
          threads,
          Order.mapInput(Order.flip(Order.Number), (thread: EnvironmentThreadShell) =>
            getThreadSortTimestamp(thread, "updated_at"),
          ),
        ),
      },
    ];
  });
  if (input.order === "all") return sections;
  // Each section's newest thread leads it, so comparing those orders projects by latest activity.
  return Arr.sort(
    sections.filter((section) => section.threads.length > 0),
    Order.mapInput(Order.flip(Order.Number), (section: HomeProjectSection) =>
      getThreadSortTimestamp(section.threads[0]!, "updated_at"),
    ),
  );
}
