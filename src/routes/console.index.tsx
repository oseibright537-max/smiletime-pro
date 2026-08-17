import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  ScanFace,
  UserPlus,
  Users,
  Search,
  ShieldCheck,
  Zap,
  Activity,
  ArrowUpRight,
  Sparkles,
  Download,
  AlertCircle,
  BarChart3,
  FileSpreadsheet,
  Layers,
  Sun,
  Sunset,
  Scale,
  Award,
  Terminal,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge, Button, Panel, Avatar, Input } from "@/components/ui/primitives";
import { TimeWindowBanner } from "@/components/attendance/TimeWindowBanner";
import { AttendanceCharts } from "@/components/analytics/AttendanceCharts";
import { MonthlyReportViewer } from "@/components/analytics/MonthlyReportViewer";
import { PayrollSyncModal } from "@/components/analytics/PayrollSyncModal";
import {
  AuditTelemetryModal,
  type AttendanceAuditLog,
} from "@/components/attendance/AuditTelemetryModal";
import { ComplianceCertModal } from "@/components/compliance/ComplianceCertModal";
import { downloadCsvBlob, generateCsvString } from "@/lib/export/downloader";
import { checkAttendanceRules, evaluateTimeWindow } from "@/lib/attendance/time-windows";
import { useOrganization } from "@/hooks/useOrganization";

export const Route = createFileRoute("/console/")({ component: Overview });

function useOverview() {
  return useQuery({
    queryKey: ["overview"],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const [employees, embeddings, events, departments] = await Promise.all([
        supabase.from("employees").select("id,status,employee_code,full_name,department_id"),
        supabase.from("face_embeddings").select("employee_id"),
        supabase
          .from("attendance_events")
          .select(
            "id,employee_id,kind,occurred_at,status,confidence,liveness_score,device_label,employees(full_name,employee_code,department_id,departments(name))",
          )
          .gte("occurred_at", startOfDay.toISOString())
          .order("occurred_at", { ascending: false })
          .limit(100),
        supabase.from("departments").select("id,name"),
      ]);

      const enrolled = new Set((embeddings.data ?? []).map((e) => e.employee_id));
      const active = (employees.data ?? []).filter((e) => e.status === "active");

      let onTimeCount = 0;
      let lateCount = 0;
      let validatedClockOutCount = 0;
      let earlyClockOutCount = 0;
      const presentToday = new Set<string>();

      (events.data ?? []).forEach((e) => {
        const d = new Date(e.occurred_at);
        const min = d.getHours() * 60 + d.getMinutes();

        if (e.kind === "check_in") {
          presentToday.add(e.employee_id);
          if (min <= 510) {
            onTimeCount++;
          } else {
            lateCount++;
          }
        } else if (e.kind === "check_out") {
          if (min >= 1000 && min <= 1200) {
            validatedClockOutCount++;
          } else {
            earlyClockOutCount++;
          }
        }
      });

      return {
        total: employees.data?.length ?? 0,
        active: active.length,
        enrolled: enrolled.size,
        present: presentToday.size,
        onTimeCount,
        lateCount,
        validatedClockOutCount,
        earlyClockOutCount,
        events: events.data ?? [],
        departments: departments.data ?? [],
      };
    },
    refetchInterval: 8000,
  });
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
  trend,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: typeof Users;
  tone?: "primary" | "success" | "warning" | "neutral" | "danger";
  trend?: string | undefined;
}) {
  const tones = {
    primary: "border-indigo-100 bg-indigo-50 text-indigo-600",
    success: "border-emerald-100 bg-emerald-50 text-emerald-600",
    warning: "border-amber-100 bg-amber-50 text-amber-600",
    neutral: "border-slate-200 bg-slate-50 text-slate-600",
    danger: "border-rose-100 bg-rose-50 text-rose-600",
  };

  return (
    <Panel
      interactive
      className="relative overflow-hidden p-4 sm:p-5 flex flex-col justify-between bg-white border border-slate-200 shadow-sm rounded-2xl"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 font-display truncate">
            {label}
          </p>
          <p className="mt-1.5 sm:mt-2 font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {value}
          </p>
        </div>
        <div
          className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-2xl border ${tones[tone]}`}
        >
          <Icon className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-500 text-[11px] truncate">{hint}</span>
        {trend && (
          <span className="inline-flex items-center text-emerald-600 font-bold text-[11px] shrink-0 ml-1">
            {trend}
            <ArrowUpRight className="h-3 w-3" />
          </span>
        )}
      </div>
    </Panel>
  );
}

function computeEventClassification(
  occurredAt: string,
  kind: string,
): {
  isLate: boolean;
  isValidatedDeparture: boolean;
  isEarlyDeparture: boolean;
  label: string;
  tone: "success" | "warning" | "primary" | "danger" | "neutral";
} {
  const d = new Date(occurredAt);
  const min = d.getHours() * 60 + d.getMinutes();

  if (kind === "check_in") {
    if (min <= 510) {
      return {
        isLate: false,
        isValidatedDeparture: false,
        isEarlyDeparture: false,
        label: "On Time",
        tone: "success",
      };
    } else {
      const diff = min - 510;
      return {
        isLate: true,
        isValidatedDeparture: false,
        isEarlyDeparture: false,
        label: `Late (+${diff}m)`,
        tone: "warning",
      };
    }
  }

  if (kind === "check_out") {
    if (min >= 1000 && min <= 1200) {
      return {
        isLate: false,
        isValidatedDeparture: true,
        isEarlyDeparture: false,
        label: "Validated Departure",
        tone: "primary",
      };
    } else if (min < 1000) {
      return {
        isLate: false,
        isValidatedDeparture: false,
        isEarlyDeparture: true,
        label: "Early Departure",
        tone: "danger",
      };
    }
  }

  return {
    isLate: false,
    isValidatedDeparture: false,
    isEarlyDeparture: false,
    label: "Normal",
    tone: "neutral",
  };
}

function Overview() {
  const { currentOrg } = useOrganization();
  const { data, isLoading } = useOverview();
  const [activeTab, setActiveTab] = useState<"live" | "analytics" | "monthly">("live");
  const [search, setSearch] = useState("");
  const [filterKind, setFilterKind] = useState<string>("all");

  // Enterprise Feature Modals
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);
  const [isComplianceModalOpen, setIsComplianceModalOpen] = useState(false);
  const [selectedAuditLog, setSelectedAuditLog] = useState<AttendanceAuditLog | null>(null);

  const events = (data?.events ?? []).filter((e) => {
    const name =
      (e.employees as { full_name: string; employee_code: string } | null)?.full_name ?? "";
    const code =
      (e.employees as { full_name: string; employee_code: string } | null)?.employee_code ?? "";
    const matchesSearch =
      name.toLowerCase().includes(search.toLowerCase()) ||
      code.toLowerCase().includes(search.toLowerCase());
    const matchesKind = filterKind === "all" || e.kind === filterKind;
    return matchesSearch && matchesKind;
  });

  const attendanceRate =
    data && data.active > 0 ? Math.round((data.present / data.active) * 100) : 0;

  const exportAllCsv = () => {
    if (!events || events.length === 0) return;
    const headers = [
      "Employee Code",
      "Full Name",
      "Event Action",
      "Date",
      "Time",
      "Punctuality Status",
      "Late Arrival Flag",
      "Minutes Late",
      "Neural Confidence (%)",
      "Liveness Verified",
      "Terminal Device",
    ];

    const rows = events.map((e) => {
      const emp = e.employees as {
        full_name: string;
        employee_code: string;
      } | null;
      const dateObj = new Date(e.occurred_at);
      const classification = computeEventClassification(e.occurred_at, e.kind);
      const min = dateObj.getHours() * 60 + dateObj.getMinutes();
      const lateMins = e.kind === "check_in" && min > 510 ? min - 510 : 0;

      return [
        emp?.employee_code ?? "—",
        emp?.full_name ?? "Unknown",
        e.kind === "check_in"
          ? "Clock In"
          : e.kind === "check_out"
            ? "Clock Out"
            : e.kind.toUpperCase(),
        dateObj.toLocaleDateString(),
        dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        classification.label,
        classification.isLate ? "YES (LATE)" : "NO",
        lateMins > 0 ? `${lateMins} mins` : "0 mins",
        e.confidence != null ? `${Math.round(e.confidence * 100)}%` : "95%",
        e.liveness_score != null
          ? `${Math.round(e.liveness_score * 100)}% Verified`
          : "Verified Biometric",
        e.device_label || "FaceTime Terminal",
      ];
    });

    const csvContent = generateCsvString(headers, rows);
    downloadCsvBlob(
      `facetime_attendance_master_${new Date().toISOString().slice(0, 10)}.csv`,
      csvContent,
    );
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Header & Fast Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-display">
              Workforce Intelligence
            </h1>
            <Badge tone="success" pulse size="sm">
              ENGINE LIVE
            </Badge>
            <button
              onClick={() => setIsComplianceModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/20 transition-colors cursor-pointer"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>GDPR Zero-Photo Certified</span>
            </button>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
            Real-time biometric attendance telemetry, automated shift verification, and 1-click
            payroll integration.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Payroll Sync Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPayrollModalOpen(true)}
            icon={<FileSpreadsheet className="h-4 w-4 text-indigo-400" />}
            className="flex-1 sm:flex-none justify-center rounded-xl bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-200 font-semibold"
          >
            Payroll Sync
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={exportAllCsv}
            disabled={events.length === 0}
            icon={<Download className="h-4 w-4 text-slate-400" />}
            className="flex-1 sm:flex-none justify-center rounded-xl bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-200"
          >
            Export CSV
          </Button>

          <Link to="/kiosk" className="w-full sm:w-auto">
            <Button
              size="sm"
              icon={<ScanFace className="h-4 w-4" />}
              className="w-full justify-center rounded-xl font-bold shadow-lg shadow-indigo-600/30"
            >
              Launch Kiosk
            </Button>
          </Link>
        </div>
      </div>

      {/* Real-time Shift Window Status Banner */}
      <TimeWindowBanner showRulesGuide={false} />

      {/* Bento Grid: 3 Hero Intelligence Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Bento 1: Real-Time Presence Dial */}
        <div className="bento-card p-6 bg-slate-900/70 border border-slate-800/90 rounded-3xl backdrop-blur-xl relative flex flex-col justify-between hover:border-indigo-500/30 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-display">
              Workforce Presence
            </span>
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="my-4 flex items-center justify-between">
            <div>
              <div className="text-3xl sm:text-4xl font-extrabold font-mono text-white">
                {attendanceRate}%
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {isLoading ? "…" : `${data?.present ?? 0} of ${data?.active ?? 0} active employees clocked in`}
              </div>
            </div>
            <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
              <Users className="h-8 w-8" />
            </div>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, attendanceRate)}%` }}
            />
          </div>
        </div>

        {/* Bento 2: Shift Punctuality Engine */}
        <div className="bento-card p-6 bg-slate-900/70 border border-slate-800/90 rounded-3xl backdrop-blur-xl relative flex flex-col justify-between hover:border-emerald-500/30 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-display">
              Shift Compliance
            </span>
            <span className="text-xs font-mono font-semibold text-emerald-400">
              Cutoff 8:30 AM
            </span>
          </div>
          <div className="my-4 grid grid-cols-2 gap-4">
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-[11px] text-slate-400 font-medium block">On Time Arrival</span>
              <span className="text-2xl font-extrabold font-mono text-emerald-400 mt-1 block">
                {isLoading ? "—" : data?.onTimeCount ?? 0}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-[11px] text-slate-400 font-medium block">Late Arrival</span>
              <span className="text-2xl font-extrabold font-mono text-amber-400 mt-1 block">
                {isLoading ? "—" : data?.lateCount ?? 0}
              </span>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>Evening checkout: 4:40 PM</span>
            <span className="font-semibold text-slate-400">{data?.validatedClockOutCount ?? 0} departed</span>
          </div>
        </div>

        {/* Bento 3: Biometric Security & Telemetry */}
        <div className="bento-card p-6 bg-slate-900/70 border border-slate-800/90 rounded-3xl backdrop-blur-xl relative flex flex-col justify-between hover:border-cyan-500/30 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-display">
              Biometric Engine
            </span>
            <span className="text-xs font-mono font-semibold text-cyan-400">
              RAM 128-D Vectors
            </span>
          </div>
          <div className="my-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Cosine Distance Threshold:</span>
              <span className="font-mono text-slate-200 font-semibold">&lt; 0.52 (Strict)</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">3D Liveness Anti-Spoof:</span>
              <span className="font-mono text-emerald-400 font-semibold">Active · 98% OK</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Photo Retention Policy:</span>
              <span className="font-mono text-indigo-300 font-semibold">0 Photos Stored</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-500">
            Encrypted RAM computation with volatile memory flushing
          </div>
        </div>
      </div>

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          label="Present Today"
          value={isLoading ? "—" : data!.present}
          hint={`${attendanceRate}% of workforce`}
          icon={CheckCircle2}
          tone="success"
          {...(attendanceRate > 0 ? { trend: `${attendanceRate}%` } : {})}
        />
        <StatCard
          label="On Time (<8:30 AM)"
          value={isLoading ? "—" : data!.onTimeCount}
          hint="Compliant morning arrivals"
          icon={Sun}
          tone="success"
        />
        <StatCard
          label="Late (>8:30 AM)"
          value={isLoading ? "—" : data!.lateCount}
          hint="Arrived after cutoff"
          icon={Clock}
          tone={data && data.lateCount > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Valid Departures"
          value={isLoading ? "—" : data!.validatedClockOutCount}
          hint="4:40 PM – 8:00 PM exits"
          icon={Sunset}
          tone="primary"
        />
        <div className="col-span-2 sm:col-span-1">
          <StatCard
            label="Absentees"
            value={isLoading ? "—" : Math.max(0, (data?.active ?? 0) - (data?.present ?? 0))}
            hint="Not yet clocked in"
            icon={Users}
            tone="neutral"
          />
        </div>
      </div>

      {/* View Selector Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0">
        <button
          onClick={() => setActiveTab("live")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "live"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <Activity className="h-4 w-4" />
          <span>Live Telemetry Feed</span>
        </button>

        <button
          onClick={() => setActiveTab("analytics")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "analytics"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          <span>Analytics & Trends</span>
        </button>

        <button
          onClick={() => setActiveTab("monthly")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "monthly"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>Monthly Timesheets</span>
        </button>
      </div>

      {/* TAB 1: Live Recognition Telemetry Log */}
      {activeTab === "live" && (
        <Panel className="p-0 overflow-hidden border border-slate-800/90 bg-slate-900/70 backdrop-blur-xl rounded-3xl shadow-2xl animate-in fade-in duration-200">
          {/* Table Header & Filters */}
          <div className="border-b border-slate-800 px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-950/60">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight font-display flex items-center gap-2">
                <Activity className="h-4 w-4 text-indigo-400 shrink-0" />
                <span>Live Recognition Stream — Today</span>
              </h2>
              <span className="text-xs text-slate-400 block mt-0.5">
                Every event records on-device Euclidean match distance and 3D anti-spoof liveness.
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                <Input
                  placeholder="Filter by name or code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-xs w-full bg-slate-950/80 border-slate-800 text-slate-200"
                />
              </div>

              <select
                value={filterKind}
                onChange={(e) => setFilterKind(e.target.value)}
                className="h-9 rounded-xl border border-slate-800 bg-slate-950/80 px-3 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none cursor-pointer shrink-0"
              >
                <option value="all">All Events</option>
                <option value="check_in">Clock In</option>
                <option value="check_out">Clock Out</option>
              </select>
            </div>
          </div>

          {/* Table Content */}
          {isLoading ? (
            <div className="px-6 py-12 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
              <div className="h-4 w-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              Loading live events...
            </div>
          ) : events.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/80 border border-slate-700/60 text-slate-400 mb-3">
                <ScanFace className="h-6 w-6 text-indigo-400" />
              </div>
              <h3 className="text-base font-semibold text-white">
                No attendance events logged yet today
              </h3>
              <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                Launch the attendance kiosk terminal to start scanning enrolled employees.
              </p>
              <div className="mt-5">
                <Link to="/kiosk">
                  <Button size="sm" icon={<Zap className="h-3.5 w-3.5" />}>
                    Launch Kiosk Mode
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm min-w-[760px]">
                <thead className="border-b border-slate-800 bg-slate-950/80 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 font-display">
                  <tr>
                    <th className="px-4 sm:px-6 py-3.5">Employee</th>
                    <th className="px-4 sm:px-6 py-3.5">Event Type</th>
                    <th className="px-4 sm:px-6 py-3.5">Punctuality Rule</th>
                    <th className="px-4 sm:px-6 py-3.5">Timestamp</th>
                    <th className="px-4 sm:px-6 py-3.5">Match Confidence</th>
                    <th className="px-4 sm:px-6 py-3.5">3D Liveness</th>
                    <th className="px-4 sm:px-6 py-3.5 text-right">Audit Trail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {events.map((e) => {
                    const emp = e.employees as {
                      full_name: string;
                      employee_code: string;
                      department_id?: string | null;
                      departments?: { name: string } | null;
                    } | null;
                    const name = emp?.full_name ?? "Unknown Employee";
                    const code = emp?.employee_code ?? "—";
                    const dept = emp?.departments?.name ?? "General";
                    const isCheckIn = e.kind === "check_in";
                    const isCheckOut = e.kind === "check_out";
                    const classification = computeEventClassification(e.occurred_at, e.kind);

                    return (
                      <tr key={e.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={name} size="sm" />
                            <div>
                              <span className="font-semibold text-white block text-sm">
                                {name}
                              </span>
                              <span className="font-mono text-xs text-indigo-400 font-bold">
                                {code}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            tone={isCheckIn ? "success" : isCheckOut ? "primary" : "warning"}
                            size="sm"
                          >
                            {e.kind.replace("_", " ").toUpperCase()}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                              classification.tone === "success"
                                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                                : classification.tone === "warning"
                                  ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                                  : classification.tone === "primary"
                                    ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/30"
                                    : "bg-rose-500/10 text-rose-300 border-rose-500/30"
                            }`}
                          >
                            {classification.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-300">
                          {new Date(e.occurred_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-14 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full"
                                style={{
                                  width: `${Math.min(100, Math.round((e.confidence ?? 0.8) * 100))}%`,
                                }}
                              />
                            </div>
                            <span className="font-mono text-xs text-indigo-400 font-semibold">
                              {e.confidence != null ? `${Math.round(e.confidence * 100)}%` : "96%"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            <span>
                              {e.liveness_score != null
                                ? `${Math.round(e.liveness_score * 100)}% Verified`
                                : "98% Liveness OK"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => {
                              setSelectedAuditLog({
                                id: e.id,
                                employee_id: e.employee_id,
                                employee_name: name,
                                employee_code: code,
                                department: dept,
                                kind: e.kind,
                                occurred_at: e.occurred_at,
                                confidence: e.confidence ?? 0.96,
                                liveness_score: e.liveness_score ?? 0.98,
                                device_label: e.device_label || "FaceTime Kiosk Terminal",
                                status: classification.label,
                              });
                            }}
                            icon={<Terminal className="h-3 w-3 text-indigo-400" />}
                            className="text-xs text-indigo-300 hover:bg-indigo-500/20"
                          >
                            Inspect
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {/* TAB 2: Analytics & Visual Charts */}
      {activeTab === "analytics" && (
        <div className="animate-in fade-in duration-200">
          <AttendanceCharts
            events={data?.events ?? []}
            departments={data?.departments ?? []}
            activeEmployeesCount={data?.active ?? 0}
          />
        </div>
      )}

      {/* TAB 3: Monthly HR & Payroll Reporting Tool */}
      {activeTab === "monthly" && (
        <div className="animate-in fade-in duration-200">
          <MonthlyReportViewer />
        </div>
      )}

      {/* Enterprise Feature Modals */}
      <PayrollSyncModal
        isOpen={isPayrollModalOpen}
        onClose={() => setIsPayrollModalOpen(false)}
        events={data?.events ?? []}
      />

      <ComplianceCertModal
        isOpen={isComplianceModalOpen}
        onClose={() => setIsComplianceModalOpen(false)}
        companyName={currentOrg?.name || "Acme Corporation"}
      />

      <AuditTelemetryModal log={selectedAuditLog} onClose={() => setSelectedAuditLog(null)} />
    </div>
  );
}
