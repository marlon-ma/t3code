import { useFonts } from "expo-font";

import { AppText, type AppTextProps } from "./AppText";
import { cn } from "../../lib/cn";

const workspaceFonts = {
  "Workspace-Manrope": require("../../../assets/fonts/manrope/Manrope-SemiBold.ttf"),
};

/** Display text in the workspace typeface; falls back to the bold system face until it loads. */
export function WorkspaceHeading({ className, style, ...props }: AppTextProps) {
  const [fontsLoaded] = useFonts(workspaceFonts);
  return (
    <AppText
      {...props}
      className={cn(!fontsLoaded && "font-t3-bold", className)}
      style={fontsLoaded ? [{ fontFamily: "Workspace-Manrope" }, style] : style}
    />
  );
}
