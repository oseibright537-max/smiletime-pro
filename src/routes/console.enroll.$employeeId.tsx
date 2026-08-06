import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCamera } from "@/hooks/useCamera";
import { analyseFrame, getFaceApi, POSES, toVectorLiteral, type PoseKey } from "@/lib/face/engine";
import { Badge, Button, Panel } from "@/components/ui/primitives";

export const Route = createFileRoute("/console/enroll/$employeeId")({ component: Enroll });

const HOLD_FRAMES = 6; // consecutive good frames required before capturing a pose

function Enroll() {
  const { employeeId } = useParams({ from: "/console/enroll/$employeeId" });
  const navigate = useNavigate();
  const { videoRef, start, stop, active, error } = useCamera();
  const [modelsReady, setModelsReady] = useState(false);
  const [poseIndex, setPoseIndex] = useState(0);
  const [hint, setHint] = useState("Position your face inside the frame");
  const [saving, setSaving] = useState(false);
  const capturedRef = useRef<Record<string, number[]>>({});
  const [captured, setCaptured] = useState<PoseKey[]>([]);
  const holdRef = useRef(0);
  const runningRef = useRef(false);

  const employee = useQuery({
    queryKey: ["employee", employeeId],
    queryFn: async () =>
      (await supabase.from("employees").select("id,full_name,employee_code").eq("id", employeeId).single()).data,
  });

  useEffect(() => {
    getFaceApi()
      .then(() => setModelsReady(true))
      .catch(() => toast.error("Could not load the recognition models"));
  }, []);

  const persist = useCallback(async () => {
    setSaving(true);
    try {
      const rows = Object.entries(capturedRef.current).map(([pose, vec]) => ({
        employee_id: employeeId,
        pose,
        embedding: toVectorLiteral(Float32Array.from(vec)) as unknown as string,
      }));
      await supabase.from("face_embeddings").delete().eq("employee_id", employeeId);
      const { error: insertError } = await supabase.from("face_embeddings").insert(rows);
      if (insertError) throw insertError;
      toast.success("Face enrolment complete — only math vectors were stored");
      stop();
      navigate({ to: "/console/employees" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [employeeId, navigate, stop]);

  // Detection loop
  useEffect(() => {
    if (!active || !modelsReady) return;
    runningRef.current = true;
    let raf = 0;

    const tick = async () => {
      if (!runningRef.current) return;
      const video = videoRef.current;
      const pose = POSES[poseIndex];
      if (video && pose) {
        try {
          const sample = await analyseFrame(video);
          if (!sample) {
            holdRef.current = 0;
            setHint("No face detected — step into the frame");
          } else if (sample.geometry.scale < 0.18) {
            holdRef.current = 0;
            setHint("Move a little closer to the camera");
          } else if (!pose.test(sample.geometry)) {
            holdRef.current = 0;
            setHint(pose.label);
          } else {
            holdRef.current += 1;
            setHint(`Hold still… ${Math.min(HOLD_FRAMES, holdRef.current)}/${HOLD_FRAMES}`);
            if (holdRef.current >= HOLD_FRAMES) {
              capturedRef.current[pose.key] = Array.from(sample.descriptor);
              holdRef.current = 0;
              setCaptured((c) => (c.includes(pose.key) ? c : [...c, pose.key]));
              setPoseIndex((i) => i + 1);
            }
          }
        } catch {
          /* transient frame error, keep looping */
        }
      }
      raf = requestAnimationFrame(() => void tick());
    };

    void tick();
    return () => {
      runningRef.current = false;
      cancelAnimationFrame(raf);
    };
  }, [active, modelsReady, poseIndex, videoRef]);

  const done = poseIndex >= POSES.length;

  useEffect(() => {
    if (done && !saving && Object.keys(capturedRef.current).length === POSES.length) void persist();
  }, [done, saving, persist]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Face enrolment</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {employee.data ? `${employee.data.full_name} · ${employee.data.employee_code}` : "Loading employee…"}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Panel className="p-0 overflow-hidden">
          <div className="relative aspect-video bg-background">
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full scale-x-[-1] object-cover"
            />
            {!active && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                <p className="max-w-sm px-6 text-sm text-muted-foreground">
                  {error ??
                    "Camera is off. Images are processed on this device and never uploaded — only the resulting vectors are saved."}
                </p>
                <Button onClick={() => void start()} disabled={!modelsReady}>
                  {modelsReady ? "Start camera" : "Loading models…"}
                </Button>
              </div>
            )}
            {active && (
              <div className="pointer-events-none absolute inset-0 flex items-end justify-center p-6">
                <div className="glow-ring rounded-full bg-background/80 px-4 py-2 text-sm">{hint}</div>
              </div>
            )}
          </div>
        </Panel>

        <Panel>
          <h2 className="font-semibold">Capture sequence</h2>
          <ol className="mt-4 space-y-3">
            {POSES.map((p, i) => {
              const complete = captured.includes(p.key);
              const current = i === poseIndex && active;
              return (
                <li key={p.key} className="flex items-center gap-3 text-sm">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      complete
                        ? "bg-success/20 text-success"
                        : current
                          ? "accent-surface text-primary-foreground"
                          : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {complete ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className={complete ? "text-muted-foreground line-through" : ""}>{p.label}</span>
                </li>
              );
            })}
          </ol>
          <div className="mt-6 space-y-2 text-xs text-muted-foreground">
            <Badge tone="primary">128-D embedding per angle</Badge>
            <p>
              Each angle yields an irreversible 128-dimension vector. Photos are discarded the moment the vector
              is computed.
            </p>
          </div>
          {saving && (
            <p className="mt-4 flex items-center gap-2 text-sm text-primary">
              <Loader2 className="h-4 w-4 animate-spin" /> Saving templates…
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}
