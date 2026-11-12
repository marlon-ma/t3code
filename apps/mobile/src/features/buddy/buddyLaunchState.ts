import { Atom } from "effect/reactivity";
import type { ComponentRef } from "react";
import { Platform, type View } from "react-native";

/** False while the launch face is still on its way to the header, which hides the header's own. */
export const buddyLaunchLandedAtom = Atom.make(Platform.OS !== "ios").pipe(Atom.keepAlive);

/** The header face the launch animation lands on. */
export const buddyLaunchAnchorAtom = Atom.make<ComponentRef<typeof View> | null>(null).pipe(
  Atom.keepAlive,
);
