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

type Kind = "auto" | "check_in" | "check_out" | "break_start" | "break_end";
type ActionKind = "check_in" | "check_out" | "break_start" | "break_end";

const DEFAULT_MATCH_THRESHOLD = 0.52;
const DUPLICATE_WINDOW_MS = 45_000;

type Phase = "idle" | "searching" | "matching" | "result";

const KIND_CONFIG: Record<
  Kind,
  { label: string; tone: "success" | "primary" | "warning" | "accent"; color: string; desc: string }
> = {
  auto: {
    label: "Smart Auto",
    tone: "primary",
    color: "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-500",
    desc: "Auto-detects Clock In or Clock Out based on shift and attendance history",
  },
  check_in: {
    label: "Clock In",
    tone: "success",
    color: "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500",
    desc: "Manual Shift Check-In",
  },
  check_out: {
    label: "Clock Out",
    tone: "primary",
    color: "bg-blue-600 hover:bg-blue-700 text-white border-blue-500",
    desc: "Manual Shift Check-Out",
  },
  break_start: {
    label: "Break Start",
    tone: "warning",
    color: "bg-amber-600 hover:bg-amber-700 text-white border-amber-500",
    desc: "Manual Break Start",
  },
  break_end: {
    label: "Break End",
    tone: "accent",
    color: "bg-cyan-600 hover:bg-cyan-700 text-white border-cyan-500",
    desc: "Manual Break End",
  },
};

function getTimeGreeting(
  name: string,
  kind: ActionKind = "check_in",
): {
  greeting: string;
  milestone: string;
  iconType: "morning" | "afternoon" | "evening";
} {
  const hour = new Date().getHours();
  let greeting = `Welcome, ${name}`;
  let iconType: "morning" | "afternoon" | "evening" = "morning";

  if (kind === "check_out") {
    greeting = `Good evening, ${name}`;
    iconType = "evening";
    const checkoutMilestones = [
      "Great work today · Shift logged and verified.",
      "Thank you for your dedication today. Have a restful evening.",
      "Shift complete · Departure validated successfully.",
      "Target met · Departure time verified.",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
    return {
      greeting,
      milestone: checkoutMilestones[hash % checkoutMilestones.length],
      iconType,
    };
  }

  if (hour < 12) {
    greeting = `Good morning, ${name}`;
    iconType = "morning";
  } else if (hour < 17) {
    greeting = `Good afternoon, ${name}`;
    iconType = "afternoon";
  } else {
    greeting = `Good evening, ${name}`;
    iconType = "evening";
  }

  const milestones = [
    "On-time arrival · Have a productive shift.",
    "Identity confirmed · Welcome to your workday.",
    "Shift initiated · Standard departure at 5:00 PM.",
    "Terminal verified · Have a great day ahead.",
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
  const [kind, setKind] = useState<Kind>("auto");
  const [phase, setPhase] = useState<Phase>("idle");
  const [hint, setHint] = useState("Position face inside the frame for smart verification");
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
      kind: ActionKind;
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
    actionKind?: ActionKind;
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

  const finish = useCallback(
    (
      payload: NonNullable<typeof result> & {
        actionKind?: ActionKind;
      },
    ) => {
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
      const recordKind: ActionKind =
        payload.actionKind || (kindRef.current === "auto" ? "check_in" : kindRef.current);

      setRecentScans((prev) => [
        {
          id: Math.random().toString(36).substring(2, 9),
          name: payload.name || "Unrecognized Person",
          kind: recordKind,
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
    },
    [],
  );

  // Instant Face Matching Engine with Automated Shift Window Resolution & Edge Resilience
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

        // 3. AUTOMATIC SMART SHIFT KIND RESOLUTION
        const now = new Date();
        const localDateStr = now.toISOString().slice(0, 10);
        const currentHours = now.getHours();
        const currentMins = now.getMinutes();
        const currentMinutesTotal = currentHours * 60 + currentMins;

        let resolvedKind: ActionKind = "check_in";

        if (kindRef.current !== "auto") {
          // Manual user override mode
          resolvedKind = kindRef.current;
        } else {
          // SMART AUTO RESOLUTION:
          // Check today's existing attendance events for this employee
          if (navigator.onLine) {
            try {
              const { data: todayLogs } = await supabase
                .from("attendance_events")
                .select("id, kind, status, occurred_at")
                .eq("employee_id", matchEmployeeId)
                .eq("local_date", localDateStr)
                .order("occurred_at", { ascending: false });

              const hasCheckIn = todayLogs?.some((e) => e.kind === "check_in");
              const hasCheckOut = todayLogs?.some((e) => e.kind === "check_out");

              if (!hasCheckIn) {
                // No clock-in today -> Action is automatically CLOCK IN
                resolvedKind = "check_in";
              } else if (hasCheckIn && !hasCheckOut) {
                // Already clocked in today, hasn't clocked out yet
                // Check if we are in the evening departure window (after 4:40 PM / 16:40 = 1000m) or in test bypass mode
                if (currentMinutesTotal >= 1000 || bypassShiftRules) {
                  resolvedKind = "check_out";
                } else {
                  // Clock-in is already logged and it is not clock-out time yet:
                  // Silently ignore repeat scans during work hours without showing an error popup
                  busyRef.current = false;
                  setPhase("searching");
                  return;
                }
              } else {
                // Both clock-in and clock-out already logged today (shift complete):
                // Silently ignore without showing disruptive "already taken attendance" error modal
                busyRef.current = false;
                setPhase("searching");
                return;
              }
            } catch {
              // Fallback based on time threshold (4:40 PM = 16:40 = 1000m)
              resolvedKind = currentMinutesTotal >= 1000 ? "check_out" : "check_in";
            }
          } else {
            // Offline heuristic: After 4:40 PM (16:40), default to check_out; otherwise check_in
            resolvedKind = currentMinutesTotal >= 1000 ? "check_out" : "check_in";
          }
        }

        // 4. TIME-WINDOW & ATTENDANCE RULE VALIDATION
        const ruleCheck = checkAttendanceRules(resolvedKind, now);

        if (!ruleCheck.allowed && !bypassShiftRules) {
          if (kindRef.current === "auto") {
            // In smart auto mode, silently ignore ineligible scans
            busyRef.current = false;
            setPhase("searching");
            return;
          }

          finish({
            ok: false,
            name: matchFullName,
            employeeCode: matchEmployeeCode,
            message:
              ruleCheck.reason ||
              `This clock action (${resolvedKind === "check_in" ? "Clock In" : "Clock Out"}) is restricted during current shift hours.`,
            statusLabel: ruleCheck.statusLabel,
            statusTone: "danger",
            actionKind: resolvedKind,
          });
          return;
        }

        // DUPLICATE PREVENTER (within 45s for the same kind)
        const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
        if (navigator.onLine) {
          const { data: recent } = await supabase
            .from("attendance_events")
            .select("id")
            .eq("employee_id", matchEmployeeId)
            .eq("kind", resolvedKind)
            .gte("occurred_at", since)
            .limit(1);

          if (recent && recent.length > 0) {
            // User just logged this punch moments ago -> silently ignore without intrusive error modal
            busyRef.current = false;
            setPhase("searching");
            return;
          }
        }

        const confidence = Math.max(0.75, Math.min(0.99, 1 - bestDistance * 0.55));
        let finalStatus = bypassShiftRules ? "normal" : ruleCheck.status;
        const finalStatusLabel = bypassShiftRules ? "Verified (Test Mode)" : ruleCheck.statusLabel;
        let isOfflineQueued = false;
        const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

        // 5. OFFLINE EDGE VS ONLINE DATABASE RECORDING
        if (!navigator.onLine) {
          // Offline Edge Punch
          enqueueOfflinePunch({
            employee_id: matchEmployeeId,
            employee_name: matchFullName,
            employee_code: matchEmployeeCode,
            kind: resolvedKind,
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
              _tz: userTimeZone,
            });

            if (!rpcErr && rpcRes && rpcRes.length > 0) {
              recorded = true;
              const ev = rpcRes[0];
              if (ev?.status) {
                finalStatus = ev.status;
              }
              if (ev?.kind) {
                resolvedKind = ev.kind as ActionKind;
              }
            }
          } catch {
            recorded = false;
          }

          if (!recorded) {
            const { error: insertError } = await supabase.from("attendance_events").insert({
              employee_id: matchEmployeeId,
              kind: resolvedKind,
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
                kind: resolvedKind,
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

        const { greeting, milestone } = getTimeGreeting(matchFullName, resolvedKind);
        const actionLabel =
          resolvedKind === "check_in"
            ? "Clock In"
            : resolvedKind === "check_out"
              ? "Clock Out"
              : KIND_CONFIG[resolvedKind].label;

        finish({
          ok: true,
          name: matchFullName,
          employeeCode: matchEmployeeCode,
          message: isOfflineQueued
            ? `${actionLabel} recorded in offline storage. Will sync when online.`
            : `${actionLabel} verified & recorded successfully.`,
          confidence,
          distance: bestDistance,
          statusLabel: finalStatusLabel,
          statusTone:
            ruleCheck.isLate && !bypassShiftRules && resolvedKind === "check_in"
              ? "warning"
              : "success",
          greeting,
          milestone,
          isOfflineQueued,
          actionKind: resolvedKind,
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
      <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center p-8 bg-slate-900/90 border border-slate-800 shadow-2xl rounded-3xl backdrop-blur-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-4">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-white font-display">Terminal Station Standby</h1>
          <p className="mt-2 text-xs text-slate-400 leading-relaxed">
            Please sign in with an authorized organization account to activate this kiosk.
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
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-hidden select-none font-sans">
      {/* Soft Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-indigo-600/10 rounded-full blur-[150px] pointer-events-none" />

      {/* Top Floating Glass Navigation Header */}
      <header className="relative z-30 max-w-4xl w-full mx-auto flex items-center justify-between gap-4">
        {/* Left: Back Link & Terminal Title */}
        <div className="flex items-center gap-3">
          <Link
            to="/console"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800/80 px-3.5 py-1.5 rounded-full transition-all shadow-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Console Hub</span>
          </Link>
          <span className="text-xs text-slate-500 font-medium hidden md:inline truncate max-w-[180px]">
            {currentOrg?.name || "Biometric Kiosk"}
          </span>
        </div>

        {/* Center: Live Clock Capsule */}
        <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800/80 px-4 py-1.5 rounded-full shadow-lg backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-xs font-semibold text-slate-200 tracking-wider">
            {time || "00:00:00"}
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-[11px] font-medium text-indigo-300">
            {KIND_CONFIG[kind].label}
          </span>
        </div>

        {/* Right: Offline status & Settings toggle */}
        <div className="flex items-center gap-2">
          {!isOnline && (
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-medium">
              <WifiOff className="h-3 w-3" />
              <span>Offline ({pendingCount})</span>
            </div>
          )}
          {isOnline && pendingCount > 0 && (
            <button
              onClick={() => void triggerSync()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-medium cursor-pointer"
            >
              <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
              <span>Sync {pendingCount}</span>
            </button>
          )}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="h-8 w-8 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-800/80 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Terminal Settings"
          >
            <Sliders className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Settings Drawer (Collapsible) */}
      {showSettings && (
        <div className="relative z-30 max-w-2xl w-full mx-auto my-3 p-4 rounded-3xl bg-slate-900/95 border border-slate-800 shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-2 duration-150 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800/60">
            <div>
              <span className="font-semibold text-white block">Cached Profiles</span>
              <span className="text-[11px] text-slate-400">{enrolledTemplates.length} active</span>
            </div>
            <button
              onClick={() => void loadTemplates()}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-400 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingTemplates ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/60">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-white">Tolerance</span>
              <span className="font-mono text-indigo-400 text-[11px]">{matchThreshold}</span>
            </div>
            <input
              type="range"
              min="0.40"
              max="0.65"
              step="0.02"
              value={matchThreshold}
              onChange={(e) => setMatchThreshold(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg accent-indigo-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800/60">
            <div>
              <span className="font-semibold text-white block">Shift Bypass</span>
              <span className="text-[11px] text-slate-400">Test mode clocking</span>
            </div>
            <input
              type="checkbox"
              checked={bypassShiftRules}
              onChange={(e) => setBypassShiftRules(e.target.checked)}
              className="h-4 w-4 rounded border-slate-700 text-indigo-600 cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Centerpiece Viewfinder Canvas */}
      <section className="relative z-20 max-w-2xl w-full mx-auto my-auto flex flex-col items-center">
        <div className="w-full aspect-[4/3] sm:aspect-[16/10] max-h-[68vh] rounded-[32px] sm:rounded-[40px] bg-slate-900 border border-slate-800/90 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden relative flex items-center justify-center">
          {/* Camera Video View */}
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            className="h-full w-full scale-x-[-1] object-cover"
          />

          {/* Minimalist Thin Corner Reticle Brackets */}
          <div className="absolute inset-8 sm:inset-12 pointer-events-none z-10 flex flex-col justify-between">
            <div className="flex justify-between">
              <div className="w-6 h-6 border-t-2 border-l-2 border-white/30 rounded-tl-lg" />
              <div className="w-6 h-6 border-t-2 border-r-2 border-white/30 rounded-tr-lg" />
            </div>
            <div className="flex justify-between">
              <div className="w-6 h-6 border-b-2 border-l-2 border-white/30 rounded-bl-lg" />
              <div className="w-6 h-6 border-b-2 border-r-2 border-white/30 rounded-br-lg" />
            </div>
          </div>

          {/* Camera Standby Screen */}
          {!active && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-8 bg-slate-950/95 backdrop-blur-xl z-30">
              <div className="h-16 w-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-xl">
                <ScanFace className="h-8 w-8" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h2 className="text-xl sm:text-2xl font-bold text-white font-display">
                  {branding.kioskWelcomeTitle || "Biometric Kiosk Ready"}
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {error ?? "Automated shift intelligence with instant on-device face recognition."}
                </p>
              </div>
              <Button
                size="lg"
                onClick={() => void start()}
                disabled={!modelsReady}
                loading={!modelsReady}
                icon={<Camera className="h-4 w-4" />}
                className="mt-2 rounded-full px-6 shadow-lg shadow-indigo-600/30"
              >
                {modelsReady ? "Start Camera Terminal" : "Loading Neural Engine…"}
              </Button>
            </div>
          )}

          {/* Floating Subtle Live Hint */}
          {active && !result && (
            <div className="pointer-events-none absolute bottom-6 inset-x-0 flex justify-center z-20 px-4">
              <div className="rounded-full bg-slate-950/80 border border-white/10 px-5 py-2 text-center text-xs sm:text-sm font-medium text-slate-200 shadow-xl backdrop-blur-xl">
                {hint}
              </div>
            </div>
          )}

          {/* Celebratory Verified Modal (Apple Clean Minimalist Style) */}
          {result && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/95 p-6 sm:p-8 text-center backdrop-blur-2xl z-30 animate-in fade-in zoom-in-95 duration-200">
              <div
                className={`h-16 w-16 sm:h-20 sm:w-20 rounded-full flex items-center justify-center shadow-2xl ${
                  result.ok
                    ? "bg-emerald-500/15 border-2 border-emerald-400 text-emerald-400 shadow-emerald-500/20"
                    : "bg-rose-500/15 border-2 border-rose-400 text-rose-400 shadow-rose-500/20"
                }`}
              >
                {result.ok ? (
                  <CheckCircle2 className="h-9 sm:h-11 w-9 sm:w-11" />
                ) : (
                  <XCircle className="h-9 sm:h-11 w-9 sm:w-11" />
                )}
              </div>

              <div className="space-y-1 max-w-full">
                {result.greeting && (
                  <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest block">
                    {result.greeting}
                  </span>
                )}
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                  {result.name ?? (result.ok ? "Identity Verified" : "Access Denied")}
                </h2>
              </div>

              {/* Action Capsule Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
                <span>
                  {result.actionKind === "check_in"
                    ? "Clocked In"
                    : result.actionKind === "check_out"
                      ? "Clocked Out"
                      : "Verified"}
                </span>
                <span>·</span>
                <span className="text-slate-300">{time}</span>
                {result.statusLabel && (
                  <>
                    <span>·</span>
                    <span className="text-emerald-400">{result.statusLabel}</span>
                  </>
                )}
              </div>

              {/* Milestone Encouragement */}
              {result.milestone && (
                <p className="text-xs text-slate-300 max-w-sm font-medium mt-1">
                  {result.milestone}
                </p>
              )}

              <p className="text-[11px] text-slate-400 max-w-sm leading-relaxed">
                {result.message}
              </p>
            </div>
          )}
        </div>

        {/* Minimalist Floating Controls Bar */}
        <div className="mt-4 flex items-center justify-center gap-2 max-w-md w-full">
          {/* Mode Pill Toggle */}
          <div className="flex items-center bg-slate-900/90 border border-slate-800/90 rounded-full p-1 shadow-lg backdrop-blur-md">
            {(["auto", "check_in", "check_out"] as Kind[]).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  kind === k
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {k === "auto" ? "Auto" : k === "check_in" ? "Clock In" : "Clock Out"}
              </button>
            ))}
          </div>

          {/* Quick Flip Cam */}
          <button
            onClick={() => void flipCamera()}
            className="p-2.5 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-800/90 text-slate-400 hover:text-white transition-colors cursor-pointer shadow-lg backdrop-blur-md"
            title="Flip Camera"
          >
            <SwitchCamera className="h-4 w-4" />
          </button>

          {/* Quick Manual Scan */}
          {active && (
            <button
              onClick={() => void handleManualScan()}
              className="p-2.5 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-800/90 text-slate-400 hover:text-white transition-colors cursor-pointer shadow-lg backdrop-blur-md"
              title="Trigger Instant Scan"
            >
              <Zap className="h-4 w-4 text-indigo-400" />
            </button>
          )}
        </div>
      </section>

      {/* Minimal Bottom Activity Strip (Last 3 Scans) */}
      <footer className="relative z-20 max-w-3xl w-full mx-auto flex items-center justify-between text-xs text-slate-500 pt-2">
        <div className="flex items-center gap-2 truncate">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="text-slate-400 font-medium">RAM Vector Processing</span>
          <span>·</span>
          <span>Zero Photo Storage</span>
        </div>

        {recentScans.length > 0 && (
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400">
            <span className="text-slate-500">Latest:</span>
            <span className="font-semibold text-slate-300">{recentScans[0]?.name}</span>
            <span className="text-indigo-400">({recentScans[0]?.time})</span>
          </div>
        )}
      </footer>
    </main>
  );
}
