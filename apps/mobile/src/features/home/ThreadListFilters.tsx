import { useFonts } from "expo-font";
import { Pressable, ScrollView, View } from "react-native";
import { SymbolView } from "../../components/ui/AppSymbol";
import { AppText } from "../../components/ui/AppText";
import { GlassSurface } from "../../components/ui/GlassSurface";
import { cn } from "../../lib/cn";
import type { WorkspaceEnvironment } from "../../state/workspaceModel";
import { ListFilterMenu } from "../layout/workspace/ListFilterMenu";
import type { EnvironmentId } from "@t3tools/contracts";
import type {
  HomeListFilterMenuEnvironment,
  HomeListFilterMenuProject,
} from "./home-list-filter-menu";

const PROJECT_PREVIEW_LIMIT = 4;
const workspaceFonts = {
  "Workspace-Manrope": require("../../../assets/fonts/manrope/Manrope-SemiBold.ttf"),
};

export function ThreadListFilters(props: {
  readonly environments: ReadonlyArray<
    HomeListFilterMenuEnvironment & Pick<WorkspaceEnvironment, "connectionState">
  >;
  readonly projects: ReadonlyArray<HomeListFilterMenuProject & { readonly computerCount: number }>;
  readonly showProjectPreview: boolean;
  readonly selectedEnvironmentId: EnvironmentId | null;
  readonly selectedProjectKey: string | null;
  readonly onEnvironmentChange: (environmentId: EnvironmentId | null) => void;
  readonly onProjectChange: (projectKey: string | null) => void;
  /** List padding the scroller bleeds through so pills start where row content does. */
  readonly gutter: number;
}) {
  const [fontsLoaded] = useFonts(workspaceFonts);
  const selectedProject = props.projects.find(
    (project) => project.key === props.selectedProjectKey,
  );
  const canResetBothFilters =
    props.selectedEnvironmentId !== null && props.selectedProjectKey !== null;
  const showProjectMenu =
    !props.showProjectPreview ||
    selectedProject !== undefined ||
    props.projects.length > PROJECT_PREVIEW_LIMIT;
  return (
    <View style={{ marginHorizontal: -props.gutter }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 2, paddingBottom: 8, gap: 6 }}
      >
        <ComputerFilter
          label="All"
          selected={props.selectedEnvironmentId === null}
          onPress={() => props.onEnvironmentChange(null)}
        />
        {props.environments.map((environment) => (
          <ComputerFilter
            key={environment.environmentId}
            label={environment.label}
            phase={environment.connectionState}
            selected={props.selectedEnvironmentId === environment.environmentId}
            onPress={() => props.onEnvironmentChange(environment.environmentId)}
          />
        ))}
      </ScrollView>
      {showProjectMenu || props.projects.length > 0 ? (
        <View className="min-h-11 flex-row items-center justify-between gap-2 px-5">
          <AppText
            accessibilityRole="header"
            textRole="headline"
            className={fontsLoaded ? undefined : "font-t3-bold"}
            style={fontsLoaded ? { fontFamily: "Workspace-Manrope" } : undefined}
          >
            Projects
          </AppText>
          {showProjectMenu ? (
            <ListFilterMenu
              label={
                selectedProject?.label ?? (props.showProjectPreview ? "View all" : "All projects")
              }
              accessibilityLabel="Filter threads by project"
              active={selectedProject !== undefined}
              actions={[
                {
                  id: "all",
                  title: "All projects",
                  state: props.selectedProjectKey === null ? "on" : "off",
                },
                ...props.projects.map((project) => ({
                  id: JSON.stringify(project.key),
                  title: project.label,
                  state:
                    project.key === props.selectedProjectKey ? ("on" as const) : ("off" as const),
                })),
                ...(canResetBothFilters ? [{ id: "reset", title: "Reset filters" }] : []),
              ]}
              onSelect={(id) => {
                if (id === "reset") {
                  props.onEnvironmentChange(null);
                  props.onProjectChange(null);
                } else if (id === "all") {
                  props.onProjectChange(null);
                } else {
                  const project = props.projects.find(
                    (candidate) => JSON.stringify(candidate.key) === id,
                  );
                  if (project) props.onProjectChange(project.key);
                }
              }}
            />
          ) : null}
        </View>
      ) : null}
      {props.showProjectPreview && !selectedProject && props.projects.length > 0 ? (
        <View className="pb-3">
          {props.projects.slice(0, PROJECT_PREVIEW_LIMIT).map((project) => (
            <Pressable
              key={project.key}
              accessibilityRole="button"
              accessibilityLabel={
                project.computerCount > 1
                  ? `${project.label}, ${project.computerCount} computers`
                  : project.label
              }
              className="min-h-12 flex-row items-center gap-3 px-5 active:bg-subtle"
              onPress={() => props.onProjectChange(project.key)}
            >
              <SymbolView name="folder" size={19} tintColorClassName="accent-icon-muted" />
              <AppText className="min-w-0 flex-1 font-t3-medium" numberOfLines={1}>
                {project.label}
              </AppText>
              {project.computerCount > 1 ? (
                <AppText textRole="caption" className="text-foreground-muted">
                  {project.computerCount} computers
                </AppText>
              ) : null}
              <SymbolView name="chevron.right" size={12} tintColorClassName="accent-icon-muted" />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ComputerFilter(props: {
  readonly label: string;
  readonly phase?: WorkspaceEnvironment["connectionState"];
  readonly selected: boolean;
  readonly onPress: () => void;
}) {
  const connecting = props.phase === "connecting" || props.phase === "reconnecting";
  const status = props.phase === "connected" ? "Online" : connecting ? "Connecting" : "Unavailable";
  const contents = (
    <>
      {props.phase ? (
        <>
          <View
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              props.phase === "connected"
                ? "bg-emerald-500"
                : connecting
                  ? "bg-amber-400"
                  : "bg-foreground-muted",
            )}
          />
          <SymbolView name="laptopcomputer" size={15} tintColorClassName="accent-icon-muted" />
        </>
      ) : null}
      <AppText
        textRole="footnote"
        numberOfLines={1}
        className={cn("max-w-44 shrink font-t3-medium", !props.selected && "text-foreground-muted")}
      >
        {props.label}
      </AppText>
    </>
  );
  const layout = "min-h-11 flex-row items-center gap-2 px-3.5";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.phase ? `${props.label}, ${status}` : "All computers"}
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
      className="rounded-full active:opacity-70"
    >
      {props.selected ? (
        <GlassSurface
          className={layout}
          chrome="none"
          tintColor={null}
          fallbackClassName="bg-subtle"
          style={{ borderRadius: 24 }}
        >
          {contents}
        </GlassSurface>
      ) : (
        <View className={layout}>{contents}</View>
      )}
    </Pressable>
  );
}
