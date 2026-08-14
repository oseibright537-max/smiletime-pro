import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Lock,
  ScanFace,
  ShieldCheck,
  Zap,
  Clock,
  Layers,
  Sparkles,
  Award,
  Cpu,
  BarChart3,
  Building,
  UserCheck,
  FileSpreadsheet,
  FileText,
  Activity,
  Download,
  WifiOff,
  Bell,
  Scale,
  Palette,
  PartyPopper,
} from "lucide-react";
import { Badge, Button, Panel } from "@/components/ui/primitives";
import { Logo } from "@/components/ui/logo";
import { ComplianceCertModal } from "@/components/compliance/ComplianceCertModal";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "FaceTime Attendance — Enterprise Biometric Facial Recognition",
      },
      {
        name: "description",
        content:
          "Zero-photo facial recognition attendance platform with offline edge resilience, automated shift window enforcement, and 1-click payroll integration.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [activeStep, setActiveStep] = useState(0);
  const [isComplianceModalOpen, setIsComplianceModalOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-500/20 selection:text-indigo-900">
      {/* Top Floating Glass Navigation */}
      <div className="sticky top-0 z-40 px-4 pt-3 pb-2 sm:px-6">
        <header className="mx-auto max-w-7xl rounded-2xl border border-slate-200/80 bg-white/80 shadow-xs backdrop-blur-md px-4 sm:px-6 py-3 transition-all">
          <div className="flex items-center justify-between">
            <Link to="/" className="group inline-flex items-center gap-3">
              <Logo size="md" subtitle="Biometric Intelligence" />
            </Link>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setIsComplianceModalOpen(true)}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold hover:bg-emerald-100 transition-colors cursor-pointer"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>GDPR Zero-Photo Certified</span>
              </button>

              <Link to="/kiosk" className="hidden sm:inline-flex">
                <Button
                  size="sm"
                  variant="outline"
                  icon={<ScanFace className="h-4 w-4 text-indigo-600" />}
                >
                  Kiosk Terminal
                </Button>
              </Link>

              <Link to="/auth" search={{ next: "/console" }}>
                <Button
                  size="sm"
                  icon={<ArrowRight className="h-4 w-4" />}
                  className="shadow-sm shadow-indigo-600/20"
                >
                  Console Hub
                </Button>
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
              <span className="truncate">
                Zero Photo Storage · Irreversible Vectors · Offline Edge Sync
              </span>
            </div>

            <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.15] break-words">
              Enterprise facial attendance without storing photos.
            </h1>

            <p className="text-sm sm:text-lg text-slate-600 leading-relaxed max-w-2xl font-light">
              High-speed biometric clock-in terminal powered by on-device neural vectors. Features
              offline edge resilience, automated shift window enforcement, real-time Slack alerts,
              and 1-click payroll integration.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <Link to="/auth" search={{ next: "/console" }} className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full justify-center shadow-md shadow-indigo-600/20"
                  icon={<ArrowRight className="h-4 w-4" />}
                >
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
                <span>Offline Edge Resilience</span>
              </div>
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>1-Click Payroll Sync</span>
              </div>
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Real-Time Slack Alerts</span>
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
                  LIVE SCANNER SIMULATOR
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
                  {activeStep === 1 && "Extracting 128-D Vector (Volatile RAM)…"}
                  {activeStep === 2 && "pgvector Cosine Distance: 0.142 (&lt; 0.52)…"}
                  {activeStep === 3 && "Verified: Elena Rostova (EMP-0142) · On Time"}
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

      {/* 6 Enterprise Capabilities Showcase */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16 border-t border-slate-200">
        <div className="text-center space-y-3 mb-12">
          <Badge tone="primary" size="md">
            ENTERPRISE SUITE
          </Badge>
          <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Built for Modern HR, Operations & Compliance
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto">
            Everything your company needs to streamline attendance, eliminate time theft, and
            automate payroll.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 1. Offline-First Resilience */}
          <Panel className="p-6 bg-white border border-slate-200 shadow-sm rounded-3xl space-y-3">
            <div className="h-11 w-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shadow-2xs">
              <WifiOff className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 font-display">
              Offline Edge Resilience
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              If office Wi-Fi drops, the terminal continues matching via local cache, queues punches
              in secure edge storage, and automatically syncs to Postgres when restored.
            </p>
          </Panel>

          {/* 2. 1-Click Payroll Sync */}
          <Panel className="p-6 bg-white border border-slate-200 shadow-sm rounded-3xl space-y-3">
            <div className="h-11 w-11 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shadow-2xs">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 font-display">
              1-Click Payroll Integration
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Direct exports formatted for Gusto, ADP Workforce Now, QuickBooks Time, BambooHR, and
              Deel with automated overtime (1.5x/2.0x) and break deduction math.
            </p>
          </Panel>

          {/* 3. Real-Time Manager Webhook Alerts */}
          <Panel className="p-6 bg-white border border-slate-200 shadow-sm rounded-3xl space-y-3">
            <div className="h-11 w-11 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shadow-2xs">
              <Bell className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 font-display">
              Real-Time Slack & Teams Alerts
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Automated notifications sent directly to manager channels whenever an employee arrives
              late, unrecognized faces are detected, or overtime limits are approached.
            </p>
          </Panel>

          {/* 4. 3D Liveness & Anti-Spoof Telemetry */}
          <Panel className="p-6 bg-white border border-slate-200 shadow-sm rounded-3xl space-y-3">
            <div className="h-11 w-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-2xs">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 font-display">
              Anti-Spoof 3D Liveness Audit
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Prevents buddy-punching using micro-motion 3D ratio analysis. Every punch logs an
              unalterable cryptographic audit trail with Euclidean distance and device stamps.
            </p>
          </Panel>

          {/* 5. Certified Zero-Photo Privacy */}
          <Panel className="p-6 bg-white border border-slate-200 shadow-sm rounded-3xl space-y-3">
            <div className="h-11 w-11 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shadow-2xs">
              <Award className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 font-display">
              Certified Zero-Photo Privacy
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Fully compliant with European GDPR Art. 9, California CCPA, and Illinois BIPA.
              Generates downloadable Data Processing Addendums (DPAs) for corporate legal teams.
            </p>
          </Panel>

          {/* 6. White-Labeling & Personalized Greetings */}
          <Panel className="p-6 bg-white border border-slate-200 shadow-sm rounded-3xl space-y-3">
            <div className="h-11 w-11 rounded-2xl bg-violet-50 border border-violet-200 text-violet-600 flex items-center justify-center shadow-2xs">
              <PartyPopper className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 font-display">
              Milestone Greetings & Branding
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Personalized morning greetings, anniversary celebrations, live announcement tickers,
              and company custom branding on every terminal.
            </p>
          </Panel>
        </div>
      </section>

      {/* Compliance Certification Modal */}
      <ComplianceCertModal
        isOpen={isComplianceModalOpen}
        onClose={() => setIsComplianceModalOpen(false)}
        companyName="Your Organization"
      />
    </div>
  );
}
