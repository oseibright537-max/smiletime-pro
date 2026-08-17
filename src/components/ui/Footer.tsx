import React from "react";
import { Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  Zap,
  Lock,
  Award,
  Clock,
  ScanFace,
  FileSpreadsheet,
  Bell,
  Cpu,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";

interface FooterProps {
  onOpenCompliance?: () => void;
  className?: string;
}

export function Footer({ onOpenCompliance, className = "" }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className={`bg-slate-950 text-slate-400 border-t border-slate-800/80 pt-12 sm:pt-16 pb-12 transition-colors ${className}`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Top Feature Highlights Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-12 border-b border-slate-800/80">
          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-slate-900/50 border border-slate-800/60">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200 font-display uppercase tracking-wider">
                Zero-Photo Storage
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Raw photos discarded in RAM immediately after 128-D vector calculation.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-slate-900/50 border border-slate-800/60">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200 font-display uppercase tracking-wider">
                Sub-Second Matching
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Instant face detection and verification under 800ms per employee.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-slate-900/50 border border-slate-800/60">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200 font-display uppercase tracking-wider">
                Offline Edge Resilience
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Matches & queues punches offline; auto-syncs when connectivity returns.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-slate-900/50 border border-slate-800/60">
            <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200 font-display uppercase tracking-wider">
                1-Click Payroll Sync
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Ready export presets for Gusto, ADP, QuickBooks, BambooHR, and Deel.
              </p>
            </div>
          </div>
        </div>

        {/* Main Footer Navigation Columns */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 sm:gap-10 py-12 border-b border-slate-800/80">
          {/* Col 1: Brand & Bio (md:col-span-4) */}
          <div className="md:col-span-4 space-y-4">
            <Link to="/" className="inline-flex items-center gap-2 group">
              <Logo size="md" subtitle="Biometric Intelligence" />
            </Link>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              Enterprise facial attendance platform powered by on-device neural vectors.
              Engineered with zero raw photo retention, active anti-spoof liveness, and automated
              workforce shift intelligence.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-[11px] font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Engine v2.4
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-[11px] font-mono">
                GDPR Art. 9 Certified
              </span>
            </div>
          </div>

          {/* Col 2: Kiosk & Terminal (md:col-span-3) */}
          <div className="md:col-span-3 space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-200 font-display">
              Terminal Solutions
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link
                  to="/kiosk"
                  className="hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5"
                >
                  <ScanFace className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Kiosk Terminal Station</span>
                </Link>
              </li>
              <li>
                <span className="text-slate-400 inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-500" />
                  <span>Smart Shift Auto-Detection</span>
                </span>
              </li>
              <li>
                <span className="text-slate-400 inline-flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-slate-500" />
                  <span>Edge Vector Caching (1ms)</span>
                </span>
              </li>
              <li>
                <span className="text-slate-400 inline-flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-slate-500" />
                  <span>Night Lockdown (Post 8 PM)</span>
                </span>
              </li>
            </ul>
          </div>

          {/* Col 3: Console & Management (md:col-span-3) */}
          <div className="md:col-span-3 space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-200 font-display">
              Workforce Hub
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link
                  to="/console"
                  className="hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5"
                >
                  <ChevronRight className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Console Overview & Analytics</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/console/employees"
                  className="hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5"
                >
                  <ChevronRight className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Staff Roster & Biometric Enrolment</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/console/settings"
                  className="hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5"
                >
                  <ChevronRight className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Settings & Manager Webhooks</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/auth"
                  search={{ next: "/console" }}
                  className="hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5"
                >
                  <ChevronRight className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Sign In & Tenant Access</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Compliance & Legal (md:col-span-2) */}
          <div className="md:col-span-2 space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-200 font-display">
              Privacy & Legal
            </h4>
            <ul className="space-y-2.5 text-xs">
              {onOpenCompliance && (
                <li>
                  <button
                    onClick={onOpenCompliance}
                    className="hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5 text-left cursor-pointer text-emerald-300 font-medium"
                  >
                    <Award className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span>Legal DPA Certificate</span>
                  </button>
                </li>
              )}
              <li className="text-slate-400">GDPR Art. 9 Adherent</li>
              <li className="text-slate-400">CCPA & BIPA Ready</li>
              <li className="text-slate-400">Zero Raw Photo Storage</li>
              <li className="text-slate-400">AES-256 GCM Vectors</li>
            </ul>
          </div>
        </div>

        {/* Bottom Copyright & Security Disclaimer Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
            <span>© {currentYear} FaceTime Biometric Systems Inc. All rights reserved.</span>
            <span className="hidden sm:inline text-slate-700">·</span>
            <span>Enterprise Facial Attendance & Workforce Automation</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>100% On-Device Neural Matching</span>
            <span className="text-slate-700">·</span>
            <span>Zero-Photo Retention Architecture</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
