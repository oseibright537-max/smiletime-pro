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
    test: (g) => Math.abs(g.yaw) < 0.2 && Math.abs(g.pitch) < 0.32,
    target: 8,
  },
  {
    key: "left",
    label: "Turned left",
    prompt: "Slowly turn left",
    test: (g) => g.yaw > 0.28,
    target: 6,
  },
  {
    key: "right",
    label: "Turned right",
    prompt: "Slowly turn right",
    test: (g) => g.yaw < -0.28,
    target: 6,
  },
  {
    key: "up",
    label: "Chin up",
    prompt: "Tilt your chin up",
    test: (g) => g.pitch > 0.33,
    target: 5,
  },
  {
    key: "down",
    label: "Chin down",
    prompt: "Tilt your chin down",
    test: (g) => g.pitch < -0.33,
    target: 5,
  },
];

/** 30 frames total across five angles — inside the 20-40 frame envelope. */
export const TOTAL_TARGET = ANGLES.reduce((n, a) => n + a.target, 0);

const MAX_PER_BUCKET = 10;
/** Consecutive frames must differ enough to avoid storing 8 identical shots. */
const MIN_DESCRIPTOR_DELTA = 0.035;

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
};

function euclidean(a: Float32Array, b: Float32Array) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i]! - b[i]!) ** 2;
  return Math.sqrt(sum);
}

export class EnrolmentSession {
  private buckets = new Map<AngleKey, Kept[]>();
  private lastQuality = 0;
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

  get complete() {
    return ANGLES.every((a) => this.buckets.get(a.key)!.length >= a.target);
  }

  /** The next incomplete bucket, in order. */
  get activeAngle(): AngleSpec | null {
    return ANGLES.find((a) => this.buckets.get(a.key)!.length < a.target) ?? null;
  }

  /**
   * Feeds one analysed frame. Never throws: a bad frame simply produces
   * feedback and the loop keeps running, which is the "automatic retry".
   */
  push(video: HTMLVideoElement, samples: FaceSample[]): SessionFeedback {
    const active = this.activeAngle;
    const base = {
      activeAngle: active?.key ?? null,
      progress: this.captured / TOTAL_TARGET,
      captured: this.captured,
      quality: this.lastQuality,
    };

    const verdict = assessFrame(video, samples);
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

    const next = this.activeAngle;
    return {
      activeAngle: next?.key ?? null,
      progress: this.captured / TOTAL_TARGET,
      captured: this.captured,
      quality: verdict.metrics.score,
      accepted: true,
      issue: null,
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
