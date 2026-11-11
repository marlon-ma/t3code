import type { ReactNode } from "react";
import { Platform, useWindowDimensions, View } from "react-native";

import { cn } from "../../lib/cn";
import { AppText } from "./AppText";
import { SymbolView, type AppSymbolName } from "./AppSymbol";

export interface ListRowContentProps {
  readonly icon?: AppSymbolName;
  /** Drawn in the icon column for marks a single symbol can't express. */
  readonly leading?: ReactNode;
  readonly label: string;
  readonly description?: string;
  readonly detail?: string;
  /** Rich secondary content under the description, such as scores with emphasized values. */
  readonly meta?: ReactNode;
  readonly disabled?: boolean;
}

export function ListRowLayout({
  icon,
  leading,
  label,
  description,
  detail,
  meta,
  disabled,
  accessory,
  tone = "default",
}: ListRowContentProps & { readonly accessory?: ReactNode; readonly tone?: "default" | "danger" }) {
  const { fontScale } = useWindowDimensions();
  const stackDetail = fontScale >= 1.5;
  return (
    <View
      className={cn(
        "min-h-14 flex-row items-center gap-3 px-4 py-3",
        description && "min-h-18",
        disabled && "opacity-45",
      )}
    >
      {icon ? (
        Platform.OS === "android" ? (
          <View className="size-6 items-center justify-center">
            <SymbolView
              name={icon}
              size={24}
              tintColorClassName={tone === "danger" ? "accent-danger-foreground" : "accent-icon"}
              type="monochrome"
              weight="regular"
            />
          </View>
        ) : (
          // A tinted tile gives every row the same weight whatever its symbol's shape.
          <View
            className={cn(
              "size-8 items-center justify-center rounded-[10px] border-continuous",
              tone === "danger" ? "bg-danger-foreground/10" : "bg-primary/10",
            )}
          >
            <SymbolView
              name={icon}
              size={17}
              tintColorClassName={tone === "danger" ? "accent-danger-foreground" : "accent-primary"}
              type="monochrome"
              weight="medium"
            />
          </View>
        )
      ) : leading ? (
        <View className="size-6 items-center justify-center">{leading}</View>
      ) : null}
      <View className="min-w-0 flex-1 gap-1">
        <AppText
          textRole="body"
          className={tone === "danger" ? "text-danger-foreground" : "text-foreground"}
        >
          {label}
        </AppText>
        {description ? (
          <AppText textRole="footnote" className="text-foreground-muted">
            {description}
          </AppText>
        ) : null}
        {meta}
        {detail && stackDetail ? (
          <AppText textRole="footnote" className="text-foreground-muted">
            {detail}
          </AppText>
        ) : null}
      </View>
      {detail && !stackDetail ? (
        <AppText
          textRole="footnote"
          className="max-w-[40%] shrink text-right text-foreground-muted"
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {detail}
        </AppText>
      ) : null}
      {accessory}
    </View>
  );
}
