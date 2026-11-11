import { View } from "react-native";

import { cn } from "../../lib/cn";

/** What something is doing right now, as the one colour vocabulary every screen shares. */
export type ActivityTone = "attention" | "working" | "idle" | "offline";

const TONE_CLASS_NAMES: Record<ActivityTone, string> = {
  attention: "bg-warning-foreground",
  working: "bg-primary",
  idle: "bg-emerald-500",
  offline: "bg-foreground-muted/50",
};

/** A status as a dot: orange needs you, blue is working, green is fine, grey is unreachable. */
export function StatusDot(props: { readonly tone: ActivityTone; readonly size?: number }) {
  const size = props.size ?? 8;
  return (
    <View
      className={cn("rounded-full", TONE_CLASS_NAMES[props.tone])}
      style={{ width: size, height: size }}
    />
  );
}
