import { useResolveClassNames } from "uniwind";

export interface IllustrationPalette {
  /** Dark faces and line work. */
  readonly ink: string;
  /** The one saturated colour: lit faces and active screens. */
  readonly accent: string;
  /** Resting top faces: the accent washed most of the way into the page colour. */
  readonly surface: string;
  /** Dark faces of a device that is off or unreachable. */
  readonly muted: string;
  /** The page colour, for cut-outs and labels. */
  readonly paper: string;
}

function colorOf(style: { readonly backgroundColor?: unknown }, fallback: string): string {
  return typeof style.backgroundColor === "string" ? style.backgroundColor : fallback;
}

function channels(hex: string): readonly [number, number, number] | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return null;
  const value = Number.parseInt(match[1]!, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** `amount` of `from` mixed into `into`; theme neutrals alone are too close to the page to read as a face. */
function mix(from: string, into: string, amount: number): string {
  const a = channels(from);
  const b = channels(into);
  if (!a || !b) return from;
  const blend = a.map((channel, index) => Math.round(channel * amount + b[index]! * (1 - amount)));
  return `rgb(${blend.join(", ")})`;
}

/** Theme colours for the isometric drawings, shared so devices and spot drawings match. */
export function useIllustrationPalette(): IllustrationPalette {
  const ink = colorOf(useResolveClassNames("bg-foreground"), "#27272a");
  const accent = colorOf(useResolveClassNames("bg-primary"), "#1b4ed8");
  const muted = colorOf(useResolveClassNames("bg-foreground-muted"), "#6f6f79");
  const paper = colorOf(useResolveClassNames("bg-screen"), "#fcfcfc");
  // On a dark page a light wash disappears into the card, so the faces take more of the accent.
  const paperChannels = channels(paper);
  const darkPage =
    paperChannels !== null && paperChannels[0] + paperChannels[1] + paperChannels[2] < 384;
  return { ink, accent, muted, paper, surface: mix(accent, paper, darkPage ? 0.42 : 0.18) };
}
