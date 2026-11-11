import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import { EnvironmentId, ProjectId, ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  buildHomeProjectScopes,
  buildHomeProjectSections,
  findHomeProjectScope,
} from "./homeThreadList";
import { buildHomeDeviceSummaries } from "./home-device-summary";
import { makeThreadShellFixture } from "../../test-fixtures";
import { buildThreadListV2Items } from "../threads/threadListV2";

function makeProject(
  input: Partial<EnvironmentProject> & Pick<EnvironmentProject, "environmentId" | "id" | "title">,
): EnvironmentProject {
  return {
    workspaceRoot: `/workspaces/${input.id}`,
    repositoryIdentity: null,
    defaultModelSelection: null,
    scripts: [],
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...input,
  };
}

function makeThread(
  input: Partial<EnvironmentThreadShell> &
    Pick<EnvironmentThreadShell, "environmentId" | "id" | "projectId" | "title">,
): EnvironmentThreadShell {
  return makeThreadShellFixture({
    modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.4" },
    runtimeMode: "full-access",
    interactionMode: "default",
    branch: null,
    worktreePath: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    archivedAt: null,
    latestUserMessageAt: null,
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    hasActionableProposedPlan: false,
    ...input,
  });
}

describe("home project scopes", () => {
  it("filters threads across both scratch hosts while retaining the selected environment boundary", () => {
    const localEnvironmentId = EnvironmentId.make("local");
    const remoteEnvironmentId = EnvironmentId.make("remote");
    const projects = [
      makeProject({
        environmentId: localEnvironmentId,
        id: ProjectId.make("scratch-local"),
        title: "No project",
        workspaceRoot: "/local/scratch",
        isScratch: true,
      }),
      makeProject({
        environmentId: remoteEnvironmentId,
        id: ProjectId.make("scratch-remote"),
        title: "No project",
        workspaceRoot: "/remote/scratch",
        isScratch: true,
      }),
      makeProject({
        environmentId: remoteEnvironmentId,
        id: ProjectId.make("ordinary"),
        title: "No project",
      }),
    ];
    const threads = projects.map((project) =>
      makeThread({
        environmentId: project.environmentId,
        projectId: project.id,
        id: ThreadId.make(`thread-${project.id}`),
        title: project.id,
      }),
    );
    const scopes = buildHomeProjectScopes({
      projects,
      environmentId: null,
      projectGroupingMode: "separate",
    });
    expect(scopes).toHaveLength(2);
    const scratchScope = scopes.find((scope) => scope.representative.isScratch)!;
    const filtered = buildThreadListV2Items({
      threads,
      environmentId: null,
      projectRefs: scratchScope.projectRefs,
      searchQuery: "",
      now: "2026-06-01T00:00:00.000Z",
    });
    expect(filtered.items.map((item) => item.thread.id).sort()).toEqual(
      threads
        .slice(0, 2)
        .map((thread) => thread.id)
        .sort(),
    );
    const remoteScopes = buildHomeProjectScopes({
      projects,
      environmentId: remoteEnvironmentId,
      projectGroupingMode: "separate",
    });
    const remoteScratch = remoteScopes.find((scope) => scope.representative.isScratch)!;
    expect(remoteScratch.key).toBe(scratchScope.key);
    expect(remoteScratch.projectRefs).toEqual([
      { environmentId: remoteEnvironmentId, projectId: projects[1]!.id },
    ]);
    expect(
      buildThreadListV2Items({
        threads,
        environmentId: remoteEnvironmentId,
        projectRefs: remoteScratch.projectRefs,
        searchQuery: "",
        now: "2026-06-01T00:00:00.000Z",
      }).items.map((item) => item.thread.id),
    ).toEqual([threads[1]!.id]);
  });

  it("keeps repository identity from an older duplicate when the freshness winner lacks it", () => {
    const localEnvironmentId = EnvironmentId.make("environment-local");
    const remoteEnvironmentId = EnvironmentId.make("environment-remote");
    const repositoryIdentity = {
      canonicalKey: "github.com/pingdotgg/t3code",
      locator: {
        source: "git-remote" as const,
        remoteName: "origin",
        remoteUrl: "git@github.com:pingdotgg/t3code.git",
      },
    };
    const projects = [
      makeProject({
        environmentId: localEnvironmentId,
        id: ProjectId.make("project-local"),
        title: "t3code",
        repositoryIdentity,
      }),
      makeProject({
        environmentId: remoteEnvironmentId,
        id: ProjectId.make("project-remote-with-identity"),
        title: "t3code",
        workspaceRoot: "/remote/t3code",
        repositoryIdentity,
        updatedAt: "2026-06-01T00:00:00.000Z",
      }),
      makeProject({
        environmentId: remoteEnvironmentId,
        id: ProjectId.make("project-remote-fresh"),
        title: "t3code",
        workspaceRoot: "/remote/t3code/",
        updatedAt: "2026-06-02T00:00:00.000Z",
      }),
    ];

    const scopes = buildHomeProjectScopes({
      projects,
      environmentId: null,
      projectGroupingMode: "repository",
    });

    expect(scopes).toHaveLength(1);
    expect(scopes[0]?.representative.id).toBe(ProjectId.make("project-local"));
    expect(scopes[0]?.projects.map((project) => project.id)).toContain(
      ProjectId.make("project-remote-fresh"),
    );
    expect(scopes[0]?.projectRefs).toHaveLength(3);
  });

  it("does not merge unrelated repositories that share a title", () => {
    const environmentId = EnvironmentId.make("environment-1");
    const projects = ["one", "two"].map((name) =>
      makeProject({
        environmentId,
        id: ProjectId.make(`project-${name}`),
        title: "app",
        repositoryIdentity: {
          canonicalKey: `github.com/example/${name}`,
          locator: {
            source: "git-remote" as const,
            remoteName: "origin",
            remoteUrl: `git@github.com:example/${name}.git`,
          },
        },
      }),
    );

    expect(
      buildHomeProjectScopes({
        projects,
        environmentId: null,
        projectGroupingMode: "repository",
      }),
    ).toHaveLength(2);
  });

  it("prefers an exact scope key over a project ID that collides with it", () => {
    const environmentId = EnvironmentId.make("environment-local");
    const collidingProject = makeProject({
      environmentId,
      id: ProjectId.make("/workspaces/target"),
      title: "Colliding",
      workspaceRoot: "/workspaces/colliding",
    });
    const targetProject = makeProject({
      environmentId,
      id: ProjectId.make("project-target"),
      title: "Target",
      workspaceRoot: "/workspaces/target",
    });
    const scopes = buildHomeProjectScopes({
      projects: [collidingProject, targetProject],
      environmentId: null,
      projectGroupingMode: "separate",
    });
    const targetScope = scopes.find((scope) => scope.title === "Target");
    expect(scopes.map((scope) => scope.title)).toEqual(["Colliding", "Target"]);
    expect(targetScope?.key).toBe("environment-local:/workspaces/target");

    expect(findHomeProjectScope(scopes, "environment-local:/workspaces/target")).toBe(targetScope);
    expect(findHomeProjectScope(scopes, "environment-local:project-target")).toBe(targetScope);
    expect(findHomeProjectScope(scopes, "environment-local:missing")).toBeNull();
    expect(findHomeProjectScope(scopes, null)).toBeNull();
  });

  it("lists each project's open threads newest first and narrows them by search", () => {
    const environmentId = EnvironmentId.make("local");
    const projects = [
      makeProject({ environmentId, id: ProjectId.make("app"), title: "App" }),
      makeProject({ environmentId, id: ProjectId.make("docs"), title: "Docs" }),
    ];
    const thread = (id: string, projectId: string, updatedAt: string, archivedAt?: string) =>
      makeThread({
        environmentId,
        projectId: ProjectId.make(projectId),
        id: ThreadId.make(id),
        title: id,
        updatedAt,
        archivedAt: archivedAt ?? null,
      });
    const threads = [
      thread("older", "app", "2026-06-01T00:00:00.000Z"),
      thread("newer", "app", "2026-06-02T00:00:00.000Z"),
      thread("archived", "app", "2026-06-03T00:00:00.000Z", "2026-06-04T00:00:00.000Z"),
      thread("guide", "docs", "2026-06-01T00:00:00.000Z"),
    ];
    const scopes = buildHomeProjectScopes({
      projects,
      environmentId: null,
      projectGroupingMode: "separate",
    });
    const titles = (searchQuery: string) =>
      buildHomeProjectSections({ scopes, threads, searchQuery }).map((section) => [
        section.scope.title,
        section.threads.map((item) => item.title),
      ]);

    expect(titles("")).toEqual([
      ["App", ["newer", "older"]],
      ["Docs", ["guide"]],
    ]);
    // A project title match keeps all its threads; a thread match keeps only that thread.
    expect(titles("docs")).toEqual([["Docs", ["guide"]]]);
    expect(titles("OLD")).toEqual([["App", ["older"]]]);
  });

  it("summarises each device by what needs the user first, then by running work", () => {
    const busy = EnvironmentId.make("busy");
    const quiet = EnvironmentId.make("quiet");
    const down = EnvironmentId.make("down");
    const base = { projectId: ProjectId.make("p") };
    const summaries = buildHomeDeviceSummaries({
      environments: [
        { environmentId: busy, label: "Busy", connectionState: "connected" },
        { environmentId: quiet, label: "Quiet", connectionState: "connected" },
        { environmentId: down, label: "Down", connectionState: "offline" },
      ],
      threads: [
        makeThread({
          ...base,
          environmentId: busy,
          id: ThreadId.make("asks"),
          title: "asks",
          hasPendingApprovals: true,
        }),
        makeThread({
          ...base,
          environmentId: busy,
          id: ThreadId.make("archived-asks"),
          title: "archived-asks",
          hasPendingApprovals: true,
          archivedAt: "2026-06-02T00:00:00.000Z",
        }),
        makeThread({
          ...base,
          environmentId: down,
          id: ThreadId.make("stale"),
          title: "stale",
          hasPendingUserInput: true,
        }),
      ],
      machineByEnvironmentId: new Map([[busy, "laptop"]]),
    });

    expect(summaries.map((device) => [device.label, device.status, device.attentionCount])).toEqual(
      [
        ["Busy", "attention", 1],
        ["Quiet", "idle", 0],
        ["Down", "offline", 1],
      ],
    );
    expect(summaries[0]!.machineKind).toBe("laptop");
    expect(summaries[1]!.machineKind).toBeNull();
  });
});
