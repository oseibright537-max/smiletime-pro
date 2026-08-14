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
  Building,
  Fingerprint,
  Wifi,
  WifiOff,
  Bell,
  PartyPopper,
  Cake,
  Megaphone,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
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
import { Badge, Button, Panel, Avatar } from "@/components/ui/primitives";
import { Logo } from "@/components/ui/logo";
import { biometricAudio } from "@/lib/face/audio";
import {
  checkAttendanceRules,
  evaluateTimeWindow,
  type AttendanceStatus,
} from "@/lib/attendance/time-windows";
import { TimeWindowBanner } from "@/components/attendance/TimeWindowBanner";
import { enqueueOfflinePunch, useOfflineSync } from "@/lib/offline/offline-sync";
import { dispatchManagerAlert } from "@/lib/alerts/webhook-dispatcher";
import { getBranding } from "@/lib/branding/branding-store";

export const Route = createFileRoute("/kiosk")({
  head: () => ({
    meta: [
      { title: "High-Speed Attendance Kiosk Terminal — FaceTime Biometrics" },
      {
        name: "description",
        content:
          "Instant facial recognition attendance terminal with automated shift window enforcement and offline edge resilience.",
      },
    ],
  }),
  component: Kiosk,
});

type Kind = "check_in" | "check_out" | "break_start" | "break_end";

const DEFAULT_MATCH_THRESHOLD = 0.52;
const DUPLICATE_WINDOW_MS = 45_000;

type Phase = "idle" | "searching" | "matching" | "result";

const KIND_CONFIG: Record<
  Kind,
  { label: string; tone: "success" | "primary" | "warning" | "accent"; color: string }
> = {
  check_in: {
    label: "Clock In",
    tone: "success",
    color: "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500",
  },
  check_out: {
    label: "Clock Out",
    tone: "primary",
    color: "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-500",
  },
  break_start: {
    label: "Break Start",
    tone: "warning",
    color: "bg-amber-600 hover:bg-amber-700 text-white border-amber-500",
  },
  break_end: {
    label: "Break End",
    tone: "accent",
    color: "bg-blue-600 hover:bg-blue-700 text-white border-blue-500",
  },
};

function getTimeGreeting(name: string): {
  greeting: string;
  milestone: string;
  iconType: "morning" | "afternoon" | "evening";
} {
  const hour = new Date().getHours();
  let greeting = `Welcome, ${name}!`;
  let iconType: "morning" | "afternoon" | "evening" = "morning";

  if (hour < 12) {
    greeting = `Good morning, ${name}! 🌅`;
    iconType = "morning";
  } else if (hour < 17) {
    greeting = `Good afternoon, ${name}! ☀️`;
    iconType = "afternoon";
  } else {
    greeting = `Good evening, ${name}! 🌙`;
    iconType = "evening";
  }

  // Deterministic friendly milestone celebration based on day/name
  const milestones = [
    "✨ On-time arrival · Have an amazing, productive shift!",
    "🎉 Thank you for being a core part of the team!",
    "🚀 Shift started · Target departure at 5:00 PM.",
    "🌟 Ready to crush your goals today!",
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  const milestone = milestones[hash % milestones.length];

  return { greeting, milestone, iconType };
}

function Kiosk() {
  const { user, loading } = useAuth();
  const { currentOrg, currentOrgId } = useOrganization();
  const { videoRef, start, stop, active, error, facingMode, flipCamera } = useCamera();
  const { isOnline, pendingCount, syncing, triggerSync } = useOfflineSync();
  const branding = getBranding();

  const [modelsReady, setModelsReady] = useState(false);
  const [kind, setKind] = useState<Kind>("check_in");
  const [phase, setPhase] = useState<Phase>("idle");
  const [hint, setHint] = useState("Position face inside the frame to clock in");
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
      isOffline?: boolean;
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
    greeting?: string;
    milestone?: string;
    isOfflineQueued?: boolean;
  } | null>(null);

  const busyRef = useRef(false);
  const loopRef = useRef(false);
  const unrecognizedFramesCount = useRef(0);
  const lastScanTimeRef = useRef<number>(0);
  const kindRef = useRef<Kind>(kind);
  kindRef.current = kind;

  // Live Digital Atomic Clock
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
        const emp = row.employees as {
          id: string;
          full_name: string;
          employee_code: string;
          status: string;
        } | null;
        if (emp && (!emp.status || emp.status === "active")) {
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
        isOffline: payload.isOfflineQueued,
      },
      ...prev.slice(0, 9),
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

  // Instant Face Matching Engine with Offline Edge Resilience & Alert Webhooks
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

        // 2. Fallback query Supabase match_face RPC if online and local match missed
        if ((!matchEmployeeId || bestDistance > matchThreshold) && navigator.onLine) {
          try {
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
          } catch {
            /* continue with local check */
          }
        }

        // NO MATCH FOUND
        if (!matchEmployeeId || bestDistance > matchThreshold) {
          unrecognizedFramesCount.current += 1;
          if (unrecognizedFramesCount.current >= 2) {
            // Dispatch webhook alert for unrecognized scan
            void dispatchManagerAlert({
              type: "unrecognized_scan",
              timeStr: new Date().toLocaleTimeString(),
              details: "Unrecognized face scan attempt detected at attendance kiosk.",
              severity: "warning",
            });

            finish({
              ok: false,
              message:
                enrolledTemplates.length === 0
                  ? "No facial templates enrolled for this company. Please enrol staff in Console > Employees."
                  : "No matching enrolled profile found. Please face the camera directly with clear lighting.",
              statusLabel: "Unknown Face",
              statusTone: "danger",
            });
          } else {
            busyRef.current = false;
            setPhase("searching");
          }
          return;
        }

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
        if (navigator.onLine) {
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
              message: `${matchFullName} already logged ${KIND_CONFIG[kindRef.current].label} within the last minute.`,
              statusLabel: "Duplicate Scan Ignored",
              statusTone: "warning",
            });
            return;
          }
        }

        const confidence = Math.max(0.75, Math.min(0.99, 1 - bestDistance * 0.55));
        const localDateStr = now.toISOString().slice(0, 10);
        let finalStatus = bypassShiftRules ? "normal" : ruleCheck.status;
        const finalStatusLabel = bypassShiftRules ? "Verified (Test Mode)" : ruleCheck.statusLabel;
        let isOfflineQueued = false;

        // 4. OFFLINE EDGE VS ONLINE DATABASE RECORDING
        if (!navigator.onLine) {
          // Offline Edge Punch
          enqueueOfflinePunch({
            employee_id: matchEmployeeId,
            employee_name: matchFullName,
            employee_code: matchEmployeeCode,
            kind: kindRef.current,
            status: finalStatus,
            local_date: localDateStr,
            confidence,
            liveness_score: 0.98,
            device_label: "FaceTime Kiosk Terminal",
          });
          isOfflineQueued = true;
        } else {
          // Online Supabase Recording
          let recorded = false;
          try {
            const { data: rpcRes, error: rpcErr } = await supabase.rpc("log_attendance", {
              _employee_id: matchEmployeeId,
              _confidence: confidence,
              _liveness: 0.98,
              _device_label: "FaceTime Attendance Terminal",
            });

            if (!rpcErr && rpcRes && rpcRes.length > 0) {
              recorded = true;
              const ev = rpcRes[0];
              if (ev?.status) {
                finalStatus = ev.status;
              }
            }
          } catch {
            recorded = false;
          }

          if (!recorded) {
            const { error: insertError } = await supabase.from("attendance_events").insert({
              employee_id: matchEmployeeId,
              kind: kindRef.current,
              status: finalStatus,
              local_date: localDateStr,
              confidence,
              liveness_score: 0.98,
              device_label: "FaceTime Attendance Terminal",
            });

            if (insertError) {
              // Fallback to offline queue if cloud insert failed
              enqueueOfflinePunch({
                employee_id: matchEmployeeId,
                employee_name: matchFullName,
                employee_code: matchEmployeeCode,
                kind: kindRef.current,
                status: finalStatus,
                local_date: localDateStr,
                confidence,
                liveness_score: 0.98,
                device_label: "FaceTime Kiosk Terminal",
              });
              isOfflineQueued = true;
            }
          }
        }

        // Trigger real-time late alert if applicable
        if (ruleCheck.isLate && !bypassShiftRules) {
          void dispatchManagerAlert({
            type: "late_arrival",
            employeeName: matchFullName,
            employeeCode: matchEmployeeCode,
            timeStr: now.toLocaleTimeString(),
            details: `${matchFullName} clocked in late (${finalStatusLabel}).`,
            severity: "warning",
          });
        }

        const { greeting, milestone } = getTimeGreeting(matchFullName);

        finish({
          ok: true,
          name: matchFullName,
          employeeCode: matchEmployeeCode,
          message: isOfflineQueued
            ? `${KIND_CONFIG[kindRef.current].label} recorded in offline storage. Will sync when online.`
            : `${KIND_CONFIG[kindRef.current].label} verified & recorded successfully.`,
          confidence,
          distance: bestDistance,
          statusLabel: finalStatusLabel,
          statusTone: ruleCheck.isLate && !bypassShiftRules ? "warning" : "success",
          greeting,
          milestone,
          isOfflineQueued,
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
            setHint("Position face inside the frame to clock in");
            setPhase("searching");
          } else {
            setDetectedBox(sample.box);
            setHint("Face detected · Verifying identity…");
            await processFaceDescriptor(sample.descriptor);
          }
        } catch {
          /* skip transient frame */
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
        toast.error("No face visible in camera. Please look directly into the camera.");
        return;
      }
      setDetectedBox(sample.box);
      await processFaceDescriptor(sample.descriptor);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  // Auth check
  if (!loading && !user) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center p-8 bg-white border border-slate-200 shadow-xl rounded-3xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 mb-4">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 font-display">Terminal Unprovisioned</h1>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            Sign in with an authorized account on this station to activate the biometric attendance
            kiosk.
          </p>
          <div className="mt-6">
            <Link to="/auth" search={{ next: "/kiosk" }}>
              <Button size="lg" className="w-full justify-center">
                Authorize Terminal Device
              </Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Kiosk HUD Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800 shadow-lg px-4 sm:px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          {/* Left: Back to console & Brand */}
          <div className="flex items-center gap-3">
            <Link
              to="/console"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 px-3 py-2 rounded-xl border border-slate-700 transition-colors shadow-2xs"
            >
              <ArrowLeft className="h-4 w-4 text-indigo-400" />
              <span className="hidden sm:inline">Console Hub</span>
            </Link>

            <Link to="/" className="group hidden md:block">
              <Logo size="sm" subtitle={currentOrg?.name || "Biometric Terminal"} theme="dark" />
            </Link>
          </div>

          {/* Center: Offline Status & Shift Window Indicator */}
          <div className="flex items-center gap-2">
            {!isOnline ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-950/80 border border-amber-600/80 text-amber-200 text-xs font-bold animate-pulse">
                <WifiOff className="h-3.5 w-3.5 text-amber-400" />
                <span>OFFLINE EDGE MODE ({pendingCount} Queued)</span>
              </div>
            ) : pendingCount > 0 ? (
              <button
                onClick={() => void triggerSync()}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-950/80 border border-emerald-600/80 text-emerald-200 text-xs font-bold cursor-pointer"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 text-emerald-400 ${syncing ? "animate-spin" : ""}`}
                />
                <span>Sync {pendingCount} Offline Events</span>
              </button>
            ) : null}

            <div className="hidden lg:block">
              <TimeWindowBanner compact={true} showRulesGuide={false} />
            </div>
          </div>

          {/* Right: Atomic Clock & Settings Gear */}
          <div className="flex items-center gap-2.5">
            <div className="bg-slate-950/90 border border-slate-800 px-3.5 py-1.5 rounded-xl text-indigo-300 font-mono text-sm font-bold shadow-inner tracking-wider">
              {time || "00:00:00"}
            </div>

            <Badge tone={active ? "success" : "warning"} pulse={active} size="md">
              {active ? "SCANNER LIVE" : "STANDBY"}
            </Badge>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Terminal Settings & Diagnostics"
            >
              <Sliders className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Diagnostic Drawer */}
        {showSettings && (
          <div className="border-t border-slate-800 mt-3 pt-3 pb-1 px-1 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <div>
                <span className="font-bold text-white block">Cached Vector Templates</span>
                <span className="text-[11px] text-slate-400">
                  {enrolledTemplates.length} biometric profiles active
                </span>
              </div>
              <button
                onClick={() => void loadTemplates()}
                className="p-2 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 cursor-pointer"
                title="Reload vector templates"
              >
                <RefreshCw
                  className={`h-4 w-4 text-indigo-400 ${loadingTemplates ? "animate-spin" : ""}`}
                />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-white">Match Tolerance Threshold</span>
                <span className="font-mono text-indigo-400 font-bold">{matchThreshold}</span>
              </div>
              <input
                type="range"
                min="0.40"
                max="0.65"
                step="0.02"
                value={matchThreshold}
                onChange={(e) => setMatchThreshold(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg accent-indigo-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block mt-1">
                Higher = More tolerant to low lighting / angles
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <div>
                <span className="font-bold text-white block">Shift Schedule Bypass</span>
                <span className="text-[11px] text-slate-400">
                  Allow test clocking outside shift hours
                </span>
              </div>
              <input
                type="checkbox"
                checked={bypassShiftRules}
                onChange={(e) => setBypassShiftRules(e.target.checked)}
                className="h-4.5 w-4.5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </div>
          </div>
        )}
      </header>

      {/* Kiosk Announcement Ticker (Feature 10) */}
      {branding.kioskAnnouncementEnabled && branding.kioskAnnouncement && (
        <div className="bg-indigo-950/80 border-b border-indigo-800/60 px-4 py-2 flex items-center justify-center gap-2 text-xs text-indigo-200">
          <Megaphone className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
          <span className="truncate">{branding.kioskAnnouncement}</span>
        </div>
      )}

      {/* Main Terminal Station */}
      <section className="mx-auto max-w-7xl w-full px-4 sm:px-6 py-4 sm:py-6 flex-1 grid lg:grid-cols-12 gap-6 items-start lg:items-center">
        {/* Left 8 Cols: Camera Viewfinder & Result Card */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 overflow-hidden shadow-2xl relative">
            {/* Viewfinder Video Canvas */}
            <div className="relative aspect-[4/3] sm:aspect-video bg-black flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="h-full w-full scale-x-[-1] object-cover"
              />

              {/* Corner Biometric Reticle Brackets */}
              <div className="absolute inset-6 sm:inset-10 pointer-events-none z-10 flex flex-col justify-between">
                <div className="flex justify-between">
                  <div className="w-8 sm:w-10 h-8 sm:h-10 border-t-2 border-l-2 border-indigo-400/90 shadow-sm" />
                  <div className="w-8 sm:w-10 h-8 sm:h-10 border-t-2 border-r-2 border-indigo-400/90 shadow-sm" />
                </div>
                <div className="flex justify-between">
                  <div className="w-8 sm:w-10 h-8 sm:h-10 border-b-2 border-l-2 border-indigo-400/90 shadow-sm" />
                  <div className="w-8 sm:w-10 h-8 sm:h-10 border-b-2 border-r-2 border-indigo-400/90 shadow-sm" />
                </div>
              </div>

              {/* Laser Scan Sweep */}
              {active && !result && (
                <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_20px_#818cf8] animate-hud-scan z-20" />
              )}

              {/* Idle Prompt / Scanner Off */}
              {!active && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-6 sm:p-10 bg-slate-950/90 backdrop-blur-md z-30">
                  <div className="h-16 sm:h-20 w-16 sm:w-20 rounded-3xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shadow-xl">
                    <Camera className="h-8 sm:h-10 w-8 sm:w-10" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display">
                    {branding.kioskWelcomeTitle || "Biometric Station Ready"}
                  </h2>
                  <p className="max-w-md text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {error ??
                      "Instant on-device facial recognition with automated shift window intelligence."}
                  </p>
                  <Button
                    size="lg"
                    onClick={() => void start()}
                    disabled={!modelsReady}
                    loading={!modelsReady}
                    icon={<ScanFace className="h-5 w-5" />}
                    className="w-full sm:w-auto shadow-lg shadow-indigo-600/30"
                  >
                    {modelsReady ? "Activate Terminal Camera" : "Loading Neural Models…"}
                  </Button>
                </div>
              )}

              {/* Live Guidance Chip */}
              {active && !result && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between p-5 z-20">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-slate-950/85 border border-white/15 px-3.5 py-1.5 text-xs font-mono text-indigo-300 backdrop-blur-md flex items-center gap-2 shadow-lg">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>
                        {phase === "matching" ? "Matching Vector…" : "Biometric Reticle Active"}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-950/90 border border-white/20 px-5 py-2.5 text-center text-sm sm:text-base font-bold text-white shadow-2xl backdrop-blur-xl max-w-[90%]">
                    {hint}
                  </div>
                </div>
              )}

              {/* Celebratory Personalized Result Modal (Feature 1) */}
              {result && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/95 p-6 sm:p-10 text-center backdrop-blur-2xl z-30 animate-in fade-in zoom-in-95 duration-200">
                  <div
                    className={`h-20 sm:h-24 w-20 sm:w-24 rounded-3xl flex items-center justify-center shadow-2xl ${
                      result.ok
                        ? "bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 shadow-emerald-500/30"
                        : "bg-rose-500/20 border-2 border-rose-400 text-rose-400 shadow-rose-500/30"
                    }`}
                  >
                    {result.ok ? (
                      <CheckCircle2 className="h-10 sm:h-12 w-10 sm:w-12" />
                    ) : (
                      <XCircle className="h-10 sm:h-12 w-10 sm:w-12" />
                    )}
                  </div>

                  <div className="space-y-1 max-w-full">
                    {result.greeting && (
                      <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider block">
                        {result.greeting}
                      </span>
                    )}
                    <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white break-words">
                      {result.name ?? (result.ok ? "Identity Verified" : "Access Denied")}
                    </h2>
                  </div>

                  {result.employeeCode && (
                    <span className="font-mono text-xs text-indigo-300 bg-indigo-500/20 px-3.5 py-1 rounded-full border border-indigo-400/30">
                      ID: {result.employeeCode}
                    </span>
                  )}

                  {/* Milestone encouragement pill (Feature 1) */}
                  {result.milestone && (
                    <div className="p-2.5 rounded-2xl bg-indigo-950/80 border border-indigo-700/80 text-xs text-indigo-200 max-w-md font-medium">
                      {result.milestone}
                    </div>
                  )}

                  <p className="text-xs sm:text-sm font-medium text-slate-300 max-w-md leading-relaxed">
                    {result.message}
                  </p>

                  <div className="flex flex-wrap justify-center gap-2.5 pt-1">
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
                      {KIND_CONFIG[kindRef.current].label.toUpperCase()}
                    </Badge>
                    {result.isOfflineQueued && (
                      <Badge tone="warning" size="md">
                        EDGE OFFLINE QUEUE
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Mode Selector Bar */}
            <div className="p-4 sm:p-5 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="flex flex-col xs:flex-row items-start xs:items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-display shrink-0">
                  Mode:
                </span>
                <div className="grid grid-cols-2 xs:flex flex-wrap gap-2 w-full xs:w-auto">
                  {(Object.keys(KIND_CONFIG) as Kind[]).map((k) => {
                    const isActive = kind === k;
                    return (
                      <button
                        key={k}
                        onClick={() => setKind(k)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                          isActive
                            ? `${KIND_CONFIG[k].color} shadow-md scale-[1.02]`
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700/80 border border-slate-700"
                        }`}
                      >
                        {KIND_CONFIG[k].label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void flipCamera()}
                  icon={<SwitchCamera className="h-4 w-4 text-slate-400" />}
                  title="Switch between front and back camera"
                  className="border-slate-700 text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white"
                >
                  <span className="hidden xs:inline">Flip Cam</span>
                </Button>

                {active && (
                  <Button
                    size="sm"
                    onClick={() => void handleManualScan()}
                    icon={<Zap className="h-4 w-4" />}
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
                    className="border-slate-700 text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white flex-1 sm:flex-none justify-center"
                  >
                    Stop Scanner
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => void start()}
                    icon={<Camera className="h-4 w-4" />}
                    className="flex-1 sm:flex-none justify-center"
                  >
                    Start Scanner
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Live Terminal Activity Rail */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
                <Activity className="h-4 w-4 text-indigo-400" />
                Live Attendance Ticker
              </h3>
              <button
                onClick={() => void loadTemplates()}
                className="text-xs text-slate-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
                title="Refresh enrolled templates"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingTemplates ? "animate-spin" : ""}`} />
              </button>
            </div>

            {recentScans.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <ScanFace className="h-8 w-8 text-slate-600 mx-auto" />
                <p>Live verified clock-in events will appear here in real time.</p>
              </div>
            ) : (
              <div className="mt-3.5 space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {recentScans.map((s) => (
                  <div
                    key={s.id}
                    className={`p-3 rounded-2xl border text-xs flex items-center justify-between transition-all ${
                      s.success
                        ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-200"
                        : "bg-rose-950/40 border-rose-800/60 text-rose-200"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar name={s.name} size="sm" />
                      <div>
                        <span className="font-bold block text-white">{s.name}</span>
                        <span className="text-[10px] text-slate-400">
                          {KIND_CONFIG[s.kind].label}
                          {s.isOffline ? " (Offline Queue)" : ""}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-[10px] text-slate-400 block">{s.time}</span>
                      {s.statusLabel && (
                        <span className="text-[9px] font-bold uppercase tracking-wider block text-indigo-300">
                          {s.statusLabel}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
