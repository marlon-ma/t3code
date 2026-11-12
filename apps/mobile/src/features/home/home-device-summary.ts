import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import type { EnvironmentId, EnvironmentMachineKind } from "@t3tools/contracts";

import { resolveThreadListV2Status } from "../threads/threadListV2";

export type HomeActivityStatus = "attention" | "working" | "idle";
export type HomeDeviceStatus = HomeActivityStatus | "offline";

export interface HomeActivityCounts {
  readonly attentionCount: number;
  readonly workingCount: number;
}

export interface HomeDeviceSummary extends HomeActivityCounts {
  readonly environmentId: EnvironmentId;
  readonly label: string;
  readonly machineKind: EnvironmentMachineKind | null;
  readonly status: HomeDeviceStatus;
}

type ActivityThread = Parameters<typeof resolveThreadListV2Status>[0] &
  Pick<EnvironmentThreadShell, "archivedAt">;

export function resolveHomeThreadActivity(thread: ActivityThread): HomeActivityStatus {
  if (thread.archivedAt !== null) return "idle";
  const status = resolveThreadListV2Status(thread);
  if (status === "approval" || status === "input" || status === "request") return "attention";
  return status === "working" ? "working" : "idle";
}

const RECENTLY_COMPLETED_MS = 10 * 60 * 1000;

/** When a just-finished thread's "done" highlight expires, or null if it has none. */
export function homeThreadDoneUntilMs(
  thread: ActivityThread & Pick<EnvironmentThreadShell, "latestRun">,
): number | null {
  if (resolveHomeThreadActivity(thread) !== "idle") return null;
  const run = thread.latestRun;
  if (run?.status !== "completed" || run.completedAt === null) return null;
  const completedAtMs = Date.parse(run.completedAt);
  return Number.isNaN(completedAtMs) ? null : completedAtMs + RECENTLY_COMPLETED_MS;
}

export function countHomeActivity(threads: ReadonlyArray<ActivityThread>): HomeActivityCounts {
  let attentionCount = 0;
  let workingCount = 0;
  for (const thread of threads) {
    const activity = resolveHomeThreadActivity(thread);
    if (activity === "attention") attentionCount += 1;
    else if (activity === "working") workingCount += 1;
  }
  return { attentionCount, workingCount };
}

export function activityStatusFromCounts(counts: HomeActivityCounts): HomeActivityStatus {
  if (counts.attentionCount > 0) return "attention";
  return counts.workingCount > 0 ? "working" : "idle";
}

export function describeHomeActivity(counts: HomeActivityCounts, idleLabel: string): string {
  const parts: string[] = [];
  if (counts.attentionCount > 0) parts.push(`${counts.attentionCount} needs you`);
  if (counts.workingCount > 0) parts.push(`${counts.workingCount} working`);
  return parts.length > 0 ? parts.join(" · ") : idleLabel;
}

export function buildHomeDeviceSummaries(input: {
  readonly environments: ReadonlyArray<{
    readonly environmentId: EnvironmentId;
    readonly label: string;
    readonly connectionState: string;
  }>;
  readonly threads: ReadonlyArray<ActivityThread & Pick<EnvironmentThreadShell, "environmentId">>;
  readonly machineByEnvironmentId: ReadonlyMap<EnvironmentId, EnvironmentMachineKind>;
}): ReadonlyArray<HomeDeviceSummary> {
  return input.environments.map((environment) => {
    const counts = countHomeActivity(
      input.threads.filter((thread) => thread.environmentId === environment.environmentId),
    );
    return {
      environmentId: environment.environmentId,
      label: environment.label,
      machineKind: input.machineByEnvironmentId.get(environment.environmentId) ?? null,
      status:
        environment.connectionState === "connected" ? activityStatusFromCounts(counts) : "offline",
      ...counts,
    };
  });
}
