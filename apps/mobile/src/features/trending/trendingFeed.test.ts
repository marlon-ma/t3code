import { describe, expect, it } from "vite-plus/test";
import {
  githubRepositoryOf,
  parseGitHubTrending,
  parseHackerNews,
  parseRedditFeed,
  trendingRequestUrl,
} from "./trendingFeed";

// Trimmed from github.com/trending; the attributes the parser skips are kept to prove it skips them.
const GITHUB_ROW = `
<article class="Box-row">
  <div class="float-right d-flex"><a href="/login?return_to=%2Fmeta%2Fastryx">Star</a></div>
  <h2 class="h3 lh-condensed">
    <a data-hydro-click="{&quot;x&quot;:1}" href="/meta/astryx" class="Link"><svg></svg>
      <span class="text-normal">meta /</span> astryx</a>  </h2>
    <p class="col-9 color-fg-muted my-1 tmp-pr-4">
      An open source design system that&#39;s fully <em>agent</em> ready
    </p>
  <div class="f6 color-fg-muted mt-2">
    <span class="repo-language-color" style="background-color: #3178c6"></span>
    <span itemprop="programmingLanguage">TypeScript</span>
    <a href="/meta/astryx/stargazers" class="Link"><svg><path d="M8"></path></svg>
        25,261</a>
    <a href="/meta/astryx/forks" class="Link"><svg></svg>
        1,968</a>
    <span class="d-inline-block float-sm-right"><svg></svg>
        2,776 stars today
</span>  </div>
</article>
<article class="Box-row">
  <h2 class="h3"><a href="/someone/bare" class="Link">bare</a></h2>
</article>`;

describe("parseGitHubTrending", () => {
  it("reads each repository row, and leaves out what a row does not say", () => {
    expect(parseGitHubTrending(`<html>${GITHUB_ROW}</html>`)).toEqual([
      {
        id: "github:meta/astryx",
        title: "meta/astryx",
        url: "https://github.com/meta/astryx",
        description: "An open source design system that's fully agent ready",
        discussionUrl: null,
        repository: { owner: "meta", name: "astryx" },
        detail: {
          kind: "github",
          language: "TypeScript",
          languageColor: "#3178c6",
          stars: 25261,
          forks: 1968,
          gained: 2776,
        },
      },
      expect.objectContaining({
        title: "someone/bare",
        description: null,
        detail: {
          kind: "github",
          language: null,
          languageColor: null,
          stars: null,
          forks: null,
          gained: null,
        },
      }),
    ]);
  });
});

describe("parseHackerNews", () => {
  it("links the thread, and treats a text post's thread as its own link", () => {
    const items = parseHackerNews({
      hits: [
        {
          objectID: "1",
          title: "Show HN: a thing",
          url: "https://github.com/acme/thing/tree/main",
          author: "pg",
          points: 120,
          num_comments: 4,
        },
        { objectID: "2", title: "Ask HN: why?", url: null, author: "dang" },
        { title: "no id" },
      ],
    });
    expect(items).toEqual([
      {
        id: "hackerNews:1",
        title: "Show HN: a thing",
        url: "https://github.com/acme/thing/tree/main",
        description: null,
        discussionUrl: "https://news.ycombinator.com/item?id=1",
        repository: { owner: "acme", name: "thing" },
        detail: {
          kind: "hackerNews",
          host: "github.com",
          author: "pg",
          points: 120,
          comments: 4,
        },
      },
      expect.objectContaining({
        url: "https://news.ycombinator.com/item?id=2",
        discussionUrl: null,
        repository: null,
        detail: expect.objectContaining({ points: 0, comments: 0 }),
      }),
    ]);
  });
});

const redditEntry = (content: string) => `<entry>
<author><name>/u/alice</name><uri>https://www.reddit.com/user/alice</uri></author>
<category term="programming" label="r/programming"/>
<content type="html">${content}</content>
<id>t3_abc</id>
<link href="https://www.reddit.com/r/programming/comments/abc/a_title/" />
<updated>2026-11-11T10:00:00+00:00</updated>
<title>Rust &amp; friends</title>
</entry>`;

describe("parseRedditFeed", () => {
  it("prefers the post's external link and keeps the thread beside it", () => {
    const [item] = parseRedditFeed(
      `<feed>${redditEntry(
        "&lt;span&gt;&lt;a href=&quot;https://github.com/acme/tool?ref=x&amp;amp;y=1&quot;&gt;[link]&lt;/a&gt;&lt;/span&gt;",
      )}</feed>`,
    );
    expect(item).toEqual({
      id: "reddit:t3_abc",
      title: "Rust & friends",
      url: "https://github.com/acme/tool?ref=x&y=1",
      description: null,
      discussionUrl: "https://www.reddit.com/r/programming/comments/abc/a_title/",
      repository: { owner: "acme", name: "tool" },
      detail: {
        kind: "reddit",
        subreddit: "r/programming",
        author: "/u/alice",
        host: "github.com",
      },
    });
  });

  it("uses the thread itself for a text post", () => {
    const [item] = parseRedditFeed(
      redditEntry(
        "&lt;a href=&quot;https://www.reddit.com/r/programming/comments/abc/a_title/&quot;&gt;[link]&lt;/a&gt;",
      ),
    );
    expect(item).toMatchObject({
      url: "https://www.reddit.com/r/programming/comments/abc/a_title/",
      discussionUrl: null,
      repository: null,
    });
  });
});

describe("githubRepositoryOf", () => {
  it.each([
    ["https://github.com/acme/tool.git", { owner: "acme", name: "tool" }],
    ["https://www.github.com/acme/tool#readme", { owner: "acme", name: "tool" }],
    ["https://github.com/topics/rust", null],
    ["https://github.com/acme", null],
    ["https://gitlab.com/acme/tool", null],
  ])("%s", (url, expected) => {
    expect(githubRepositoryOf(url)).toEqual(expected);
  });
});

describe("trendingRequestUrl", () => {
  const now = 1_800_000_000;
  it.each([
    ["github", "weekly", "https://github.com/trending?since=weekly"],
    ["hackerNews", "daily", "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=40"],
    [
      "hackerNews",
      "monthly",
      `https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=40&numericFilters=${encodeURIComponent(
        `created_at_i>${now - 30 * 86_400},points>50`,
      )}`,
    ],
    [
      "reddit",
      "weekly",
      "https://www.reddit.com/r/programming+opensource+LocalLLaMA+selfhosted+webdev/top/.rss?t=week",
    ],
  ] as const)("%s %s", (source, period, expected) => {
    expect(trendingRequestUrl(source, period, now)).toBe(expected);
  });
});
