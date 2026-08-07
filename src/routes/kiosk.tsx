import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ScanFace, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCamera } from "@/hooks/useCamera";
import { analyseFrame, averageDescriptors, getFaceApi, toVectorLiteral } from "@/lib/face/engine";
import { assessFrame } from "@/lib/face/quality";
import { CHALLENGE_COPY, LivenessSession } from "@/lib/face/liveness";
import { Badge, Button, Panel, Select } from "@/components/ui/primitives";


export const Route = createFileRoute("/kiosk")({
  head: () => ({
    meta: [
      { title: "Attendance Kiosk — Sentra" },
      {
        name: "description",
        content: "Liveness-verified facial check-in and check-out terminal for Sentra attendance.",
      },
      { property: "og:title", content: "Attendance Kiosk — Sentra" },
      { property: "og:description", content: "Liveness-verified facial check-in terminal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Kiosk,
});

type Kind = "check_in" | "check_out" | "break_start" | "break_end";

/** Cosine-distance threshold. Lower = stricter. 0.12 ≈ 0.49 euclidean on unit vectors. */
const MATCH_THRESHOLD = 0.12;
/** Same employee cannot log the same event kind twice within this window. */
const DUPLICATE_WINDOW_MS = 60_000;

type Phase = "idle" | "searching" | "liveness" | "matching" | "result";

function Kiosk() {
  const { user, loading } = useAuth();
  const { videoRef, start, stop, active, error } = useCamera();
  const [modelsReady, setModelsReady] = useState(false);
  const [kind, setKind] = useState<Kind>("check_in");
  const [phase, setPhase] = useState<Phase>("idle");
  const [hint, setHint] = useState("Stand in front of the camera to begin");
  const [result, setResult] = useState<
    { ok: boolean; name?: string; message: string; confidence?: number; liveness?: number } | null
  >(null);
  const livenessRef = useRef<LivenessSession | null>(null);
  /** Best recent quality-gated descriptors; matching uses their mean. */
  const probeRef = useRef<{ descriptor: Float32Array; score: number }[]>([]);
  const busyRef = useRef(false);
  const loopRef = useRef(false);
  const kindRef = useRef<Kind>(kind);
  kindRef.current = kind;

  useEffect(() => {
    getFaceApi()
      .then(() => setModelsReady(true))
      .catch(() => toast.error("Could not load the recognition models"));
  }, []);

  const finish = useCallback((payload: NonNullable<typeof result>) => {
    setResult(payload);
    setPhase("result");
    busyRef.current = true;
    setTimeout(() => {
      setResult(null);
      livenessRef.current = new LivenessSession();
      probeRef.current = [];
      busyRef.current = false;
      setPhase("searching");
    }, 4000);
  }, []);

  const recognise = useCallback(
    async (descriptor: Float32Array, livenessScore: number) => {
      setPhase("matching");
      const { data, error: rpcError } = await supabase.rpc("match_face", {
        probe: toVectorLiteral(descriptor) as unknown as string,
        max_distance: MATCH_THRESHOLD,
      });

      if (rpcError) {
        finish({ ok: false, message: rpcError.message });
        return;
      }
      const match = data?.[0];
      if (!match) {
        finish({ ok: false, message: "No enrolled match found. Ask HR to enrol your face." });
        return;
      }

      const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
      const { data: recent } = await supabase
        .from("attendance_events")
        .select("id")
        .eq("employee_id", match.employee_id)
        .eq("kind", kindRef.current)
        .gte("occurred_at", since)
        .limit(1);

      if (recent && recent.length > 0) {
        finish({
          ok: false,
          name: match.full_name,
          message: `${match.full_name} already logged a ${kindRef.current.replace("_", " ")} moments ago.`,
        });
        return;
      }

      const confidence = Math.max(0, 1 - match.distance / MATCH_THRESHOLD) * 0.4 + 0.6;
      const { error: insertError } = await supabase.from("attendance_events").insert({
        employee_id: match.employee_id,
        kind: kindRef.current,
        confidence,
        liveness_score: livenessScore,
        device_label: "Web kiosk",
      });

      if (insertError) {
        finish({ ok: false, message: insertError.message });
        return;
      }

      finish({
        ok: true,
        name: match.full_name,
        message: `${kindRef.current.replace("_", " ")} recorded`,
        confidence,
        liveness: livenessScore,
      });
    },
    [finish],
  );

  // Recognition + liveness loop
  useEffect(() => {
    if (!active || !modelsReady) return;
    loopRef.current = true;
    livenessRef.current = livenessRef.current ?? new LivenessSession();
    setPhase("searching");
    let raf = 0;

    const tick = async () => {
      if (!loopRef.current) return;
      const video = videoRef.current;
      if (video && !busyRef.current) {
        try {
          const sample = await analyseFrame(video);
          const session = livenessRef.current!;
          if (!sample) {
            setHint("Waiting for a face…");
            session.reset();
            probeRef.current = [];
            setPhase("searching");
          } else if (sample.geometry.scale < 0.18) {
            setHint("Step a little closer");
          } else {
            setPhase("liveness");

            // Keep the best clean, well-lit frames seen during the liveness
            // sequence; the probe is their averaged vector, which is far more
            // robust than a single frame in low light or slight motion.
            const verdict = assessFrame(video, [sample]);
            if (verdict.ok) {
              probeRef.current.push({ descriptor: sample.descriptor, score: verdict.metrics.score });
              probeRef.current.sort((a, b) => b.score - a.score);
              if (probeRef.current.length > 5) probeRef.current.length = 5;
            }

            const passed = session.push(sample.geometry);
            if (passed) {
              busyRef.current = true;
              const score = session.score();
              session.reset();
              const probes = probeRef.current.map((p) => p.descriptor);
              probeRef.current = [];
              await recognise(
                probes.length > 0 ? averageDescriptors(probes) : sample.descriptor,
                score,
              );
            } else {
              const c = session.current;
              const { done, total } = session.progress;
              setHint(`${c ? CHALLENGE_COPY[c] : ""} · ${done}/${total}`);
            }
          }
        } catch {
          /* keep looping on transient frame errors */
        }
      }
      raf = requestAnimationFrame(() => void tick());
    };

    void tick();
    return () => {
      loopRef.current = false;
      cancelAnimationFrame(raf);
    };
  }, [active, modelsReady, recognise, videoRef]);

  if (!loading && !user) {
    return (
      <main className="hero-surface flex min-h-screen items-center justify-center px-4">
        <Panel className="max-w-md text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-warning" />
          <h1 className="mt-4 text-xl font-semibold">Kiosk needs to be provisioned</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with a workspace account on this terminal once; the device then stays authorised for
            attendance capture.
          </p>
          <Link to="/auth" search={{ next: "/kiosk" }} className="mt-5 inline-block">
            <Button>Sign in to this device</Button>
          </Link>
        </Panel>
      </main>
    );
  }

  return (
    <main className="hero-surface min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link to="/console" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Console
        </Link>
        <div className="flex items-center gap-2">
          <ScanFace className="h-4 w-4 text-primary" />
          <span className="font-display font-semibold">Attendance kiosk</span>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-16">
        <Panel className="p-0 overflow-hidden">
          <div className="relative aspect-video bg-background">
            <video ref={videoRef} playsInline muted className="h-full w-full scale-x-[-1] object-cover" />

            {!active && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
                <p className="max-w-md text-sm text-muted-foreground">
                  {error ??
                    "This terminal runs recognition locally. Video never leaves the device — only the match result is stored."}
                </p>
                <Button size="lg" onClick={() => void start()} disabled={!modelsReady}>
                  {modelsReady ? "Start terminal" : "Loading models…"}
                </Button>
              </div>
            )}

            {active && !result && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between p-6">
                <div className="glow-ring rounded-full bg-background/80 px-4 py-1.5 text-xs uppercase tracking-wide">
                  {phase === "matching" ? "Matching…" : phase === "liveness" ? "Liveness check" : "Searching"}
                </div>
                <div className="rounded-xl bg-background/85 px-5 py-3 text-center text-lg font-medium">{hint}</div>
              </div>
            )}

            {result && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/92 px-6 text-center">
                {result.ok ? (
                  <ShieldCheck className="h-12 w-12 text-success" />
                ) : (
                  <ShieldAlert className="h-12 w-12 text-warning" />
                )}
                <h2 className="font-display text-3xl font-semibold">{result.name ?? "Not recognised"}</h2>
                <p className="text-sm capitalize text-muted-foreground">{result.message}</p>
                {result.ok && (
                  <div className="mt-2 flex gap-2">
                    <Badge tone="success">match {Math.round((result.confidence ?? 0) * 100)}%</Badge>
                    <Badge tone="primary">liveness {Math.round((result.liveness ?? 0) * 100)}%</Badge>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border px-6 py-4">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Event type</span>
            <div className="w-48">
              <Select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                <option value="check_in">Check in</option>
                <option value="check_out">Check out</option>
                <option value="break_start">Break start</option>
                <option value="break_end">Break end</option>
              </Select>
            </div>
            {active && (
              <Button variant="outline" size="sm" className="ml-auto" onClick={stop}>
                Stop terminal
              </Button>
            )}
          </div>
        </Panel>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Anti-spoofing: randomised blink and head-motion challenges plus micro-motion analysis run before any
          identity match is accepted.
        </p>
      </section>
    </main>
  );
}
