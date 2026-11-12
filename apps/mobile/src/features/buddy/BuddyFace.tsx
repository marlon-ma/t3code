import { useAtomValue } from "@effect/atom-react";
import { useIsFocused } from "@react-navigation/native";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet } from "react-native";
import Animated, {
  makeMutable,
  useAnimatedProps,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { useResolveClassNames } from "uniwind";

import {
  BUDDY_SLOT_COUNT,
  BUDDY_VIEW_BOX,
  buddyEmotionIndex,
  createBuddyEngineState,
  pokeBuddy,
  setBuddyEmotion,
  stepBuddy,
  type BuddyEngineState,
  type BuddyTheme,
} from "./buddyEyeEngine";
import { buddyFailedCountAtom, buddyMoodAtom, type BuddyMood } from "./buddyMood";

const AnimatedPath = Animated.createAnimatedComponent(Path);

const MOOD_EMOTION: Record<BuddyMood, string> = {
  asleep: "00",
  idle: "02",
  working: "32",
  waiting: "35",
  attention: "13",
  request: "03",
  limited: "15",
};
/** Busy, thinking, searching, replying: working cycles through these so it never looks stuck. */
const WORKING_EMOTIONS = ["32", "30", "40", "39"];
const WORKING_ROTATE_MS = 14_000;
const TAP_REACTIONS = ["10", "11", "14", "17", "18", "19", "20", "21", "03"];

const MOOD_LABEL: Record<BuddyMood, string> = {
  asleep: "Buddy is asleep",
  idle: "Buddy is idle",
  working: "Buddy is working",
  waiting: "Buddy is waiting on another thread",
  attention: "Buddy needs you",
  request: "Buddy has a guest message",
  limited: "Buddy hit a usage limit",
};

function startReaction(
  timer: { current: ReturnType<typeof setTimeout> | null },
  setReaction: (id: string | null) => void,
  id: string,
  ms: number,
) {
  if (timer.current) clearTimeout(timer.current);
  setReaction(id);
  timer.current = setTimeout(() => setReaction(null), ms);
}

/** The mood's expression, briefly overridden by reactions to what just happened. */
function useBuddyEmotion(mood: BuddyMood, failedCount: number) {
  const [reaction, setReaction] = useState<string | null>(null);
  const [workingStep, setWorkingStep] = useState(0);
  const previous = useRef({ mood, failedCount });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const react = (id: string, ms: number) => startReaction(timer, setReaction, id, ms);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- reacts to status edges with timed expressions
  useEffect(() => {
    const before = previous.current;
    previous.current = { mood, failedCount };
    const reaction =
      failedCount > before.failedCount
        ? (["34", 4000] as const)
        : before.mood === "asleep" && mood !== "asleep"
          ? (["01", 2200] as const)
          : before.mood === "working" && mood === "idle"
            ? (["33", 3600] as const)
            : null;
    if (reaction) startReaction(timer, setReaction, reaction[0], reaction[1]);
  }, [mood, failedCount]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- rotates working expressions on a timer
  useEffect(() => {
    if (mood !== "working") return;
    const interval = setInterval(() => setWorkingStep((step) => step + 1), WORKING_ROTATE_MS);
    return () => clearInterval(interval);
  }, [mood]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- clears the pending reaction timer on unmount
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const id =
    reaction ??
    (mood === "working"
      ? WORKING_EMOTIONS[workingStep % WORKING_EMOTIONS.length]!
      : MOOD_EMOTION[mood]);
  const tap = () => react(TAP_REACTIONS[Math.floor(Math.random() * TAP_REACTIONS.length)]!, 2600);
  return { emotion: buddyEmotionIndex(id), tap };
}

function useAppActive() {
  const [active, setActive] = useState(AppState.currentState === "active");
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- subscribes to the app's foreground state
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) =>
      setActive(next === "active"),
    );
    return () => subscription.remove();
  }, []);
  return active;
}

interface Slot {
  readonly d: string;
  readonly fill: string;
  readonly opacity: number;
}

function BuddySlot(props: { readonly slot: SharedValue<Slot> }) {
  const animatedProps = useAnimatedProps(() => {
    const value = props.slot.get();
    return { d: value.d, fill: value.fill, opacity: value.opacity };
  });
  return <AnimatedPath animatedProps={animatedProps} />;
}

function parseColor(value: unknown, fallback: readonly [number, number, number]) {
  if (typeof value !== "string") return fallback;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
    const n = Number.parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
  }
  const rgb = /rgba?\(([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(value);
  return rgb ? ([Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] as const) : fallback;
}

/** Grok-style: a ball in the text colour with eyes in the background colour. */
function useBuddyTheme(): BuddyTheme {
  const body = StyleSheet.flatten(useResolveClassNames("text-foreground"))?.color;
  const eye = StyleSheet.flatten(useResolveClassNames("bg-screen"))?.backgroundColor;
  const muted = StyleSheet.flatten(useResolveClassNames("text-foreground-muted"))?.color;
  return useMemo(
    () => ({
      body: parseColor(body, [20, 20, 20]),
      eye: parseColor(eye, [255, 255, 255]),
      muted: parseColor(muted, [128, 128, 128]),
    }),
    [body, eye, muted],
  );
}

/**
 * Buddy, after Emotion Ball (github.com/Aithena/emotion-ball): a ball whose eyes morph,
 * blink and glance with what the agents are doing. Tap it for a reaction.
 */
export function BuddyFace(props: { readonly size: number }) {
  const mood = useAtomValue(buddyMoodAtom);
  const failedCount = useAtomValue(buddyFailedCountAtom);
  const { emotion, tap } = useBuddyEmotion(mood, failedCount);
  const reduceMotion = useReducedMotion();
  const focused = useIsFocused();
  const appActive = useAppActive();
  const theme = useBuddyTheme();

  const target = useSharedValue(emotion);
  const pokes = useSharedValue(0);
  const themeValue = useSharedValue(theme);
  const engine = useSharedValue<BuddyEngineState | null>(null);
  const [slots] = useState(() =>
    Array.from({ length: BUDDY_SLOT_COUNT }, () =>
      makeMutable<Slot>({ d: "", fill: "transparent", opacity: 0 }),
    ).map((value, id) => ({ id, value })),
  );

  const frame = useFrameCallback((info) => {
    "worklet";
    const now = info.timestamp;
    engine.modify((current) => {
      "worklet";
      const state = current ?? createBuddyEngineState(target.get(), now);
      if (state.requested !== target.get()) {
        state.requested = target.get();
        setBuddyEmotion(state, target.get(), now);
      }
      if (state.pokes !== pokes.get()) {
        state.pokes = pokes.get();
        pokeBuddy(state, now);
      }
      if (stepBuddy(state, now, true, themeValue.get())) {
        for (let i = 0; i < slots.length; i++) {
          const slot = slots[i]!.value;
          const shown = slot.get();
          if (
            shown.d !== state.d[i] ||
            shown.fill !== state.fill[i] ||
            Math.abs(shown.opacity - state.opacity[i]!) > 0.01
          ) {
            slot.set({ d: state.d[i]!, fill: state.fill[i]!, opacity: state.opacity[i]! });
          }
        }
      }
      return state;
    }, false);
  }, false);

  const running = !reduceMotion && focused && appActive;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- drives the UI-thread frame loop and paused frames
  useEffect(() => {
    target.set(emotion);
    themeValue.set(theme);
    frame.setActive(running);
    if (running) return;
    // Paused: show the expression's resting frame rather than a frozen mid-blink.
    const still = createBuddyEngineState(emotion, 0);
    stepBuddy(still, 0, false, theme);
    slots.forEach(({ value: slot }, i) =>
      slot.set({ d: still.d[i]!, fill: still.fill[i]!, opacity: still.opacity[i]! }),
    );
    engine.set(null);
  }, [emotion, running, frame, target, themeValue, theme, slots, engine]);

  return (
    <Pressable
      accessibilityLabel={MOOD_LABEL[mood]}
      hitSlop={6}
      onPress={() => {
        tap();
        pokes.set(pokes.get() + 1);
      }}
    >
      <Svg
        width={props.size}
        height={props.size}
        viewBox={BUDDY_VIEW_BOX}
        style={{ overflow: "visible" }}
      >
        {slots.map((slot) => (
          <BuddySlot key={slot.id} slot={slot.value} />
        ))}
      </Svg>
    </Pressable>
  );
}
