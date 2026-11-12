import { DEFAULT_HOSTED_APP_URL } from "@t3tools/shared/connectAuth";
import { afterEach, expect, it, vi } from "vite-plus/test";

import appleAppSiteAssociation from "../web/public/.well-known/apple-app-site-association.json";
import assetLinks from "../web/public/.well-known/assetlinks.json";

// Keep config parsing independent of local env files and build credentials.
vi.mock("../../scripts/lib/public-config.ts", () => ({
  loadRepoEnv: () =>
    Object.fromEntries(
      [
        "APP_VARIANT",
        "T3CODE_WORKSPACE_TESTFLIGHT",
        "T3CODE_WORKSPACE_BUILD_NUMBER",
        "T3CODE_RELAY_URL",
        "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
      ].flatMap((key) => {
        const value = process.env[key];
        return value === undefined ? [] : [[key, value]];
      }),
    ),
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

async function loadConfig(variant: string | undefined) {
  vi.resetModules();
  vi.stubEnv("APP_VARIANT", variant);
  return (await import("./app.config.ts")).default;
}

it.each(["prod", ""])("rejects APP_VARIANT=%j before selecting production IDs", async (value) => {
  await expect(loadConfig(value)).rejects.toThrow(
    "APP_VARIANT must be development, preview, or production.",
  );
});

it.each([
  [undefined, "com.t3tools.t3code"],
  ["development", "com.t3tools.t3code.dev"],
  ["preview", "com.t3tools.t3code.preview"],
  ["production", "com.t3tools.t3code"],
])("keeps the iOS and Android identifiers for APP_VARIANT=%j", async (value, identifier) => {
  const config = await loadConfig(value);
  expect(config.ios?.bundleIdentifier).toBe(identifier);
  expect(config.android?.package).toBe(identifier);
  // Copied thread links open this app only while app.t3.codes lists it.
  const host = new URL(DEFAULT_HOSTED_APP_URL).host;
  expect(config.ios?.associatedDomains).toContain(`applinks:${host}`);
  expect(appleAppSiteAssociation.applinks.details[0]?.appIDs).toContain(
    `${config.ios?.appleTeamId}.${identifier}`,
  );
  expect(config.android?.intentFilters?.[0]?.data).toEqual([
    { scheme: "https", host, pathPrefix: "/threads/" },
  ]);
  expect(assetLinks.map((link) => link.target.package_name)).toContain(identifier);
});

it("uses an independent iOS identity for Workspace TestFlight builds", async () => {
  vi.stubEnv("T3CODE_WORKSPACE_TESTFLIGHT", "1");
  vi.stubEnv("T3CODE_WORKSPACE_BUILD_NUMBER", "7");
  vi.stubEnv("T3CODE_RELAY_URL", "https://relay.example.test");
  vi.stubEnv("EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_placeholder");
  const config = await loadConfig("production");
  expect(config.platforms).toEqual(["ios"]);
  expect(config.scheme).toBe("marlon-workspace");
  expect(config.ios).toMatchObject({
    bundleIdentifier: "com.marlonma.workspace",
    buildNumber: "7",
    entitlements: { "keychain-access-groups": ["$(AppIdentifierPrefix)com.marlonma.workspace"] },
  });
  expect(config.ios?.associatedDomains).toBeUndefined();
  // Updates come from the Workspace's own Expo project, never the T3 Code one.
  expect(config.owner).toBe("marlonma");
  expect(config.extra?.eas).toEqual({
    projectId: "ca22af01-bc3b-4e4b-8bf4-00c9f5d20dd9",
    observe: { endpointUrl: "https://observe.invalid" },
  });
  expect(config.updates).toMatchObject({
    enabled: true,
    url: "https://u.expo.dev/ca22af01-bc3b-4e4b-8bf4-00c9f5d20dd9",
    requestHeaders: { "expo-channel-name": "production" },
  });
  expect(config.runtimeVersion).toEqual({ policy: "appVersion" });
  expect(config.extra?.relay.url).toBeNull();
  expect(config.extra?.clerk.publishableKey).toBeNull();
});
