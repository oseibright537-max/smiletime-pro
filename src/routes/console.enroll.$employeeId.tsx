import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";
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
  const [hint, setHint] = useState("Position your face inside the circle");
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
          .select("id,full_name,employee_code")
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

      toast.success("Enrolment complete — only irreversible vectors were stored");
      stop();
      navigate({ to: "/console/employees" });
    } catch (e) {
      doneRef.current = false;
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [employeeId, navigate, stop]);

  // Continuous analysis loop — no manual capture, transient failures just retry.
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
          /* transient frame error — the next tick retries automatically */
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
      <div className="min-w-0">
        <h1 className="text-xl font-semibold sm:text-2xl">Face enrolment</h1>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {employee.data
            ? `${employee.data.full_name} · ${employee.data.employee_code}`
            : "Loading employee…"}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel className="overflow-hidden p-0">
          <div className="relative aspect-[3/4] bg-background sm:aspect-video">
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
                <svg viewBox="0 0 100 100" className="h-[70%] max-h-full" aria-hidden="true">
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
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
                <p className="max-w-sm text-sm text-muted-foreground">
                  {error ??
                    "Sit facing a light source, then just follow the prompts — capture is automatic and takes a few seconds. Frames never leave this device."}
                </p>
                <Button onClick={() => void start()} disabled={!modelsReady}>
                  {modelsReady ? "Start enrolment" : "Loading models…"}
                </Button>
              </div>
            )}

            {active && (
              <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-4 sm:p-6">
                <div
                  role="status"
                  aria-live="polite"
                  className={`max-w-full rounded-full px-4 py-2 text-center text-sm font-medium backdrop-blur ${
                    accepted ? "bg-success/20 text-success" : "bg-background/85"
                  }`}
                >
                  {hint}
                </div>
                <span className="text-[11px] text-muted-foreground sm:text-xs">
                  {captured}/{TOTAL_TARGET} frames · quality {Math.round(quality * 100)}%
                </span>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => sessionRef.current.skipActive()}
                    disabled={saving}
                  >
                    Skip this step
                  </Button>
                  <Button onClick={finishNow} disabled={!canFinish || saving}>
                    Finish now
                  </Button>
                </div>
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
                <li key={a.key} className="flex min-w-0 items-center gap-3 text-sm">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] ${
                      complete
                        ? "bg-success/20 text-success"
                        : current
                          ? "accent-surface text-primary-foreground"
                          : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {complete ? <Check className="h-3.5 w-3.5" /> : n}
                  </span>
                  <span className={`truncate ${complete ? "text-muted-foreground line-through" : ""}`}>
                    {a.label}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {Math.min(n, a.target)}/{a.target}
                  </span>
                </li>
              );
            })}
          </ol>

          <div className="mt-6 space-y-2 text-xs text-muted-foreground">
            <Badge tone="primary">automatic capture</Badge>
            <p>
              Poor frames are rejected and retried automatically. If a pose is hard for your camera,
              the checks loosen after a few seconds and the step is skipped on its own — or use
              “Skip this step” / “Finish now”.
            </p>
            {elapsed > 0 && (
              <p className="flex items-center gap-1.5 text-success">
                <ShieldCheck className="h-3.5 w-3.5" /> captured in {elapsed}s
              </p>
            )}
          </div>

          {saving && (
            <p className="mt-4 flex items-center gap-2 text-sm text-primary">
              <Loader2 className="h-4 w-4 animate-spin" /> Building templates…
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}

