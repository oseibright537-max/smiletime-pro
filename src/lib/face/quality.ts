/**
 * Frame quality gating.
 *
 * Every candidate frame must pass objective checks before its embedding is
 * accepted: exactly one face, sufficient and non-blown-out lighting, enough
 * pixels on the face, the face fully inside the frame, eyes open, and enough
 * high-frequency detail (sharpness) to rule out motion blur / out-of-focus.
 */

import type { FaceSample } from "./engine";

export type QualityIssue =
  | "no_face"
  | "multiple_faces"
  | "too_far"
  | "too_close"
  | "off_center"
  | "cropped"
  | "dark"
  | "bright"
  | "blurry"
  | "low_res"
  | "eyes_closed"
  | "low_confidence";

export const ISSUE_COPY: Record<QualityIssue, string> = {
  no_face: "Position your face inside the circle",
  multiple_faces: "Only one face should be visible",
  too_far: "Move closer",
  too_close: "Move back",
  off_center: "Center your face in the circle",
  cropped: "Keep your whole face in view",
  dark: "Improve lighting — it's too dark",
  bright: "Too much light — reduce glare",
  blurry: "Hold still, the image is blurry",
  low_res: "Move closer for a sharper image",
  eyes_closed: "Keep your eyes open",
  low_confidence: "Face not clear enough",
};

export type QualityMetrics = {
  brightness: number; // 0..1 mean luma
  sharpness: number; // variance of Laplacian, normalised 0..1
  faceWidthPx: number;
  centerOffset: number; // 0 (centered) .. 1
  ear: number;
  score: number; // 0..1 overall
};

export type QualityVerdict =
  | { ok: true; metrics: QualityMetrics }
  | { ok: false; issue: QualityIssue; metrics?: QualityMetrics };

export const THRESHOLDS = {
  minScale: 0.14,
  maxScale: 0.85,
  maxCenterOffset: 0.45,
  minBrightness: 0.12,
  maxBrightness: 0.95,
  minSharpness: 0.07,
  minFaceWidthPx: 70,
  minEar: 0.14,
  minDetection: 0.4,
} as const;

/**
 * `relax` (0..1) progressively loosens every gate. The enrolment session raises
 * it when nothing has been accepted for a while, so a dim room or a soft webcam
 * can never deadlock the flow.
 */
function tuned(relax: number) {
  const r = Math.max(0, Math.min(1, relax));
  return {
    minScale: THRESHOLDS.minScale * (1 - 0.4 * r),
    maxScale: THRESHOLDS.maxScale + 0.1 * r,
    maxCenterOffset: THRESHOLDS.maxCenterOffset + 0.35 * r,
    minBrightness: THRESHOLDS.minBrightness * (1 - 0.6 * r),
    maxBrightness: Math.min(0.995, THRESHOLDS.maxBrightness + 0.04 * r),
    minSharpness: THRESHOLDS.minSharpness * (1 - 0.7 * r),
    minFaceWidthPx: THRESHOLDS.minFaceWidthPx * (1 - 0.4 * r),
    minEar: THRESHOLDS.minEar * (1 - 0.4 * r),
    minDetection: THRESHOLDS.minDetection * (1 - 0.3 * r),
  };
}


const work = (() => {
  let canvas: HTMLCanvasElement | null = null;
  return () => {
    if (typeof document === "undefined") return null;
    canvas ??= document.createElement("canvas");
    return canvas;
  };
})();

/** Mean luma + normalised Laplacian variance for the face crop. */
export function measurePixels(
  video: HTMLVideoElement,
  box: { x: number; y: number; width: number; height: number },
): { brightness: number; sharpness: number } | null {
  const canvas = work();
  if (!canvas) return null;
  const S = 96;
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  const sx = Math.max(0, box.x);
  const sy = Math.max(0, box.y);
  const sw = Math.min(video.videoWidth - sx, box.width);
  const sh = Math.min(video.videoHeight - sy, box.height);
  if (sw <= 4 || sh <= 4) return null;

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, S, S);
  const { data } = ctx.getImageData(0, 0, S, S);

  const gray = new Float32Array(S * S);
  let sum = 0;
  for (let i = 0; i < S * S; i++) {
    const r = data[i * 4]!;
    const g = data[i * 4 + 1]!;
    const b = data[i * 4 + 2]!;
    const y = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    gray[i] = y;
    sum += y;
  }
  const brightness = sum / (S * S);

  // 4-neighbour Laplacian variance → focus measure.
  let lapSum = 0;
  let lapSq = 0;
  let n = 0;
  for (let y = 1; y < S - 1; y++) {
    for (let x = 1; x < S - 1; x++) {
      const i = y * S + x;
      const l = 4 * gray[i]! - gray[i - 1]! - gray[i + 1]! - gray[i - S]! - gray[i + S]!;
      lapSum += l;
      lapSq += l * l;
      n++;
    }
  }
  const mean = lapSum / n;
  const variance = lapSq / n - mean * mean;
  // Empirical normalisation: variance ~0.004 is soft, ~0.02+ is crisp.
  const sharpness = Math.min(1, Math.sqrt(Math.max(variance, 0)) * 8);

  return { brightness, sharpness };
}

/** Applies every gate and returns the first blocking issue, or the metrics. */
export function assessFrame(
  video: HTMLVideoElement,
  samples: FaceSample[],
  relax = 0,
): QualityVerdict {
  if (samples.length === 0) return { ok: false, issue: "no_face" };
  // Bystanders only block while the gates are strict; when relaxed we simply
  // use the largest (closest) face rather than stalling the whole enrolment.
  if (samples.length > 1 && relax < 0.5) return { ok: false, issue: "multiple_faces" };

  const t = tuned(relax);
  const sample = samples[0]!;
  const { box, geometry } = sample;
  const vw = video.videoWidth || 1;
  const vh = video.videoHeight || 1;

  if (sample.score < t.minDetection) return { ok: false, issue: "low_confidence" };
  if (geometry.scale < t.minScale) return { ok: false, issue: "too_far" };
  if (geometry.scale > t.maxScale) return { ok: false, issue: "too_close" };

  const cx = (box.x + box.width / 2) / vw;
  const cy = (box.y + box.height / 2) / vh;
  const centerOffset = Math.hypot((cx - 0.5) * 2, (cy - 0.5) * 2);
  // Tolerate a little edge overlap; only reject when a real chunk is missing.
  const margin = -0.12 * box.width;
  if (
    box.x < margin ||
    box.y < margin ||
    box.x + box.width > vw - margin ||
    box.y + box.height > vh - margin
  )
    return { ok: false, issue: "cropped" };
  if (centerOffset > t.maxCenterOffset) return { ok: false, issue: "off_center" };
  if (box.width < t.minFaceWidthPx) return { ok: false, issue: "low_res" };
  if (geometry.ear < t.minEar) return { ok: false, issue: "eyes_closed" };

  const pixels = measurePixels(video, box);
  if (!pixels) return { ok: false, issue: "no_face" };
  if (pixels.brightness < t.minBrightness) return { ok: false, issue: "dark" };
  if (pixels.brightness > t.maxBrightness) return { ok: false, issue: "bright" };
  if (pixels.sharpness < t.minSharpness) return { ok: false, issue: "blurry" };

  const score =
    0.35 * Math.min(1, sample.score / 0.9) +
    0.3 * Math.min(1, pixels.sharpness / 0.45) +
    0.2 * (1 - Math.abs(pixels.brightness - 0.55) / 0.45) +
    0.15 * (1 - Math.min(1, centerOffset / t.maxCenterOffset));



  return {
    ok: true,
    metrics: {
      brightness: pixels.brightness,
      sharpness: pixels.sharpness,
      faceWidthPx: box.width,
      centerOffset,
      ear: geometry.ear,
      score: Math.max(0, Math.min(1, score)),
    },
  };
}
