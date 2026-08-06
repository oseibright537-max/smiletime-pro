import type { FaceGeometry } from "./engine";

/**
 * Active liveness: the subject must complete randomised motion challenges.
 * A printed photo or a static phone screen cannot satisfy a blink followed by
 * a head rotation, and the passive motion-variance check rejects replayed
 * video that shows no natural micro-movement.
 */

export type ChallengeKind = "blink" | "turn_left" | "turn_right" | "nod_up";

export const CHALLENGE_COPY: Record<ChallengeKind, string> = {
  blink: "Blink once",
  turn_left: "Turn your head left",
  turn_right: "Turn your head right",
  nod_up: "Tilt your chin up",
};

const EAR_CLOSED = 0.21;
const EAR_OPEN = 0.27;

export function randomChallenges(count = 2): ChallengeKind[] {
  const pool: ChallengeKind[] = ["blink", "turn_left", "turn_right", "nod_up"];
  const picked: ChallengeKind[] = ["blink"];
  const rest = pool.filter((c) => c !== "blink").sort(() => Math.random() - 0.5);
  return [...picked, ...rest].slice(0, count);
}

export class LivenessSession {
  readonly challenges: ChallengeKind[];
  private index = 0;
  private eyesClosed = false;
  private neutralSeen = true;
  private geometrySamples: FaceGeometry[] = [];

  constructor(challenges: ChallengeKind[] = randomChallenges()) {
    this.challenges = challenges;
  }

  get current(): ChallengeKind | null {
    return this.challenges[this.index] ?? null;
  }

  get progress() {
    return { done: this.index, total: this.challenges.length };
  }

  get passed() {
    return this.index >= this.challenges.length;
  }

  /** Feeds one frame of geometry; returns true when the whole sequence passed. */
  push(g: FaceGeometry): boolean {
    this.geometrySamples.push(g);
    if (this.geometrySamples.length > 90) this.geometrySamples.shift();

    const challenge = this.current;
    if (!challenge) return true;

    switch (challenge) {
      case "blink": {
        if (g.ear < EAR_CLOSED) this.eyesClosed = true;
        else if (this.eyesClosed && g.ear > EAR_OPEN) this.advance();
        break;
      }
      case "turn_left":
        if (this.neutralSeen && g.yaw > 0.32) this.advance();
        else if (Math.abs(g.yaw) < 0.12) this.neutralSeen = true;
        break;
      case "turn_right":
        if (this.neutralSeen && g.yaw < -0.32) this.advance();
        else if (Math.abs(g.yaw) < 0.12) this.neutralSeen = true;
        break;
      case "nod_up":
        if (this.neutralSeen && g.pitch > 0.38) this.advance();
        else if (Math.abs(g.pitch) < 0.15) this.neutralSeen = true;
        break;
    }
    return this.passed;
  }

  private advance() {
    this.index += 1;
    this.eyesClosed = false;
    this.neutralSeen = false;
  }

  /** 0..1 confidence combining challenge completion and natural micro-motion. */
  score(): number {
    const completion = this.challenges.length ? this.index / this.challenges.length : 0;
    const yaws = this.geometrySamples.map((s) => s.yaw);
    const ears = this.geometrySamples.map((s) => s.ear);
    const variance = spread(yaws) * 2 + spread(ears) * 6;
    const motion = Math.min(1, variance);
    return Math.round(Math.min(1, completion * 0.8 + motion * 0.2) * 100) / 100;
  }

  reset() {
    this.index = 0;
    this.eyesClosed = false;
    this.neutralSeen = true;
    this.geometrySamples = [];
  }
}

function spread(values: number[]) {
  if (values.length < 4) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - avg) ** 2, 0) / values.length);
}
