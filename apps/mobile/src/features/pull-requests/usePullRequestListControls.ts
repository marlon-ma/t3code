import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";

import { mobilePreferencesAtom, updateMobilePreferencesAtom } from "../../state/preferences";
import { DEFAULT_PR_LIST_CONTROLS, type PullRequestListControls } from "./pullRequestList";

const NO_HIDDEN_REPOSITORIES: readonly string[] = [];

export function usePullRequestListControls() {
  const preferences = useAtomValue(mobilePreferencesAtom);
  const savePreferences = useAtomSet(updateMobilePreferencesAtom);
  const saved = AsyncResult.isSuccess(preferences)
    ? preferences.value.pullRequestListFilters
    : undefined;
  const environmentId = saved?.environmentId ?? null;
  const hiddenRepositories = saved?.hiddenRepositories ?? NO_HIDDEN_REPOSITORIES;
  const controlsFor = (environment: string | null) =>
    saved?.controls[environment ?? ""] ?? DEFAULT_PR_LIST_CONTROLS;
  const setEnvironmentId = (next: string | null) =>
    savePreferences({
      transform: (current) => ({
        pullRequestListFilters: {
          ...current.pullRequestListFilters,
          controls: current.pullRequestListFilters?.controls ?? {},
          environmentId: next,
        },
      }),
    });
  const setControls = (environment: string | null, controls: PullRequestListControls) =>
    savePreferences({
      transform: (current) => ({
        pullRequestListFilters: {
          ...current.pullRequestListFilters,
          environmentId: current.pullRequestListFilters?.environmentId ?? null,
          controls: withEnvironmentControls(
            current.pullRequestListFilters?.controls,
            environment ?? "",
            controls,
          ),
        },
      }),
    });
  const toggleHiddenRepository = (repository: string) =>
    savePreferences({
      transform: (current) => {
        const key = repository.toLowerCase();
        const hidden = current.pullRequestListFilters?.hiddenRepositories ?? [];
        return {
          pullRequestListFilters: {
            environmentId: current.pullRequestListFilters?.environmentId ?? null,
            controls: current.pullRequestListFilters?.controls ?? {},
            hiddenRepositories: hidden.includes(key)
              ? hidden.filter((item) => item !== key)
              : [...hidden, key],
          },
        };
      },
    });
  return {
    environmentId,
    controlsFor,
    setEnvironmentId,
    setControls,
    hiddenRepositories,
    toggleHiddenRepository,
  } as const;
}

function withEnvironmentControls(
  saved: Readonly<Record<string, PullRequestListControls>> | undefined,
  environment: string,
  controls: PullRequestListControls,
): Record<string, PullRequestListControls> {
  return { ...saved, [environment]: controls };
}
