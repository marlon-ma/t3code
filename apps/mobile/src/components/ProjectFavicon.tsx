import { SymbolView } from "./ui/AppSymbol";
import { AppText } from "./ui/AppText";
import { memo } from "react";
import { View } from "react-native";
import type { EnvironmentId, ProjectIconOverride } from "@t3tools/contracts";
import {
  countGlyphs,
  projectAutoMonogram,
  projectIconColorClassNames,
  resolveProjectIconGlyph,
  resolveProjectIconSymbol,
  type ProjectIconGlyph,
} from "../lib/projectIcon";

// Projects always show a letter mark (or the user's own icon), never the repo favicon.
export const ProjectFavicon = memo(function ProjectFavicon(props: {
  readonly environmentId: EnvironmentId;
  readonly open?: boolean;
  readonly size?: number;
  readonly projectTitle: string;
  readonly workspaceRoot?: string | null;
  readonly faviconPath?: string | null;
  readonly projectIcon?: ProjectIconOverride | null;
}) {
  const size = props.size ?? 42;
  const symbol = resolveProjectIconSymbol(props.projectIcon);
  if (symbol !== null) {
    return (
      <SymbolView
        name={symbol.name}
        size={size}
        tintColorClassName={projectIconColorClassNames(symbol.color).tint}
        type="monochrome"
      />
    );
  }

  const glyph =
    resolveProjectIconGlyph(props.projectIcon, props.projectTitle) ??
    projectAutoMonogram(props.projectTitle);
  if (glyph !== null) {
    return <ProjectIconGlyphView glyph={glyph} size={size} />;
  }

  return (
    <SymbolView
      name={{ ios: "folder.fill", android: props.open ? "folder_open" : "folder" }}
      size={size}
      tintColorClassName={"accent-icon-subtle"}
      type="monochrome"
    />
  );
});

function ProjectIconGlyphView(props: { readonly glyph: ProjectIconGlyph; readonly size: number }) {
  const { glyph, size } = props;
  if (glyph.kind === "emoji") {
    return (
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <AppText
          allowFontScaling={false}
          style={{
            fontSize: size * 0.8,
            lineHeight: size,
            textAlign: "center",
            includeFontPadding: false,
          }}
        >
          {glyph.emoji}
        </AppText>
      </View>
    );
  }

  // Letter marks share the accent tile of list-row icons, so projects read as one set.
  return (
    <View
      className="bg-primary/10"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.25,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AppText
        allowFontScaling={false}
        numberOfLines={1}
        className="font-mono text-primary"
        style={{
          fontWeight: "700",
          fontSize: size * (countGlyphs(glyph.text) === 1 ? 0.6 : 0.515625),
          lineHeight: size,
          textAlign: "center",
          includeFontPadding: false,
        }}
      >
        {glyph.text}
      </AppText>
    </View>
  );
}
