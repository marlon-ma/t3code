import type { ReactNode } from "react";
import { Platform, View, type LayoutChangeEvent } from "react-native";

import { cn } from "../../lib/cn";
import { MOBILE_SHAPE } from "../../lib/designTokens";

/** A free-form block on the grouped-card surface, for content that is not a list of rows. */
export function UsageCard(props: {
  readonly className?: string;
  readonly children: ReactNode;
  readonly onLayout?: (event: LayoutChangeEvent) => void;
}) {
  return (
    <View
      className={cn("border-continuous bg-grouped-card p-4", props.className)}
      style={{
        borderRadius:
          Platform.OS === "android" ? MOBILE_SHAPE.group.android : MOBILE_SHAPE.group.ios,
      }}
      onLayout={props.onLayout}
    >
      {props.children}
    </View>
  );
}
