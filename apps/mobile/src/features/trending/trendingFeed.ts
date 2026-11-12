import type { PromptLinkRepository } from "@t3tools/shared/promptLinks";

export type TrendingSource = "github" | "hackerNews" | "reddit" | "x";
export type TrendingPeriod = "daily" | "weekly" | "monthly";

export type TrendingDetail =
  | {
      readonly kind: "github";
      readonly language: string | null;
      readonly languageColor: string | null;
      readonly stars: number | null;
      readonly forks: number | null;
      /** Stars gained over the requested period. */
      readonly gained: number | null;
    }
  | {
      readonly kind: "hackerNews";
      readonly host: string | null;
      readonly author: string | null;
      readonly points: number;
      readonly comments: number;
    }
  | {
      readonly kind: "reddit";
      readonly subreddit: string | null;
      readonly author: string | null;
      /** The linked site, for link posts. */
      readonly host: string | null;
    }
  | { readonly kind: "x" };

export interface TrendingItem {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly description: string | null;
  /** Where people talk about it, when that is not `url` itself. */
  readonly discussionUrl: string | null;
  readonly repository: PromptLinkRepository | null;
  readonly detail: TrendingDetail;
}

const countOf = (value: string | undefined) => {
  const count = value ? Number(value.replace(/,/g, "")) : Number.NaN;
  return Number.isFinite(count) ? count : null;
};

const ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code =
        entity[1] === "x" || entity[1] === "X"
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

const textOf = (html: string) =>
  decodeEntities(html.replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();

// github.com paths that are not owners, so a link to one is not a repository.
const GITHUB_RESERVED_OWNERS = new Set([
  "about",
  "apps",
  "collections",
  "enterprise",
  "events",
  "explore",
  "features",
  "marketplace",
  "orgs",
  "pricing",
  "settings",
  "sponsors",
  "topics",
  "trending",
  "users",
]);

export function githubRepositoryOf(url: string): PromptLinkRepository | null {
  const match =
    /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})(?:[/?#]|$)/i.exec(
      url.trim(),
    );
  if (!match?.[1] || !match[2] || GITHUB_RESERVED_OWNERS.has(match[1].toLowerCase())) return null;
  const name = match[2].replace(/\.git$/i, "");
  return /^\.+$/.test(name) ? null : { owner: match[1], name };
}

export function parseGitHubTrending(html: string): TrendingItem[] {
  const items: TrendingItem[] = [];
  for (const article of html.split('<article class="Box-row">').slice(1)) {
    const path = /<h2[^>]*>[\s\S]*?href="\/([^"/]+)\/([^"/]+)"/.exec(article);
    if (!path?.[1] || !path[2]) continue;
    const owner = decodeEntities(path[1]);
    const name = decodeEntities(path[2]);
    const description = /<p class="col-9[^"]*">([\s\S]*?)<\/p>/.exec(article)?.[1];
    const language = /itemprop="programmingLanguage">([^<]+)</.exec(article)?.[1];
    const languageColor = /repo-language-color"[^>]*background-color:\s*(#[0-9a-f]{3,8})/i.exec(
      article,
    )?.[1];
    const counter = (kind: string) =>
      new RegExp(
        `href="/${escapeRegExp(path[1]!)}/${escapeRegExp(path[2]!)}/${kind}"[\\s\\S]*?</svg>\\s*([\\d,]+)\\s*</a>`,
      ).exec(article)?.[1];
    const gained = /([\d,]+) stars? (?:today|this week|this month)/.exec(article)?.[1];
    items.push({
      id: `github:${owner}/${name}`.toLowerCase(),
      title: `${owner}/${name}`,
      url: `https://github.com/${owner}/${name}`,
      description: description ? textOf(description) || null : null,
      discussionUrl: null,
      repository: { owner, name },
      detail: {
        kind: "github",
        language: language?.trim() || null,
        languageColor: languageColor ?? null,
        stars: countOf(counter("stargazers")),
        forks: countOf(counter("forks")),
        gained: countOf(gained),
      },
    });
  }
  return items;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface HackerNewsHit {
  readonly objectID?: unknown;
  readonly title?: unknown;
  readonly url?: unknown;
  readonly author?: unknown;
  readonly points?: unknown;
  readonly num_comments?: unknown;
}

export function parseHackerNews(json: unknown): TrendingItem[] {
  const hits = (json as { hits?: unknown } | null)?.hits;
  if (!Array.isArray(hits)) return [];
  return (hits as HackerNewsHit[]).flatMap((hit) => {
    if (typeof hit.objectID !== "string" || typeof hit.title !== "string") return [];
    const discussionUrl = `https://news.ycombinator.com/item?id=${hit.objectID}`;
    const url = typeof hit.url === "string" && hit.url ? hit.url : discussionUrl;
    const points = typeof hit.points === "number" ? hit.points : 0;
    const comments = typeof hit.num_comments === "number" ? hit.num_comments : 0;
    return [
      {
        id: `hackerNews:${hit.objectID}`,
        title: hit.title,
        url,
        description: null,
        discussionUrl: url === discussionUrl ? null : discussionUrl,
        repository: githubRepositoryOf(url),
        detail: {
          kind: "hackerNews",
          host: hostOf(url),
          author: typeof hit.author === "string" ? hit.author : null,
          points,
          comments,
        },
      },
    ];
  });
}

/** Reddit's Atom feed: its JSON API refuses unauthenticated apps, the feed does not. */
export function parseRedditFeed(xml: string): TrendingItem[] {
  return xml.split("<entry>").flatMap((entry, index) => {
    if (index === 0) return [];
    const title = /<title>([\s\S]*?)<\/title>/.exec(entry)?.[1];
    const discussionUrl = /<link href="([^"]+)"/.exec(entry)?.[1];
    if (!title || !discussionUrl) return [];
    const id = /<id>([^<]+)<\/id>/.exec(entry)?.[1] ?? discussionUrl;
    const subreddit = /<category[^>]*label="([^"]+)"/.exec(entry)?.[1];
    const author = /<name>([^<]+)<\/name>/.exec(entry)?.[1];
    const content = decodeEntities(/<content[^>]*>([\s\S]*?)<\/content>/.exec(entry)?.[1] ?? "");
    const linked = /<a href="([^"]+)">\[link\]<\/a>/.exec(content)?.[1];
    const external = linked && !/^https?:\/\/(?:[a-z]+\.)?reddit\.com\//i.test(linked);
    const url = decodeEntities(external ? linked : discussionUrl);
    return [
      {
        id: `reddit:${id}`,
        title: decodeEntities(title),
        url,
        description: null,
        discussionUrl: external ? decodeEntities(discussionUrl) : null,
        repository: githubRepositoryOf(url),
        detail: {
          kind: "reddit",
          subreddit: subreddit ?? null,
          author: author ? decodeEntities(author) : null,
          host: external ? hostOf(url) : null,
        },
      },
    ];
  });
}

function hostOf(url: string): string | null {
  return URL.canParse(url) ? new URL(url).hostname.replace(/^www\./, "") : null;
}

const xSearch = (id: string, title: string, query: string, description: string): TrendingItem => ({
  id: `x:${id}`,
  title,
  url: `https://x.com/search?q=${encodeURIComponent(query)}&f=top`,
  description,
  discussionUrl: null,
  repository: null,
  detail: { kind: "x" },
});

// X has no free read API, so this source opens curated searches in X instead of listing posts.
export const X_SEARCHES: readonly TrendingItem[] = [
  xSearch(
    "github-links",
    "GitHub links people are sharing",
    "github.com min_faves:300 -filter:replies",
    "Popular posts linking to a repository.",
  ),
  xSearch(
    "open-source",
    "New open source launches",
    '("open source" OR "open-sourced") (launch OR release) min_faves:300',
    "Projects announced as open source.",
  ),
  xSearch(
    "coding-agents",
    "Coding agents",
    '("coding agent" OR "claude code" OR codex OR cursor) min_faves:200',
    "What people say about coding agents.",
  ),
  xSearch(
    "show-off",
    "Things people built",
    '"I built" (github OR repo) min_faves:200 -filter:replies',
    "Side projects with a repository attached.",
  ),
];

export const REDDIT_SUBREDDITS = [
  "programming",
  "opensource",
  "LocalLLaMA",
  "selfhosted",
  "webdev",
] as const;

const PERIOD_DAYS: Record<TrendingPeriod, number> = { daily: 1, weekly: 7, monthly: 30 };
const REDDIT_PERIOD: Record<TrendingPeriod, string> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
};

export function trendingRequestUrl(
  source: Exclude<TrendingSource, "x">,
  period: TrendingPeriod,
  nowSeconds: number,
): string {
  if (source === "github") return `https://github.com/trending?since=${period}`;
  if (source === "reddit") {
    return `https://www.reddit.com/r/${REDDIT_SUBREDDITS.join("+")}/top/.rss?t=${REDDIT_PERIOD[period]}`;
  }
  // Today is the live front page; longer periods are the week's or month's top stories by points.
  if (period === "daily") {
    return "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=40";
  }
  const since = Math.floor(nowSeconds) - PERIOD_DAYS[period] * 86_400;
  return `https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=40&numericFilters=${encodeURIComponent(`created_at_i>${since},points>50`)}`;
}

export async function fetchTrending(
  source: TrendingSource,
  period: TrendingPeriod,
  signal?: AbortSignal,
): Promise<TrendingItem[]> {
  if (source === "x") return [...X_SEARCHES];
  const request = trendingRequestUrl(source, period, Date.now() / 1000);
  const response = await fetch(request, { signal, headers: { Accept: "*/*" } });
  if (response.status === 429) throw new Error("Rate limited. Try again in a minute.");
  if (!response.ok) throw new Error(`Request failed (${response.status}).`);
  if (source === "hackerNews") return parseHackerNews(await response.json());
  const body = await response.text();
  const items = source === "github" ? parseGitHubTrending(body) : parseRedditFeed(body);
  if (items.length === 0) throw new Error("Nothing came back. The page may have changed.");
  return items;
}
