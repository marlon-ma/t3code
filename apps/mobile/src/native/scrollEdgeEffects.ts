// Avoid RN/navigation imports so node checks do not load their untranspiled Flow.

export type NativeTopScrollEdgeEffect = "automatic" | "soft" | "hard";
export type NativeHeaderScrollEdgeEffects = {
  readonly top: NativeTopScrollEdgeEffect;
  readonly bottom: "hidden";
  readonly left: "hidden";
  readonly right: "hidden";
};

function nativeTopScrollEdgeEffect(
  os: string,
  _version: number | string,
): NativeTopScrollEdgeEffect {
  if (os !== "ios") {
    return "automatic";
  }

  // On iOS 27, soft uses a local overlay rather than sampling edge-to-edge app content.
  return "automatic";
}

export function nativeHeaderScrollEdgeEffects(
  os: string,
  version: number | string,
): NativeHeaderScrollEdgeEffects {
  return {
    top: nativeTopScrollEdgeEffect(os, version),
    bottom: "hidden",
    left: "hidden",
    right: "hidden",
  };
}

/**
 * For screens whose bar carries a title and controls over dense text: the soft blur lets a bubble
 * or a line of prose read through the title, so the bar gets UIKit's opaque backing instead.
 */
export const DENSE_CONTENT_SCROLL_EDGE_EFFECTS: NativeHeaderScrollEdgeEffects = {
  top: "hard",
  bottom: "hidden",
  left: "hidden",
  right: "hidden",
};
