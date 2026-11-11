import type { ViewStyle } from "react-native";
import { MOBILE_SHAPE } from "../../lib/designTokens";
import type { MobileThemeVariables } from "../../lib/mobileTheme";

export const THREAD_LIST_V2_MONO_FONT = "Menlo";
export const THREAD_LIST_V2_ROW_CONTENT_CLASS_NAME = "px-4 py-2.5";
export const THREAD_LIST_V2_ROW_DIVIDERS = true;
/** Screen-pane rows sit on grouped cards; each row draws its own slice of the card. */
export const THREAD_LIST_V2_GROUPED_ROWS = true;
export const THREAD_LIST_V2_SIDEBAR_ROW_STYLE = {
  borderRadius: 12,
  paddingHorizontal: 12,
  paddingVertical: 10,
} satisfies ViewStyle;
export const THREAD_LIST_V2_SIDEBAR_ROW_CONTAINER_STYLE = {
  borderRadius: 12,
  overflow: "hidden",
} satisfies ViewStyle;

export interface ThreadListV2RowGroupPosition {
  readonly start: boolean;
  readonly end: boolean;
}

function groupedRowContainerStyle(start: boolean, end: boolean): ViewStyle {
  const top = start ? MOBILE_SHAPE.group.ios : 0;
  const bottom = end ? MOBILE_SHAPE.group.ios : 0;
  return {
    marginHorizontal: 16,
    overflow: "hidden",
    borderCurve: "continuous",
    borderTopLeftRadius: top,
    borderTopRightRadius: top,
    borderBottomLeftRadius: bottom,
    borderBottomRightRadius: bottom,
  };
}

// Shared objects: the swipeable memoizes on its container style's identity.
const GROUPED_ROW_CONTAINER_STYLES = {
  only: groupedRowContainerStyle(true, true),
  first: groupedRowContainerStyle(true, false),
  last: groupedRowContainerStyle(false, true),
  middle: groupedRowContainerStyle(false, false),
};

export const selectedThreadRowColors = {
  foregroundClassName: "text-thread-selected-foreground",
  mutedForegroundClassName: "text-thread-selected-foreground-muted",
  iconTintClassName: "accent-thread-selected-foreground",
  mutedIconTintClassName: "accent-thread-selected-foreground-muted",
};

export function getThreadListV2NewBranchMenuTitle(_branch: string) {
  return "New thread on branch";
}

export function getThreadListV2RowAppearance(
  theme: MobileThemeVariables,
  sidebarPane: boolean,
  selected: boolean,
  group?: ThreadListV2RowGroupPosition,
) {
  const selectedBackgroundColor = theme["--color-thread-selected"];
  const surfaceColor = theme[sidebarPane ? "--color-drawer" : "--color-grouped-card"];
  const style: ViewStyle | undefined = sidebarPane
    ? {
        backgroundColor: selected ? selectedBackgroundColor : theme["--color-drawer"],
        borderRadius: THREAD_LIST_V2_SIDEBAR_ROW_STYLE.borderRadius,
      }
    : undefined;
  const swipeContainerStyle: ViewStyle | undefined = sidebarPane
    ? THREAD_LIST_V2_SIDEBAR_ROW_CONTAINER_STYLE
    : GROUPED_ROW_CONTAINER_STYLES[
        group?.start === false
          ? group.end
            ? "last"
            : "middle"
          : group?.end === false
            ? "first"
            : "only"
      ];

  return {
    className: sidebarPane ? undefined : "bg-grouped-card",
    interactionClassName: sidebarPane ? "bg-thread-hover" : "bg-row-hover",
    interactionOpacity: selected ? 0 : 1,
    foregroundClassName: sidebarPane ? "text-drawer-foreground" : "text-foreground",
    mutedForegroundClassName: sidebarPane
      ? "text-drawer-foreground-muted"
      : "text-foreground-muted",
    tertiaryForegroundClassName: sidebarPane
      ? "text-drawer-foreground-muted"
      : "text-foreground-tertiary",
    mutedIconTintClassName: sidebarPane
      ? "accent-drawer-foreground-muted"
      : "accent-foreground-muted",
    tertiaryIconTintClassName: sidebarPane
      ? "accent-drawer-foreground-muted"
      : "accent-foreground-tertiary",
    style,
    cardStyle: sidebarPane ? { ...style, ...THREAD_LIST_V2_SIDEBAR_ROW_STYLE } : undefined,
    swipeContainerStyle,
    swipeBackgroundColor: surfaceColor,
    providerIconSurfaceColor: sidebarPane && selected ? selectedBackgroundColor : surfaceColor,
  };
}
