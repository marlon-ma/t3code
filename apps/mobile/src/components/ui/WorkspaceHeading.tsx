import { AppText, type AppTextProps } from "./AppText";
import { cn } from "../../lib/cn";

/** Title text in the workspace display typeface. */
export function WorkspaceHeading({ className, ...props }: AppTextProps) {
  return <AppText {...props} className={cn("font-workspace", className)} />;
}
