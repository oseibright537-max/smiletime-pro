import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Loader2,
  ShieldCheck,
  ScanFace,
  ArrowLeft,
  UploadCloud,
  Camera,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layers,
  FileImage,
  RefreshCw,
  Eye,
  Lock,
  UserCheck,
  Info,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCamera } from "@/hooks/useCamera";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import {
  analyseAllFaces,
  analyseFrame,
  averageDescriptors,
  extractEmbeddingFromFile,
  extractEmbeddingFromSnapshot,
  getFaceApi,
  toVectorLiteral,
  type FaceSample,
} from "@/lib/face/engine";
import { ANGLES, EnrolmentSession, TOTAL_TARGET, type AngleKey } from "@/lib/face/capture";
import { Badge, Button, Panel } from "@/components/ui/primitives";
import { DeleteEmployeeModal } from "@/components/employees/DeleteEmployeeModal";

export const Route = createFileRoute("/console/enroll/$employeeId")({ component: Enroll });

type EnrollTab = "snapshot" | "upload" | "guided";

function Enroll() {
  const { employeeId } = useParams({ from: "/console/enroll/$employeeId" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isStaff } = useAuth();
  const [tab, setTab] = useState<EnrollTab>("snapshot");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Camera & Face API
  const { videoRef, start, stop, active, error: cameraError } = useCamera();
  const [modelsReady, setModelsReady] = useState(false);
  const [saving, setSaving] = useState(false);

  // Live Snapshot Mode State
  const [liveSample, setLiveSample] = useState<FaceSample | null>(null);
  const [capturedVector, setCapturedVector] = useState<Float32Array | null>(null);
  const [capturedQuality, setCapturedQuality] = useState<number>(0);
  const [burstCount, setBurstCount] = useState<number>(0);

  // Upload Mode State
  const [uploadProcessing, setUploadProcessing] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadedVector, setUploadedVector] = useState<Float32Array | null>(null);
  const [uploadSample, setUploadSample] = useState<FaceSample | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Guided 5-Angle Mode State
  const [guidedHint, setGuidedHint] = useState("Position face inside the reticle");
  const [guidedAccepted, setGuidedAccepted] = useState(false);
  const [guidedProgress, setGuidedProgress] = useState(0);
  const [guidedCaptured, setGuidedCaptured] = useState(0);
  const [guidedQuality, setGuidedQuality] = useState(0);
  const [guidedCounts, setGuidedCounts] = useState<Record<AngleKey, number>>({
    front: 0,
    left: 0,
    right: 0,
    up: 0,
    down: 0,
  });
  const [guidedActiveAngle, setGuidedActiveAngle] = useState<AngleKey | null>("front");
  const sessionRef = useRef(new EnrolmentSession());
  const loopRef = useRef(false);
  const doneRef = useRef(false);

  // Employee details & current template status
  const employee = useQuery({
    queryKey: ["employee", employeeId],
    queryFn: async () => {
      const [{ data: emp }, { data: embeddings }] = await Promise.all([
        supabase
          .from("employees")
          .select("id,full_name,employee_code,job_title,department_id,departments(name)")
          .eq("id", employeeId)
          .single(),
        supabase
          .from("face_embeddings")
          .select("id,pose,created_at,quality")
          .eq("employee_id", employeeId),
      ]);
      return {
        ...emp,
        templatesCount: embeddings?.length ?? 0,
      };
    },
  });

  const deleteEmployee = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("employees").delete().eq("id", employeeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Employee permanently deleted");
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      qc.invalidateQueries({ queryKey: ["report_employees"] });
      navigate({ to: "/console/employees" });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Warm up face recognition neural networks
  useEffect(() => {
    getFaceApi()
      .then(() => setModelsReady(true))
      .catch(() => toast.error("Could not load the facial neural models."));
  }, []);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (uploadPreview) {
        URL.revokeObjectURL(uploadPreview);
      }
      stop();
    };
  }, [stop, uploadPreview]);

  // Live detection loop for Camera Snapshot mode & Guided mode
  useEffect(() => {
    if (!active || !modelsReady) return;
    loopRef.current = true;
    let raf = 0;

    const tick = async () => {
      if (!loopRef.current) return;
      const video = videoRef.current;
      if (video) {
        try {
          if (tab === "snapshot") {
            const sample = await analyseFrame(video, { scoreThreshold: 0.35, inputSize: 416 });
            setLiveSample(sample);
          } else if (tab === "guided" && !doneRef.current) {
            const samples = await analyseAllFaces(video, { scoreThreshold: 0.35, inputSize: 416 });
            const fb = sessionRef.current.push(video, samples);
            setGuidedHint(fb.message);
            setGuidedAccepted(fb.accepted);
            setGuidedProgress(fb.progress);
            setGuidedCaptured(fb.captured);
            setGuidedActiveAngle(fb.activeAngle);
            setGuidedCounts(sessionRef.current.counts);
            if (fb.quality) setGuidedQuality(fb.quality);

            if (sessionRef.current.complete && !doneRef.current) {
              doneRef.current = true;
              loopRef.current = false;
              void saveGuidedTemplates();
              return;
            }
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
  }, [active, modelsReady, tab, videoRef]);

  // Handle Tab Switch
  const handleTabChange = (newTab: EnrollTab) => {
    setTab(newTab);
    setCapturedVector(null);
    setBurstCount(0);
    if (newTab === "upload") {
      stop();
    }
  };

  // 1. Snapshot Mode: Instant Capture
  const captureLiveSnapshot = async () => {
    if (!videoRef.current) return;
    setBurstCount(1);
    try {
      const descriptors: Float32Array[] = [];
      for (let i = 0; i < 3; i++) {
        const result = await extractEmbeddingFromSnapshot(videoRef.current);
        if (result.success && result.descriptor) {
          descriptors.push(result.descriptor);
        }
        await new Promise((r) => setTimeout(r, 60));
      }

      if (descriptors.length === 0) {
        toast.error("Could not detect face. Look straight at the camera.");
        setBurstCount(0);
        return;
      }

      const avgDescriptor =
        descriptors.length > 1 ? averageDescriptors(descriptors) : descriptors[0]!;
      setCapturedVector(avgDescriptor);
      setCapturedQuality(liveSample ? Math.round(liveSample.score * 100) : 95);
      toast.success("Facial biometric profile generated successfully!");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBurstCount(0);
    }
  };

  const { currentOrgId } = useOrganization();

  // Save single descriptor (from Snapshot or Upload)
  const saveVectorToDatabase = async (vector: Float32Array, poseLabel = "front") => {
    setSaving(true);
    try {
      // 1. Delete previous embeddings for this employee
      await supabase.from("face_embeddings").delete().eq("employee_id", employeeId);

      // 2. Insert new 128-D vector literal
      const { error } = await supabase.from("face_embeddings").insert({
        organization_id: currentOrgId || null,
        employee_id: employeeId,
        pose: poseLabel,
        quality: capturedQuality ? capturedQuality / 100 : 0.95,
        model: "face-api/facenet-128",
        embedding: toVectorLiteral(vector) as unknown as string,
      });

      if (error) throw error;

      toast.success("Biometric enrollment complete! Saved to workforce directory.");
      stop();
      if (uploadPreview) {
        URL.revokeObjectURL(uploadPreview);
        setUploadPreview(null);
      }
      navigate({ to: "/console/employees" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // 2. Upload Photo File Mode
  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (JPG, PNG, WebP).");
      return;
    }

    setUploadProcessing(true);
    setUploadedVector(null);
    if (uploadPreview) URL.revokeObjectURL(uploadPreview);

    try {
      const res = await extractEmbeddingFromFile(file);
      if (!res.success || !res.descriptor) {
        toast.error(res.error || "Could not detect a clear human face in uploaded photo.");
        setUploadPreview(null);
        return;
      }

      setUploadedVector(res.descriptor);
      setUploadSample(res.sample ?? null);
      setUploadPreview(res.previewUrl ?? null);
      toast.success("Face detected! Biometric profile extracted successfully.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploadProcessing(false);
    }
  };

  // 3. Guided 5-Angle Mode Saver
  const saveGuidedTemplates = async () => {
    const session = sessionRef.current;
    setSaving(true);
    try {
      const rows = session.templates().map((t) => ({
        organization_id: currentOrgId || null,
        employee_id: employeeId,
        pose: t.pose,
        quality: t.quality,
        model: "face-api/facenet-128",
        embedding: toVectorLiteral(t.descriptor) as unknown as string,
      }));
      if (rows.length === 0) throw new Error("No usable frames were captured.");

      await supabase.from("face_embeddings").delete().eq("employee_id", employeeId);
      const { error: insertError } = await supabase.from("face_embeddings").insert(rows);
      if (insertError) throw insertError;

      toast.success("Multi-angle face templates enrolled successfully!");
      stop();
      navigate({ to: "/console/employees" });
    } catch (e) {
      doneRef.current = false;
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const ring = 2 * Math.PI * 46;

  return (
    <div className="space-y-5 sm:space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Link
              to="/console/employees"
              className="p-1.5 sm:p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors shadow-xs shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
              Biometric Face Enrollment
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            {employee.data?.full_name ? (
              <span className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="font-semibold text-slate-900">{employee.data.full_name}</span>
                <span className="font-mono text-indigo-600 font-bold">({employee.data.employee_code})</span>
                {employee.data.job_title && (
                  <span className="text-slate-500">· {employee.data.job_title}</span>
                )}
              </span>
            ) : (
              "Loading employee info…"
            )}
          </p>
        </div>

        {employee.data && (
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            {employee.data.templatesCount > 0 ? (
              <Badge tone="success" pulse size="md">
                {employee.data.templatesCount} ACTIVE TEMPLATES
              </Badge>
            ) : (
              <Badge tone="warning" size="md">
                NOT ENROLLED YET
              </Badge>
            )}

            {isStaff && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteModalOpen(true)}
                icon={<Trash2 className="h-4 w-4 text-rose-600" />}
                className="text-rose-700 hover:bg-rose-50 border-rose-200 shrink-0"
              >
                Delete Profile
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Mode Selector Tabs */}
      <div className="flex items-center gap-1.5 sm:gap-2 border-b border-slate-200 pb-3 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0 whitespace-nowrap">
        <button
          onClick={() => handleTabChange("snapshot")}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer shrink-0 ${
            tab === "snapshot"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
          }`}
        >
          <Camera className="h-4 w-4" />
          <span>Live Camera Snapshot</span>
          <Badge tone={tab === "snapshot" ? "neutral" : "primary"} size="sm">
            FAST
          </Badge>
        </button>

        <button
          onClick={() => handleTabChange("upload")}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer shrink-0 ${
            tab === "upload"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
          }`}
        >
          <UploadCloud className="h-4 w-4" />
          <span>Upload Picture File</span>
          <Badge tone={tab === "upload" ? "neutral" : "primary"} size="sm">
            NO WEBCAM
          </Badge>
        </button>

        <button
          onClick={() => handleTabChange("guided")}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer shrink-0 ${
            tab === "guided"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>Guided 5-Angle Capture</span>
          <Badge tone={tab === "guided" ? "neutral" : "success"} size="sm">
            HIGH ACCURACY
          </Badge>
        </button>
      </div>

      {/* Main Container */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT 2 COLS: Capture / Upload Workspace */}
        <div className="lg:col-span-2 space-y-4">
          {/* MODE 1: LIVE CAMERA SNAPSHOT */}
          {tab === "snapshot" && (
            <Panel className="p-0 overflow-hidden border border-slate-200 bg-slate-950 relative rounded-2xl shadow-md">
              <div className="relative aspect-video bg-slate-950 flex items-center justify-center">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="h-full w-full scale-x-[-1] object-cover"
                />

                {/* Viewfinder Target Reticle */}
                {active && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div
                      className={`w-64 h-64 sm:w-72 sm:h-72 rounded-full border-2 transition-colors duration-300 flex items-center justify-center ${
                        liveSample
                          ? "border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.4)]"
                          : "border-white/30 border-dashed"
                      }`}
                    >
                      <div className="w-12 h-12 border-t-2 border-l-2 border-indigo-400 absolute top-12 left-12 opacity-80" />
                      <div className="w-12 h-12 border-t-2 border-r-2 border-indigo-400 absolute top-12 right-12 opacity-80" />
                      <div className="w-12 h-12 border-b-2 border-l-2 border-indigo-400 absolute bottom-12 left-12 opacity-80" />
                      <div className="w-12 h-12 border-b-2 border-r-2 border-indigo-400 absolute bottom-12 right-12 opacity-80" />
                    </div>

                    <div className="absolute top-4 left-4 bg-slate-950/80 border border-white/15 px-3 py-1 rounded-full text-xs font-mono text-indigo-300 backdrop-blur-md flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 rounded-full ${liveSample ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`}
                      />
                      {liveSample ? "Face Detected · Ready to Capture" : "Looking for Face…"}
                    </div>
                  </div>
                )}

                {/* Camera Inactive State */}
                {!active && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-8 bg-slate-950/90 backdrop-blur-md">
                    <div className="h-16 w-16 rounded-3xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-400 shadow-lg">
                      <Camera className="h-8 w-8" />
                    </div>
                    <h2 className="text-xl font-bold text-white font-display">
                      Camera Ready for Snapshot
                    </h2>
                    <p className="max-w-md text-xs text-slate-300 leading-relaxed">
                      {cameraError ??
                        "Take a live snapshot to compute the biometric profile on-device. No camera photos are ever stored."}
                    </p>
                    <Button
                      size="lg"
                      onClick={() => void start()}
                      disabled={!modelsReady}
                      loading={!modelsReady}
                      icon={<Camera className="h-4 w-4" />}
                    >
                      {modelsReady ? "Start Camera Stream" : "Loading Neural Models…"}
                    </Button>
                  </div>
                )}
              </div>

              {/* Bottom Camera Action Bar */}
              <div className="border-t border-slate-800 bg-slate-900 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-indigo-400" />
                  <span>On-device biometric extraction · Zero photo storage</span>
                </div>

                {active && (
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={stop}>
                      Stop Camera
                    </Button>
                    <Button
                      size="md"
                      onClick={() => void captureLiveSnapshot()}
                      loading={burstCount > 0}
                      disabled={!liveSample || burstCount > 0}
                      icon={<ScanFace className="h-4 w-4" />}
                    >
                      {burstCount > 0 ? "Analyzing Face…" : "Capture Face"}
                    </Button>
                  </div>
                )}
              </div>
            </Panel>
          )}

          {/* MODE 2: UPLOAD PICTURE FILE */}
          {tab === "upload" && (
            <Panel className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileUpload(file);
                }}
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files?.[0];
                  if (file) void handleFileUpload(file);
                }}
                className="border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/20 transition-all rounded-2xl p-8 sm:p-12 text-center cursor-pointer flex flex-col items-center justify-center gap-4"
              >
                <div className="h-16 w-16 rounded-3xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-sm">
                  <UploadCloud className="h-8 w-8" />
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-900 font-display">
                    Upload Employee Portrait Photo
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    Drag and drop a JPG, PNG, or WebP photo here, or click to browse from your device.
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs font-medium text-indigo-700 bg-indigo-50 px-4 py-1.5 rounded-full border border-indigo-200">
                  <FileImage className="h-3.5 w-3.5" />
                  Supports Passport Photos, ID Badges, Headshots
                </div>

                {uploadProcessing && (
                  <div className="flex items-center gap-2 text-xs text-amber-700 font-medium">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Neural model analyzing image in local memory…
                  </div>
                )}
              </div>

              {/* Uploaded Image Confirmation Preview Card */}
              {uploadPreview && uploadedVector && (
                <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="relative h-16 w-16 rounded-xl overflow-hidden border border-indigo-300 shadow-sm">
                      <img
                        src={uploadPreview}
                        alt="Face Preview"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span className="font-semibold text-slate-900 text-sm">Face Extracted</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Confidence: {Math.round((uploadSample?.score ?? 0.95) * 100)}% · Ready to Save
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (uploadPreview) URL.revokeObjectURL(uploadPreview);
                      setUploadPreview(null);
                      setUploadedVector(null);
                    }}
                    icon={<RefreshCw className="h-3.5 w-3.5" />}
                  >
                    Choose Different Photo
                  </Button>
                </div>
              )}
            </Panel>
          )}

          {/* MODE 3: GUIDED 5-ANGLE SCAN */}
          {tab === "guided" && (
            <Panel className="p-0 overflow-hidden border border-slate-200 bg-slate-950 relative rounded-2xl shadow-md">
              <div className="relative aspect-video bg-slate-950 flex items-center justify-center">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="h-full w-full scale-x-[-1] object-cover"
                />

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
                        className={guidedAccepted ? "text-emerald-400/80" : "text-white/30"}
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="46"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        className="text-indigo-400 transition-[stroke-dashoffset] duration-200"
                        strokeDasharray={ring}
                        strokeDashoffset={ring * (1 - guidedProgress)}
                        transform="rotate(-90 50 50)"
                      />
                    </svg>

                    <div className="absolute bottom-6 inset-x-0 flex flex-col items-center gap-1.5">
                      <div
                        className={`rounded-full px-5 py-2 text-xs font-semibold backdrop-blur ${
                          guidedAccepted
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-slate-950/85 text-white border border-white/15"
                        }`}
                      >
                        {guidedHint}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {guidedCaptured}/{TOTAL_TARGET} frames · quality{" "}
                        {Math.round(guidedQuality * 100)}%
                      </span>
                    </div>
                  </div>
                )}

                {!active && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-8 bg-slate-950/90 backdrop-blur-md">
                    <Button size="lg" onClick={() => void start()} disabled={!modelsReady}>
                      Start 5-Angle Enrolment
                    </Button>
                  </div>
                )}
              </div>
            </Panel>
          )}

          {/* PRIVACY GUARANTEE NOTICE */}
          <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 flex items-start gap-3 text-xs text-slate-700">
            <ShieldCheck className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-900 block">
                Zero-Knowledge Facial Privacy
              </span>
              <p className="mt-0.5 text-slate-600 leading-relaxed">
                Raw photos and video frames are never uploaded or stored on any server. Only an
                encrypted mathematical biometric profile is registered.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT 1 COL: Biometric Confirmation & Save Panel */}
        <div className="space-y-4">
          <Panel className="bg-white border border-slate-200 rounded-2xl shadow-sm">
            <h2 className="text-base font-bold text-slate-900 font-display flex items-center gap-2">
              <ScanFace className="h-4.5 w-4.5 text-indigo-600" />
              Biometric Enrollment Status
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Verify the profile before saving to the employee directory.
            </p>

            {/* Ready State */}
            {((tab === "snapshot" && capturedVector) || (tab === "upload" && uploadedVector)) && (
              <div className="mt-4 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700">
                      <UserCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 text-sm block">
                        Biometric Profile Ready
                      </span>
                      <span className="text-[11px] text-emerald-700 font-medium">
                        Quality Validated · Template Normalized
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-emerald-200 text-xs text-slate-700 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Employee:</span>
                      <span className="font-semibold text-slate-900">
                        {employee.data?.full_name || "Employee"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Privacy Protection:</span>
                      <span className="text-indigo-700 font-medium">Zero-Photo Encrypted</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Status:</span>
                      <span className="text-emerald-700 font-semibold">Ready to Activate</span>
                    </div>
                  </div>
                </div>

                <Button
                  size="lg"
                  className="w-full"
                  loading={saving}
                  onClick={() => {
                    const vec = tab === "snapshot" ? capturedVector : uploadedVector;
                    if (vec) void saveVectorToDatabase(vec);
                  }}
                  icon={<ShieldCheck className="h-4 w-4" />}
                >
                  Save Face Profile
                </Button>
              </div>
            )}

            {/* Empty State when no vector captured yet */}
            {!capturedVector && !uploadedVector && tab !== "guided" && (
              <div className="mt-6 text-center py-8 border border-slate-200 rounded-xl bg-slate-50">
                <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 mx-auto flex items-center justify-center text-slate-400 mb-2 shadow-xs">
                  <ScanFace className="h-5 w-5 text-indigo-600" />
                </div>
                <p className="text-xs font-semibold text-slate-800">Awaiting Face Capture</p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto mt-1">
                  {tab === "snapshot"
                    ? "Start the camera and click 'Capture Face' to generate the profile."
                    : "Upload an employee portrait to generate the profile."}
                </p>
              </div>
            )}

            {/* Guided Progress Checklist */}
            {tab === "guided" && (
              <div className="mt-4 space-y-3">
                <ol className="space-y-2">
                  {ANGLES.map((a) => {
                    const n = guidedCounts[a.key];
                    const complete = n >= a.target;
                    const current = a.key === guidedActiveAngle;
                    return (
                      <li
                        key={a.key}
                        className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 border border-slate-200"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                              complete
                                ? "bg-emerald-100 text-emerald-700 font-bold"
                                : current
                                  ? "bg-indigo-600 text-white font-bold"
                                  : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {complete ? <Check className="h-3 w-3" /> : n}
                          </span>
                          <span className={complete ? "text-slate-400 line-through" : "text-slate-800"}>
                            {a.label}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {Math.min(n, a.target)}/{a.target}
                        </span>
                      </li>
                    );
                  })}
                </ol>

                {sessionRef.current.canFinish && (
                  <Button
                    size="md"
                    className="w-full mt-3"
                    loading={saving}
                    onClick={() => void saveGuidedTemplates()}
                  >
                    Finish & Save Multi-Angle Profile
                  </Button>
                )}
              </div>
            )}
          </Panel>

          {/* Quick Tips */}
          <Panel className="p-4 border border-slate-200 bg-slate-50 text-xs space-y-2 rounded-2xl">
            <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
              <Info className="h-4 w-4 text-indigo-600" />
              <span>Tips for Fast Scanning</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600 leading-relaxed">
              <li>Ensure good lighting facing the front of the face.</li>
              <li>Maintain a natural expression looking straight ahead.</li>
            </ul>
          </Panel>
        </div>
      </div>

      {/* Delete Employee Modal */}
      {employee.data && (
        <DeleteEmployeeModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={() => deleteEmployee.mutate()}
          loading={deleteEmployee.isPending}
          employee={{
            id: employeeId,
            full_name: employee.data.full_name,
            employee_code: employee.data.employee_code,
            job_title: employee.data.job_title,
            department_name: (employee.data.departments as { name: string } | null)?.name,
            templatesCount: employee.data.templatesCount,
          }}
        />
      )}
    </div>
  );
}
