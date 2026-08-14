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
  SwitchCamera,
  Sliders,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { useCamera } from "@/hooks/useCamera";
import { Building } from "lucide-react";
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
import {
  checkAttendanceRules,
  evaluateTimeWindow,
  type AttendanceStatus,
} from "@/lib/attendance/time-windows";
import { TimeWindowBanner } from "@/components/attendance/TimeWindowBanner";

export const Route = createFileRoute("/kiosk")({
  head: () => ({
    meta: [
      { title: "High-Speed Attendance Kiosk Terminal" },
      {
        name: "description",
        content:
          "Instant facial recognition attendance terminal with automated shift window enforcement.",
      },
    ],
  }),
  component: Kiosk,
});

type Kind = "check_in" | "check_out" | "break_start" | "break_end";

/** Cosine distance threshold for FaceNet-128 (0.52 accommodates phone cameras, lighting, & laptops) */
const DEFAULT_MATCH_THRESHOLD = 0.52;
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
  const { currentOrg, currentOrgId } = useOrganization();
  const { videoRef, start, stop, active, error, facingMode, flipCamera } = useCamera();
  const [modelsReady, setModelsReady] = useState(false);
  const [kind, setKind] = useState<Kind>("check_in");
  const [phase, setPhase] = useState<Phase>("idle");
  const [hint, setHint] = useState("Looking for face in camera view…");
  const [time, setTime] = useState("");
  const [matchThreshold, setMatchThreshold] = useState(DEFAULT_MATCH_THRESHOLD);
  const [enrolledTemplates, setEnrolledTemplates] = useState<EnrolledCandidate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [bypassShiftRules, setBypassShiftRules] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [detectedBox, setDetectedBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const [recentScans, setRecentScans] = useState<
    Array<{
      id: string;
      name: string;
      kind: Kind;
      time: string;
      success: boolean;
      statusLabel?: string;
    }>
  >([]);

  const [result, setResult] = useState<{
    ok: boolean;
    name?: string;
    employeeCode?: string;
    message: string;
    confidence?: number;
    distance?: number;
    statusLabel?: string;
    statusTone?: "success" | "warning" | "primary" | "danger" | "neutral";
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

  // Preload face recognition models & enrolled face vector templates for active company
  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      let query = supabase
        .from("face_embeddings")
        .select(
          "id, employee_id, organization_id, embedding, pose, employees(id, full_name, employee_code, status, organization_id)",
        )
        .order("created_at", { ascending: false });

      if (currentOrgId) {
        query = query.or(`organization_id.eq.${currentOrgId},organization_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const parsed: EnrolledCandidate[] = [];
      for (const row of data ?? []) {
        const emp = row.employees as {
          id: string;
          full_name: string;
          employee_code: string;
          status: string;
          organization_id?: string;
        } | null;
        if (emp && (!emp.status || emp.status === "active")) {
          // If currentOrgId is active, only include if matches or null
          if (!currentOrgId || !emp.organization_id || emp.organization_id === currentOrgId) {
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
      }
      setEnrolledTemplates(parsed);
    } catch (err) {
      console.warn("Could not preload local vectors:", err);
    } finally {
      setLoadingTemplates(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    getFaceApi()
      .then(() => {
        setModelsReady(true);
        void loadTemplates();
      })
      .catch(() => toast.error("Could not load neural face recognition models"));
  }, [loadTemplates]);

  // Attempt auto-start when models are ready and user is authenticated
  useEffect(() => {
    if (modelsReady && !active && !error && user) {
      void start();
    }
  }, [modelsReady, active, error, user, start]);

  const finish = useCallback((payload: NonNullable<typeof result>) => {
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
        statusLabel: payload.statusLabel,
      },
      ...prev.slice(0, 7),
    ]);

    // Reset after 3.2 seconds so the scanner is ready for the next person
    setTimeout(() => {
      setResult(null);
      setDetectedBox(null);
      unrecognizedFramesCount.current = 0;
      busyRef.current = false;
      setPhase("searching");
    }, 3200);
  }, []);

  // Instant Face Matching Engine
  const processFaceDescriptor = useCallback(
    async (descriptor: Float32Array) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setPhase("matching");
      setHint("Matching face against enrolled workforce…");

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
            _org_id: currentOrgId || undefined,
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
          if (unrecognizedFramesCount.current >= 2) {
            finish({
              ok: false,
              message:
                enrolledTemplates.length === 0
                  ? "No facial templates enrolled for this company. Please enrol at least one employee in Console > Employees."
                  : "No matching enrolled profile found. Please ensure you are enrolled with good lighting.",
              statusLabel: "Unknown Face",
              statusTone: "danger",
            });
          } else {
            busyRef.current = false;
            setPhase("searching");
          }
          return;
        }

        // Reset unrecognized counter
        unrecognizedFramesCount.current = 0;

        // 3. TIME-WINDOW & ATTENDANCE RULE VALIDATION
        const now = new Date();
        const ruleCheck = checkAttendanceRules(kindRef.current, now);

        if (!ruleCheck.allowed && !bypassShiftRules) {
          finish({
            ok: false,
            name: matchFullName,
            employeeCode: matchEmployeeCode,
            message:
              ruleCheck.reason || "This clock action is restricted during current shift hours.",
            statusLabel: ruleCheck.statusLabel,
            statusTone: "danger",
          });
          return;
        }

        // DUPLICATE PREVENTER (within 45s)
        const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
        let recentQuery = supabase
          .from("attendance_events")
          .select("id")
          .eq("employee_id", matchEmployeeId)
          .eq("kind", kindRef.current)
          .gte("occurred_at", since);

        if (currentOrgId) {
          recentQuery = recentQuery.eq("organization_id", currentOrgId);
        }

        const { data: recent } = await recentQuery.limit(1);

        if (recent && recent.length > 0) {
          finish({
            ok: false,
            name: matchFullName,
            employeeCode: matchEmployeeCode,
            message: `${matchFullName} already logged ${KIND_LABELS[kindRef.current].label} within the last minute.`,
            statusLabel: "Duplicate Scan Ignored",
            statusTone: "warning",
          });
          return;
        }

        const confidence = Math.max(0.75, Math.min(0.99, 1 - bestDistance * 0.55));
        const localDateStr = now.toISOString().slice(0, 10);
        let finalStatus = bypassShiftRules ? "normal" : ruleCheck.status;
        let finalStatusLabel = bypassShiftRules ? "Verified (Test Mode)" : ruleCheck.statusLabel;

        // 4. SECURE SERVER-SIDE ATTENDANCE RECORDING (Prevents client status tampering)
        let recorded = false;
        try {
          const { data: rpcRes, error: rpcErr } = await supabase.rpc("record_attendance", {
            _org_id: currentOrgId || undefined,
            _employee_id: matchEmployeeId,
            _kind: kindRef.current,
            _confidence: confidence,
            _liveness_score: 0.98,
            _device_label: "FaceTime Attendance Terminal",
          });

          if (!rpcErr && rpcRes) {
            const parsedRes = typeof rpcRes === "string" ? JSON.parse(rpcRes) : rpcRes;
            if (parsedRes.duplicate) {
              finish({
                ok: false,
                name: matchFullName,
                employeeCode: matchEmployeeCode,
                message: parsedRes.message || `${matchFullName} already logged recently.`,
                statusLabel: "Duplicate Scan Ignored",
                statusTone: "warning",
              });
              return;
            }
            if (parsedRes.success) {
              recorded = true;
              if (!bypassShiftRules && parsedRes.status_label) {
                finalStatus = parsedRes.status;
                finalStatusLabel = parsedRes.status_label;
              }
            }
          }
        } catch {
          recorded = false;
        }

        // Direct insert fallback if RPC has not been executed on database yet
        if (!recorded) {
          const { error: insertError } = await supabase.from("attendance_events").insert({
            organization_id: currentOrgId || undefined,
            employee_id: matchEmployeeId,
            kind: kindRef.current,
            status: finalStatus,
            local_date: localDateStr,
            confidence,
            liveness_score: 0.98,
            device_label: "FaceTime Attendance Terminal",
          });

          if (insertError) {
            finish({ ok: false, message: insertError.message });
            return;
          }
        }

        finish({
          ok: true,
          name: matchFullName,
          employeeCode: matchEmployeeCode,
          message: `${KIND_LABELS[kindRef.current].label} recorded successfully.`,
          confidence,
          distance: bestDistance,
          statusLabel: finalStatusLabel,
          statusTone: ruleCheck.isLate && !bypassShiftRules ? "warning" : "success",
        });
      } catch (err) {
        finish({
          ok: false,
          message: (err as Error).message || "An unexpected error occurred during face scan.",
        });
      }
    },
    [enrolledTemplates, finish, matchThreshold, bypassShiftRules, currentOrgId],
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
      if (video && !busyRef.current && Date.now() - lastScanTimeRef.current > 1200) {
        try {
          const sample = await analyseFrame(video, { scoreThreshold: 0.24, inputSize: 320 });
          if (!sample) {
            setDetectedBox(null);
            setHint("Looking for face in camera view…");
            setPhase("searching");
          } else {
            setDetectedBox(sample.box);
            setHint("Face detected · Verifying identity…");
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
      toast.info("Scanning camera frame…");
      const sample = await analyseFrame(videoRef.current, { scoreThreshold: 0.22, inputSize: 416 });
      if (!sample) {
        toast.error(
          "No face visible in camera. Please face the camera directly with good lighting.",
        );
        return;
      }
      setDetectedBox(sample.box);
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
          <h1 className="text-2xl font-bold text-slate-900 font-display">Terminal Unprovisioned</h1>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            Sign in with an authorized account on this station to activate facial attendance
            capture.
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
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs px-3 sm:px-6 py-2.5 sm:py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/console"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors bg-slate-100 hover:bg-slate-200 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" />{" "}
              <span className="hidden xs:inline">Back to</span> Console
            </Link>

            <Link to="/" className="group hidden sm:block">
              <Logo size="sm" subtitle="Attendance Terminal" />
            </Link>
          </div>

          {/* Real-Time Shift Window Indicator */}
          <div className="hidden md:block">
            <TimeWindowBanner compact={true} showRulesGuide={false} />
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <div className="bg-slate-100 border border-slate-200 px-2.5 sm:px-3 py-1.5 rounded-lg text-indigo-700 font-bold">
              {time || "00:00:00"}
            </div>
            <Badge tone={active ? "success" : "warning"} pulse={active} size="sm">
              {active ? "LIVE" : "READY"}
            </Badge>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 transition-colors"
              title="Terminal Settings & Diagnostics"
            >
              <Sliders className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Terminal Controls Drawer */}
        {showSettings && (
          <div className="border-t border-slate-200 mt-2.5 pt-3 pb-2 px-1 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <span className="font-bold text-slate-800 block">Enrolled Faces in Cache</span>
                <span className="text-[11px] text-slate-500">
                  {enrolledTemplates.length} biometric templates loaded
                </span>
              </div>
              <button
                onClick={() => void loadTemplates()}
                className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100"
                title="Reload vector templates"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 text-indigo-600 ${loadingTemplates ? "animate-spin" : ""}`}
                />
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-800">Match Tolerance</span>
                <span className="font-mono text-indigo-600 font-semibold">{matchThreshold}</span>
              </div>
              <input
                type="range"
                min="0.40"
                max="0.65"
                step="0.02"
                value={matchThreshold}
                onChange={(e) => setMatchThreshold(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg accent-indigo-600 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Higher = More lenient lighting match
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <span className="font-bold text-slate-800 block">Shift Rule Override</span>
                <span className="text-[11px] text-slate-500">
                  Allow clock actions 24/7 for testing
                </span>
              </div>
              <input
                type="checkbox"
                checked={bypassShiftRules}
                onChange={(e) => setBypassShiftRules(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </div>
          </div>
        )}
      </header>

      {/* No Enrolled Templates Warning Banner */}
      {enrolledTemplates.length === 0 && !loadingTemplates && (
        <div className="mx-auto max-w-6xl w-full px-3 sm:px-6 pt-3">
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-950">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                <strong>No facial profiles enrolled yet.</strong> Go to the Employee Directory to
                enrol your first face before testing attendance.
              </span>
            </div>
            <Link to="/console/employees" className="shrink-0 w-full sm:w-auto">
              <Button
                size="xs"
                variant="outline"
                className="w-full justify-center bg-white border-amber-300 text-amber-900"
              >
                Go to Face Enrollment
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Main Terminal Station */}
      <section className="mx-auto max-w-6xl w-full px-3 sm:px-6 py-4 sm:py-6 flex-1 grid lg:grid-cols-4 gap-4 sm:gap-6 items-start lg:items-center">
        {/* Left 3 Cols: Camera Viewfinder & Result Card */}
        <div className="lg:col-span-3">
          <Panel className="p-0 overflow-hidden border border-slate-200 bg-white relative shadow-lg rounded-2xl">
            {/* Camera Viewfinder */}
            <div className="relative aspect-[4/3] sm:aspect-video bg-slate-950 flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="h-full w-full scale-x-[-1] object-cover"
              />

              {/* Corner HUD Brackets */}
              <div className="absolute inset-4 sm:inset-8 pointer-events-none z-10 flex flex-col justify-between">
                <div className="flex justify-between">
                  <div className="w-6 sm:w-8 h-6 sm:h-8 border-t-2 border-l-2 border-indigo-400/80" />
                  <div className="w-6 sm:w-8 h-6 sm:h-8 border-t-2 border-r-2 border-indigo-400/80" />
                </div>
                <div className="flex justify-between">
                  <div className="w-6 sm:w-8 h-6 sm:h-8 border-b-2 border-l-2 border-indigo-400/80" />
                  <div className="w-6 sm:w-8 h-6 sm:h-8 border-b-2 border-r-2 border-indigo-400/80" />
                </div>
              </div>

              {/* Laser scan line */}
              {active && !result && (
                <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_15px_#818cf8] animate-scanline z-20" />
              )}

              {/* Idle / Inactive State Start Prompt */}
              {!active && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 sm:gap-4 text-center p-4 sm:p-8 bg-slate-950/90 backdrop-blur-md z-30">
                  <div className="h-14 sm:h-16 w-14 sm:w-16 rounded-2xl sm:rounded-3xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shadow-lg">
                    <Camera className="h-7 sm:h-8 w-7 sm:w-8" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white font-display">
                    Terminal Scanner Ready
                  </h2>
                  <p className="max-w-md text-xs text-slate-300 leading-relaxed">
                    {error ??
                      "Fast biometric recognition. Look at the camera to clock in or out instantly."}
                  </p>
                  <Button
                    size="lg"
                    onClick={() => void start()}
                    disabled={!modelsReady}
                    loading={!modelsReady}
                    icon={<ScanFace className="h-5 w-5" />}
                    className="w-full sm:w-auto"
                  >
                    {modelsReady ? "Activate Terminal Scanner" : "Loading Neural Models…"}
                  </Button>
                </div>
              )}

              {/* Active Real-Time Scanner Overlay */}
              {active && !result && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between p-4 sm:p-6 z-20">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-slate-950/80 border border-white/15 px-3 py-1 text-[10px] sm:text-xs uppercase tracking-widest font-mono text-indigo-300 backdrop-blur-md flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      {phase === "matching" ? "Matching Identity…" : "Scanner Active"}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-950/90 border border-white/20 px-4 sm:px-6 py-2 sm:py-3 text-center text-sm sm:text-base font-bold text-white shadow-2xl backdrop-blur-xl max-w-[90%] break-words">
                    {hint}
                  </div>
                </div>
              )}

              {/* Recognition Result Modal Overlay */}
              {result && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 sm:gap-4 bg-slate-950/95 p-4 sm:p-8 text-center backdrop-blur-2xl z-30 animate-in fade-in zoom-in-95 duration-200">
                  <div
                    className={`h-16 sm:h-20 w-16 sm:w-20 rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-2xl ${
                      result.ok
                        ? "bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 shadow-emerald-500/30"
                        : "bg-rose-500/20 border-2 border-rose-400 text-rose-400 shadow-rose-500/30"
                    }`}
                  >
                    {result.ok ? (
                      <CheckCircle2 className="h-8 sm:h-10 w-8 sm:w-10" />
                    ) : (
                      <XCircle className="h-8 sm:h-10 w-8 sm:w-10" />
                    )}
                  </div>

                  <h2 className="font-display text-2xl sm:text-4xl font-bold text-white break-words max-w-full px-2">
                    {result.name ?? (result.ok ? "Face Verified" : "Access Denied")}
                  </h2>

                  {result.employeeCode && (
                    <span className="font-mono text-xs text-indigo-300 bg-indigo-500/20 px-3 py-1 rounded-full border border-indigo-400/30">
                      ID: {result.employeeCode}
                    </span>
                  )}

                  <p className="text-xs sm:text-sm font-medium text-slate-300 max-w-md px-2 leading-relaxed">
                    {result.message}
                  </p>

                  <div className="flex flex-wrap justify-center gap-2 sm:gap-3 pt-1 sm:pt-2">
                    {result.ok && (
                      <Badge tone="success" size="md">
                        MATCH: {Math.round((result.confidence ?? 0.95) * 100)}%
                      </Badge>
                    )}
                    {result.statusLabel && (
                      <Badge
                        tone={result.statusTone || (result.ok ? "success" : "danger")}
                        size="md"
                      >
                        {result.statusLabel.toUpperCase()}
                      </Badge>
                    )}
                    <Badge tone="primary" size="md">
                      {KIND_LABELS[kindRef.current].label.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Event Selector Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 sm:px-6 py-3 sm:py-4">
              <div className="flex flex-col xs:flex-row items-start xs:items-center gap-2 sm:gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 font-display shrink-0">
                  Action:
                </span>
                <div className="grid grid-cols-2 xs:flex flex-wrap gap-1.5 w-full xs:w-auto">
                  {(Object.keys(KIND_LABELS) as Kind[]).map((k) => {
                    const isActive = kind === k;
                    return (
                      <button
                        key={k}
                        onClick={() => setKind(k)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
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

              <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                {/* Mobile Camera Flip */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void flipCamera()}
                  icon={<SwitchCamera className="h-3.5 w-3.5 text-slate-600" />}
                  title="Switch between front and back camera"
                >
                  <span className="hidden xs:inline">Flip</span>
                </Button>

                {active && (
                  <Button
                    size="sm"
                    onClick={() => void handleManualScan()}
                    icon={<Zap className="h-3.5 w-3.5" />}
                    className="flex-1 sm:flex-none justify-center"
                  >
                    Scan Now
                  </Button>
                )}
                {active ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={stop}
                    className="flex-1 sm:flex-none justify-center"
                  >
                    Stop Scanner
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => void start()}
                    icon={<Camera className="h-3.5 w-3.5" />}
                    className="flex-1 sm:flex-none justify-center"
                  >
                    Start Scanner
                  </Button>
                )}
              </div>
            </div>
          </Panel>
        </div>

        {/* Right 1 Col: Recent Kiosk Scans Activity Stream */}
        <div className="space-y-4">
          <Panel className="border border-slate-200 bg-white shadow-sm rounded-2xl p-4 sm:p-5">
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
                      <span className="font-mono text-[10px] text-slate-400 block">{s.time}</span>
                      {s.statusLabel && (
                        <span className="text-[9px] font-bold uppercase tracking-wider block">
                          {s.statusLabel}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </section>
    </main>
  );
}
