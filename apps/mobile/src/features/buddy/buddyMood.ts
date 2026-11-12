import type { EnvironmentId } from "@t3tools/contracts";
import { Atom } from "effect/reactivity";

import { environmentThreadShells } from "../../state/threads";
import { workspaceConnections } from "../../state/workspace";
import { resolveThreadListV2Status } from "../threads/threadListV2";

export type BuddyMood =
  | "asleep"
  | "idle"
  | "working"
  | "waiting"
  | "attention"
  | "request"
  | "limited";

export interface BuddyStatus {
  readonly mood: BuddyMood;
  readonly failedCount: number;
}

type MoodThread = Parameters<typeof resolveThreadListV2Status>[0] & {
  readonly environmentId: EnvironmentId;
  readonly archivedAt: string | null;
};

// Highest first: the face shows the most urgent thing any thread is doing.
const PRIORITY: ReadonlyArray<BuddyMood> = [
  "attention",
  "request",
  "working",
  "waiting",
  "limited",
  "idle",
];

export function resolveBuddyStatus(input: {
  readonly environments: ReadonlyArray<{
    readonly environmentId: EnvironmentId;
    readonly isEnabled: boolean;
    readonly connectionState: string;
  }>;
  readonly threads: ReadonlyArray<MoodThread>;
}): BuddyStatus {
  const connected = new Set(
    input.environments
      .filter((environment) => environment.isEnabled && environment.connectionState === "connected")
      .map((environment) => environment.environmentId),
  );
  if (connected.size === 0) return { mood: "asleep", failedCount: 0 };
  const seen = new Set<BuddyMood>();
  let failedCount = 0;
  for (const thread of input.threads) {
    if (thread.archivedAt !== null || !connected.has(thread.environmentId)) continue;
    const status = resolveThreadListV2Status(thread);
    if (status === "approval" || status === "input") seen.add("attention");
    else if (status === "request") seen.add("request");
    else if (status === "working") seen.add("working");
    else if (status === "waiting" && thread.runtime?.status === "running") seen.add("waiting");
    else if (status === "limited") seen.add("limited");
    else if (status === "failed") failedCount += 1;
  }
  return { mood: PRIORITY.find((mood) => seen.has(mood)) ?? "idle", failedCount };
}

const buddyStatusAtom = Atom.make((get) =>
  resolveBuddyStatus({
    environments: get(workspaceConnections.environmentsAtom),
    threads: get(environmentThreadShells.threadShellsAtom),
  }),
);

// Primitive atoms, so the header re-renders only when one of them changes.
export const buddyMoodAtom = Atom.make((get) => get(buddyStatusAtom).mood).pipe(
  Atom.withLabel("mobile:buddy-mood"),
);
export const buddyFailedCountAtom = Atom.make((get) => get(buddyStatusAtom).failedCount).pipe(
  Atom.withLabel("mobile:buddy-failed-count"),
);
