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
  const [canFinish, setCanFinish] = useState(false);

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
          setCanFinish(fb.canFinish);

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

  const finishNow = useCallback(() => {
    if (doneRef.current) return;
    if (!sessionRef.current.canFinish) {
      toast.error("Hold still a moment longer — not enough frames yet");
      return;
    }
    doneRef.current = true;
    loopRef.current = false;
    void persist();
  }, [persist]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Face enrolment</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {employee.data
            ? `${employee.data.full_name} · ${employee.data.employee_code}`
            : "Loading employee…"}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Panel className="overflow-hidden p-0">
          <div className="relative aspect-video bg-background">
            <video
              ref={videoRef}
              playsInline
              muted
              aria-label="Live camera preview for face enrolment"
              className="h-full w-full scale-x-[-1] object-cover"
            />

            {/* Face guide ring with capture progress */}
            {active && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="h-[78%] max-h-full" aria-hidden="true">
                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className={accepted ? "text-success/60" : "text-muted-foreground/40"}
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="text-primary transition-[stroke-dashoffset] duration-200"
                    strokeDasharray={ring}
                    strokeDashoffset={ring * (1 - progress)}
                    transform="rotate(-90 50 50)"
                  />
                </svg>
              </div>
            )}

            {!active && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                <p className="max-w-sm px-6 text-sm text-muted-foreground">
                  {error ??
                    "Frames are analysed on this device and never uploaded — only the resulting math vectors are saved. Capture is fully automatic; just follow the on-screen prompts."}
                </p>
                <Button onClick={() => void start()} disabled={!modelsReady}>
                  {modelsReady ? "Start enrolment" : "Loading models…"}
                </Button>
              </div>
            )}

            {active && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-6">
                <div
                  role="status"
                  aria-live="polite"
                  className={`rounded-full px-5 py-2 text-sm font-medium backdrop-blur ${
                    accepted ? "bg-success/20 text-success" : "bg-background/85"
                  }`}
                >
                  {hint}
                </div>
                <span className="text-xs text-muted-foreground">
                  {captured}/{TOTAL_TARGET} frames · quality {Math.round(quality * 100)}%
                </span>
              </div>
            )}
          </div>
        </Panel>

        <Panel>
          <h2 className="font-semibold">Capture coverage</h2>
          <ol className="mt-4 space-y-3">
            {ANGLES.map((a) => {
              const n = counts[a.key];
              const complete = n >= a.target;
              const current = a.key === activeAngle;
              return (
                <li key={a.key} className="flex items-center gap-3 text-sm">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                      complete
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : current
                          ? "accent-surface text-primary-foreground"
                          : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {complete ? <Check className="h-3.5 w-3.5" /> : n}
                  </span>
                  <span className={complete ? "text-muted-foreground line-through" : ""}>
                    {a.label}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {Math.min(n, a.target)}/{a.target}
                  </span>
                </li>
              );
            })}
          </ol>

          <div className="mt-6 space-y-2 text-xs text-muted-foreground">
            <Badge tone="primary">automatic capture</Badge>
            <p>
              Blurry, dark, overexposed, off-centre, or multi-face frames are rejected automatically
              and retried — no buttons, no restarts. The stored template is the averaged vector of
              the best frames per angle.
            </p>
            {elapsed > 0 && (
              <p className="flex items-center gap-1.5 text-success">
                <ShieldCheck className="h-3.5 w-3.5" /> captured in {elapsed}s
              </p>
            )}
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
  );
}

