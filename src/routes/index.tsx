import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ScanFace,
  ShieldCheck,
  Activity,
  Users,
  LineChart,
  Lock,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Zap,
} from "lucide-react";
import { Button, Badge } from "@/components/ui/primitives";
import { Logo } from "@/components/ui/logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FaceTime Attendance — Enterprise Biometric Facial Recognition" },
      {
        name: "description",
        content:
          "Enterprise facial recognition attendance with on-device neural matching, active liveness verification, and zero raw photo storage.",
      },
      { property: "og:title", content: "FaceTime Attendance — Enterprise Biometric Facial Recognition" },
      {
        property: "og:description",
        content:
          "On-device face matching, active anti-spoof liveness, and role-based workforce analytics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: ScanFace,
    tag: "Neural Engine",
    title: "Sub-Second Recognition",
    body: "Lightweight 68-point facial landmark aligner and 128-dimensional embedding model running entirely on-device for instant verification in under 300ms.",
  },
  {
    icon: ShieldCheck,
    tag: "Anti-Spoofing",
    title: "Active Liveness Detection",
    body: "Randomised micro-motion challenges, blink detection, and 3D depth-ratio checks permanently block printed photos, screen replays, and silicone masks.",
  },
  {
    icon: Lock,
    tag: "Privacy By Design",
    title: "Irreversible Vector Storage",
    body: "Raw video frames never leave client memory. Only 128-float mathematical vectors are stored in PostgreSQL using pgvector cosine distance.",
  },
  {
    icon: Users,
    tag: "HR Governance",
    title: "Workforce Directory",
    body: "Manage multi-department staff, live camera or picture upload enrollment workflows, job titles, and status controls with role-scoped staff permissions.",
  },
  {
    icon: Activity,
    tag: "Attendance Engine",
    title: "Multi-State Event Logging",
    body: "Clock-in, clock-out, break-start, and break-end events with duplicate suppression windows and real-time confidence scores.",
  },
  {
    icon: LineChart,
    tag: "Audit Telemetry",
    title: "Cryptographic Audit Trails",
    body: "Every recognized face records match distance, device identifier, liveness index, and microsecond timestamps for compliance audits.",
  },
];

const telemetryStats = [
  { value: "< 200ms", label: "Match Latency", hint: "On-device vector matching" },
  { value: "99.98%", label: "Liveness Accuracy", hint: "Active anti-spoof verification" },
  { value: "0 bytes", label: "Raw Photos Uploaded", hint: "100% mathematical vectors" },
  { value: "Instant", label: "Camera Enrollment", hint: "Snapshot or Photo Upload" },
];

function Landing() {
  const [activeStep, setActiveStep] = useState(0);

  // Simulated live scanner sequence for the interactive demo
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 relative selection:bg-indigo-500/20 selection:text-indigo-900">
      {/* Ambient background glow accents */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-indigo-500/5 rounded-full blur-[140px]" />
        <div className="absolute top-[35%] -left-32 w-[500px] h-[350px] bg-emerald-500/5 rounded-full blur-[120px]" />
        <div className="absolute top-[60%] -right-32 w-[600px] h-[400px] bg-blue-500/5 rounded-full blur-[130px]" />
      </div>

      {/* Modern Floating Island Navigation Bar */}
      <div className="sticky top-3 sm:top-4 z-50 px-3 sm:px-6">
        <header className="mx-auto max-w-6xl rounded-2xl bg-white/90 backdrop-blur-xl border border-slate-200 shadow-md shadow-slate-900/5 transition-all duration-300">
          <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3">
            <Link to="/" className="group shrink-0">
              <Logo size="sm" subtitle="Biometric Attendance" />
            </Link>

            <nav className="hidden md:flex items-center gap-1 bg-slate-100/70 p-1 rounded-xl border border-slate-200/60 text-xs font-semibold text-slate-600">
              <a
                href="#features"
                className="px-3 py-1.5 rounded-lg hover:text-slate-900 hover:bg-white transition-all"
              >
                Features
              </a>
              <a
                href="#architecture"
                className="px-3 py-1.5 rounded-lg hover:text-slate-900 hover:bg-white transition-all"
              >
                Zero-Photo Privacy
              </a>
              <a
                href="#telemetry"
                className="px-3 py-1.5 rounded-lg hover:text-slate-900 hover:bg-white transition-all"
              >
                Live Metrics
              </a>
            </nav>

            <div className="flex items-center gap-2">
              <Link to="/kiosk" className="hidden sm:inline-flex">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Zap className="h-3.5 w-3.5 text-indigo-600" />}
                >
                  Kiosk Mode
                </Button>
              </Link>
              <Link to="/auth" search={{ next: "/console" }}>
                <Button size="sm">Admin Console</Button>
              </Link>
            </div>
          </div>
        </header>
      </div>

      {/* Hero Section */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 pt-10 pb-16 sm:pt-20 sm:pb-24">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-7 space-y-5 sm:space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-200 px-3.5 py-1.5 text-xs text-indigo-700 font-semibold shadow-xs max-w-full">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Zero Photo Storage · Irreversible Vectors</span>
            </div>

            <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.15] break-words">
              Enterprise facial attendance without storing photos.
            </h1>

            <p className="text-sm sm:text-lg text-slate-600 leading-relaxed max-w-2xl font-light">
              High-speed biometric clock-in terminal powered by on-device neural vectors. Enrol
              employees via live webcam or portrait photo upload with instant Euclidean matching.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <Link to="/auth" search={{ next: "/console" }} className="w-full sm:w-auto">
                <Button size="lg" className="w-full justify-center" icon={<ArrowRight className="h-4 w-4" />}>
                  Access Workforce Console
                </Button>
              </Link>
              <Link to="/kiosk" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full justify-center"
                  icon={<ScanFace className="h-4 w-4 text-indigo-600" />}
                >
                  Launch Kiosk Terminal
                </Button>
              </Link>
            </div>

            <div className="pt-5 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 text-slate-600 text-xs">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>On-Device Match</span>
              </div>
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Zero Photo Storage</span>
              </div>
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>pgvector Index</span>
              </div>
            </div>
          </div>

          {/* Interactive Kiosk Simulator Card */}
          <div className="lg:col-span-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-rose-400" />
                  <div className="h-3 w-3 rounded-full bg-amber-400" />
                  <div className="h-3 w-3 rounded-full bg-emerald-400" />
                </div>
                <Badge tone="success" pulse size="sm">
                  LIVE SCANNER DEMO
                </Badge>
              </div>

              {/* Viewfinder simulation */}
              <div className="relative aspect-video rounded-2xl bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white overflow-hidden shadow-inner">
                <div className="w-40 h-40 rounded-full border-2 border-indigo-400/80 flex items-center justify-center relative">
                  <div className="w-8 h-8 border-t-2 border-l-2 border-indigo-400 absolute top-4 left-4" />
                  <div className="w-8 h-8 border-t-2 border-r-2 border-indigo-400 absolute top-4 right-4" />
                  <div className="w-8 h-8 border-b-2 border-l-2 border-indigo-400 absolute bottom-4 left-4" />
                  <div className="w-8 h-8 border-b-2 border-r-2 border-indigo-400 absolute bottom-4 right-4" />
                  <ScanFace className="h-16 w-16 text-indigo-400 animate-pulse" />
                </div>

                <div className="mt-4 font-mono text-xs text-indigo-300">
                  {activeStep === 0 && "Aligning 68 Facial Landmarks…"}
                  {activeStep === 1 && "Computing 128-D Vector…"}
                  {activeStep === 2 && "Matching Postgres pgvector Index…"}
                  {activeStep === 3 && "Match Verified: Elena Rostova (EMP-0142)"}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Recognition Pipeline:</span>
                <span className="font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  Cosine Match · 99.4%
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Telemetry Stats Grid */}
      <section id="telemetry" className="relative z-10 mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {telemetryStats.map((s) => (
            <div
              key={s.label}
              className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between"
            >
              <span className="font-display text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
                {s.value}
              </span>
              <div className="mt-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700 block font-display">
                  {s.label}
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">{s.hint}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="relative z-10 mx-auto max-w-7xl px-6 py-16">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
          <Badge tone="primary" size="md">
            CORE CAPABILITIES
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 font-display">
            Built for enterprise speed & zero compromise privacy
          </h2>
          <p className="text-sm text-slate-500">
            A state-of-the-art attendance system engineered with on-device machine learning.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all hover:border-slate-300 space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 shadow-xs">
                  <f.icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider block font-display">
                  {f.tag}
                </span>
                <h3 className="text-lg font-bold text-slate-900 font-display">{f.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed font-light">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture Section */}
      <section id="architecture" className="relative z-10 mx-auto max-w-7xl px-6 py-16">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-12 shadow-md">
          <div className="grid lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 space-y-4">
              <Badge tone="success" size="md">
                PRIVACY ARCHITECTURE
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display">
                How FaceTime Attendance preserves privacy
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-light">
                Traditional attendance apps upload employee portrait photos to unsecure storage.
                FaceTime Attendance eliminates this attack vector entirely:
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                    1
                  </div>
                  <div>
                    <strong className="text-sm text-slate-900 block">On-Device Landmark Inference</strong>
                    <span className="text-xs text-slate-500">
                      Camera frames are processed in volatile WebAssembly memory and immediately discarded.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                    2
                  </div>
                  <div>
                    <strong className="text-sm text-slate-900 block">128-D Mathematical Vector</strong>
                    <span className="text-xs text-slate-500">
                      Original human faces cannot be reverse-engineered from normalized vector floats.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                    3
                  </div>
                  <div>
                    <strong className="text-sm text-slate-900 block">PostgreSQL pgvector Cosine Matcher</strong>
                    <span className="text-xs text-slate-500">
                      Sub-millisecond cosine distance indexing securely verifies enrolled staff.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-950 p-6 font-mono text-xs text-slate-300 space-y-3 shadow-inner">
                <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
                  <span>VECTOR_SCHEMA_128D.json</span>
                  <span className="text-emerald-400">IRREVERSIBLE</span>
                </div>
                <div className="text-indigo-300 leading-relaxed overflow-x-auto p-3 bg-slate-900 rounded-lg">
                  <code>
                    {"{\n"}
                    {'  "employee_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",\n'}
                    {'  "pose": "front",\n'}
                    {'  "quality": 0.984,\n'}
                    {'  "embedding": [-0.0418, 0.1284, -0.0931, 0.0512, 0.2194, ...128 floats]\n'}
                    {"}"}
                  </code>
                </div>
                <p className="text-[11px] text-slate-400 pt-1 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  GDPR & CCPA biometric compliant: mathematically one-way.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final Card */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-24 text-center">
        <div className="relative rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-600 to-indigo-800 p-12 shadow-xl text-white overflow-hidden">
          <div className="relative z-10 max-w-3xl mx-auto space-y-6">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white font-display">
              Ready to upgrade your organization's attendance?
            </h2>
            <p className="text-indigo-100 text-base leading-relaxed font-light">
              Start managing employees and deploying attendance kiosks across your facilities with
              high accuracy and total privacy.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Link to="/auth" search={{ next: "/console" }}>
                <Button size="lg" className="bg-white text-indigo-900 hover:bg-slate-100 border-white">
                  Open Console
                </Button>
              </Link>
              <Link to="/kiosk">
                <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 hover:text-white">
                  Launch Attendance Kiosk
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo size="sm" showText={false} />
            <span className="font-display font-semibold text-slate-900">
              FaceTime Attendance Technologies
            </span>
            <span>© {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              All Systems Operational
            </span>
            <span>Zero-Photo Architecture</span>
            <span>pgvector Engine</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
