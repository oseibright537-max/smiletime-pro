import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ScanFace,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Clock,
  CheckCircle2,
  Lock,
  Sparkles,
  Camera,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCamera } from "@/hooks/useCamera";
import { analyseFrame, averageDescriptors, getFaceApi, toVectorLiteral } from "@/lib/face/engine";
import { assessFrame } from "@/lib/face/quality";
import { CHALLENGE_COPY, LivenessSession } from "@/lib/face/liveness";
import { Badge, Button, Panel, Avatar } from "@/components/ui/primitives";

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

/** Cosine-distance threshold. Lower = stricter. */
const MATCH_THRESHOLD = 0.12;
/** Same employee cannot log the same event kind twice within this window. */
const DUPLICATE_WINDOW_MS = 60_000;

type Phase = "idle" | "searching" | "liveness" | "matching" | "result";

const KIND_LABELS: Record<Kind, { label: string; tone: "success" | "primary" | "warning" }> = {
  check_in: { label: "Check In", tone: "success" },
  check_out: { label: "Check Out", tone: "primary" },
  break_start: { label: "Break Start", tone: "warning" },
  break_end: { label: "Break End", tone: "warning" },
};

function Kiosk() {
  const { user, loading } = useAuth();
  const { videoRef, start, stop, active, error } = useCamera();
  const [modelsReady, setModelsReady] = useState(false);
  const [kind, setKind] = useState<Kind>("check_in");
  const [phase, setPhase] = useState<Phase>("idle");
  const [hint, setHint] = useState("Position your face inside the viewfinder to begin");
  const [time, setTime] = useState("");
  const [result, setResult] = useState<{
    ok: boolean;
    name?: string;
    message: string;
    confidence?: number;
    liveness?: number;
  } | null>(null);

  const livenessRef = useRef<LivenessSession | null>(null);
  const probeRef = useRef<{ descriptor: Float32Array; score: number }[]>([]);
  const busyRef = useRef(false);
  const loopRef = useRef(false);
  const kindRef = useRef<Kind>(kind);
  kindRef.current = kind;

  // Live Digital Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

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
    }, 4500);
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
        finish({
          ok: false,
          message: "No enrolled match found. Ask your HR administrator to enrol your face.",
        });
        return;
      }

      const confidence = Math.max(0, 1 - match.distance / MATCH_THRESHOLD) * 0.4 + 0.6;
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const { data: logged, error: logError } = await supabase.rpc("log_attendance", {
        _employee_id: match.employee_id,
        _confidence: confidence,
        _liveness: livenessScore,
        _device_label: "Sentra Kiosk Station",
        _tz: tz,
      });

      if (logError) {
        finish({ ok: false, name: match.full_name, message: logError.message });
        return;
      }

      const event = logged?.[0];
      const kindLogged = (event?.kind ?? "check_in") as Kind;
      finish({
        ok: true,
        name: match.full_name,
        kind: kindLogged,
        status: event?.status ?? "normal",
        message:
          `${KIND_LABELS[kindLogged].label} recorded` +
          (event?.status === "late"
            ? " — marked Late (after 9:30 AM)."
            : event?.status === "early_leave"
              ? " — early leave (before 5:00 PM)."
              : "."),
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
            setHint("Looking for face landmarks…");
            session.reset();
            probeRef.current = [];
            setPhase("searching");
          } else if (sample.geometry.scale < 0.18) {
            setHint("Step slightly closer to the terminal");
          } else {
            setPhase("liveness");

            const verdict = assessFrame(video, [sample]);
            if (verdict.ok) {
              probeRef.current.push({
                descriptor: sample.descriptor,
                score: verdict.metrics.score,
              });
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
              setHint(
                `${c ? CHALLENGE_COPY[c] : "Follow anti-spoof motion"} · Challenge ${done}/${total}`,
              );
            }
          }
        } catch {
          /* keep looping */
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
        <Panel className="max-w-md text-center p-8 border border-white/10 shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-4">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-white font-display">
            Terminal Unprovisioned
          </h1>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Sign in with a workspace administrator account on this station once to authorize facial
            attendance capture.
          </p>
          <div className="mt-6">
            <Link to="/auth" search={{ next: "/kiosk" }}>
              <Button size="lg" className="w-full">
                Authorize Terminal Device
              </Button>
            </Link>
          </div>
        </Panel>
      </main>
    );
  }

  return (
    <main className="hero-surface min-h-screen flex flex-col justify-between selection:bg-sky-500/30 selection:text-sky-200">
      {/* Top Kiosk Header Bar */}
      <header className="sticky top-0 z-40 glass-bar border-b border-white/10 px-6 py-3.5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link
            to="/console"
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-lg border border-white/10"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Console
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500">
              <ScanFace className="h-4.5 w-4.5 text-slate-950" />
            </div>
            <div>
              <span className="font-display font-bold text-white text-base tracking-tight block">
                Sentra Attendance Kiosk
              </span>
              <span className="text-[10px] text-muted-foreground font-mono uppercase block">
                Terminal ID: STN-884
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs">
            <div className="bg-slate-900 border border-white/10 px-3 py-1.5 rounded-lg text-sky-300 font-bold">
              {time || "00:00:00"}
            </div>
            <Badge tone="success" pulse size="sm">
              LIVE
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Center Terminal Station */}
      <section className="mx-auto max-w-4xl w-full px-6 py-8 flex-1 flex flex-col justify-center">
        <Panel className="p-0 overflow-hidden border border-white/15 relative bg-slate-950 shadow-2xl">
          {/* Camera Viewfinder */}
          <div className="relative aspect-video bg-slate-950 flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full scale-x-[-1] object-cover"
            />

            {/* Corner Brackets */}
            <div className="absolute inset-8 pointer-events-none z-10 flex flex-col justify-between">
              <div className="flex justify-between">
                <div className="w-8 h-8 border-t-2 border-l-2 border-sky-400/80" />
                <div className="w-8 h-8 border-t-2 border-r-2 border-sky-400/80" />
              </div>
              <div className="flex justify-between">
                <div className="w-8 h-8 border-b-2 border-l-2 border-sky-400/80" />
                <div className="w-8 h-8 border-b-2 border-r-2 border-sky-400/80" />
              </div>
            </div>

            {/* Laser scan line */}
            {active && !result && (
              <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-sky-400 to-transparent shadow-[0_0_15px_#38bdf8] animate-scanline z-20" />
            )}

            {/* Idle State Start Prompt */}
            {!active && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-8 bg-slate-950/90 backdrop-blur-md z-30">
                <div className="h-16 w-16 rounded-3xl bg-sky-500/10 border border-sky-400/30 flex items-center justify-center text-sky-400 shadow-lg shadow-sky-500/20">
                  <Camera className="h-8 w-8" />
                </div>
                <h2 className="text-2xl font-extrabold text-white font-display">
                  Attendance Terminal Ready
                </h2>
                <p className="max-w-md text-xs text-muted-foreground leading-relaxed">
                  {error ??
                    "Recognition occurs entirely on-device in WebGL memory. Video is never transmitted or stored."}
                </p>
                <Button
                  size="xl"
                  onClick={() => void start()}
                  disabled={!modelsReady}
                  loading={!modelsReady}
                  icon={<ScanFace className="h-6 w-6" />}
                >
                  {modelsReady ? "Activate Terminal Scanner" : "Loading Recognition Neural Models…"}
                </Button>
              </div>
            )}

            {/* Active Real-Time Scanner Overlay */}
            {active && !result && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between p-6 z-20">
                <div className="rounded-full bg-slate-950/80 border border-white/10 px-4 py-1.5 text-xs uppercase tracking-widest font-mono text-sky-300 backdrop-blur-md">
                  {phase === "matching"
                    ? "Cosine Matching 128-D Vector…"
                    : phase === "liveness"
                      ? "Active Liveness Check"
                      : "Scanning for Face…"}
                </div>
                <div className="rounded-2xl bg-slate-950/90 border border-white/20 px-6 py-3 text-center text-base sm:text-lg font-bold text-white shadow-2xl backdrop-blur-xl">
                  {hint}
                </div>
              </div>
            )}

            {/* Recognition Result Modal Overlay */}
            {result && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/95 p-8 text-center backdrop-blur-2xl z-30 animate-in fade-in zoom-in-95 duration-200">
                <div
                  className={`h-20 w-20 rounded-3xl flex items-center justify-center shadow-2xl ${
                    result.ok
                      ? "bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 shadow-emerald-500/30"
                      : "bg-rose-500/20 border-2 border-rose-400 text-rose-400 shadow-rose-500/30"
                  }`}
                >
                  {result.ok ? (
                    <CheckCircle2 className="h-10 w-10" />
                  ) : (
                    <ShieldAlert className="h-10 w-10" />
                  )}
                </div>

                <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white">
                  {result.name ?? (result.ok ? "Verified" : "Recognition Failed")}
                </h2>

                <p className="text-sm font-medium text-slate-300 max-w-md">{result.message}</p>

                {result.ok && (
                  <div className="flex flex-wrap justify-center gap-3 pt-2">
                    <Badge tone="success" size="md">
                      MATCH: {Math.round((result.confidence ?? 0) * 100)}%
                    </Badge>
                    <Badge tone="primary" size="md">
                      LIVENESS: {Math.round((result.liveness ?? 0) * 100)}%
                    </Badge>
                    <Badge tone="muted" size="md">
                      {KIND_LABELS[kindRef.current].label.toUpperCase()}
                    </Badge>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Event Selector Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 bg-slate-900/80 px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                MODE:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(KIND_LABELS) as Kind[]).map((k) => {
                  const isActive = kind === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setKind(k)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                        isActive
                          ? "bg-sky-400 text-slate-950 shadow-md shadow-sky-500/20"
                          : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-white/5"
                      }`}
                    >
                      {KIND_LABELS[k].label}
                    </button>
                  );
                })}
              </div>
            </div>

            {active && (
              <Button variant="outline" size="sm" onClick={stop}>
                Stop Terminal
              </Button>
            )}
          </div>
        </Panel>

        <p className="mt-4 text-center text-xs text-muted-foreground font-light">
          Anti-spoofing engine: Randomised micro-motions, blink challenges, and 68-point 3D landmark
          verification protect every event.
        </p>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-4 text-center text-xs text-muted-foreground">
        Sentra On-Device Biometric Recognition · Zero Photo Upload Policy
      </footer>
    </main>
  );
}
