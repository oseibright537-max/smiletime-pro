import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Loader2,
  ShieldCheck,
  ScanFace,
  ArrowLeft,
  Eye,
  Sparkles,
  Zap,
  Camera,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCamera } from "@/hooks/useCamera";
import { analyseAllFaces, getFaceApi, toVectorLiteral } from "@/lib/face/engine";
import { ANGLES, EnrolmentSession, TOTAL_TARGET, type AngleKey } from "@/lib/face/capture";
import { Badge, Button, Panel } from "@/components/ui/primitives";

export const Route = createFileRoute("/console/enroll/$employeeId")({ component: Enroll });

function Enroll() {
  const { employeeId } = useParams({ from: "/console/enroll/$employeeId" });
  const navigate = useNavigate();
  const { videoRef, start, stop, active, error } = useCamera();
  const [modelsReady, setModelsReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hint, setHint] = useState("Position face inside the biometric reticle");
  const [accepted, setAccepted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [captured, setCaptured] = useState(0);
  const [quality, setQuality] = useState(0);
  const [counts, setCounts] = useState<Record<AngleKey, number>>({
    front: 0,
    left: 0,
    right: 0,
    up: 0,
    down: 0,
  });
  const [activeAngle, setActiveAngle] = useState<AngleKey | null>("front");
  const [elapsed, setElapsed] = useState(0);

  const sessionRef = useRef(new EnrolmentSession());
  const loopRef = useRef(false);
  const doneRef = useRef(false);

  const employee = useQuery({
    queryKey: ["employee", employeeId],
    queryFn: async () =>
      (
        await supabase
          .from("employees")
          .select("id,full_name,employee_code,job_title")
          .eq("id", employeeId)
          .single()
      ).data,
  });

  useEffect(() => {
    getFaceApi()
      .then(() => setModelsReady(true))
      .catch(() => toast.error("Could not load the recognition models"));
  }, []);

  const persist = useCallback(async () => {
    const session = sessionRef.current;
    setSaving(true);
    setElapsed(Math.round(session.elapsedMs / 100) / 10);
    try {
      const rows = session.templates().map((t) => ({
        employee_id: employeeId,
        pose: t.pose,
        quality: t.quality,
        embedding: toVectorLiteral(t.descriptor) as unknown as string,
      }));
      if (rows.length === 0) throw new Error("No usable frames were captured");

      await supabase.from("face_embeddings").delete().eq("employee_id", employeeId);
      const { error: insertError } = await supabase.from("face_embeddings").insert(rows);
      if (insertError) throw insertError;

      toast.success("Enrolment complete — 5-angle vectors saved successfully");
      stop();
      navigate({ to: "/console/employees" });
    } catch (e) {
      doneRef.current = false;
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [employeeId, navigate, stop]);

  // Continuous analysis loop
  useEffect(() => {
    if (!active || !modelsReady) return;
    loopRef.current = true;
    let raf = 0;

    const tick = async () => {
      if (!loopRef.current) return;
      const video = videoRef.current;
      if (video && !doneRef.current) {
        try {
          const samples = await analyseAllFaces(video);
          const fb = sessionRef.current.push(video, samples);
          setHint(fb.message);
          setAccepted(fb.accepted);
          setProgress(fb.progress);
          setCaptured(fb.captured);
          setActiveAngle(fb.activeAngle);
          setCounts(sessionRef.current.counts);
          if (fb.quality) setQuality(fb.quality);

          if (sessionRef.current.complete && !doneRef.current) {
            doneRef.current = true;
            loopRef.current = false;
            void persist();
            return;
          }
        } catch {
          /* transient frame error */
        }
      }
      raf = requestAnimationFrame(() => void tick());
    };

    void tick();
    return () => {
      loopRef.current = false;
      cancelAnimationFrame(raf);
    };
  }, [active, modelsReady, persist, videoRef]);

  const ring = 2 * Math.PI * 46;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Breadcrumb Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-white/10">
        <div>
          <Link
            to="/console/employees"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Employee Directory
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight text-white font-display flex items-center gap-2">
            <ScanFace className="h-6 w-6 text-sky-400" />
            Biometric Face Enrolment
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {employee.data ? (
              <span className="text-sky-300 font-medium">
                {employee.data.full_name} · {employee.data.employee_code} (
                {employee.data.job_title || "Staff"})
              </span>
            ) : (
              "Loading employee credentials…"
            )}
          </p>
        </div>

        <Badge tone="primary" size="md">
          5-ANGLE CALIBRATION
        </Badge>
      </div>

      {/* Main Enrolment Workstation */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Interactive Viewfinder */}
        <div className="lg:col-span-8">
          <Panel className="p-0 overflow-hidden border border-white/15 relative bg-slate-950 shadow-2xl">
            <div className="relative aspect-video bg-slate-950 flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                aria-label="Live camera preview for face enrolment"
                className="h-full w-full scale-x-[-1] object-cover"
              />

              {/* HUD Corner Tech Brackets */}
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

              {/* Laser Scanline */}
              {active && (
                <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-sky-400 to-transparent shadow-[0_0_15px_#38bdf8] animate-scanline z-20" />
              )}

              {/* Face Guide Ring with Animated Capture Progress */}
              {active && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
                  <svg viewBox="0 0 100 100" className="h-[78%] max-h-full" aria-hidden="true">
                    <circle
                      cx="50"
                      cy="50"
                      r="46"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className={accepted ? "text-emerald-400/60" : "text-slate-600/40"}
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="46"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      className="text-sky-400 transition-[stroke-dashoffset] duration-200"
                      strokeDasharray={ring}
                      strokeDashoffset={ring * (1 - progress)}
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                </div>
              )}

              {/* Inactive State Start Screen */}
              {!active && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-8 bg-slate-950/90 backdrop-blur-sm z-30">
                  <div className="h-16 w-16 rounded-3xl bg-sky-500/10 border border-sky-400/30 flex items-center justify-center text-sky-400 shadow-lg shadow-sky-500/20">
                    <Camera className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold text-white font-display">
                    Ready to Calibrate Facial Angles
                  </h3>
                  <p className="max-w-md text-xs text-muted-foreground leading-relaxed">
                    {error ??
                      "Frames are analysed entirely on this device and discarded immediately. Only the irreversible mathematical vectors are stored."}
                  </p>
                  <Button
                    size="lg"
                    onClick={() => void start()}
                    disabled={!modelsReady}
                    loading={!modelsReady}
                    icon={<ScanFace className="h-5 w-5" />}
                  >
                    {modelsReady ? "Start Camera Enrolment" : "Loading Neural Models…"}
                  </Button>
                </div>
              )}

              {/* Active Bottom Floating Feedback */}
              {active && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-6 z-20">
                  <div
                    role="status"
                    aria-live="polite"
                    className={`rounded-full px-6 py-2.5 text-sm font-semibold backdrop-blur-xl border shadow-xl transition-all ${
                      accepted
                        ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/40"
                        : "bg-slate-950/90 text-white border-white/20"
                    }`}
                  >
                    {hint}
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono text-slate-300 bg-black/60 px-3 py-1 rounded-full border border-white/10 backdrop-blur-md">
                    <span>
                      {captured}/{TOTAL_TARGET} FRAMES
                    </span>
                    <span>·</span>
                    <span className="text-sky-300">QUALITY: {Math.round(quality * 100)}%</span>
                  </div>
                </div>
              )}
            </div>
          </Panel>
        </div>

        {/* Right: Angle Checklist & Telemetry Panel */}
        <div className="lg:col-span-4 space-y-4">
          <Panel className="border border-white/10">
            <h2 className="text-base font-bold text-white font-display flex items-center justify-between">
              <span>Pose Calibration</span>
              <span className="text-xs font-mono text-sky-400">
                {Math.round(progress * 100)}% COMPLETE
              </span>
            </h2>

            <ol className="mt-4 space-y-2.5">
              {ANGLES.map((a) => {
                const n = counts[a.key];
                const complete = n >= a.target;
                const current = a.key === activeAngle;
                return (
                  <li
                    key={a.key}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      complete
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : current
                          ? "bg-sky-500/10 border-sky-400/50 text-white shadow-md shadow-sky-500/10"
                          : "bg-white/5 border-white/5 text-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                          complete
                            ? "bg-emerald-400 text-slate-950"
                            : current
                              ? "bg-sky-400 text-slate-950"
                              : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {complete ? <Check className="h-4 w-4" /> : n}
                      </span>
                      <span
                        className={`text-sm font-medium ${complete ? "line-through opacity-80" : ""}`}
                      >
                        {a.label}
                      </span>
                    </div>
                    <span className="font-mono text-xs">
                      {Math.min(n, a.target)}/{a.target}
                    </span>
                  </li>
                );
              })}
            </ol>

            {/* Quality Gauge Bar */}
            <div className="mt-6 pt-4 border-t border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Optical Frame Quality</span>
                <span className="font-mono text-sky-400 font-semibold">
                  {Math.round(quality * 100)}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round(quality * 100)}%` }}
                />
              </div>
            </div>

            {/* Privacy Assurance Note */}
            <div className="mt-6 p-3 rounded-xl bg-white/5 border border-white/5 text-[11px] text-muted-foreground leading-relaxed flex items-start gap-2.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Zero image upload: Blurry, dark, or off-center frames are rejected automatically.
                Only the averaged 128-D float vector is committed.
              </span>
            </div>

            {saving && (
              <div className="mt-4 p-3 rounded-xl bg-sky-500/10 border border-sky-400/30 text-sky-300 text-xs font-medium flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Commiting mathematical templates to database…
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
