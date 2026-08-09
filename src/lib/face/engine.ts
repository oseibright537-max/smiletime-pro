/**
 * Browser face engine.
 *
 * Wraps the deep-learning detector/recognizer (SSD-free TinyFaceDetector for
 * localisation, 68-point landmark net for alignment + liveness geometry, and a
 * FaceNet-style 128-D embedding net for identity). No Haar cascades.
 *
 * Only embeddings ever leave this module — raw frames stay in the browser.
 */

export type FaceApi = typeof import("@vladmandic/face-api");

export type Point = { x: number; y: number };

export type FaceSample = {
  descriptor: Float32Array;
  score: number;
  box: { x: number; y: number; width: number; height: number };
  landmarks: Point[];
  geometry: FaceGeometry;
};

export type FaceGeometry = {
  /** -1 (turned right) .. 0 (front) .. 1 (turned left) */
  yaw: number;
  /** -1 (looking down) .. 0 .. 1 (looking up) */
  pitch: number;
  /** eye aspect ratio, ~0.30 open / <0.20 closed */
  ear: number;
  /** face width relative to the frame width */
  scale: number;
};

let apiPromise: Promise<FaceApi> | null = null;

/** Loads and warms up the models once per session. */
export async function getFaceApi(): Promise<FaceApi> {
  if (!apiPromise) {
    apiPromise = (async () => {
      const faceapi = await import("@vladmandic/face-api");
      // Prefer WebGL, fall back to CPU. The WASM backend is not bundled, so we
      // never let tfjs try to fetch its .wasm binaries at runtime.
      const tf = faceapi.tf as unknown as {
        setBackend: (name: string) => Promise<boolean>;
        ready: () => Promise<void>;
      };
      let ok = false;
      try {
        ok = await tf.setBackend("webgl");
      } catch {
        ok = false;
      }
      if (!ok) await tf.setBackend("cpu").catch(() => false);

      await tf.ready();

      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      ]);
      return faceapi;
    })();
  }
  return apiPromise;
}

function mean(points: Point[]): Point {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function eyeAspectRatio(eye: Point[]) {
  if (eye.length < 6) return 0.3;
  const a = dist(eye[1]!, eye[5]!);
  const b = dist(eye[2]!, eye[4]!);
  const c = dist(eye[0]!, eye[3]!);
  return c === 0 ? 0.3 : (a + b) / (2 * c);
}

/** Derives head pose + blink signals from the 68-point mesh. */
export function computeGeometry(
  leftEye: Point[],
  rightEye: Point[],
  nose: Point[],
  jaw: Point[],
  mouth: Point[],
  frameWidth: number,
): FaceGeometry {
  const l = mean(leftEye);
  const r = mean(rightEye);
  const eyeMid = { x: (l.x + r.x) / 2, y: (l.y + r.y) / 2 };
  const interEye = Math.max(dist(l, r), 1);
  const noseTip = nose[nose.length - 1] ?? eyeMid;
  const mouthMid = mean(mouth);

  const yaw = Math.max(-1, Math.min(1, ((eyeMid.x - noseTip.x) / interEye) * 2.2));
  const vertical = dist(eyeMid, mouthMid) || 1;
  const noseRatio = (noseTip.y - eyeMid.y) / vertical; // ~0.55 neutral
  const pitch = Math.max(-1, Math.min(1, (0.55 - noseRatio) * 5));
  const ear = (eyeAspectRatio(leftEye) + eyeAspectRatio(rightEye)) / 2;
  const faceWidth = jaw.length ? dist(jaw[0]!, jaw[jaw.length - 1]!) : interEye * 2;

  return { yaw, pitch, ear, scale: faceWidth / Math.max(frameWidth, 1) };
}

function toSample(
  result: {
    descriptor: Float32Array;
    detection: { score: number; box: { x: number; y: number; width: number; height: number } };
    landmarks: {
      getLeftEye(): Point[];
      getRightEye(): Point[];
      getNose(): Point[];
      getJawOutline(): Point[];
      getMouth(): Point[];
      positions: Point[];
    };
  },
  frameWidth: number,
): FaceSample {
  const lm = result.landmarks;
  return {
    descriptor: result.descriptor,
    score: result.detection.score,
    box: result.detection.box,
    landmarks: lm.positions.map((p) => ({ x: p.x, y: p.y })),
    geometry: computeGeometry(
      lm.getLeftEye(),
      lm.getRightEye(),
      lm.getNose(),
      lm.getJawOutline(),
      lm.getMouth(),
      frameWidth,
    ),
  };
}

/** Detects the single most prominent face and returns its embedding + geometry. */
export async function analyseFrame(
  video: HTMLVideoElement,
  options: { inputSize?: number; scoreThreshold?: number } = {},
): Promise<FaceSample | null> {
  const faceapi = await getFaceApi();
  if (!video.videoWidth) return null;

  const inputSize = options.inputSize ?? 416;
  const scoreThreshold = options.scoreThreshold ?? 0.35;

  const result = await faceapi
    .detectSingleFace(
      video,
      new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold }),
    )
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!result) return null;
  return toSample(result as never, video.videoWidth);
}

/**
 * Detects every face in the frame (largest first).
 */
export async function analyseAllFaces(
  video: HTMLVideoElement,
  options: { inputSize?: number; scoreThreshold?: number } = {},
): Promise<FaceSample[]> {
  const faceapi = await getFaceApi();
  if (!video.videoWidth) return [];

  const inputSize = options.inputSize ?? 416;
  const scoreThreshold = options.scoreThreshold ?? 0.35;

  const results = await faceapi
    .detectAllFaces(
      video,
      new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold }),
    )
    .withFaceLandmarks()
    .withFaceDescriptors();

  return results
    .map((r) => toSample(r as never, video.videoWidth))
    .sort((a, b) => b.box.width - a.box.width);
}


/** L2-normalised mean of several descriptors — a more stable template. */
export function averageDescriptors(descriptors: Float32Array[]): Float32Array {
  const dims = descriptors[0]?.length ?? 128;
  const out = new Float32Array(dims);
  for (const d of descriptors) for (let i = 0; i < dims; i++) out[i]! += d[i]!;
  let norm = 0;
  for (let i = 0; i < dims; i++) {
    out[i]! /= descriptors.length;
    norm += out[i]! * out[i]!;
  }
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dims; i++) out[i]! /= norm;
  return out;
}

/** pgvector literal, e.g. "[0.1,-0.2,...]" */
export function toVectorLiteral(descriptor: Float32Array): string {
  return `[${Array.from(descriptor)
    .map((v) => v.toFixed(6))
    .join(",")}]`;
}

export const POSES = [
  {
    key: "front",
    label: "Look straight ahead",
    test: (g: FaceGeometry) => Math.abs(g.yaw) < 0.18 && Math.abs(g.pitch) < 0.3,
  },
  {
    key: "left",
    label: "Turn your head slowly to your left",
    test: (g: FaceGeometry) => g.yaw > 0.3,
  },
  {
    key: "right",
    label: "Turn your head slowly to your right",
    test: (g: FaceGeometry) => g.yaw < -0.3,
  },
  { key: "up", label: "Tilt your chin up", test: (g: FaceGeometry) => g.pitch > 0.35 },
  { key: "down", label: "Tilt your chin down", test: (g: FaceGeometry) => g.pitch < -0.35 },
] as const;

export type PoseKey = (typeof POSES)[number]["key"];

/** Detects the single most prominent face in an image/canvas element. */
export async function analyseImageElement(
  image: HTMLImageElement | HTMLCanvasElement,
): Promise<FaceSample | null> {
  const faceapi = await getFaceApi();
  const width = "naturalWidth" in image ? image.naturalWidth || image.width : image.width;
  if (!width) return null;

  const result = await faceapi
    .detectSingleFace(
      image,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 }),
    )
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!result) return null;
  return toSample(result as never, width);
}

/** Detects all faces in an image or canvas element (sorted largest first). */
export async function analyseAllImageFaces(
  image: HTMLImageElement | HTMLCanvasElement,
): Promise<FaceSample[]> {
  const faceapi = await getFaceApi();
  const width = "naturalWidth" in image ? image.naturalWidth || image.width : image.width;
  if (!width) return [];

  const results = await faceapi
    .detectAllFaces(
      image,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 }),
    )
    .withFaceLandmarks()
    .withFaceDescriptors();

  return results
    .map((r) => toSample(r as never, width))
    .sort((a, b) => b.box.width - a.box.width);
}

/**
 * Extracts 128-D mathematical embedding vector directly from an uploaded photo file.
 * The image is processed in client-side memory and never transmitted or saved.
 */
export async function extractEmbeddingFromFile(file: File | Blob): Promise<{
  success: boolean;
  descriptor?: Float32Array;
  sample?: FaceSample;
  faceCount: number;
  error?: string;
  previewUrl?: string;
}> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = async () => {
      try {
        const samples = await analyseAllImageFaces(img);
        if (samples.length === 0) {
          URL.revokeObjectURL(objectUrl);
          resolve({
            success: false,
            faceCount: 0,
            error: "No face detected. Please upload a clear front-facing portrait photo.",
          });
          return;
        }

        if (samples.length > 1) {
          URL.revokeObjectURL(objectUrl);
          resolve({
            success: false,
            faceCount: samples.length,
            error: `Multiple faces (${samples.length}) detected. Please upload a photo with only one person.`,
          });
          return;
        }

        const sample = samples[0]!;
        // Keep previewUrl for temporary client-side UI confirmation, will be cleaned up on save/exit
        resolve({
          success: true,
          descriptor: sample.descriptor,
          sample,
          faceCount: 1,
          previewUrl: objectUrl,
        });
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        resolve({
          success: false,
          faceCount: 0,
          error: (err as Error).message || "Failed to process image with neural model.",
        });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        success: false,
        faceCount: 0,
        error: "Failed to load image file. Please verify it is a valid JPG, PNG, or WebP file.",
      });
    };

    img.src = objectUrl;
  });
}

/**
 * Extracts 128-D mathematical embedding vector from the current live camera frame.
 */
export async function extractEmbeddingFromSnapshot(video: HTMLVideoElement): Promise<{
  success: boolean;
  descriptor?: Float32Array;
  sample?: FaceSample;
  faceCount: number;
  error?: string;
}> {
  if (!video.videoWidth || !video.videoHeight) {
    return {
      success: false,
      faceCount: 0,
      error: "Camera stream not ready. Please wait for camera initialization.",
    };
  }

  try {
    const samples = await analyseAllFaces(video);
    if (samples.length === 0) {
      return {
        success: false,
        faceCount: 0,
        error: "No face detected in frame. Please face the camera directly.",
      };
    }

    if (samples.length > 1) {
      return {
        success: false,
        faceCount: samples.length,
        error: "Multiple faces detected. Please make sure only one person is in front of the camera.",
      };
    }

    const sample = samples[0]!;
    return {
      success: true,
      descriptor: sample.descriptor,
      sample,
      faceCount: 1,
    };
  } catch (err) {
    return {
      success: false,
      faceCount: 0,
      error: (err as Error).message || "Failed to extract facial vector from camera.",
    };
  }
}

/** Computes cosine distance between two 128-D descriptors: 0 = identical, 1 = orthogonal */
export function cosineDistance(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (!denom) return 1;
  return Math.max(0, 1 - dot / denom);
}

/** Parses a pgvector string "[0.123, -0.456, ...]" into Float32Array */
export function parseVectorLiteral(raw: string | number[] | Float32Array): Float32Array | null {
  if (raw instanceof Float32Array) return raw;
  if (Array.isArray(raw)) return new Float32Array(raw);
  if (typeof raw !== "string") return null;

  try {
    const trimmed = raw.trim().replace(/^\[|\]$/g, "");
    if (!trimmed) return null;
    const parts = trimmed.split(",").map((v) => parseFloat(v.trim()));
    if (parts.length === 0 || isNaN(parts[0]!)) return null;
    return new Float32Array(parts);
  } catch {
    return null;
  }
}

export type EnrolledCandidate = {
  employee_id: string;
  full_name: string;
  employee_code: string;
  embedding: Float32Array;
};

/** Finds best matching enrolled employee vector locally in memory */
export function findBestVectorMatch(
  probe: Float32Array,
  enrolled: EnrolledCandidate[],
  maxDistance = 0.45,
): { match: EnrolledCandidate | null; distance: number; confidence: number } {
  let bestCandidate: EnrolledCandidate | null = null;
  let bestDist = 999;

  for (const item of enrolled) {
    const dist = cosineDistance(probe, item.embedding);
    if (dist < bestDist) {
      bestDist = dist;
      bestCandidate = item;
    }
  }

  if (bestCandidate && bestDist <= maxDistance) {
    const confidence = Math.max(0.65, Math.min(0.99, 1 - bestDist * 0.85));
    return { match: bestCandidate, distance: bestDist, confidence };
  }

  return { match: null, distance: bestDist, confidence: 0 };
}

