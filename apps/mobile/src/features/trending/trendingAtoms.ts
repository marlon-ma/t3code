import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { Atom } from "effect/reactivity";

import { fetchTrending, type TrendingPeriod, type TrendingSource } from "./trendingFeed";

export type PullRequestsTabFeed = "pullRequests" | "trending";

/** Which list the Pull requests tab shows. Kept for the session so switching tabs keeps it. */
export const pullRequestsTabFeedAtom = Atom.make<PullRequestsTabFeed>("pullRequests").pipe(
  Atom.keepAlive,
  Atom.withLabel("mobile:pull-requests-tab-feed"),
);

export const trendingSourceAtom = Atom.make<TrendingSource>("github").pipe(
  Atom.keepAlive,
  Atom.withLabel("mobile:trending-source"),
);

export const trendingPeriodAtom = Atom.make<TrendingPeriod>("daily").pipe(
  Atom.keepAlive,
  Atom.withLabel("mobile:trending-period"),
);

export type TrendingFeedKey = `${TrendingSource}:${TrendingPeriod}`;

/** X is a fixed list of searches, so every period shares one entry. */
export const trendingFeedKey = (source: TrendingSource, period: TrendingPeriod): TrendingFeedKey =>
  source === "x" ? "x:daily" : `${source}:${period}`;

export class TrendingFeedError extends Schema.TaggedError<TrendingFeedError>()(
  "TrendingFeedError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect()),
  },
) {}

// Kept alive so flipping between sources or periods shows the last result instead of refetching.
export const trendingFeedAtom = Atom.family((key: TrendingFeedKey) => {
  const [source, period] = key.split(":") as [TrendingSource, TrendingPeriod];
  return Atom.make(
    Effect.tryPromise({
      try: (signal) => fetchTrending(source, period, signal),
      catch: (cause) =>
        new TrendingFeedError({
          message: cause instanceof Error ? cause.message : "Could not load what's trending.",
          cause,
        }),
    }).pipe(
      Effect.timeoutOrElse({
        duration: "20 seconds",
        orElse: () =>
          Effect.fail(new TrendingFeedError({ message: "Loading timed out. Pull to try again." })),
      }),
    ),
  ).pipe(Atom.keepAlive, Atom.withLabel(`mobile:trending-feed:${key}`));
});
