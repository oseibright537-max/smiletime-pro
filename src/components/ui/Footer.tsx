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
      className={`border-t border-[#ECEBF0] bg-white text-[#5C5A66] pt-14 pb-12 transition-colors ${className}`}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Main Footer Navigation Columns */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 sm:gap-10 pb-12">
          {/* Col 1: Brand & Bio (md:col-span-5) */}
          <div className="md:col-span-5 space-y-3">
            <Link to="/" className="inline-flex items-center gap-2 group">
              <Logo size="md" subtitle="Biometric Intelligence" />
            </Link>
            <p className="text-[13px] text-[#5C5A66] leading-relaxed max-w-sm">
              Enterprise facial attendance platform powered by on-device neural vectors. Zero photo
              retention, active anti-spoof liveness, and 1-click payroll integration.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EEF7F1] border border-[#B8E5C8] text-[#2F9E63] text-[11px] font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-[#2F9E63] animate-pulse" />
                Live Engine v2.4
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#F3F2F6] border border-[#ECEBF0] text-[#5C5A66] text-[11px] font-mono">
                GDPR Art. 9 Certified
              </span>
            </div>
          </div>

          {/* Col 2: Kiosk & Terminal (md:col-span-2) */}
          <div className="md:col-span-2 space-y-3">
            <span className="bst-tag">Terminal</span>
            <ul className="space-y-2 text-[13px]">
              <li>
                <Link
                  to="/kiosk"
                  className="hover:text-[#1B1A20] transition-colors inline-flex items-center gap-1"
                >
                  <span>Kiosk Station</span>
                </Link>
              </li>
              <li>
                <span className="text-[#9B99A6]">Smart Shifts</span>
              </li>
              <li>
                <span className="text-[#9B99A6]">Edge Caching</span>
              </li>
            </ul>
          </div>

          {/* Col 3: Console & Management (md:col-span-3) */}
          <div className="md:col-span-3 space-y-3">
            <span className="bst-tag">Workspace</span>
            <ul className="space-y-2 text-[13px]">
              <li>
                <Link
                  to="/console"
                  className="hover:text-[#1B1A20] transition-colors inline-flex items-center gap-1"
                >
                  <span>Console Overview</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/console/employees"
                  className="hover:text-[#1B1A20] transition-colors inline-flex items-center gap-1"
                >
                  <span>Staff & Enrolment</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/console/settings"
                  className="hover:text-[#1B1A20] transition-colors inline-flex items-center gap-1"
                >
                  <span>Settings & Shifts</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/auth"
                  search={{ next: "/console" }}
                  className="hover:text-[#1B1A20] transition-colors inline-flex items-center gap-1"
                >
                  <span>Sign In</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Compliance & Legal (md:col-span-2) */}
          <div className="md:col-span-2 space-y-3">
            <span className="bst-tag">Privacy</span>
            <ul className="space-y-2 text-[13px]">
              {onOpenCompliance && (
                <li>
                  <button
                    onClick={onOpenCompliance}
                    className="hover:text-[#1B1A20] transition-colors text-left cursor-pointer text-[#2F9E63] font-semibold"
                  >
                    <span>DPA Certificate</span>
                  </button>
                </li>
              )}
              <li className="text-[#9B99A6]">GDPR Article 9</li>
              <li className="text-[#9B99A6]">Zero Photo RAM</li>
              <li className="text-[#9B99A6]">AES-256 Vectors</li>
            </ul>
          </div>
        </div>

        {/* Bottom Copyright Bar */}
        <div className="pt-6 border-t border-[#ECEBF0] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#9B99A6]">
          <div>
            <span>© {currentYear} SmileTime Biometric Systems Inc.</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span>100% Volatile RAM Vectors</span>
            <span>·</span>
            <span>Zero Raw Photo Storage</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
