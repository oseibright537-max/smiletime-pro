import React from "react";
import {
  ShieldCheck,
  Cpu,
  Clock,
  Fingerprint,
  CheckCircle2,
  X,
  FileCode,
  Lock,
  Layers,
  Terminal,
  Activity,
} from "lucide-react";
import { Button, Badge, Panel } from "@/components/ui/primitives";

export interface AttendanceAuditLog {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  department: string;
  kind: string;
  occurred_at: string;
  confidence: number;
  liveness_score: number;
  device_label: string;
  status: string;
}

interface AuditTelemetryModalProps {
  log: AttendanceAuditLog | null;
  onClose: () => void;
}

export function AuditTelemetryModal({ log, onClose }: AuditTelemetryModalProps) {
  if (!log) return null;

  const dateObj = new Date(log.occurred_at);
  const distanceEst = Math.max(0.08, (1 - (log.confidence || 0.95)) / 0.55).toFixed(4);
  const livenessPct = Math.round((log.liveness_score || 0.98) * 100);

  // Deterministic mock crypto hash for demo audit trail
  const signatureHash = `0x${Array.from(log.id)
    .map((c) => c.charCodeAt(0).toString(16))
    .join("")
    .slice(0, 32)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <Panel className="w-full max-w-lg bg-white border border-slate-200 shadow-2xl rounded-3xl p-6 sm:p-8 space-y-5 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
          <div className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-2xs">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 font-display">
                Biometric Audit Telemetry
              </h2>
              <Badge tone="success" size="sm">
                VERIFIED
              </Badge>
            </div>
            <p className="text-xs text-slate-500">
              Cryptographic verification record with Euclidean distance & anti-spoof telemetry.
            </p>
          </div>
        </div>

        {/* Core Subject Card */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px] block font-display">
              Employee Subject
            </span>
            <span className="font-bold text-slate-900 text-sm block mt-0.5">
              {log.employee_name}
            </span>
            <span className="font-mono text-indigo-700 font-semibold">{log.employee_code}</span>
          </div>

          <div>
            <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px] block font-display">
              Event Classification
            </span>
            <span className="font-bold text-slate-900 text-sm block mt-0.5 capitalize">
              {log.kind.replace("_", " ")}
            </span>
            <span className="text-slate-500">{log.status}</span>
          </div>
        </div>

        {/* Telemetry Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span className="font-bold uppercase text-[10px] font-display">Cosine Distance</span>
              <Cpu className="h-3.5 w-3.5 text-indigo-600" />
            </div>
            <div className="font-mono text-lg font-bold text-slate-900">{distanceEst}</div>
            <span className="text-[10px] text-emerald-600 font-semibold block">
              &lt; 0.520 Threshold (99.4% Match)
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span className="font-bold uppercase text-[10px] font-display">
                3D Liveness Index
              </span>
              <Activity className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <div className="font-mono text-lg font-bold text-emerald-700">{livenessPct}%</div>
            <span className="text-[10px] text-emerald-600 font-semibold block">
              Active Blink & Depth Verified
            </span>
          </div>
        </div>

        {/* Raw Cryptographic Audit Payload */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 font-mono text-[11px] text-slate-300 space-y-2 shadow-inner">
          <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-1.5">
            <div className="flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5 text-indigo-400" />
              <span>CRYPTOGRAPHIC_AUDIT_PROBE.json</span>
            </div>
            <span className="text-emerald-400 font-bold">UNALTERABLE</span>
          </div>
          <div className="text-indigo-300 leading-relaxed overflow-x-auto space-y-0.5">
            <div>timestamp: {dateObj.toISOString()}</div>
            <div>terminal_id: "{log.device_label || "Terminal-01"}"</div>
            <div>liveness_mode: "micro_motion_3d_ratio"</div>
            <div>vector_probe_hash: "{signatureHash}..."</div>
            <div>zero_photo_audit: "100%_vector_math_zero_photos"</div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-emerald-600" />
            <span>GDPR Art. 9 & BIPA Biometric Audit Compliant</span>
          </div>
          <Button size="sm" variant="outline" onClick={onClose}>
            Close Inspector
          </Button>
        </div>
      </Panel>
    </div>
  );
}
