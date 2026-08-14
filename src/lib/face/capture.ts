/**
 * Face ID-style enrolment session.
 *
 * The camera feed is analysed continuously; the operator never presses a
 * capture button. Frames are routed into angle buckets (front / left / right /
 * up / down) and only quality-gated frames are kept. Each bucket keeps its best
 * frames by quality score, and the final template per bucket is the
 * L2-normalised mean descriptor — far more stable than any single shot.
 */

import { averageDescriptors, type FaceGeometry, type FaceSample } from "./engine";
import { assessFrame, ISSUE_COPY, type QualityIssue } from "./quality";

export type AngleKey = "front" | "left" | "right" | "up" | "down";

export type AngleSpec = {
  key: AngleKey;
  label: string;
  prompt: string;
  test: (g: FaceGeometry) => boolean;
  /** frames required before the bucket is considered complete */
  target: number;
};

export const ANGLES: AngleSpec[] = [
  {
    key: "front",
    label: "Straight ahead",
    prompt: "Look straight at the camera",
    test: (g) => Math.abs(g.yaw) < 0.3 && Math.abs(g.pitch) < 0.45,
    target: 5,
  },
  {
    key: "left",
    label: "Turned left",
    prompt: "Slowly turn your head left",
    test: (g) => g.yaw > 0.16,
    target: 3,
  },
  {
    key: "right",
    label: "Turned right",
    prompt: "Slowly turn your head right",
    test: (g) => g.yaw < -0.16,
    target: 3,
  },
  {
    key: "up",
    label: "Chin up",
    prompt: "Tilt your chin up slightly",
    test: (g) => g.pitch > 0.2,
    target: 2,
  },
  {
    key: "down",
    label: "Chin down",
    prompt: "Tilt your chin down slightly",
    test: (g) => g.pitch < -0.2,
    target: 2,
  },
];

/** 15 frames total across five angles — fast, and still multi-pose. */
export const TOTAL_TARGET = ANGLES.reduce((n, a) => n + a.target, 0);

/** Enough frames to build a usable template if the user finishes early. */
export const MIN_USABLE_FRAMES = 5;
/** No accepted frame for this long → loosen the gates. */
const RELAX_AFTER_MS = 2500;
/** An angle that refuses to complete for this long is skipped automatically. */
const SKIP_ANGLE_AFTER_MS = 12000;

const MAX_PER_BUCKET = 8;
/** Consecutive frames must differ enough to avoid storing 8 identical shots. */
const MIN_DESCRIPTOR_DELTA = 0.02;

type Kept = { descriptor: Float32Array; score: number };

export type SessionFeedback = {
  /** Human instruction to show right now. */
  message: string;
  /** Machine-readable reason a frame was rejected, when relevant. */
  issue: QualityIssue | null;
  /** true when the frame was accepted into a bucket. */
  accepted: boolean;
  /** Bucket the user should be working on. */
  activeAngle: AngleKey | null;
  progress: number; // 0..1
  captured: number;
  quality: number; // 0..1 of the last accepted frame
  /** true once enough frames exist to save a usable template. */
  canFinish: boolean;
};

function euclidean(a: Float32Array, b: Float32Array) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i]! - b[i]!) ** 2;
  return Math.sqrt(sum);
}

export class EnrolmentSession {
  private buckets = new Map<AngleKey, Kept[]>();
  private skipped = new Set<AngleKey>();
  private lastQuality = 0;
  private lastAcceptedAt = Date.now();
  private angleStartedAt = Date.now();
  private currentAngle: AngleKey | null = ANGLES[0]?.key ?? null;
  readonly startedAt = Date.now();

  constructor() {
    for (const a of ANGLES) this.buckets.set(a.key, []);
  }

  get counts(): Record<AngleKey, number> {
    return Object.fromEntries(
      ANGLES.map((a) => [a.key, this.buckets.get(a.key)!.length]),
    ) as Record<AngleKey, number>;
  }

  get captured() {
    return ANGLES.reduce((n, a) => n + Math.min(this.buckets.get(a.key)!.length, a.target), 0);
  }

  get totalFrames() {
    return ANGLES.reduce((n, a) => n + this.buckets.get(a.key)!.length, 0);
  }

  /** Enough material to build a template — enables the manual "Finish" action. */
  get canFinish() {
    return this.totalFrames >= MIN_USABLE_FRAMES;
  }

  get complete() {
    return ANGLES.every(
      (a) => this.skipped.has(a.key) || this.buckets.get(a.key)!.length >= a.target,
    );
  }

  /** How far the gates are currently loosened (0..1). */
  get relax() {
    return Math.min(1, Math.max(0, (Date.now() - this.lastAcceptedAt - RELAX_AFTER_MS) / 6000));
  }

  /** The next incomplete, non-skipped bucket, in order. */
  get activeAngle(): AngleSpec | null {
    return (
      ANGLES.find((a) => !this.skipped.has(a.key) && this.buckets.get(a.key)!.length < a.target) ??
      null
    );
  }

  /** Manually skip the current angle (operator escape hatch in the UI). */
  skipActive() {
    const active = this.activeAngle;
    if (active) {
      this.skipped.add(active.key);
      this.angleStartedAt = Date.now();
    }
  }

  /** Skips angles the camera/user simply cannot satisfy so we never deadlock. */
  private maintain() {
    const active = this.activeAngle;
    if (!active) return;
    if (active.key !== this.currentAngle) {
      this.currentAngle = active.key;
      this.angleStartedAt = Date.now();
      return;
    }
    if (
      Date.now() - this.angleStartedAt > SKIP_ANGLE_AFTER_MS &&
      active.key !== "front" &&
      this.canFinish
    ) {
      this.skipped.add(active.key);
      this.angleStartedAt = Date.now();
    }
  }

  /**
   * Feeds one analysed frame. Never throws: a bad frame simply produces
   * feedback and the loop keeps running, which is the "automatic retry".
   */
  push(video: HTMLVideoElement, samples: FaceSample[]): SessionFeedback {
    this.maintain();
    const active = this.activeAngle;
    const base = {
      activeAngle: active?.key ?? null,
      progress: this.captured / TOTAL_TARGET,
      captured: this.captured,
      quality: this.lastQuality,
      canFinish: this.canFinish,
    };

    const verdict = assessFrame(video, samples, this.relax);
    if (!verdict.ok) {
      return { ...base, message: ISSUE_COPY[verdict.issue], issue: verdict.issue, accepted: false };
    }

    const sample = samples[0]!;
    if (!active) {
      return { ...base, message: "Enrolment complete", issue: null, accepted: false, progress: 1 };
    }

    // Route to whichever bucket this pose satisfies (opportunistic capture),
    // preferring the active one so instructions stay truthful.
    const spec =
      (active.test(sample.geometry) ? active : null) ??
      ANGLES.find(
        (a) => this.buckets.get(a.key)!.length < MAX_PER_BUCKET && a.test(sample.geometry),
      );

    if (!spec) {
      return { ...base, message: active.prompt, issue: null, accepted: false };
    }

    const bucket = this.buckets.get(spec.key)!;
    const tooSimilar = bucket.some(
      (k) => euclidean(k.descriptor, sample.descriptor) < MIN_DESCRIPTOR_DELTA,
    );
    if (tooSimilar) {
      return { ...base, message: `${spec.prompt} — move slightly`, issue: null, accepted: false };
    }

    bucket.push({ descriptor: sample.descriptor, score: verdict.metrics.score });
    bucket.sort((a, b) => b.score - a.score);
    if (bucket.length > MAX_PER_BUCKET) bucket.length = MAX_PER_BUCKET;
    this.lastQuality = verdict.metrics.score;
    this.lastAcceptedAt = Date.now();

    const next = this.activeAngle;
    return {
      activeAngle: next?.key ?? null,
      progress: this.captured / TOTAL_TARGET,
      captured: this.captured,
      quality: verdict.metrics.score,
      accepted: true,
      issue: null,
      canFinish: this.canFinish,
      message: next ? next.prompt : "Enrolment complete",
    };
  }

  /** One averaged, L2-normalised template per angle, plus a global mean. */
  templates(): { pose: string; descriptor: Float32Array; frames: number; quality: number }[] {
    const out: { pose: string; descriptor: Float32Array; frames: number; quality: number }[] = [];
    const all: Float32Array[] = [];

    for (const a of ANGLES) {
      const kept = this.buckets.get(a.key)!.slice(0, a.target);
      if (kept.length === 0) continue;
      all.push(...kept.map((k) => k.descriptor));
      out.push({
        pose: a.key,
        descriptor: averageDescriptors(kept.map((k) => k.descriptor)),
        frames: kept.length,
        quality: kept.reduce((n, k) => n + k.score, 0) / kept.length,
      });
    }

    if (all.length > 0) {
      out.push({
        pose: "mean",
        descriptor: averageDescriptors(all),
        frames: all.length,
        quality: out.reduce((n, t) => n + t.quality, 0) / Math.max(out.length, 1),
      });
    }
    return out;
  }

  get elapsedMs() {
    return Date.now() - this.startedAt;
  }
}
