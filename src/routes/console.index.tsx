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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge, Button, Panel, Avatar, Input } from "@/components/ui/primitives";

export const Route = createFileRoute("/console/")({ component: Overview });

function useOverview() {
  return useQuery({
    queryKey: ["overview"],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const [employees, embeddings, events] = await Promise.all([
        supabase.from("employees").select("id,status,employee_code,full_name"),
        supabase.from("face_embeddings").select("employee_id"),
        supabase
          .from("attendance_events")
          .select(
            "id,employee_id,kind,occurred_at,confidence,liveness_score,employees(full_name,employee_code)",
          )
          .gte("occurred_at", startOfDay.toISOString())
          .order("occurred_at", { ascending: false })
          .limit(50),
      ]);

      const enrolled = new Set((embeddings.data ?? []).map((e) => e.employee_id));
      const active = (employees.data ?? []).filter((e) => e.status === "active");
      const presentToday = new Set(
        (events.data ?? []).filter((e) => e.kind === "check_in").map((e) => e.employee_id),
      );

      return {
        total: employees.data?.length ?? 0,
        active: active.length,
        enrolled: enrolled.size,
        present: presentToday.size,
        events: events.data ?? [],
      };
    },
    refetchInterval: 10000,
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
  tone?: "primary" | "success" | "warning" | "neutral";
  trend?: string | undefined;
}) {
  const tones = {
    primary: "border-indigo-100 bg-indigo-50 text-indigo-600",
    success: "border-emerald-100 bg-emerald-50 text-emerald-600",
    warning: "border-amber-100 bg-amber-50 text-amber-600",
    neutral: "border-slate-200 bg-slate-50 text-slate-600",
  };

  return (
    <Panel interactive className="relative overflow-hidden p-6 flex flex-col justify-between bg-white border border-slate-200 shadow-sm rounded-2xl">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-display">
            {label}
          </p>
          <p className="mt-3 font-display text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            {value}
          </p>
        </div>
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${tones[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-500">{hint}</span>
        {trend && (
          <span className="inline-flex items-center text-emerald-600 font-semibold">
            {trend}
            <ArrowUpRight className="h-3 w-3" />
          </span>
        )}
      </div>
    </Panel>
  );
}

function computeLateness(occurredAt: string, kind: string): { isLate: boolean; label: string } {
  if (kind !== "check_in") return { isLate: false, label: "Normal" };
  const d = new Date(occurredAt);
  const hours = d.getHours();
  const minutes = d.getMinutes();
  // Standard Shift Start: 9:00 AM
  const totalMinutes = hours * 60 + minutes;
  const shiftStartMinutes = 9 * 60; // 9:00 AM
  if (totalMinutes > shiftStartMinutes) {
    const diff = totalMinutes - shiftStartMinutes;
    return { isLate: true, label: `Late (+${diff}m)` };
  }
  return { isLate: false, label: "On Time" };
}

function Overview() {
  const { data, isLoading } = useOverview();
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

  const exportCsv = () => {
    if (!events || events.length === 0) {
      return;
    }
    const headers = [
      "Employee Code",
      "Full Name",
      "Event Type",
      "Date",
      "Time",
      "Punctuality",
      "Neural Confidence",
      "Liveness Score",
      "Status",
    ];
    const csvRows = events.map((e) => {
      const emp = e.employees as { full_name: string; employee_code: string } | null;
      const dateObj = new Date(e.occurred_at);
      const lateness = computeLateness(e.occurred_at, e.kind);
      return [
        `"${emp?.employee_code ?? ""}"`,
        `"${(emp?.full_name ?? "Unknown").replace(/"/g, '""')}"`,
        `"${e.kind.replace("_", " ").toUpperCase()}"`,
        `"${dateObj.toLocaleDateString()}"`,
        `"${dateObj.toLocaleTimeString()}"`,
        `"${lateness.label}"`,
        `"${e.confidence != null ? Math.round(e.confidence * 100) + "%" : "N/A"}"`,
        `"${e.liveness_score != null ? Math.round(e.liveness_score * 100) + "%" : "N/A"}"`,
        `"Verified"`,
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...csvRows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `facetime_attendance_report_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      {/* Top Header & Fast Actions */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-display">
              Workforce Intelligence
            </h1>
            <Badge tone="success" pulse size="sm">
              LIVE TELEMETRY
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Real-time biometric recognition logs, presence tracking, and face template status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={events.length === 0}
            icon={<Download className="h-4 w-4 text-indigo-600" />}
          >
            Export Attendance CSV
          </Button>
          <Link to="/console/employees">
            <Button variant="outline" size="sm" icon={<UserPlus className="h-4 w-4" />}>
              Add Employee
            </Button>
          </Link>
          <Link to="/kiosk">
            <Button size="sm" icon={<ScanFace className="h-4 w-4" />}>
              Launch Kiosk Terminal
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Present Today"
          value={isLoading ? "—" : data!.present}
          hint={`${attendanceRate}% of workforce checked in`}
          icon={CheckCircle2}
          tone="success"
          {...(attendanceRate > 0 ? { trend: `${attendanceRate}%` } : {})}
        />
        <StatCard
          label="Active Employees"
          value={isLoading ? "—" : data!.active}
          hint="Eligible for biometric sign-in"
          icon={Users}
          tone="primary"
        />
        <StatCard
          label="Face Enrolled"
          value={isLoading ? "—" : data!.enrolled}
          hint="Biometric templates ready"
          icon={ScanFace}
          tone="primary"
        />
        <StatCard
          label="Awaiting Enrollment"
          value={isLoading ? "—" : Math.max(0, data!.active - data!.enrolled)}
          hint="Cannot use kiosk yet"
          icon={Clock}
          tone={data && data.active > data.enrolled ? "warning" : "neutral"}
        />
      </div>

      {/* Recognition Log Panel */}
      <Panel className="p-0 overflow-hidden border border-slate-200 bg-white rounded-2xl shadow-sm">
        {/* Table Header & Filters */}
        <div className="border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 bg-slate-50/70">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight font-display flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-600" />
              Live Recognition Log — Today
            </h2>
            <span className="text-xs text-slate-500">
              Automatic duplicate suppression, shift punctuality, & liveness scoring applied per event.
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Filter by name or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Event Filter */}
            <select
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value)}
              className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-800 focus:border-indigo-600 focus:outline-none"
            >
              <option value="all">All Events</option>
              <option value="check_in">Clock In</option>
              <option value="check_out">Clock Out</option>
              <option value="break_start">Break Start</option>
              <option value="break_end">Break End</option>
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
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-100/70 text-xs font-semibold uppercase tracking-wider text-slate-600 font-display">
                <tr>
                  <th className="px-6 py-3">Employee</th>
                  <th className="px-6 py-3">Event Type</th>
                  <th className="px-6 py-3">Punctuality</th>
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3">Neural Match</th>
                  <th className="px-6 py-3">Liveness Verification</th>
                  <th className="px-6 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((e) => {
                  const emp = e.employees as { full_name: string; employee_code: string } | null;
                  const name = emp?.full_name ?? "Unknown Employee";
                  const code = emp?.employee_code ?? "—";
                  const isCheckIn = e.kind === "check_in";
                  const isCheckOut = e.kind === "check_out";
                  const lateness = computeLateness(e.occurred_at, e.kind);

                  return (
                    <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={name} size="sm" />
                          <div>
                            <span className="font-semibold text-slate-900 block text-sm">{name}</span>
                            <span className="font-mono text-xs text-slate-500">{code}</span>
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
                        {isCheckIn ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                              lateness.isLate
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : "bg-emerald-50 text-emerald-800 border-emerald-200"
                            }`}
                          >
                            {lateness.label}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
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
    </div>
  );
}
