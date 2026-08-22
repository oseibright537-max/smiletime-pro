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
  ChevronRight,
  Check,
  Flame,
} from "lucide-react";
import { Badge, Button, Panel } from "@/components/ui/primitives";
import { Logo } from "@/components/ui/logo";
import { ComplianceCertModal } from "@/components/compliance/ComplianceCertModal";
import { Footer } from "@/components/ui/Footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "SmileTime Pro",
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

export function Index() {
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
      setTimeout(() => setIsManualScanning(false), 3200);
    }, 2200);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFB] text-[#1B1A20] font-sans selection:bg-[#C7B8F5]/30 selection:text-[#1B1A20]">
      {/* ── Top Floating Header ── */}
      <div className="sticky top-0 z-40 px-4 pt-3 pb-2 sm:px-6">
        <header className="mx-auto max-w-7xl rounded-full border border-[#ECEBF0] bg-white/90 shadow-[0_2px_12px_rgba(27,26,32,0.04)] backdrop-blur-md px-4 sm:px-6 py-2.5 transition-all">
          <div className="flex items-center justify-between">
            <Link to="/" className="group inline-flex items-center gap-3">
              <Logo size="md" subtitle="Biometric Intelligence" />
            </Link>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setIsComplianceModalOpen(true)}
                className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#EEF7F1] border border-[#B8E5C8] text-[#2F9E63] text-xs font-semibold hover:bg-[#E2F3E7] transition-colors cursor-pointer"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-[#2F9E63]" />
                <span>GDPR Zero-Photo Certified</span>
              </button>

              <Link to="/kiosk" className="hidden sm:inline-flex">
                <Button
                  size="sm"
                  variant="outline"
                  icon={<ScanFace className="h-3.5 w-3.5 text-[#1B1A20]" />}
                  className="rounded-full font-semibold"
                >
                  Kiosk Terminal
                </Button>
              </Link>

              <span className="bst-btn-wrap">
                <span className="bst-btn-halo" />
                <Link to="/auth" search={{ next: "/console" }}>
                  <Button
                    size="sm"
                    icon={<ArrowRight className="h-3.5 w-3.5" />}
                    className="bst-btn bst-btn--sm"
                  >
                    Console Hub
                  </Button>
                </Link>
              </span>
            </div>
          </div>
        </header>
      </div>

      {/* ── Hero Section (Two-Column Side-by-Side) ── */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 pt-10 pb-16 sm:pt-16 sm:pb-24">
        {/* Soft Ambient Background Halo */}
        <div className="bst-halo ln-halo--hero opacity-25" />

        <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Left Hero Text Content */}
          <div className="lg:col-span-6 space-y-6 text-left relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#F3EFFC] border border-[#C7B8F5] px-4 py-1.5 text-xs text-[#7C5ED6] font-semibold shadow-2xs">
              <ShieldCheck className="h-3.5 w-3.5 text-[#7C5ED6] shrink-0" />
              <span>Zero-Photo Retention · 100% Volatile RAM Vectors</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-semibold tracking-[-0.03em] text-[#1B1A20] leading-[1.08]">
              Enterprise facial attendance without storing photos.
            </h1>

            <p className="text-[15px] sm:text-[16px] text-[#5C5A66] leading-relaxed font-normal">
              High-speed biometric clock-in powered by on-device neural vectors. Features instant
              12ms recognition, offline edge sync, automated shift rules, and 1-click payroll
              integration.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <span className="bst-btn-wrap w-full sm:w-auto">
                <span className="bst-btn-halo" />
                <Link to="/kiosk" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="bst-btn bst-btn--lg w-full justify-center"
                    icon={<ScanFace className="h-4 w-4" />}
                  >
                    Launch Kiosk Terminal
                  </Button>
                </Link>
              </span>

              <Link to="/auth" search={{ next: "/console" }} className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full justify-center rounded-full border-[#ECEBF0] bg-white text-[#1B1A20] hover:bg-[#F3F2F6] hover:border-[#9B99A6] text-sm font-semibold"
                  icon={<ArrowRight className="h-4 w-4" />}
                >
                  Workforce Console
                </Button>
              </Link>
            </div>

            {/* Performance Indicators */}
            <div className="pt-6 border-t border-[#ECEBF0] grid grid-cols-3 gap-4 text-left">
              <div>
                <div className="text-2xl sm:text-3xl font-bold text-[#1B1A20] tracking-[-0.02em]">
                  12ms
                </div>
                <div className="text-xs text-[#9B99A6] font-medium mt-0.5">Match Latency</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold text-[#1B1A20] tracking-[-0.02em]">
                  99.4%
                </div>
                <div className="text-xs text-[#9B99A6] font-medium mt-0.5">Cosine Precision</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold text-[#1B1A20] tracking-[-0.02em]">
                  0 Photos
                </div>
                <div className="text-xs text-[#9B99A6] font-medium mt-0.5">Privacy Guaranteed</div>
              </div>
            </div>
          </div>

          {/* Right Realistic Interactive Biometric Simulator Card */}
          <div className="lg:col-span-6 relative z-10">
            <div className="rounded-[32px] bg-[#131217] border border-[#2B2934] shadow-[0_20px_60px_rgba(0,0,0,0.5)] p-4 sm:p-6 text-white relative overflow-hidden">
              {/* Top Terminal Status Header */}
              <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-[#2B2934] text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[#2F9E63] animate-pulse" />
                  <span className="font-mono text-[#A8A6B4] text-[11px]">
                    {liveTime || "09:41:24 AM"}
                  </span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#1B1A20] border border-[#2B2934] text-[#C7B8F5] text-[11px] font-mono font-medium">
                  <Cpu className="h-3 w-3" />
                  <span>ON-DEVICE 60 FPS</span>
                </div>
              </div>

              {/* Viewfinder Canvas Area */}
              <div className="relative aspect-[4/3] rounded-2xl bg-[#1B1A20] border border-[#2B2934] flex flex-col items-center justify-center p-6 text-center overflow-hidden">
                {/* Background Grid Pattern */}
                <div
                  className="absolute inset-0 opacity-10 pointer-events-none"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 1px 1px, #C7B8F5 1px, transparent 0)",
                    backgroundSize: "22px 22px",
                  }}
                />

                {/* Laser Scan Sweep Animation */}
                <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-[#C7B8F5] to-transparent shadow-[0_0_12px_#C7B8F5] pointer-events-none animate-scanline" />

                {/* 4 Corner Reticle Guides */}
                <div className="absolute inset-5 pointer-events-none flex flex-col justify-between">
                  <div className="flex justify-between">
                    <div className="w-5 h-5 border-t-2 border-l-2 border-[#C7B8F5]/80 rounded-tl" />
                    <div className="w-5 h-5 border-t-2 border-r-2 border-[#C7B8F5]/80 rounded-tr" />
                  </div>
                  <div className="flex justify-between">
                    <div className="w-5 h-5 border-b-2 border-l-2 border-[#C7B8F5]/80 rounded-bl" />
                    <div className="w-5 h-5 border-b-2 border-r-2 border-[#C7B8F5]/80 rounded-br" />
                  </div>
                </div>

                {/* Dynamic Facial Landmarks Graphic */}
                {activeStep < 3 ? (
                  <div className="relative flex flex-col items-center justify-center space-y-3.5">
                    <div className="relative w-32 h-32 rounded-full border border-[#C7B8F5]/30 bg-[#C7B8F5]/5 flex items-center justify-center">
                      <ScanFace className="h-16 w-16 text-[#C7B8F5]/85 transition-all duration-300" />
                      {/* Geometric Landmark Nodes */}
                      <div className="absolute top-7 left-9 h-1.5 w-1.5 rounded-full bg-[#C7B8F5] animate-ping" />
                      <div className="absolute top-7 right-9 h-1.5 w-1.5 rounded-full bg-[#C7B8F5] animate-ping" />
                      <div className="absolute bottom-9 left-11 h-1.5 w-1.5 rounded-full bg-[#C7B8F5] animate-pulse" />
                      <div className="absolute bottom-9 right-11 h-1.5 w-1.5 rounded-full bg-[#C7B8F5] animate-pulse" />
                    </div>

                    <div className="space-y-1">
                      <div className="font-mono text-xs font-semibold text-[#C7B8F5]">
                        {activeStep === 0 && "Locating 68 Facial Landmarks…"}
                        {activeStep === 1 && "Generating 128-D Vector (Volatile RAM)…"}
                        {activeStep === 2 && "Vector Cosine Distance: 0.142 (< 0.52)…"}
                      </div>
                      <div className="text-[11px] text-[#82808E]">
                        {activeStep === 0 && "Aligning bounding box & pose angle"}
                        {activeStep === 1 && "Raw pixels discarded immediately"}
                        {activeStep === 2 && "99.4% Match Confidence verified"}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Verified Result State */
                  <div className="w-full max-w-sm p-4.5 rounded-2xl bg-[#131217] border border-[#2F9E63]/40 shadow-xl text-center space-y-2.5 animate-in zoom-in-95 duration-200">
                    <div className="mx-auto h-11 w-11 rounded-full bg-[#2F9E63]/10 border border-[#2F9E63]/30 flex items-center justify-center text-[#2F9E63]">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#2F9E63]/10 border border-[#2F9E63]/20 text-[#2F9E63] text-[10.5px] font-bold tracking-wider uppercase">
                        Clocked In · 8:15 AM · On Time
                      </div>
                      <h3 className="text-base font-semibold text-[#F4F3F7] mt-1">Elena Rostova</h3>
                      <p className="text-xs text-[#82808E] font-mono">EMP-0142 · Engineering</p>
                    </div>
                    <div className="pt-2 border-t border-[#2B2934] text-[11px] text-[#82808E]">
                      Departure scheduled for 5:00 PM
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Interactive Simulation Bar */}
              <div className="mt-4 pt-3 border-t border-[#2B2934] flex items-center justify-between text-xs">
                <button
                  onClick={handleSimulateScan}
                  disabled={isManualScanning}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1B1A20] hover:bg-[#232128] text-[#C7B8F5] font-semibold transition-colors cursor-pointer border border-[#2B2934] text-xs"
                >
                  <Zap className="h-3.5 w-3.5 text-[#C7B8F5]" />
                  <span>Simulate Live Scan</span>
                </button>

                <div className="flex items-center gap-1.5 text-[#2F9E63] text-xs font-semibold">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Zero Photo Leak Proof</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3 Focused Core Capabilities ── */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 border-t border-[#ECEBF0]">
        <div className="text-center space-y-2 mb-12">
          <span className="bst-kicker">Engineered for Accuracy</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1B1A20] tracking-[-0.025em]">
            Designed for Simplicity and Reliability
          </h2>
          <p className="text-xs sm:text-sm text-[#5C5A66] max-w-md mx-auto">
            Clean, friction-free attendance tracking without complex hardware or privacy risks.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-5">
          {/* 1. Offline-First Resilience */}
          <div className="p-7 bg-white border border-[#ECEBF0] shadow-[0_2px_10px_rgba(27,26,32,0.04)] rounded-[26px] space-y-4 hover:border-[#9B99A6] hover:shadow-[0_6px_24px_rgba(27,26,32,0.06)] hover:-translate-y-0.5 transition-all">
            <div className="bst-icon-tile">
              <WifiOff className="h-5 w-5 text-[#1B1A20]" />
            </div>
            <h3 className="text-base font-semibold text-[#1B1A20]">Offline Edge Resilience</h3>
            <p className="text-xs text-[#5C5A66] leading-relaxed">
              Continues clocking seamlessly even during internet dropouts, storing encrypted punches
              locally and syncing automatically when reconnected.
            </p>
          </div>

          {/* 2. Zero-Photo Privacy */}
          <div className="p-7 bg-white border border-[#ECEBF0] shadow-[0_2px_10px_rgba(27,26,32,0.04)] rounded-[26px] space-y-4 hover:border-[#9B99A6] hover:shadow-[0_6px_24px_rgba(27,26,32,0.06)] hover:-translate-y-0.5 transition-all">
            <div className="bst-icon-tile">
              <ShieldCheck className="h-5 w-5 text-[#2F9E63]" />
            </div>
            <h3 className="text-base font-semibold text-[#1B1A20]">Zero-Photo Retention</h3>
            <p className="text-xs text-[#5C5A66] leading-relaxed">
              Photos are processed in volatile device RAM into mathematical vectors and instantly
              discarded. GDPR Article 9 & BIPA certified.
            </p>
          </div>

          {/* 3. 1-Click Payroll Sync */}
          <div className="p-7 bg-white border border-[#ECEBF0] shadow-[0_2px_10px_rgba(27,26,32,0.04)] rounded-[26px] space-y-4 hover:border-[#9B99A6] hover:shadow-[0_6px_24px_rgba(27,26,32,0.06)] hover:-translate-y-0.5 transition-all">
            <div className="bst-icon-tile">
              <FileSpreadsheet className="h-5 w-5 text-[#7C5ED6]" />
            </div>
            <h3 className="text-base font-semibold text-[#1B1A20]">1-Click Payroll Integration</h3>
            <p className="text-xs text-[#5C5A66] leading-relaxed">
              Export standardized timesheets formatted directly for Gusto, QuickBooks, ADP, and CSV
              with automated shift overtime calculations.
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
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
