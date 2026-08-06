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
      try {
        await tf.setBackend("webgl");
      } catch {
        await tf.setBackend("cpu");
      }
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

/** Detects the single most prominent face and returns its embedding + geometry. */
export async function analyseFrame(video: HTMLVideoElement): Promise<FaceSample | null> {
  const faceapi = await getFaceApi();
  if (!video.videoWidth) return null;

  const result = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!result) return null;

  const lm = result.landmarks;
  const geometry = computeGeometry(
    lm.getLeftEye(),
    lm.getRightEye(),
    lm.getNose(),
    lm.getJawOutline(),
    lm.getMouth(),
    video.videoWidth,
  );

  return {
    descriptor: result.descriptor,
    score: result.detection.score,
    box: result.detection.box,
    landmarks: lm.positions.map((p) => ({ x: p.x, y: p.y })),
    geometry,
  };
}

/** pgvector literal, e.g. "[0.1,-0.2,...]" */
export function toVectorLiteral(descriptor: Float32Array): string {
  return `[${Array.from(descriptor)
    .map((v) => v.toFixed(6))
    .join(",")}]`;
}

export const POSES = [
  { key: "front", label: "Look straight ahead", test: (g: FaceGeometry) => Math.abs(g.yaw) < 0.18 && Math.abs(g.pitch) < 0.3 },
  { key: "left", label: "Turn your head slowly to your left", test: (g: FaceGeometry) => g.yaw > 0.3 },
  { key: "right", label: "Turn your head slowly to your right", test: (g: FaceGeometry) => g.yaw < -0.3 },
  { key: "up", label: "Tilt your chin up", test: (g: FaceGeometry) => g.pitch > 0.35 },
  { key: "down", label: "Tilt your chin down", test: (g: FaceGeometry) => g.pitch < -0.35 },
] as const;

export type PoseKey = (typeof POSES)[number]["key"];
