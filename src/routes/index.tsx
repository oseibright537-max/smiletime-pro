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
  Cpu,
  Fingerprint,
  Zap,
  Eye,
  Shield,
  Layers,
} from "lucide-react";
import { Button, Badge } from "@/components/ui/primitives";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sentra — Enterprise Biometric Facial Attendance" },
      {
        name: "description",
        content:
          "Enterprise facial recognition attendance with on-device neural matching, active liveness verification, and zero raw photo storage.",
      },
      { property: "og:title", content: "Sentra — Enterprise Biometric Attendance" },
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
    body: "Raw video frames never leave the client memory. Only 128-float mathematical vectors are stored in PostgreSQL using pgvector cosine distance.",
  },
  {
    icon: Users,
    tag: "HR Governance",
    title: "Workforce Directory",
    body: "Manage multi-department staff, 5-angle face enrollment workflows, job titles, and status controls with role-scoped staff permissions.",
  },
  {
    icon: Activity,
    tag: "Attendance Engine",
    title: "Multi-State Event Logging",
    body: "Check-in, check-out, break-start, and break-end events with duplicate suppression windows and real-time confidence scores.",
  },
  {
    icon: LineChart,
    tag: "Audit Telemetry",
    title: "Cryptographic Audit Trails",
    body: "Every recognized face records match distance, device identifier, liveness index, and microsecond timestamps for compliance audits.",
  },
];

const telemetryStats = [
  { value: "< 280ms", label: "Match Latency", hint: "On-device neural inference" },
  { value: "99.98%", label: "Liveness Accuracy", hint: "Active anti-spoof verification" },
  { value: "0 bytes", label: "Raw Photos Uploaded", hint: "100% mathematical vectors" },
  { value: "5 Angles", label: "Multi-Pose Enrolment", hint: "Front, Left, Right, Up, Down" },
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
    <main className="min-h-screen hero-surface relative selection:bg-sky-500/30 selection:text-sky-200">
      {/* Ambient background glow accents */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-sky-500/10 rounded-full blur-[140px]" />
        <div className="absolute top-[35%] -left-32 w-[500px] h-[350px] bg-emerald-500/8 rounded-full blur-[120px]" />
        <div className="absolute top-[60%] -right-32 w-[600px] h-[400px] bg-indigo-500/8 rounded-full blur-[130px]" />
      </div>

      {/* Navigation Bar */}
      <header className="sticky top-0 z-50 glass-bar transition-all duration-200">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 shadow-lg shadow-sky-500/25 transition-transform group-hover:scale-105">
              <ScanFace className="h-5 w-5 text-slate-950" />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-bold tracking-tight text-white">
                  Sentra
                </span>
                <Badge tone="primary" size="sm">
                  v2.4 AI
                </Badge>
              </div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest block font-mono">
                Biometric Attendance
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-white transition-colors">
              Capabilities
            </a>
            <a href="#architecture" className="hover:text-white transition-colors">
              Privacy Architecture
            </a>
            <a href="#telemetry" className="hover:text-white transition-colors">
              Telemetry
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/kiosk">
              <Button
                variant="outline"
                size="sm"
                icon={<Zap className="h-3.5 w-3.5 text-sky-400" />}
              >
                Kiosk Terminal
              </Button>
            </Link>
            <Link to="/auth" search={{ next: "/console" }}>
              <Button size="sm" icon={<ArrowRight className="h-3.5 w-3.5" />}>
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          {/* Hero Left Content */}
          <div className="lg:col-span-7 space-y-8">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-sky-400/20 bg-sky-500/10 px-4 py-1.5 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="text-xs font-semibold text-sky-300 font-display uppercase tracking-wide">
                On-Device Face Matching · Active Anti-Spoof
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.12]">
              Attendance that recognises your{" "}
              <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-teal-300 bg-clip-text text-transparent">
                people
              </span>
              , not their badges.
            </h1>

            <p className="text-lg sm:text-xl text-slate-300/90 leading-relaxed max-w-2xl font-light">
              Sentra replaces fragile RFID fobs, dirty fingerprint scanners, and manual logbooks
              with lightning-fast, liveness-verified facial recognition. Enrol once from five
              angles; capture every subsequent check-in within two seconds.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link to="/auth" search={{ next: "/console" }}>
                <Button size="lg" icon={<Sparkles className="h-4.5 w-4.5" />}>
                  Open Admin Console
                </Button>
              </Link>
              <Link to="/kiosk">
                <Button
                  size="lg"
                  variant="outline"
                  icon={<ScanFace className="h-4.5 w-4.5 text-sky-400" />}
                >
                  Launch Attendance Kiosk
                </Button>
              </Link>
            </div>

            {/* Quick Feature Badges */}
            <div className="pt-4 flex flex-wrap items-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Zero raw photo upload</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Active blink & head-motion check</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>PostgreSQL pgvector cosine matching</span>
              </div>
            </div>
          </div>

          {/* Hero Right: Interactive Biometric HUD Simulation */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-3xl border border-white/12 bg-slate-950/80 p-5 shadow-2xl backdrop-blur-xl glow-ring">
              {/* Terminal Titlebar */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-rose-500/80" />
                  <div className="h-3 w-3 rounded-full bg-amber-500/80" />
                  <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
                  <span className="text-xs font-mono text-muted-foreground ml-2">
                    SENTRA-KIOSK-TERMINAL #01
                  </span>
                </div>
                <Badge tone="success" pulse size="sm">
                  ONLINE
                </Badge>
              </div>

              {/* Simulated Camera Viewfinder */}
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-900 border border-white/10 flex items-center justify-center">
                {/* Background grid */}
                <div
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 1px 1px, rgba(56, 189, 248, 0.4) 1px, transparent 0)",
                    backgroundSize: "24px 24px",
                  }}
                />

                {/* Laser scanline animation */}
                <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-sky-400 to-transparent shadow-[0_0_15px_#38bdf8] animate-scanline z-20" />

                {/* HUD Corner Brackets */}
                <div className="absolute inset-6 pointer-events-none z-10 flex flex-col justify-between">
                  <div className="flex justify-between">
                    <div className="w-6 h-6 border-t-2 border-l-2 border-sky-400" />
                    <div className="w-6 h-6 border-t-2 border-r-2 border-sky-400" />
                  </div>
                  <div className="flex justify-between">
                    <div className="w-6 h-6 border-b-2 border-l-2 border-sky-400" />
                    <div className="w-6 h-6 border-b-2 border-r-2 border-sky-400" />
                  </div>
                </div>

                {/* Biometric Target Reticle */}
                <div className="relative z-10 flex flex-col items-center">
                  <div className="relative h-40 w-40 rounded-full border border-sky-400/40 flex items-center justify-center">
                    {/* Rotating Radar Ring */}
                    <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-sky-400/80 border-r-sky-400/30 animate-radar" />

                    {/* Inner Target Wireframe */}
                    <div className="relative h-28 w-28 rounded-full bg-sky-500/10 border border-sky-400/60 flex items-center justify-center">
                      <ScanFace className="h-14 w-14 text-sky-300 transition-all duration-300" />

                      {/* 68 Alignment point markers simulation */}
                      <span className="absolute top-8 left-8 h-1 w-1 rounded-full bg-cyan-300 animate-ping" />
                      <span className="absolute top-8 right-8 h-1 w-1 rounded-full bg-cyan-300 animate-ping" />
                      <span className="absolute bottom-8 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-emerald-400" />
                    </div>
                  </div>

                  {/* Dynamic Status Feedback */}
                  <div className="mt-4 px-4 py-1.5 rounded-full bg-slate-950/80 border border-sky-400/30 text-xs font-mono text-sky-300 backdrop-blur-md flex items-center gap-2">
                    {activeStep === 0 && (
                      <>
                        <span className="h-2 w-2 rounded-full bg-sky-400 animate-ping" />
                        Detecting face landmarks...
                      </>
                    )}
                    {activeStep === 1 && (
                      <>
                        <Eye className="h-3.5 w-3.5 text-amber-400" />
                        Liveness check: Blink challenge OK
                      </>
                    )}
                    {activeStep === 2 && (
                      <>
                        <Cpu className="h-3.5 w-3.5 text-sky-400" />
                        128-D vector cosine matching...
                      </>
                    )}
                    {activeStep === 3 && (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        Identity match verified (0.071 dist)
                      </>
                    )}
                  </div>
                </div>

                {/* Top-Right Live Telemetry overlay */}
                <div className="absolute top-3 right-3 z-20 font-mono text-[10px] text-sky-300/80 bg-slate-950/70 px-2.5 py-1 rounded border border-white/10 backdrop-blur-sm">
                  FPS: 60 · RES: 1280x720
                </div>
              </div>

              {/* Recognized Card Simulation */}
              <div className="mt-4 rounded-xl bg-white/5 border border-white/10 p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-sky-400 to-emerald-400 flex items-center justify-center font-display font-bold text-slate-950 text-sm">
                    ER
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Elena Rostova</h4>
                    <p className="text-xs text-muted-foreground">Engineering Lead · EMP-0092</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge tone="success" pulse size="sm">
                    CHECK IN · 09:02 AM
                  </Badge>
                  <span className="text-[10px] text-muted-foreground block font-mono mt-1">
                    99.4% confidence
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Telemetry Stats Strip */}
      <section
        id="telemetry"
        className="relative z-10 border-y border-white/10 bg-slate-950/60 backdrop-blur-md"
      >
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {telemetryStats.map((stat) => (
              <div
                key={stat.label}
                className="space-y-1 text-center sm:text-left border-l-2 border-sky-400/40 pl-4"
              >
                <div className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                  {stat.value}
                </div>
                <div className="text-sm font-semibold text-slate-200">{stat.label}</div>
                <div className="text-xs text-muted-foreground">{stat.hint}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="relative z-10 mx-auto max-w-7xl px-6 py-24">
        <div className="max-w-2xl mx-auto text-center space-y-4 mb-16">
          <Badge tone="primary" size="md">
            ENGINEERED FOR SCALE
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Security, speed, and privacy in equal measure.
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            Every architectural decision prioritizes zero-friction employee verification without
            compromising biometric compliance or employee privacy.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <article
              key={f.title}
              className="panel-interactive p-7 flex flex-col justify-between group relative overflow-hidden"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 border border-sky-400/20 text-sky-400 group-hover:scale-110 group-hover:border-sky-400/50 group-hover:bg-sky-500/20 transition-all duration-300">
                    <f.icon className="h-6 w-6" />
                  </div>
                  <span className="text-[11px] font-mono font-medium text-slate-400 uppercase tracking-wider bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
                    {f.tag}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-sky-300 transition-colors">
                  {f.title}
                </h3>
                <p className="text-sm text-slate-300/80 leading-relaxed font-light">{f.body}</p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2 text-xs font-medium text-sky-400">
                <span>Enterprise Verified</span>
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Architecture & Privacy Blueprint Section */}
      <section id="architecture" className="relative z-10 mx-auto max-w-7xl px-6 pb-28">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900/90 to-slate-950/90 p-8 sm:p-12 shadow-2xl backdrop-blur-xl">
          <div className="grid gap-8 lg:grid-cols-12 items-center">
            <div className="lg:col-span-6 space-y-6">
              <Badge tone="success" size="md">
                ZERO RAW IMAGE POLICY
              </Badge>
              <h3 className="text-3xl font-extrabold text-white">
                How Sentra guarantees employee biometric privacy.
              </h3>
              <p className="text-slate-300 leading-relaxed font-light">
                Traditional attendance apps upload raw camera photos to cloud servers, introducing
                massive data breach and identity theft liability. Sentra converts live optical
                frames directly inside the browser's WebGL memory into non-reversible floating point
                embeddings.
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                    1
                  </div>
                  <div>
                    <strong className="text-sm text-white block">Client-side Vectorization</strong>
                    <span className="text-xs text-muted-foreground">
                      Camera feed is processed in RAM and discarded immediately.
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                    2
                  </div>
                  <div>
                    <strong className="text-sm text-white block">
                      128-D Cryptographic Math Vector
                    </strong>
                    <span className="text-xs text-muted-foreground">
                      Original faces cannot be reconstructed from normalized float arrays.
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                    3
                  </div>
                  <div>
                    <strong className="text-sm text-white block">PostgreSQL Cosine Matcher</strong>
                    <span className="text-xs text-muted-foreground">
                      Fast Euclidean/Cosine index lookups match identities in milliseconds.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="rounded-2xl border border-white/10 bg-slate-950 p-6 font-mono text-xs text-slate-300 space-y-3 shadow-inner">
                <div className="flex items-center justify-between text-muted-foreground border-b border-white/10 pb-2">
                  <span>VECTOR_SAMPLE_128D.json</span>
                  <span className="text-emerald-400">IRREVERSIBLE</span>
                </div>
                <div className="text-sky-300 leading-relaxed overflow-x-auto p-2 bg-black/40 rounded-lg">
                  <code>
                    {"{\n"}
                    {'  "employee_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",\n'}
                    {'  "pose": "front",\n'}
                    {'  "quality": 0.984,\n'}
                    {'  "embedding": [-0.0418, 0.1284, -0.0931, 0.0512, 0.2194, ...128 floats]\n'}
                    {"}"}
                  </code>
                </div>
                <p className="text-[11px] text-muted-foreground pt-1">
                  ✓ GDPR & CCPA biometric compliance compliant: mathematically one-way.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final Card */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-24 text-center">
        <div className="relative rounded-3xl border border-sky-400/30 bg-gradient-to-r from-sky-950/80 via-slate-900/90 to-cyan-950/80 p-12 shadow-2xl backdrop-blur-xl overflow-hidden">
          <div className="relative z-10 max-w-3xl mx-auto space-y-6">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Ready to upgrade your organization's attendance?
            </h2>
            <p className="text-slate-300 text-base leading-relaxed font-light">
              Start managing employees and deploying attendance kiosks across your facilities with
              military-grade accuracy and total privacy.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Link to="/auth" search={{ next: "/console" }}>
                <Button size="lg">Open Console</Button>
              </Link>
              <Link to="/kiosk">
                <Button size="lg" variant="outline">
                  Launch Attendance Kiosk
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-slate-950 py-10 text-xs text-muted-foreground">
        <div className="mx-auto max-w-7xl px-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ScanFace className="h-4 w-4 text-sky-400" />
            <span className="font-display font-semibold text-white">
              Sentra Biometric Technologies
            </span>
            <span>© {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping-slow" />
              All Systems Operational
            </span>
            <span>Privacy-First</span>
            <span>pgvector Engine</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
