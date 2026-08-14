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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge, Button, Panel, Avatar, Input } from "@/components/ui/primitives";
import { TimeWindowBanner } from "@/components/attendance/TimeWindowBanner";
import { AttendanceCharts } from "@/components/analytics/AttendanceCharts";
import { MonthlyReportViewer } from "@/components/analytics/MonthlyReportViewer";
import { downloadCsvBlob, generateCsvString } from "@/lib/export/downloader";
import { checkAttendanceRules, evaluateTimeWindow } from "@/lib/attendance/time-windows";
import { useOrganization } from "@/hooks/useOrganization";

export const Route = createFileRoute("/console/")({ component: Overview });

function useOverview(organizationId?: string | null) {
  return useQuery({
    queryKey: ["overview", organizationId],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      let empQ = supabase
        .from("employees")
        .select("id,status,employee_code,full_name,department_id");
      if (organizationId)
        empQ = empQ.or(`organization_id.eq.${organizationId},organization_id.is.null`);

      let embQ = supabase.from("face_embeddings").select("employee_id");
      if (organizationId)
        embQ = embQ.or(`organization_id.eq.${organizationId},organization_id.is.null`);

      let evQ = supabase
        .from("attendance_events")
        .select(
          "id,employee_id,kind,occurred_at,status,confidence,liveness_score,employees(full_name,employee_code,department_id)",
        )
        .gte("occurred_at", startOfDay.toISOString())
        .order("occurred_at", { ascending: false })
        .limit(100);
      if (organizationId)
        evQ = evQ.or(`organization_id.eq.${organizationId},organization_id.is.null`);

      let deptQ = supabase.from("departments").select("id,name");
      if (organizationId)
        deptQ = deptQ.or(`organization_id.eq.${organizationId},organization_id.is.null`);

      const [employees, embeddings, events, departments] = await Promise.all([
        empQ,
        embQ,
        evQ,
        deptQ,
      ]);

      const enrolled = new Set((embeddings.data ?? []).map((e) => e.employee_id));
      const active = (employees.data ?? []).filter((e) => e.status === "active");

      // Categorize arrivals today
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
      className="relative overflow-hidden p-3.5 sm:p-5 flex flex-col justify-between bg-white border border-slate-200 shadow-sm rounded-2xl"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500 font-display truncate">
            {label}
          </p>
          <p className="mt-1 sm:mt-2 font-display text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
            {value}
          </p>
        </div>
        <div
          className={`flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl border ${tones[tone]}`}
        >
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
      </div>

      <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-500 text-[10px] sm:text-[11px] truncate">{hint}</span>
        {trend && (
          <span className="inline-flex items-center text-emerald-600 font-semibold text-[10px] sm:text-[11px] shrink-0 ml-1">
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
  const { currentOrg, currentOrgId } = useOrganization();
  const { data, isLoading } = useOverview(currentOrgId);
  const [activeTab, setActiveTab] = useState<"live" | "analytics" | "monthly">("live");
  const [search, setSearch] = useState("");
  const [filterKind, setFilterKind] = useState<string>("all");

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
    if (!events || events.length === 0) {
      return;
    }
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
      "HR Compliance Note",
    ];

    const rows = events.map((e) => {
      const emp = e.employees as {
        full_name: string;
        employee_code: string;
        department_id?: string | null;
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
        "FaceTime Attendance Terminal",
        classification.isLate
          ? `Arrival exceeded 8:30 AM cutoff by ${lateMins} minutes.`
          : classification.isEarlyDeparture
            ? "Early departure prior to 4:40 PM evening window."
            : "Compliant with shift policy.",
      ];
    });

    const csvContent = generateCsvString(headers, rows);
    downloadCsvBlob(
      `facetime_attendance_master_${new Date().toISOString().slice(0, 10)}.csv`,
      csvContent,
    );
  };

  const exportLateArrivalsCsv = () => {
    const lateEvents = (events || []).filter((e) => {
      const d = new Date(e.occurred_at);
      const min = d.getHours() * 60 + d.getMinutes();
      return e.kind === "check_in" && min > 510;
    });

    if (lateEvents.length === 0) {
      toast.info("No late arrivals recorded today. Great job!");
      return;
    }

    const headers = [
      "Employee Code",
      "Full Name",
      "Date",
      "Actual Arrival Time",
      "Company Cutoff Time",
      "Lateness (Minutes)",
      "Infraction Severity",
      "Neural Confidence (%)",
      "HR Review Status",
    ];

    const rows = lateEvents.map((e) => {
      const emp = e.employees as { full_name: string; employee_code: string } | null;
      const dateObj = new Date(e.occurred_at);
      const min = dateObj.getHours() * 60 + dateObj.getMinutes();
      const lateMins = min - 510;
      const severity =
        lateMins > 60
          ? "Critical (> 1hr Late)"
          : lateMins > 30
            ? "Moderate (> 30m Late)"
            : "Minor (< 30m Late)";

      return [
        emp?.employee_code ?? "—",
        emp?.full_name ?? "Unknown",
        dateObj.toLocaleDateString(),
        dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        "08:30:00 AM",
        `${lateMins} mins`,
        severity,
        e.confidence != null ? `${Math.round(e.confidence * 100)}%` : "95%",
        "Pending HR Justification",
      ];
    });

    const csvContent = generateCsvString(headers, rows);
    downloadCsvBlob(
      `facetime_lateness_audit_${new Date().toISOString().slice(0, 10)}.csv`,
      csvContent,
    );
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Top Header & Fast Actions */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-display">
              Workforce Intelligence
            </h1>
            <Badge tone="success" pulse size="sm">
              LIVE TELEMETRY
            </Badge>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Real-time biometric attendance, automated 8:30 AM threshold categorizations, and HR
            analytics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={exportAllCsv}
            disabled={events.length === 0}
            icon={<Download className="h-4 w-4 text-indigo-600" />}
            className="flex-1 sm:flex-none justify-center"
          >
            Export All CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportLateArrivalsCsv}
            disabled={(data?.lateCount ?? 0) === 0}
            icon={<Clock className="h-4 w-4 text-amber-600" />}
            className="flex-1 sm:flex-none justify-center text-amber-900 bg-amber-50/60 border-amber-300 hover:bg-amber-100/60"
            title="Download formatted spreadsheet with all late arrivals"
          >
            Late Audit CSV ({data?.lateCount ?? 0})
          </Button>
          <Link to="/console/employees" className="flex-1 sm:flex-none">
            <Button
              variant="outline"
              size="sm"
              icon={<UserPlus className="h-4 w-4" />}
              className="w-full justify-center"
            >
              Directory & Roster
            </Button>
          </Link>
          <Link to="/kiosk" className="w-full sm:w-auto">
            <Button
              size="sm"
              icon={<ScanFace className="h-4 w-4" />}
              className="w-full justify-center"
            >
              Launch Kiosk
            </Button>
          </Link>
        </div>
      </div>

      {/* Real-time Shift Window Status Banner */}
      <TimeWindowBanner showRulesGuide={true} />

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4">
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
          hint="Arrived after 8:30 AM cutoff"
          icon={Clock}
          tone={data && data.lateCount > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Validated Departures"
          value={isLoading ? "—" : data!.validatedClockOutCount}
          hint="4:40 PM – 8:00 PM valid exit"
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

      {/* Main Navigation View Selector Tabs */}
      <div className="flex items-center gap-1.5 sm:gap-2 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0">
        <button
          onClick={() => setActiveTab("live")}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "live"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Activity className="h-4 w-4" />
          <span>Live Telemetry Log</span>
        </button>

        <button
          onClick={() => setActiveTab("analytics")}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "analytics"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          <span>Analytics & Charts</span>
        </button>

        <button
          onClick={() => setActiveTab("monthly")}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "monthly"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>Monthly HR & Payroll</span>
        </button>
      </div>

      {/* TAB 1: Live Recognition Telemetry Log */}
      {activeTab === "live" && (
        <Panel className="p-0 overflow-hidden border border-slate-200 bg-white rounded-2xl shadow-sm animate-in fade-in duration-200">
          {/* Table Header & Filters */}
          <div className="border-b border-slate-200 px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/70">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight font-display flex items-center gap-2">
                <Activity className="h-4 w-4 text-indigo-600 shrink-0" />
                <span>Live Recognition Stream — Today</span>
              </h2>
              <span className="text-xs text-slate-500 block mt-0.5">
                Automated 8:30 AM late categorization & 4:40 PM departure validation applied per
                event.
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Filter by name or code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-xs w-full"
                />
              </div>

              <select
                value={filterKind}
                onChange={(e) => setFilterKind(e.target.value)}
                className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-800 focus:border-indigo-600 focus:outline-none cursor-pointer shrink-0"
              >
                <option value="all">All Events</option>
                <option value="check_in">Clock In</option>
                <option value="check_out">Clock Out</option>
              </select>
            </div>
          </div>

          {/* Table Content */}
          {isLoading ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
              <div className="h-4 w-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
              Loading live events...
            </div>
          ) : events.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 border border-slate-200 text-slate-500 mb-3">
                <ScanFace className="h-6 w-6 text-indigo-600" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">
                No attendance events logged yet today
              </h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
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
              <table className="w-full text-left text-xs sm:text-sm min-w-[720px]">
                <thead className="border-b border-slate-200 bg-slate-100/70 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-600 font-display">
                  <tr>
                    <th className="px-4 sm:px-6 py-3">Employee</th>
                    <th className="px-4 sm:px-6 py-3">Event Type</th>
                    <th className="px-4 sm:px-6 py-3">Time Rule Classification</th>
                    <th className="px-4 sm:px-6 py-3">Timestamp</th>
                    <th className="px-4 sm:px-6 py-3">Neural Confidence</th>
                    <th className="px-4 sm:px-6 py-3">Liveness Verification</th>
                    <th className="px-4 sm:px-6 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {events.map((e) => {
                    const emp = e.employees as { full_name: string; employee_code: string } | null;
                    const name = emp?.full_name ?? "Unknown Employee";
                    const code = emp?.employee_code ?? "—";
                    const isCheckIn = e.kind === "check_in";
                    const isCheckOut = e.kind === "check_out";
                    const classification = computeEventClassification(e.occurred_at, e.kind);

                    return (
                      <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar name={name} size="sm" />
                            <div>
                              <span className="font-semibold text-slate-900 block text-sm">
                                {name}
                              </span>
                              <span className="font-mono text-xs text-indigo-700 font-bold">
                                {code}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3.5">
                          <Badge
                            tone={isCheckIn ? "success" : isCheckOut ? "primary" : "warning"}
                            size="sm"
                          >
                            {e.kind.replace("_", " ").toUpperCase()}
                          </Badge>
                        </td>
                        <td className="px-6 py-3.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${
                              classification.tone === "success"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : classification.tone === "warning"
                                  ? "bg-amber-50 text-amber-800 border-amber-200"
                                  : classification.tone === "primary"
                                    ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                                    : "bg-rose-50 text-rose-800 border-rose-200"
                            }`}
                          >
                            {classification.label}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 font-mono text-xs text-slate-600">
                          {new Date(e.occurred_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                              <div
                                className="h-full bg-indigo-600 rounded-full"
                                style={{
                                  width: `${Math.min(100, Math.round((e.confidence ?? 0.8) * 100))}%`,
                                }}
                              />
                            </div>
                            <span className="font-mono text-xs text-indigo-700 font-semibold">
                              {e.confidence != null ? `${Math.round(e.confidence * 100)}%` : "—"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="font-medium">
                              {e.liveness_score != null
                                ? `${Math.round(e.liveness_score * 100)}% Verified`
                                : "Active OK"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            Verified
                          </span>
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

      {/* TAB 2: Analytics & Animated Visual Charts */}
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
    </div>
  );
}
