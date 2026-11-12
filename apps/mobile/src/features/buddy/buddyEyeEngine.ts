// A Reanimated port of Emotion Ball's engine and renderer (https://github.com/Aithena/emotion-ball).
// Every function is a worklet so the frame loop stays on the UI thread. Coordinates are
// head-centred; the renderer writes a fixed pool of path slots instead of creating nodes.
import {
  BUDDY_EMOTIONS,
  BUDDY_EYE_HALF,
  BUDDY_HEAD_RING,
  BUDDY_RINGS,
  BUDDY_SILHOUETTE,
} from "./buddyEyeData";

type Emotion = (typeof BUDDY_EMOTIONS)[number];
type Anim = Emotion["anims"][number];
type Pose = number[];
type Rgb = readonly [number, number, number];

export interface BuddyTheme {
  readonly body: Rgb;
  readonly eye: Rgb;
  readonly muted: Rgb;
}

// Pose layout, matching the generator.
const BODY_X = 0;
const BODY_Y = 1;
const BODY_SCALE = 2;
const BODY_ROTATE = 3;
const BODY_BREATHE = 4;
const BODY_R = 5;
const BODY_ZZZ = 8;
const BODY_ORBIT = 9;
const LEFT = 10;
const RIGHT = 18;
const EYE_X = 0;
const EYE_Y = 1;
const EYE_SCALE_X = 2;
const EYE_SCALE_Y = 3;
const EYE_ROTATE = 4;
const EYE_OPEN = 5;
const EYE_LOOK_X = 6;
const EYE_LOOK_Y = 7;

// Draw order of the path slots.
const RIBBON_SLOTS = 9;
const SLOT_BACK = 0;
const SLOT_BODY = SLOT_BACK + RIBBON_SLOTS;
const SLOT_EYES = SLOT_BODY + 1;
const SLOT_FRONT = SLOT_EYES + 2;
const CONFETTI_SLOTS = 24;
const SLOT_CONFETTI = SLOT_FRONT + RIBBON_SLOTS;
const SLOT_ZZZ = SLOT_CONFETTI + CONFETTI_SLOTS;
export const BUDDY_SLOT_COUNT = SLOT_ZZZ + 3;

const TAU = Math.PI * 2;
/** Eyes larger than on the full-size ball, so they read at header size. */
const EYE_SCALE = 1.45;
const BOUNCE_SEGMENTS = [
  { h: 48, d: 0.5 },
  { h: 28, d: 0.382 },
  { h: 14, d: 0.27 },
  { h: 6, d: 0.177 },
];
const BOUNCE_TOTAL = 1.329;
const FRAME_MS = 16;
const CONFETTI_COLORS: ReadonlyArray<Rgb> = [
  [249, 112, 92],
  [91, 149, 240],
  [63, 190, 134],
  [245, 177, 63],
  [154, 114, 238],
  [53, 195, 189],
];
const STAR_GOLD: Rgb = [244, 195, 78];
const STAR: ReadonlyArray<number> = (() => {
  const points: number[] = [];
  for (let e = 0; e < 10; e++) {
    const a = -Math.PI / 2 + (e * Math.PI) / 5;
    const r = e % 2 === 0 ? 1 : 0.42;
    points.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return points;
})();
const CIRCLE: ReadonlyArray<number> = (() => {
  const points: number[] = [];
  for (let e = 0; e < 10; e++) points.push(Math.cos((e * TAU) / 10), Math.sin((e * TAU) / 10));
  return points;
})();
const SQUARE: ReadonlyArray<number> = [-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5];
const LETTER_Z: ReadonlyArray<number> = [
  -0.3, -0.36, 0.3, -0.36, 0.3, -0.24, -0.1, 0.24, 0.3, 0.24, 0.3, 0.36, -0.3, 0.36, -0.3, 0.24,
  0.1, -0.24, -0.3, -0.24,
];

/** The ball is 228.5 units across; effects spill outside the view box. */
export const BUDDY_VIEW_BOX = "-116 -116 232 232";

interface Trail {
  slot: number;
  lam: number;
  lamVel: number;
  tilt: number;
  roll: number;
  rad: number;
  radVel: number;
  follow: number;
  carry: number;
  arc: number;
  width: number;
  life: number;
  ret: number;
  hist: number[];
  orbit: boolean;
  hue: number;
  hueSpan: number;
  hueVel: number;
}

interface Confetti {
  slot: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  rot: number;
  vr: number;
  stretch: number;
  shape: number;
  color: Rgb;
}

export interface BuddyEngineState {
  emotion: number;
  requested: number;
  emotionStart: number;
  transitionStart: number;
  transitionDuration: number;
  previous: Pose | null;
  last: Pose | null;
  sequenceActive: boolean;
  sequenceDone: boolean;
  ringSourceLeft: number[];
  ringSourceRight: number[];
  ring: number;
  ringX: number;
  ringV: number;
  ringSpeed: number;
  poolPosition: number;
  poolNext: number;
  openX: number;
  openV: number;
  openTarget: number;
  blinkQueue: number[];
  blinkNext: number;
  anticNext: number;
  bounceAt: number;
  spinning: boolean;
  spinX: number;
  spinV: number;
  spinTarget: number;
  pokes: number;
  seed: number;
  lastTick: number;
  lastRender: number;
  prevYaw: number;
  wasFast: boolean;
  spawnAt: number[];
  planeTilt: number;
  planeRoll: number;
  planeCount: number;
  baseHue: number;
  spawnIndex: number;
  orbitNextAt: number;
  trails: Trail[];
  confetti: Confetti[];
  pendingBurst: number;
  d: string[];
  fill: string[];
  opacity: number[];
}

function clamp(v: number, a: number, b: number) {
  "worklet";
  return v < a ? a : v > b ? b : v;
}

function rand(a: number, b: number) {
  "worklet";
  return a + Math.random() * (b - a);
}

function easeInOutCubic(t: number) {
  "worklet";
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerpArray(a: ReadonlyArray<number>, b: ReadonlyArray<number>, t: number): number[] {
  "worklet";
  const out = new Array<number>(b.length);
  for (let i = 0; i < b.length; i++) out[i] = a[i]! + (b[i]! - a[i]!) * t;
  return out;
}

function rgb(c: ReadonlyArray<number>) {
  "worklet";
  return `rgb(${Math.round(c[0]!)},${Math.round(c[1]!)},${Math.round(c[2]!)})`;
}

function hsl(h: number, s: number, l: number): Rgb {
  "worklet";
  const hue = (((h % 360) + 360) % 360) / 60;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((hue % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    hue < 1
      ? [c, x, 0]
      : hue < 2
        ? [x, c, 0]
        : hue < 3
          ? [0, c, x]
          : hue < 4
            ? [0, x, c]
            : hue < 5
              ? [x, 0, c]
              : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** Theme colour for poses whose body colour is the -1 sentinel. */
function themed(pose: ReadonlyArray<number>, theme: BuddyTheme): Pose {
  "worklet";
  const out = pose.slice();
  if (out[BODY_R]! < 0) {
    out[BODY_R] = theme.body[0];
    out[BODY_R + 1] = theme.body[1];
    out[BODY_R + 2] = theme.body[2];
  }
  return out;
}

function setRing(state: BuddyEngineState, index: number, speed: number) {
  "worklet";
  if (index === state.ring && state.ringX >= 0.999) return;
  const s = clamp(state.ringX, 0, 1);
  const target = BUDDY_RINGS[state.ring]!;
  state.ringSourceLeft = lerpArray(state.ringSourceLeft, target[0], s);
  state.ringSourceRight = lerpArray(state.ringSourceRight, target[1], s);
  state.ring = index;
  state.ringX = 0;
  state.ringV = 0;
  state.ringSpeed = speed;
}

function blinkNow(state: BuddyEngineState, t: number) {
  "worklet";
  // Close, hold, overshoot open, settle; sometimes a second blink.
  state.blinkQueue.push(t, 0.05, t + 70, 0.05, t + 150, 1.08, t + 300, 1);
  if (Math.random() < 0.14) state.blinkQueue.push(t + 370, 0.05, t + 480, 1);
}

function spin(state: BuddyEngineState, turns: number) {
  "worklet";
  if (state.spinning) return;
  state.spinning = true;
  state.spinX = 0;
  state.spinV = 0;
  state.spinTarget = turns * TAU * (Math.random() < 0.5 ? -1 : 1);
}

export function setBuddyEmotion(
  state: BuddyEngineState,
  index: number,
  now: number,
  initial = false,
) {
  "worklet";
  const def = BUDDY_EMOTIONS[index] ?? BUDDY_EMOTIONS[2]!;
  const changed = state.emotion !== index;
  state.previous = state.last ? state.last.slice() : null;
  state.emotion = index;
  state.emotionStart = now;
  state.transitionStart = now;
  state.transitionDuration = state.previous ? def.transition : 0;
  state.sequenceActive = def.seq !== null;
  state.sequenceDone = false;
  state.poolPosition = 0;
  setRing(state, def.pool[0]!, def.poolSpeed >= 10 ? 10 : 8);
  state.poolNext = now + rand(def.poolMs[0]!, def.poolMs[1]!);
  if (!initial && changed && def.blinkMs) blinkNow(state, now);
  state.blinkNext = def.blinkMs ? now + rand(def.blinkMs[0]!, def.blinkMs[1]!) : Infinity;
  state.anticNext = now + rand(2500, 5000);
  if (!initial) {
    if (def.ribbons > 0) spin(state, def.ribbons >= 1 ? 2 : 1);
    if (def.confetti > 0) state.pendingBurst = 20;
  }
}

/** A tap: spin (throwing ribbons) or hop, whichever is free. */
export function pokeBuddy(state: BuddyEngineState, now: number) {
  "worklet";
  if (Math.random() < 0.55 && !state.spinning) spin(state, 1);
  else if (state.bounceAt < 0) state.bounceAt = now;
  else blinkNow(state, now);
}

// Worklet declarations become `var` factories that capture their callees when defined, so
// a worklet must come after every worklet it calls.
export function createBuddyEngineState(emotion: number, now: number): BuddyEngineState {
  "worklet";
  const first = BUDDY_RINGS[0]!;
  const state: BuddyEngineState = {
    emotion,
    requested: emotion,
    emotionStart: now,
    transitionStart: now,
    transitionDuration: 0,
    previous: null,
    last: null,
    sequenceActive: false,
    sequenceDone: false,
    ringSourceLeft: first[0].slice(),
    ringSourceRight: first[1].slice(),
    ring: 0,
    ringX: 1,
    ringV: 0,
    ringSpeed: 7,
    poolPosition: 0,
    poolNext: 0,
    openX: 1,
    openV: 0,
    openTarget: 1,
    blinkQueue: [],
    blinkNext: Infinity,
    anticNext: 0,
    bounceAt: -1,
    spinning: false,
    spinX: 0,
    spinV: 0,
    spinTarget: 0,
    pokes: 0,
    seed: Math.random() * 10,
    lastTick: 0,
    lastRender: 0,
    prevYaw: 0,
    wasFast: false,
    spawnAt: [],
    planeTilt: 0,
    planeRoll: 0,
    planeCount: 4,
    baseHue: 0,
    spawnIndex: 0,
    orbitNextAt: 0,
    trails: [],
    confetti: [],
    pendingBurst: 0,
    d: new Array<string>(BUDDY_SLOT_COUNT).fill(""),
    fill: new Array<string>(BUDDY_SLOT_COUNT).fill("transparent"),
    opacity: new Array<number>(BUDDY_SLOT_COUNT).fill(0),
  };
  setBuddyEmotion(state, emotion, now, true);
  return state;
}

function animValue(a: Anim, t: number, seed: number) {
  "worklet";
  switch (a.type) {
    case 0:
      return a.amp * Math.sin((TAU * t) / (a.period || 2000) + a.phase);
    case 1:
      return a.amp * 0.5 * (1 - Math.cos((TAU * t) / (a.period || 1000) + a.phase));
    case 2: {
      const s = (t / 1000) * a.speed;
      let v =
        ((Math.sin(s * 3.1 + seed) +
          Math.sin(s * 5.7 + seed * 2.3) +
          Math.sin(s * 9.3 + seed * 4.1)) /
          3) *
        a.amp;
      if (a.decay) v *= clamp(1 - t / a.decay, 0, 1);
      return v;
    }
    case 3: {
      const period = a.period || 800;
      const p = ((t + a.phaseMs) % period) / period;
      return a.amp * (p < 0.5 ? p * 4 - 1 : 3 - p * 4);
    }
    case 4: {
      const period = a.period || 3600;
      const ph = TAU * (((t + a.phaseMs) % period) / period) + a.phase;
      return a.amp * Math.tanh(2.8 * Math.sin(ph));
    }
    default: {
      const p = (t + a.phaseMs + seed * 97) % a.interval;
      return p >= a.dur ? 0 : -a.amp * Math.sin(Math.PI * (p / a.dur));
    }
  }
}

const EYE_PROP_OFFSETS = [EYE_X, EYE_Y, -1, EYE_ROTATE, EYE_OPEN, EYE_LOOK_X, EYE_LOOK_Y];
const BODY_PROP_OFFSETS = [BODY_X, BODY_Y, BODY_SCALE, BODY_ROTATE, -1, -1, -1];

function applyAnim(pose: Pose, a: Anim, t: number, seed: number) {
  "worklet";
  const v = animValue(a, t, seed);
  if (a.target === 1) {
    const offset = BODY_PROP_OFFSETS[a.prop]!;
    if (offset >= 0) pose[offset]! += v;
    return;
  }
  const eyes = a.target === 0 ? [LEFT, RIGHT] : a.target === 2 ? [LEFT] : [RIGHT];
  for (const eye of eyes) {
    if (a.prop === 2) {
      pose[eye + EYE_SCALE_X]! += v;
      pose[eye + EYE_SCALE_Y]! += v;
    } else {
      pose[eye + EYE_PROP_OFFSETS[a.prop]!]! += v;
    }
  }
}

function sequencePose(
  state: BuddyEngineState,
  def: Emotion,
  t: number,
  now: number,
  theme: BuddyTheme,
): Pose | null {
  "worklet";
  const seq = def.seq!;
  const frames = seq.frames;
  const last = frames[frames.length - 1]!;
  if (t >= last.at) {
    if (!state.sequenceDone) {
      state.sequenceDone = true;
      if (seq.settle === -1) {
        state.previous = state.last ? state.last.slice() : themed(last.pose, theme);
        state.transitionStart = now;
        state.transitionDuration = def.transition || 500;
        state.sequenceActive = false;
        return null;
      }
      if (seq.settle >= 0) {
        setBuddyEmotion(state, seq.settle, now);
        return null;
      }
    }
    return themed(last.pose, theme);
  }
  if (t <= frames[0]!.at) return themed(frames[0]!.pose, theme);
  for (let i = 0; i < frames.length - 1; i++) {
    const a = frames[i]!;
    const b = frames[i + 1]!;
    if (t >= a.at && t < b.at) {
      return lerpArray(
        themed(a.pose, theme),
        themed(b.pose, theme),
        easeInOutCubic((t - a.at) / (b.at - a.at)),
      );
    }
  }
  return themed(last.pose, theme);
}

function springStep(x: number, v: number, target: number, w: number, dt: number) {
  "worklet";
  const nv = v + (-2 * w * v - w * w * (x - target)) * dt;
  return [x + nv * dt, nv] as const;
}

function compose(
  state: BuddyEngineState,
  now: number,
  dt: number,
  animate: boolean,
  theme: BuddyTheme,
): Pose {
  "worklet";
  let def = BUDDY_EMOTIONS[state.emotion]!;
  let pose: Pose | null = null;
  if (state.sequenceActive) {
    pose = sequencePose(state, def, now - state.emotionStart, now, theme);
    def = BUDDY_EMOTIONS[state.emotion]!;
  }
  if (pose === null) pose = themed(def.base, theme);
  const t = now - state.emotionStart;

  const breathe = pose[BODY_BREATHE]!;
  if (breathe && animate) {
    const ph = (TAU * now) / 3600;
    pose[BODY_SCALE]! += breathe * Math.sin(ph);
    pose[BODY_Y]! += breathe * 55 * Math.sin(ph + 0.6);
  }
  if (animate) for (const a of def.anims) applyAnim(pose, a, t, state.seed);

  if (animate && now >= state.poolNext) {
    if (def.pool.length > 1) {
      state.poolPosition =
        (state.poolPosition + 1 + Math.floor(rand(0, def.pool.length - 1))) % def.pool.length;
      setRing(state, def.pool[state.poolPosition]!, def.poolSpeed);
    }
    state.poolNext = now + rand(def.poolMs[0]!, def.poolMs[1]!);
  }

  if (animate && def.blinkMs && now >= state.blinkNext) {
    blinkNow(state, now);
    state.blinkNext = now + rand(def.blinkMs[0]!, def.blinkMs[1]!);
  }
  let openKey = -1;
  while (state.blinkQueue.length && now >= state.blinkQueue[0]!) {
    openKey = state.blinkQueue[1]!;
    state.blinkQueue.splice(0, 2);
  }
  state.openTarget =
    openKey >= 0 ? openKey : state.blinkQueue.length ? state.openTarget : def.openness;

  if (animate && def.antics && now >= state.anticNext) {
    if (!state.spinning && state.bounceAt < 0) {
      const pick = Math.random();
      if (pick < 0.45) spin(state, 1);
      else if (pick < 0.8) state.bounceAt = now;
      else blinkNow(state, now);
    }
    state.anticNext = now + rand(9000, 18000);
  }

  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  const j = dt / steps;
  for (let i = 0; i < steps; i++) {
    [state.ringX, state.ringV] = springStep(state.ringX, state.ringV, 1, state.ringSpeed, j);
    [state.openX, state.openV] = springStep(state.openX, state.openV, state.openTarget, 26, j);
    if (state.spinning) {
      [state.spinX, state.spinV] = springStep(state.spinX, state.spinV, state.spinTarget, 6.2, j);
      if (Math.abs(state.spinTarget - state.spinX) < 0.01 && Math.abs(state.spinV) < 0.05) {
        state.spinning = false;
      }
    }
  }

  if (state.bounceAt >= 0) {
    const elapsed = (now - state.bounceAt) / 1000;
    if (elapsed >= BOUNCE_TOTAL) {
      state.bounceAt = -1;
    } else {
      let acc = 0;
      let i = 0;
      while (i < BOUNCE_SEGMENTS.length - 1 && elapsed >= acc + BOUNCE_SEGMENTS[i]!.d) {
        acc += BOUNCE_SEGMENTS[i]!.d;
        i++;
      }
      const seg = BOUNCE_SEGMENTS[i]!;
      const n = (elapsed - acc) / seg.d;
      pose[BODY_Y]! += -4 * seg.h * n * (1 - n);
    }
  }

  if (def.gaze && animate) {
    const w = now / 1000;
    pose[LEFT + EYE_LOOK_X]! += 1.4 * Math.sin(0.42 * w) + 0.5 * Math.sin(w);
    pose[RIGHT + EYE_LOOK_X]! += 1.4 * Math.sin(0.42 * w + 1) + 0.5 * Math.sin(w + 2);
    pose[LEFT + EYE_LOOK_Y]! += 0.9 * Math.sin(0.58 * w);
    pose[RIGHT + EYE_LOOK_Y]! += 0.9 * Math.sin(0.58 * w + 1);
  }

  const open = clamp(state.openX, 0.02, 1.5);
  for (const eye of [LEFT, RIGHT]) {
    pose[eye + EYE_SCALE_X] = Math.max(pose[eye + EYE_SCALE_X]! * EYE_SCALE, 0.05);
    pose[eye + EYE_SCALE_Y] = Math.max(pose[eye + EYE_SCALE_Y]! * EYE_SCALE, 0.05);
    pose[eye + EYE_OPEN] = clamp(pose[eye + EYE_OPEN]!, 0, 1.3) * open;
  }

  const tt = now - state.transitionStart;
  if (state.transitionDuration > 0 && tt < state.transitionDuration && state.previous) {
    pose = lerpArray(state.previous, pose, easeInOutCubic(tt / state.transitionDuration));
  }
  state.last = pose;
  return pose;
}

function polygon(points: ReadonlyArray<number>) {
  "worklet";
  let d = "";
  for (let i = 0; i < points.length; i += 2) {
    d += (i === 0 ? "M" : "L") + points[i]!.toFixed(1) + " " + points[i + 1]!.toFixed(1);
  }
  return d + "Z";
}

/** Body transform: rotate and scale about the head centre, then offset. */
function bodyTransform(pose: Pose, points: number[]) {
  "worklet";
  const s = pose[BODY_SCALE]!;
  const r = (pose[BODY_ROTATE]! * Math.PI) / 180;
  const c = Math.cos(r) * s;
  const n = Math.sin(r) * s;
  const bx = pose[BODY_X]!;
  const by = pose[BODY_Y]!;
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i]!;
    const y = points[i + 1]!;
    points[i] = x * c - y * n + bx;
    points[i + 1] = x * n + y * c + by;
  }
  return points;
}

function silhouetteAt(y: number) {
  "worklet";
  const s = BUDDY_SILHOUETTE;
  const row = clamp(
    Math.round((clamp(y, s.minY, s.maxY) - s.minY) / s.step),
    0,
    s.rows.length / 2 - 1,
  );
  return [s.rows[row * 2]!, s.rows[row * 2 + 1]!] as const;
}

/** An eye wrapped onto the ball: longitude from x, cosine squash, hidden on the back. */
function eyePath(ring: ReadonlyArray<number>, pose: Pose, eye: number, yaw: number): string {
  "worklet";
  let cx = 0;
  let cy = 0;
  const n = ring.length / 2;
  for (let i = 0; i < ring.length; i += 2) {
    cx += ring[i]!;
    cy += ring[i + 1]!;
  }
  cx /= n;
  cy /= n;
  const open = clamp(pose[eye + EYE_OPEN]!, 0.02, 2.4);
  const sy = clamp(pose[eye + EYE_SCALE_Y]! * open, 0.02, 2.4);
  const sxBase = pose[eye + EYE_SCALE_X]!;
  const halfH = BUDDY_EYE_HALF * sy + 2;
  const ey = clamp(
    cy + pose[eye + EYE_Y]! + pose[eye + EYE_LOOK_Y]!,
    BUDDY_SILHOUETTE.minY + halfH,
    BUDDY_SILHOUETTE.maxY - halfH,
  );
  const [lo, hi] = silhouetteAt(ey);
  const cx0 = (lo + hi) / 2;
  const hw = Math.max((hi - lo) / 2, 12);
  const ox = cx + pose[eye + EYE_X]! + pose[eye + EYE_LOOK_X]!;
  const total = clamp(ox / hw, -1.15, 1.15) + yaw;
  const cn = Math.cos(total);
  if (cn <= 0.02) return "";
  const ex = cx0 + hw * Math.sin(total) * 0.985;
  const dyN = ey / 130;
  const fy = Math.sqrt(1 - dyN * dyN * 0.22);
  const sx = sxBase * cn;
  const syy = sy * fy;
  const er = (pose[eye + EYE_ROTATE]! * Math.PI) / 180;
  const ec = Math.cos(er);
  const es = Math.sin(er);
  const points = new Array<number>(ring.length);
  for (let i = 0; i < ring.length; i += 2) {
    const px = (ring[i]! - cx) * sx;
    const py = (ring[i + 1]! - cy) * syy;
    points[i] = px * ec - py * es + ex;
    points[i + 1] = px * es + py * ec + ey;
  }
  return polygon(bodyTransform(pose, points));
}

function orbitPoint(t: Trail, lam: number, out: number[]) {
  "worklet";
  const hx = t.rad * Math.sin(lam);
  const hy = -t.rad * Math.cos(lam) * Math.sin(t.tilt);
  const ca = Math.cos(t.roll);
  const sa = Math.sin(t.roll);
  out.push(hx * ca - hy * sa, hx * sa + hy * ca, Math.cos(lam) * Math.cos(t.tilt), lam);
}

function freeSlot(used: ReadonlyArray<{ slot: number }>, count: number) {
  "worklet";
  for (let s = 0; s < count; s++) if (!used.some((item) => item.slot === s)) return s;
  return -1;
}

function createTrail(state: BuddyEngineState, trail: Omit<Trail, "slot">) {
  "worklet";
  const slot = freeSlot(state.trails, RIBBON_SLOTS);
  if (slot >= 0) state.trails.push({ ...trail, slot });
}

function trailBase(lam: number, hue: number) {
  "worklet";
  return {
    lam,
    life: 0,
    ret: 0,
    hist: [] as number[],
    carry: 0,
    hue,
    hueSpan: rand(45, 95) * (Math.random() < 0.5 ? 1 : -1),
    hueVel: rand(18, 42) * (Math.random() < 0.5 ? 1 : -1),
  };
}

function spawnTrail(state: BuddyEngineState, lam: number, dir: number) {
  "worklet";
  const g = state.planeCount;
  const tierStep = 38 / Math.max(g - 1, 1);
  createTrail(state, {
    ...trailBase(lam, state.baseHue + (360 * state.spawnIndex) / Math.max(g, 1) + rand(-14, 14)),
    lamVel: dir * rand(0.5, 1.1),
    tilt: state.planeTilt + rand(-0.04, 0.04),
    roll: state.planeRoll + rand(-0.05, 0.05),
    rad: 116 + state.spawnIndex * tierStep + rand(-1.5, 1.5),
    radVel: rand(0, 2.5),
    follow: rand(0.74, 0.94),
    arc: rand(2.2, 3.4),
    width: g <= 3 ? rand(8, 10.5) : g === 4 ? rand(6.6, 8.6) : rand(5.6, 7.4),
    orbit: false,
  });
  state.spawnIndex++;
}

function spawnOrbit(state: BuddyEngineState, index: number) {
  "worklet";
  createTrail(state, {
    ...trailBase(rand(0, TAU), rand(0, 360)),
    lamVel: (Math.random() < 0.5 ? -1 : 1) * rand(1.7, 2.3),
    tilt: rand(0.1, 0.22),
    roll: rand(-0.12, 0.12),
    rad: 124 + index * 16,
    radVel: 0,
    follow: 0.8,
    arc: rand(2.4, 3.2),
    width: rand(5.5, 7),
    orbit: true,
  });
}

/** Thick head, thin tail, round caps; split into front and back of the ball by z. */
function trailPaths(hist: ReadonlyArray<number>, width: number) {
  "worklet";
  const n = hist.length / 4;
  const nx: number[] = [];
  const ny: number[] = [];
  for (let e = 0; e < n; e++) {
    const p0 = e > 0 ? e - 1 : 0;
    const p1 = e < n - 1 ? e + 1 : n - 1;
    let dx = hist[p1 * 4]! - hist[p0 * 4]!;
    let dy = hist[p1 * 4 + 1]! - hist[p0 * 4 + 1]!;
    const h = Math.hypot(dx, dy) || 1;
    dx /= h;
    dy /= h;
    const d = (width * (0.5 + (e / (n - 1)) * 0.5)) / 2;
    nx.push(-dy * d);
    ny.push(dx * d);
  }
  const x = (k: number) => hist[k * 4]!;
  const y = (k: number) => hist[k * 4 + 1]!;
  const cap = (k: number) => {
    const hw = Math.max(Math.hypot(nx[k]!, ny[k]!), 0.2).toFixed(1);
    return "A" + hw + " " + hw + " 0 0 0 ";
  };
  const seg = (a: number, b: number) => {
    let s = "";
    for (let k = a; k <= b; k++) {
      s += (k === a ? "M" : "L") + (x(k) + nx[k]!).toFixed(1) + " " + (y(k) + ny[k]!).toFixed(1);
    }
    s += b === n - 1 ? cap(b) : "L";
    for (let k = b; k >= a; k--) {
      s += (k === b ? "" : "L") + (x(k) - nx[k]!).toFixed(1) + " " + (y(k) - ny[k]!).toFixed(1);
    }
    if (a === 0) s += cap(0) + (x(0) + nx[0]!).toFixed(1) + " " + (y(0) + ny[0]!).toFixed(1);
    return s + "Z";
  };
  let front = "";
  let back = "";
  let d0 = 0;
  while (d0 < n) {
    const isFront = hist[d0 * 4 + 2]! >= 0;
    let i2 = d0;
    while (i2 + 1 < n && hist[(i2 + 1) * 4 + 2]! >= 0 === isFront) i2++;
    const a2 = Math.max(d0 - 1, 0);
    const b2 = Math.min(i2 + 1, n - 1);
    if (b2 > a2) {
      if (isFront) front += seg(a2, b2);
      else back += seg(a2, b2);
    }
    d0 = i2 + 1;
  }
  return [front, back] as const;
}

function burst(state: BuddyEngineState, count: number) {
  "worklet";
  for (let i = 0; i < count; i++) {
    const slot = freeSlot(state.confetti, CONFETTI_SLOTS);
    if (slot < 0) return;
    const ang = (i / count) * TAU + rand(-0.35, 0.35);
    const speed = rand(170, 360);
    const star = Math.random() < 0.18;
    const round = !star && Math.random() < 0.3;
    state.confetti.push({
      slot,
      x: Math.cos(ang) * rand(96, 116),
      y: Math.sin(ang) * rand(96, 116),
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed - rand(20, 75),
      life: 0,
      max: rand(0.45, 0.85),
      r: star ? rand(4, 7) : rand(3.5, 8),
      rot: rand(0, 360),
      vr: rand(-260, 260),
      stretch: !star && !round ? 1.9 : 1,
      shape: star ? 2 : round ? 1 : 0,
      color: star
        ? STAR_GOLD
        : CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]!,
    });
  }
}

function placed(
  shape: ReadonlyArray<number>,
  x: number,
  y: number,
  rot: number,
  sx: number,
  sy: number,
) {
  "worklet";
  const r = (rot * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const out = new Array<number>(shape.length);
  for (let i = 0; i < shape.length; i += 2) {
    const px = shape[i]! * sx;
    const py = shape[i + 1]! * sy;
    out[i] = px * c - py * s + x;
    out[i + 1] = px * s + py * c + y;
  }
  return polygon(out);
}

function setSlot(state: BuddyEngineState, slot: number, d: string, fill: string, opacity: number) {
  "worklet";
  state.d[slot] = d;
  state.fill[slot] = fill;
  state.opacity[slot] = opacity;
}

function clearSlot(state: BuddyEngineState, slot: number) {
  "worklet";
  setSlot(state, slot, "", "transparent", 0);
}

function renderEffects(
  state: BuddyEngineState,
  pose: Pose,
  now: number,
  dt: number,
  theme: BuddyTheme,
) {
  "worklet";
  const yaw = state.spinning ? state.spinX : 0;

  // Sleep letters drift up and out at the top right.
  const zzz = pose[BODY_ZZZ]!;
  for (let z = 0; z < 3; z++) {
    if (zzz <= 0) {
      clearSlot(state, SLOT_ZZZ + z);
      continue;
    }
    const zp = (now * 0.00033 + z / 3) % 1;
    const zo = (zp < 0.18 ? zp / 0.18 : 1 - (zp - 0.18) / 0.82) * 0.8 * zzz;
    const size = 12 + zp * 11;
    setSlot(
      state,
      SLOT_ZZZ + z,
      placed(
        LETTER_Z,
        66 + zp * 34 + 4 * Math.sin(zp * 9),
        -66 - zp * 42,
        -10 + zp * 14,
        size,
        size,
      ),
      rgb(theme.muted),
      zo,
    );
  }

  // Ribbons are thrown once a spin is fast enough.
  let dYaw = yaw - state.prevYaw;
  if (!isFinite(dYaw) || Math.abs(dYaw) > 1.2) dYaw = 0;
  state.prevYaw = yaw;
  const vel = dYaw / dt;
  const fast = Math.abs(vel) >= 0.9;
  const dir = vel >= 0 ? 1 : -1;
  if (fast && !state.wasFast) {
    state.planeTilt = rand(0.16, 0.5);
    state.planeRoll = rand(-0.85, 0.85) + rand(-0.12, 0.12);
    state.planeCount = Math.round(rand(3, 5));
    state.baseHue = rand(0, 360);
    state.spawnIndex = 0;
    state.spawnAt = [];
    for (let q = 0; q < state.planeCount; q++) state.spawnAt.push(now + q * rand(55, 105));
  }
  if (!fast) state.spawnAt = [];
  state.wasFast = fast;
  if (Math.abs(vel) >= 5) {
    while (state.spawnAt.length && now >= state.spawnAt[0]!) {
      state.spawnAt.shift();
      spawnTrail(state, yaw - rand(0, 0.18) * dir, dir);
    }
  }

  const orbitWant = pose[BODY_ORBIT]! > 0;
  if (orbitWant && now >= state.orbitNextAt) {
    const orbits = state.trails.filter((trail) => trail.orbit).length;
    if (orbits < 2) spawnOrbit(state, orbits);
    state.orbitNextAt = now + 700;
  }

  const live: Trail[] = [];
  for (const trail of state.trails) {
    trail.life += dt;
    const retract = trail.orbit ? !orbitWant : !fast || trail.life > 5;
    trail.ret = clamp(trail.ret + (retract ? dt / 0.5 : -dt / 0.35), 0, 1);
    if (retract && trail.ret >= 1) continue;
    live.push(trail);
    if (trail.orbit) {
      trail.lam += trail.lamVel * dt + dYaw * trail.follow;
    } else if (fast) {
      trail.carry = vel * trail.follow;
      trail.lam += dYaw * trail.follow + trail.lamVel * dt;
    } else {
      trail.lam += (trail.carry + trail.lamVel) * dt;
      trail.carry *= Math.exp(-2.6 * dt);
      trail.lamVel *= Math.exp(-2.6 * dt);
    }
    trail.rad += trail.radVel * dt;

    const hist = trail.hist;
    const lastL = hist.length ? hist[hist.length - 1]! : trail.lam - 0.001 * dir;
    const dl = trail.lam - lastL;
    const steps = Math.min(Math.ceil(Math.abs(dl) / 0.09), 24);
    for (let s = 1; s <= steps; s++) orbitPoint(trail, lastL + (dl * s) / steps, hist);
    if (!hist.length) orbitPoint(trail, trail.lam, hist);

    // Retract: narrow the arc, trim whole points, then pull the tail point in.
    const span = trail.arc * (1 - trail.ret * trail.ret * (3 - 2 * trail.ret));
    while (hist.length > 8 && Math.abs(trail.lam - hist[3]!) > span) hist.splice(0, 4);
    const over = Math.abs(trail.lam - hist[3]!) - span;
    if (hist.length >= 8 && over > 0) {
      const tail: number[] = [];
      orbitPoint(trail, hist[3]! + (trail.lam - hist[3]! >= 0 ? 1 : -1) * over, tail);
      for (let k = 0; k < 4; k++) hist[k] = tail[k]!;
    }
    if (hist.length > 48 * 4) hist.splice(0, hist.length - 48 * 4);

    const zHead = Math.cos(trail.lam) * Math.cos(trail.tilt);
    const pz = 0.72 + 0.28 * clamp(zHead, 0, 1);
    let grow = Math.min(trail.life / 0.34, 1);
    grow = grow * grow * (3 - 2 * grow);
    const width = trail.width * pz * 1.7 * grow * (1 - 0.72 * trail.ret * trail.ret);
    if (hist.length < 8 || width < 0.5) {
      clearSlot(state, SLOT_BACK + trail.slot);
      clearSlot(state, SLOT_FRONT + trail.slot);
      continue;
    }
    const [front, back] = trailPaths(hist, width);
    const fade = Math.min(trail.life / 0.26, 1);
    const color = rgb(hsl(trail.hue + trail.hueVel * trail.life + trail.hueSpan / 2, 0.56, 0.61));
    setSlot(state, SLOT_BACK + trail.slot, back, color, fade);
    setSlot(state, SLOT_FRONT + trail.slot, front, color, fade);
  }
  for (let s = 0; s < RIBBON_SLOTS; s++) {
    if (!live.some((trail) => trail.slot === s)) {
      clearSlot(state, SLOT_BACK + s);
      clearSlot(state, SLOT_FRONT + s);
    }
  }
  state.trails = live;

  if (state.pendingBurst > 0) {
    burst(state, state.pendingBurst);
    state.pendingBurst = 0;
  }
  const pieces: Confetti[] = [];
  for (const piece of state.confetti) {
    piece.life += dt;
    if (piece.life >= piece.max) continue;
    pieces.push(piece);
    piece.x += piece.vx * dt;
    piece.y += piece.vy * dt;
    const drag = Math.pow(0.94, 60 * dt);
    piece.vx *= drag;
    piece.vy = piece.vy * drag + 40 * dt;
    piece.rot += piece.vr * dt;
    const u = piece.life / piece.max;
    const fade = u < 0.1 ? u / 0.1 : Math.pow(1 - (u - 0.1) / 0.9, 1.7);
    const size = Math.max(piece.r * (1 - 0.4 * u), 0.5);
    const shape = piece.shape === 2 ? STAR : piece.shape === 1 ? CIRCLE : SQUARE;
    setSlot(
      state,
      SLOT_CONFETTI + piece.slot,
      placed(shape, piece.x, piece.y, piece.rot, size, size * piece.stretch),
      rgb(piece.color),
      fade,
    );
  }
  for (let s = 0; s < CONFETTI_SLOTS; s++) {
    if (!pieces.some((piece) => piece.slot === s)) clearSlot(state, SLOT_CONFETTI + s);
  }
  state.confetti = pieces;
}

/**
 * Advances the engine to `now` and writes every slot's d, fill and opacity into the state.
 * Returns false when no repaint is due yet.
 */
export function stepBuddy(
  state: BuddyEngineState,
  now: number,
  animate: boolean,
  theme: BuddyTheme,
): boolean {
  "worklet";
  if (animate && now - state.lastRender < FRAME_MS) return false;
  const dt = state.lastTick ? clamp((now - state.lastTick) / 1000, 0.001, 0.05) : 1 / 60;
  state.lastTick = now;
  state.lastRender = now;
  if (!animate) {
    state.ringX = 1;
    state.ringV = 0;
    state.openX = BUDDY_EMOTIONS[state.emotion]!.openness;
    state.transitionDuration = 0;
    state.sequenceActive = false;
  }
  const pose = compose(state, now, dt, animate, theme);

  const body: Rgb = [pose[BODY_R]!, pose[BODY_R + 1]!, pose[BODY_R + 2]!];
  setSlot(state, SLOT_BODY, polygon(bodyTransform(pose, BUDDY_HEAD_RING.slice())), rgb(body), 1);

  // Eyes keep the theme's contrast colour, and turn white once the ball changes colour.
  const tinted = clamp(
    (Math.abs(body[0] - theme.body[0]) +
      Math.abs(body[1] - theme.body[1]) +
      Math.abs(body[2] - theme.body[2])) /
      150,
    0,
    1,
  );
  const eyeColor = rgb(lerpArray(theme.eye, [255, 255, 255], tinted));
  const s = clamp(state.ringX, 0, 1.35);
  const target = BUDDY_RINGS[state.ring]!;
  const settled = s >= 0.999 && Math.abs(state.ringV) <= 0.001;
  const left = settled ? target[0] : lerpArray(state.ringSourceLeft, target[0], s);
  const right = settled ? target[1] : lerpArray(state.ringSourceRight, target[1], s);
  const yaw = state.spinning ? state.spinX : 0;
  setSlot(state, SLOT_EYES, eyePath(left, pose, LEFT, yaw), eyeColor, 1);
  setSlot(state, SLOT_EYES + 1, eyePath(right, pose, RIGHT, yaw), eyeColor, 1);

  if (animate) renderEffects(state, pose, now, dt, theme);
  return true;
}

export function buddyEmotionIndex(id: string): number {
  const index = BUDDY_EMOTIONS.findIndex((emotion) => emotion.id === id);
  return index < 0 ? 2 : index;
}
