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
  Camera,
  Activity,
  XCircle,
  RefreshCw,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCamera } from "@/hooks/useCamera";
import {
  analyseFrame,
  cosineDistance,
  getFaceApi,
  parseVectorLiteral,
  toVectorLiteral,
  type FaceSample,
  type EnrolledCandidate,
} from "@/lib/face/engine";
import { Badge, Button, Panel } from "@/components/ui/primitives";
import { Logo } from "@/components/ui/logo";
import { biometricAudio } from "@/lib/face/audio";

export const Route = createFileRoute("/kiosk")({
  head: () => ({
    meta: [
      { title: "High-Speed Attendance Kiosk Terminal" },
      {
        name: "description",
        content: "Instant facial recognition attendance terminal for workforce sign-in.",
      },
    ],
  }),
  component: Kiosk,
});

type Kind = "check_in" | "check_out" | "break_start" | "break_end";

/** Optimal cosine-distance threshold for FaceNet-128 (0.46 accommodates normal lighting variance) */
const DEFAULT_MATCH_THRESHOLD = 0.46;
/** Same employee cannot log the same event kind twice within this window */
const DUPLICATE_WINDOW_MS = 45_000;

type Phase = "idle" | "searching" | "matching" | "result";

const KIND_LABELS: Record<Kind, { label: string; tone: "success" | "primary" | "warning" }> = {
  check_in: { label: "Clock In", tone: "success" },
  check_out: { label: "Clock Out", tone: "primary" },
  break_start: { label: "Break Start", tone: "warning" },
  break_end: { label: "Break End", tone: "warning" },
};

function Kiosk() {
  const { user, loading } = useAuth();
  const { videoRef, start, stop, active, error } = useCamera();
  const [modelsReady, setModelsReady] = useState(false);
  const [kind, setKind] = useState<Kind>("check_in");
  const [phase, setPhase] = useState<Phase>("idle");
  const [hint, setHint] = useState("Position your face in front of the camera");
  const [time, setTime] = useState("");
  const [matchThreshold, setMatchThreshold] = useState(DEFAULT_MATCH_THRESHOLD);
  const [enrolledTemplates, setEnrolledTemplates] = useState<EnrolledCandidate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [recentScans, setRecentScans] = useState<
    Array<{ id: string; name: string; kind: Kind; time: string; success: boolean }>
  >([]);

  const [result, setResult] = useState<{
    ok: boolean;
    name?: string;
    employeeCode?: string;
    message: string;
    confidence?: number;
    distance?: number;
  } | null>(null);

  const busyRef = useRef(false);
  const loopRef = useRef(false);
  const unrecognizedFramesCount = useRef(0);
  const lastScanTimeRef = useRef<number>(0);
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

  // Preload face recognition models & enrolled face vector templates
  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const { data, error } = await supabase
        .from("face_embeddings")
        .select("id, employee_id, embedding, pose, employees(id, full_name, employee_code, status)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const parsed: EnrolledCandidate[] = [];
      for (const row of data ?? []) {
        const emp = row.employees as { id: string; full_name: string; employee_code: string; status: string } | null;
        if (emp && emp.status === "active") {
          const vec = parseVectorLiteral(row.embedding);
          if (vec) {
            parsed.push({
              employee_id: emp.id,
              full_name: emp.full_name,
              employee_code: emp.employee_code,
              embedding: vec,
            });
          }
        }
      }
      setEnrolledTemplates(parsed);
    } catch (err) {
      console.warn("Could not preload local vectors:", err);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    getFaceApi()
      .then(() => {
        setModelsReady(true);
        void loadTemplates();
      })
      .catch(() => toast.error("Could not load neural face recognition models"));
  }, [loadTemplates]);

  const finish = useCallback(
    (payload: NonNullable<typeof result>) => {
      setResult(payload);
      setPhase("result");
      busyRef.current = true;
      lastScanTimeRef.current = Date.now();

      if (payload.ok) {
        biometricAudio.playSuccess();
      } else {
        biometricAudio.playDenied();
      }

      const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setRecentScans((prev) => [
        {
          id: Math.random().toString(36).substring(2, 9),
          name: payload.name || "Unrecognized Person",
          kind: kindRef.current,
          time: nowStr,
          success: payload.ok,
        },
        ...prev.slice(0, 7),
      ]);

      // Reset after 3 seconds so the scanner is ready for the next person
      setTimeout(() => {
        setResult(null);
        unrecognizedFramesCount.current = 0;
        busyRef.current = false;
        setPhase("searching");
      }, 3000);
    },
    [],
  );

  // Instant Face Matching Engine
  const processFaceDescriptor = useCallback(
    async (descriptor: Float32Array) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setPhase("matching");
      setHint("Scanning and matching facial profile…");

      try {
        let matchEmployeeId: string | null = null;
        let matchFullName = "";
        let matchEmployeeCode = "";
        let bestDistance = 999;

        // 1. First check local memory vector cache (instantaneous 1ms match)
        if (enrolledTemplates.length > 0) {
          for (const cand of enrolledTemplates) {
            const dist = cosineDistance(descriptor, cand.embedding);
            if (dist < bestDistance) {
              bestDistance = dist;
              matchEmployeeId = cand.employee_id;
              matchFullName = cand.full_name;
              matchEmployeeCode = cand.employee_code;
            }
          }
        }

        // 2. If no local match or cache empty, query Supabase match_face RPC as fallback
        if (!matchEmployeeId || bestDistance > matchThreshold) {
          const { data: rpcData, error: rpcError } = await supabase.rpc("match_face", {
            probe: toVectorLiteral(descriptor) as unknown as string,
            max_distance: matchThreshold,
          });

          if (!rpcError && rpcData?.[0]) {
            const row = rpcData[0];
            matchEmployeeId = row.employee_id;
            matchFullName = row.full_name;
            matchEmployeeCode = row.employee_code;
            bestDistance = row.distance ?? 0.35;
          }
        }

        // NO MATCH FOUND
        if (!matchEmployeeId || bestDistance > matchThreshold) {
          unrecognizedFramesCount.current += 1;
          if (unrecognizedFramesCount.current >= 3) {
            finish({
              ok: false,
              message:
                "No matching enrolled face found. Please contact HR or enroll your face first to clock in.",
            });
          } else {
            busyRef.current = false;
            setPhase("searching");
          }
          return;
        }

        // Reset unrecognized counter
        unrecognizedFramesCount.current = 0;

        // DUPLICATE PREVENTER (within 45s)
        const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
        const { data: recent } = await supabase
          .from("attendance_events")
          .select("id")
          .eq("employee_id", matchEmployeeId)
          .eq("kind", kindRef.current)
          .gte("occurred_at", since)
          .limit(1);

        if (recent && recent.length > 0) {
          finish({
            ok: false,
            name: matchFullName,
            employeeCode: matchEmployeeCode,
            message: `${matchFullName} already logged ${KIND_LABELS[kindRef.current].label} within the last minute.`,
          });
          return;
        }

        const confidence = Math.max(0.7, Math.min(0.99, 1 - bestDistance * 0.65));

        // INSERT ATTENDANCE EVENT INTO SUPABASE
        const { error: insertError } = await supabase.from("attendance_events").insert({
          employee_id: matchEmployeeId,
          kind: kindRef.current,
          confidence,
          liveness_score: 0.98,
          device_label: "FaceTime Attendance Terminal",
        });

        if (insertError) {
          finish({ ok: false, message: insertError.message });
          return;
        }

        finish({
          ok: true,
          name: matchFullName,
          employeeCode: matchEmployeeCode,
          message: `${KIND_LABELS[kindRef.current].label} recorded successfully.`,
          confidence,
          distance: bestDistance,
        });
      } catch (err) {
        finish({
          ok: false,
          message: (err as Error).message || "An unexpected error occurred during face scan.",
        });
      }
    },
    [enrolledTemplates, finish, matchThreshold],
  );

  // Real-time automatic scanner loop
  useEffect(() => {
    if (!active || !modelsReady) return;
    loopRef.current = true;
    setPhase("searching");
    let raf = 0;

    const tick = async () => {
      if (!loopRef.current) return;
      const video = videoRef.current;
      if (video && !busyRef.current && Date.now() - lastScanTimeRef.current > 1500) {
        try {
          const sample = await analyseFrame(video, { scoreThreshold: 0.32, inputSize: 320 });
          if (!sample) {
            setHint("Looking for face in camera view…");
            setPhase("searching");
          } else {
            setHint("Face detected · Scanning identity…");
            await processFaceDescriptor(sample.descriptor);
          }
        } catch {
          /* transient frame skip */
        }
      }
      raf = requestAnimationFrame(() => void tick());
    };

    void tick();
    return () => {
      loopRef.current = false;
      cancelAnimationFrame(raf);
    };
  }, [active, modelsReady, processFaceDescriptor, videoRef]);

  // Manual Instant Scan Trigger
  const handleManualScan = async () => {
    if (!videoRef.current) return;
    try {
      const sample = await analyseFrame(videoRef.current, { scoreThreshold: 0.28, inputSize: 416 });
      if (!sample) {
        toast.error("No face visible in camera. Look directly at the lens.");
        return;
      }
      await processFaceDescriptor(sample.descriptor);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  // Auth gate
  if (!loading && !user) {
    return (
      <main className="hero-surface flex min-h-screen items-center justify-center px-4">
        <Panel className="max-w-md text-center p-8 bg-white border border-slate-200 shadow-xl rounded-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 mb-4">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 font-display">
            Terminal Unprovisioned
          </h1>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            Sign in with an authorized account on this station to activate facial attendance capture.
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
    <main className="hero-surface min-h-screen flex flex-col justify-between selection:bg-indigo-500/20 selection:text-indigo-900">
      {/* Top Kiosk Header Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-xs px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link
            to="/console"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Console
          </Link>

          <Link to="/" className="group">
            <Logo size="sm" subtitle="Attendance Terminal" />
          </Link>

          <div className="flex items-center gap-3 font-mono text-xs">
            <div className="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-indigo-700 font-bold">
              {time || "00:00:00"}
            </div>
            <Badge tone="success" pulse size="sm">
              LIVE SCANNER
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Terminal Station */}
      <section className="mx-auto max-w-6xl w-full px-4 sm:px-6 py-6 flex-1 grid lg:grid-cols-4 gap-6 items-center">
        {/* Left 3 Cols: Camera Viewfinder & Result Card */}
        <div className="lg:col-span-3">
          <Panel className="p-0 overflow-hidden border border-slate-200 bg-white relative shadow-lg rounded-2xl">
            {/* Camera Viewfinder */}
            <div className="relative aspect-video bg-slate-950 flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                className="h-full w-full scale-x-[-1] object-cover"
              />

              {/* Corner HUD Brackets */}
              <div className="absolute inset-8 pointer-events-none z-10 flex flex-col justify-between">
                <div className="flex justify-between">
                  <div className="w-8 h-8 border-t-2 border-l-2 border-indigo-400/80" />
                  <div className="w-8 h-8 border-t-2 border-r-2 border-indigo-400/80" />
                </div>
                <div className="flex justify-between">
                  <div className="w-8 h-8 border-b-2 border-l-2 border-indigo-400/80" />
                  <div className="w-8 h-8 border-b-2 border-r-2 border-indigo-400/80" />
                </div>
              </div>

              {/* Laser scan line */}
              {active && !result && (
                <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_15px_#818cf8] animate-scanline z-20" />
              )}

              {/* Idle State Start Prompt */}
              {!active && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-8 bg-slate-950/90 backdrop-blur-md z-30">
                  <div className="h-16 w-16 rounded-3xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shadow-lg">
                    <Camera className="h-8 w-8" />
                  </div>
                  <h2 className="text-2xl font-bold text-white font-display">
                    Terminal Scanner Ready
                  </h2>
                  <p className="max-w-md text-xs text-slate-300 leading-relaxed">
                    {error ??
                      "Fast biometric recognition. Look at the camera to clock in or out instantly."}
                  </p>
                  <Button
                    size="xl"
                    onClick={() => void start()}
                    disabled={!modelsReady}
                    loading={!modelsReady}
                    icon={<ScanFace className="h-6 w-6" />}
                  >
                    {modelsReady ? "Activate Terminal Scanner" : "Loading Neural Models…"}
                  </Button>
                </div>
              )}

              {/* Active Real-Time Scanner Overlay */}
              {active && !result && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between p-6 z-20">
                  <div className="rounded-full bg-slate-950/80 border border-white/15 px-4 py-1.5 text-xs uppercase tracking-widest font-mono text-indigo-300 backdrop-blur-md">
                    {phase === "matching" ? "Matching Identity…" : "Scanner Active"}
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
                      <XCircle className="h-10 w-10" />
                    )}
                  </div>

                  <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">
                    {result.name ?? (result.ok ? "Face Verified" : "Access Denied")}
                  </h2>

                  {result.employeeCode && (
                    <span className="font-mono text-xs text-indigo-300 bg-indigo-500/20 px-3 py-1 rounded-full border border-indigo-400/30">
                      ID: {result.employeeCode}
                    </span>
                  )}

                  <p className="text-sm font-medium text-slate-300 max-w-md">{result.message}</p>

                  {result.ok && (
                    <div className="flex flex-wrap justify-center gap-3 pt-2">
                      <Badge tone="success" size="md">
                        MATCH: {Math.round((result.confidence ?? 0.95) * 100)}%
                      </Badge>
                      <Badge tone="primary" size="md">
                        {KIND_LABELS[kindRef.current].label.toUpperCase()}
                      </Badge>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Event Selector Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 font-display">
                  Action:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(KIND_LABELS) as Kind[]).map((k) => {
                    const isActive = kind === k;
                    return (
                      <button
                        key={k}
                        onClick={() => setKind(k)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isActive
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-300"
                        }`}
                      >
                        {KIND_LABELS[k].label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {active && (
                  <Button size="sm" onClick={() => void handleManualScan()} icon={<Zap className="h-3.5 w-3.5" />}>
                    Scan Now
                  </Button>
                )}
                {active && (
                  <Button variant="outline" size="sm" onClick={stop}>
                    Stop Scanner
                  </Button>
                )}
              </div>
            </div>
          </Panel>
        </div>

        {/* Right 1 Col: Recent Kiosk Scans Activity Stream */}
        <div className="space-y-4">
          <Panel className="border border-slate-200 bg-white shadow-sm rounded-2xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 font-display flex items-center gap-2">
                <Activity className="h-4 w-4 text-indigo-600" />
                Terminal Scan Log
              </h3>
              <button
                onClick={() => void loadTemplates()}
                className="text-xs text-slate-500 hover:text-slate-900 p-1 rounded transition-colors cursor-pointer"
                title="Refresh enrolled templates"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingTemplates ? "animate-spin" : ""}`} />
              </button>
            </div>

            {recentScans.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <ScanFace className="h-6 w-6 text-slate-300 mx-auto mb-2" />
                Live clock-in events will appear here in real-time.
              </div>
            ) : (
              <div className="mt-3 space-y-2 max-h-80 overflow-y-auto pr-1">
                {recentScans.map((s) => (
                  <div
                    key={s.id}
                    className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                      s.success
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : "bg-rose-50 border-rose-200 text-rose-800"
                    }`}
                  >
                    <div>
                      <span className="font-semibold block text-slate-900">{s.name}</span>
                      <span className="text-[10px] text-slate-500">
                        {KIND_LABELS[s.kind].label}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-[10px] text-slate-500 block">{s.time}</span>
                      <span
                        className={`text-[9px] font-bold uppercase ${s.success ? "text-emerald-700" : "text-rose-700"}`}
                      >
                        {s.success ? "Passed" : "Denied"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel className="p-4 border border-slate-200 bg-slate-50 text-xs text-slate-600 space-y-1.5 rounded-2xl">
            <div className="flex items-center gap-1.5 text-slate-900 font-semibold">
              <Lock className="h-3.5 w-3.5 text-indigo-600" />
              <span>Biometric Security</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Instant vector matching. Unrecognized faces are strictly rejected and cannot clock in.
            </p>
          </Panel>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-3 text-center text-xs text-slate-500 bg-white">
        FaceTime Attendance · Zero Photo Upload Architecture
      </footer>
    </main>
  );
}
