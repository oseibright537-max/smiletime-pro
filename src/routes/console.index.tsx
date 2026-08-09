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
    refetchInterval: 10000, // Live poll every 10s
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
  trend?: string;
}) {
  const tones = {
    primary: "border-sky-500/20 bg-sky-500/5 text-sky-400",
    success: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400",
    warning: "border-amber-500/20 bg-amber-500/5 text-amber-400",
    neutral: "border-slate-700/30 bg-white/5 text-slate-300",
  };

  return (
    <Panel interactive className="relative overflow-hidden p-6 flex flex-col justify-between">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-display">
            {label}
          </p>
          <p className="mt-3 font-display text-4xl font-extrabold text-white tracking-tight">
            {value}
          </p>
        </div>
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${tones[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
        <span className="text-slate-400">{hint}</span>
        {trend && (
          <span className="inline-flex items-center text-emerald-400 font-medium">
            {trend}
            <ArrowUpRight className="h-3 w-3" />
          </span>
        )}
      </div>
    </Panel>
  );
}

function Overview() {
  const { data, isLoading, refetch } = useOverview();
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

  return (
    <div className="space-y-8">
      {/* Top Header & Fast Actions */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-2 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-white font-display">
              Workforce Intelligence
            </h1>
            <Badge tone="success" pulse size="sm">
              LIVE TELEMETRY
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-400 font-light">
            Real-time biometric recognition logs, presence tracking, and face template status.
          </p>
        </div>

        <div className="flex items-center gap-3">
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
          hint="5-angle templates ready"
          icon={ScanFace}
          tone="primary"
        />
        <StatCard
          label="Awaiting Enrolment"
          value={isLoading ? "—" : Math.max(0, data!.active - data!.enrolled)}
          hint="Cannot use kiosk yet"
          icon={Clock}
          tone={data && data.active > data.enrolled ? "warning" : "neutral"}
        />
      </div>

      {/* Recognition Log Panel */}
      <Panel className="p-0 overflow-hidden border border-white/10">
        {/* Table Header & Filters */}
        <div className="border-b border-white/10 px-6 py-5 flex flex-wrap items-center justify-between gap-4 bg-slate-900/50">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight font-display flex items-center gap-2">
              <Activity className="h-4.5 w-4.5 text-sky-400" />
              Live Recognition Log — Today
            </h2>
            <span className="text-xs text-muted-foreground">
              Automatic duplicate suppression & liveness scoring applied per event.
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter by employee name or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Event Filter */}
            <select
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value)}
              className="h-9 rounded-xl border border-white/10 bg-slate-950 px-3 text-xs text-foreground focus:border-sky-400 focus:outline-none"
            >
              <option value="all">All Events</option>
              <option value="check_in">Check In</option>
              <option value="check_out">Check Out</option>
              <option value="break_start">Break Start</option>
              <option value="break_end">Break End</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <div className="h-4 w-4 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
            Loading live events...
          </div>
        ) : events.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-muted-foreground mb-3">
              <ScanFace className="h-6 w-6 text-sky-400" />
            </div>
            <h3 className="text-base font-semibold text-white">
              No attendance events logged yet today
            </h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
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
              <thead className="border-b border-white/10 bg-slate-950/60 text-xs font-semibold uppercase tracking-wider text-muted-foreground font-display">
                <tr>
                  <th className="px-6 py-3.5">Employee</th>
                  <th className="px-6 py-3.5">Event Type</th>
                  <th className="px-6 py-3.5">Timestamp</th>
                  <th className="px-6 py-3.5">Neural Match</th>
                  <th className="px-6 py-3.5">Liveness Verification</th>
                  <th className="px-6 py-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {events.map((e) => {
                  const emp = e.employees as { full_name: string; employee_code: string } | null;
                  const name = emp?.full_name ?? "Unknown Employee";
                  const code = emp?.employee_code ?? "—";
                  const isCheckIn = e.kind === "check_in";
                  const isCheckOut = e.kind === "check_out";

                  return (
                    <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={name} size="sm" />
                          <div>
                            <span className="font-semibold text-white block text-sm">{name}</span>
                            <span className="font-mono text-xs text-muted-foreground">{code}</span>
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
                      <td className="px-6 py-3.5 font-mono text-xs text-slate-300">
                        {new Date(e.occurred_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-sky-400 rounded-full"
                              style={{
                                width: `${Math.min(100, Math.round((e.confidence ?? 0.8) * 100))}%`,
                              }}
                            />
                          </div>
                          <span className="font-mono text-xs text-sky-300">
                            {e.confidence != null ? `${Math.round(e.confidence * 100)}%` : "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          <span className="font-mono">
                            {e.liveness_score != null
                              ? `${Math.round(e.liveness_score * 100)}% Verified`
                              : "Active OK"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          ✓ Signed
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
