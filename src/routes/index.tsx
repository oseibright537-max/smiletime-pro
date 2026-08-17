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
import { Footer } from "@/components/ui/Footer";

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
  const [isManualScanning, setIsManualScanning] = useState(false);
  const [isComplianceModalOpen, setIsComplianceModalOpen] = useState(false);
  const [liveTime, setLiveTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLiveTime(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isManualScanning) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 2800);
    return () => clearInterval(interval);
  }, [isManualScanning]);

  const handleSimulateScan = () => {
    setIsManualScanning(true);
    setActiveStep(0);
    setTimeout(() => setActiveStep(1), 600);
    setTimeout(() => setActiveStep(2), 1400);
    setTimeout(() => {
      setActiveStep(3);
      setTimeout(() => setIsManualScanning(false), 3000);
    }, 2200);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-500/20 selection:text-indigo-900 font-sans">
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
      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 pt-12 pb-20 sm:pt-24 sm:pb-32">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Hero Text Content */}
          <div className="lg:col-span-6 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50/80 border border-indigo-200/80 px-3.5 py-1.5 text-xs text-indigo-800 font-semibold shadow-2xs">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
              <span>Zero-Photo Retention · 100% Volatile RAM Vectors</span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-950 leading-[1.12]">
              Enterprise facial attendance without storing photos.
            </h1>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
              High-speed biometric clock-in powered by on-device neural vectors. Features instant
              12ms recognition, offline edge sync, automated shift rules, and 1-click payroll
              integration.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <Link to="/kiosk" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full justify-center px-8 py-3.5 rounded-2xl shadow-lg shadow-indigo-600/20 text-sm font-bold"
                  icon={<ScanFace className="h-4 w-4" />}
                >
                  Launch Kiosk Terminal
                </Button>
              </Link>

              <Link to="/auth" search={{ next: "/console" }} className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full justify-center px-8 py-3.5 rounded-2xl border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-semibold"
                  icon={<ArrowRight className="h-4 w-4" />}
                >
                  Workforce Console
                </Button>
              </Link>
            </div>

            {/* Performance Indicators */}
            <div className="pt-6 border-t border-slate-200 grid grid-cols-3 gap-4 text-left">
              <div>
                <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900">12ms</div>
                <div className="text-xs text-slate-500 font-medium">Match Latency</div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900">99.4%</div>
                <div className="text-xs text-slate-500 font-medium">Cosine Precision</div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900">0 Photos</div>
                <div className="text-xs text-slate-500 font-medium">Privacy Guaranteed</div>
              </div>
            </div>
          </div>

          {/* Right Realistic Interactive Biometric Simulator */}
          <div className="lg:col-span-6">
            <div className="rounded-[36px] bg-slate-950 border border-slate-800 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.5)] p-4 sm:p-6 text-white relative overflow-hidden">
              {/* Top Terminal Status Header */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800/80 text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-mono text-slate-300 text-[11px]">{liveTime || "09:41:24 AM"}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] font-mono font-medium">
                  <Cpu className="h-3 w-3" />
                  <span>ON-DEVICE 60 FPS</span>
                </div>
              </div>

              {/* Viewfinder Canvas Area */}
              <div className="relative aspect-[4/3] rounded-2xl bg-slate-900/90 border border-slate-800/80 flex flex-col items-center justify-center p-6 text-center overflow-hidden">
                {/* Background Grid Pattern */}
                <div
                  className="absolute inset-0 opacity-10 pointer-events-none"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 1px 1px, #818cf8 1px, transparent 0)",
                    backgroundSize: "24px 24px",
                  }}
                />

                {/* Vertical Laser Scan Sweep Animation */}
                <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_12px_#818cf8] pointer-events-none animate-scanline" />

                {/* 4 Minimal Corner Reticle Guides */}
                <div className="absolute inset-6 pointer-events-none flex flex-col justify-between">
                  <div className="flex justify-between">
                    <div className="w-5 h-5 border-t-2 border-l-2 border-indigo-400/70 rounded-tl-md" />
                    <div className="w-5 h-5 border-t-2 border-r-2 border-indigo-400/70 rounded-tr-md" />
                  </div>
                  <div className="flex justify-between">
                    <div className="w-5 h-5 border-b-2 border-l-2 border-indigo-400/70 rounded-bl-md" />
                    <div className="w-5 h-5 border-b-2 border-r-2 border-indigo-400/70 rounded-br-md" />
                  </div>
                </div>

                {/* Dynamic Facial Landmarks Graphic */}
                {activeStep < 3 ? (
                  <div className="relative flex flex-col items-center justify-center space-y-4">
                    <div className="relative w-36 h-36 rounded-full border border-indigo-500/30 bg-indigo-500/5 flex items-center justify-center">
                      <ScanFace className="h-16 w-16 text-indigo-400/80 transition-all duration-300" />
                      {/* Geometric Landmark Nodes */}
                      <div className="absolute top-8 left-10 h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping" />
                      <div className="absolute top-8 right-10 h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping" />
                      <div className="absolute bottom-10 left-12 h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                      <div className="absolute bottom-10 right-12 h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    </div>

                    <div className="space-y-1">
                      <div className="font-mono text-xs font-semibold text-indigo-300">
                        {activeStep === 0 && "Locating 68 Facial Landmarks…"}
                        {activeStep === 1 && "Generating 128-D Vector (Volatile RAM)…"}
                        {activeStep === 2 && "pgvector Cosine Distance: 0.142 (< 0.52)…"}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {activeStep === 0 && "Aligning bounding box & pose angle"}
                        {activeStep === 1 && "Raw pixels discarded immediately"}
                        {activeStep === 2 && "99.4% Match Confidence verified"}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Verified Result State */
                  <div className="w-full max-w-sm p-5 rounded-2xl bg-slate-950/90 border border-emerald-500/30 shadow-xl text-center space-y-3 animate-in zoom-in-95 duration-200">
                    <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-bold tracking-wider uppercase">
                        Clocked In · 8:15 AM · On Time
                      </div>
                      <h3 className="text-lg font-bold text-white mt-1 font-display">
                        Elena Rostova
                      </h3>
                      <p className="text-xs text-slate-400 font-mono">EMP-0142 · Engineering</p>
                    </div>
                    <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                      Departure scheduled for 5:00 PM
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Interactive Simulation Bar */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <button
                  onClick={handleSimulateScan}
                  disabled={isManualScanning}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 font-semibold transition-colors cursor-pointer border border-slate-700 text-xs"
                >
                  <Zap className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Simulate Live Scan</span>
                </button>

                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-mono font-semibold">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Zero Photo Leak Proof</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Focused Core Capabilities */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-20 border-t border-slate-200/70">
        <div className="text-center space-y-3 mb-14">
          <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Designed for Simplicity and Reliability
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Clean, friction-free attendance tracking without complex hardware or privacy risks.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {/* 1. Offline-First Resilience */}
          <div className="p-8 bg-white border border-slate-200/80 shadow-xs rounded-[28px] space-y-4 hover:shadow-md transition-shadow">
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <WifiOff className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 font-display">
              Offline Edge Resilience
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Continues clocking seamlessly even during internet dropouts, storing encrypted punches
              locally and syncing automatically when reconnected.
            </p>
          </div>

          {/* 2. Zero-Photo Privacy */}
          <div className="p-8 bg-white border border-slate-200/80 shadow-xs rounded-[28px] space-y-4 hover:shadow-md transition-shadow">
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 font-display">
              Zero-Photo Retention
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Photos are processed in volatile device RAM into mathematical vectors and instantly
              discarded. GDPR Article 9 & BIPA certified.
            </p>
          </div>

          {/* 3. 1-Click Payroll Sync */}
          <div className="p-8 bg-white border border-slate-200/80 shadow-xs rounded-[28px] space-y-4 hover:shadow-md transition-shadow">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 font-display">
              1-Click Payroll Integration
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Export standardized timesheets formatted directly for Gusto, QuickBooks, ADP, and
              CSV with automated shift overtime calculations.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer onOpenCompliance={() => setIsComplianceModalOpen(true)} />

      {/* Compliance Certification Modal */}
      <ComplianceCertModal
        isOpen={isComplianceModalOpen}
        onClose={() => setIsComplianceModalOpen(false)}
        companyName="Your Organization"
      />
    </div>
  );
}
