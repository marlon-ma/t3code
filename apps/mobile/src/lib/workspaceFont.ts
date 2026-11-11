import { loadAsync } from "expo-font";

/** Display typeface for titles and section headings; body text stays in the system sans. */
export const WORKSPACE_FONT_FAMILY = "Workspace-Manrope";

/** Registers the display typeface; text set in it falls back to the system face until it resolves. */
export function loadWorkspaceFont(): Promise<void> {
  return loadAsync({
    [WORKSPACE_FONT_FAMILY]: require("../../assets/fonts/manrope/Manrope-SemiBold.ttf"),
  });
}
