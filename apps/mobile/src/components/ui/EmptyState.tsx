import { View } from "react-native";
import type { ReactNode } from "react";

import { AppText as Text } from "./AppText";
import { Button } from "./Button";
import { WorkspaceHeading } from "./WorkspaceHeading";

export function EmptyState(props: {
  readonly title: string;
  readonly detail: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly action?: ReactNode;
  /** Drawing shown above the title, for states that are about a device or a place. */
  readonly illustration?: ReactNode;
  readonly variant?: "card" | "plain";
}) {
  if (props.variant === "plain") {
    return (
      <View className="items-center px-8 py-8">
        {props.illustration ? <View className="mb-4">{props.illustration}</View> : null}
        <WorkspaceHeading textRole="title" className="text-center text-foreground">
          {props.title}
        </WorkspaceHeading>
        <Text
          textRole="body"
          className="mt-2 text-center font-sans leading-normal text-foreground-muted"
        >
          {props.detail}
        </Text>
        {props.action ? (
          <View className="mt-5">{props.action}</View>
        ) : props.actionLabel && props.onAction ? (
          <View className="mt-5">
            <Button tone="primary" label={props.actionLabel} onPress={props.onAction} />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View className="rounded-[22px] border border-border bg-card p-5">
      {props.illustration ? <View className="mb-3 self-start">{props.illustration}</View> : null}
      <WorkspaceHeading textRole="headline" className="text-foreground">
        {props.title}
      </WorkspaceHeading>
      <Text textRole="footnote" className="mt-2 font-sans leading-relaxed text-foreground-muted">
        {props.detail}
      </Text>
      {props.action ? (
        <View className="mt-4 self-start">{props.action}</View>
      ) : props.actionLabel && props.onAction ? (
        <View className="mt-4 self-start">
          <Button tone="primary" label={props.actionLabel} onPress={props.onAction} />
        </View>
      ) : null}
    </View>
  );
}
