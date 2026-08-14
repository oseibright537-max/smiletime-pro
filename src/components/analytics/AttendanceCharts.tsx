import React, { useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import {
  TrendingUp,
  Activity,
  BarChart3,
  PieChart as PieIcon,
  Sun,
  Clock,
  CheckCircle2,
  Building2,
  Calendar,
} from "lucide-react";
import { Badge, Panel } from "@/components/ui/primitives";

interface AttendanceChartsProps {
  events: Array<{
    id: string;
    employee_id: string;
    kind: string;
    occurred_at: string;
    status?: string;
    confidence?: number | null;
    employees?: { full_name: string; employee_code: string; department_id?: string | null } | null;
  }>;
  departments?: Array<{ id: string; name: string }>;
  activeEmployeesCount: number;
}

export function AttendanceCharts({
  events,
  departments = [],
  activeEmployeesCount,
}: AttendanceChartsProps) {
  const [chartView, setChartView] = useState<"flow" | "trend" | "department">("flow");

  // 1. Process Hourly Flow Data (00:00 to 23:00)
  const hourlyData = React.useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, "0")}:00`,
      hourNum: i,
      onTimeIn: 0,
      lateIn: 0,
      validOut: 0,
      earlyOut: 0,
      total: 0,
    }));

    events.forEach((e) => {
      const d = new Date(e.occurred_at);
      const h = d.getHours();
      const m = d.getMinutes();
      const currentMin = h * 60 + m;

      const hourEntry = hours[h];
      if (hourEntry) {
        hourEntry.total++;
        if (e.kind === "check_in") {
          if (currentMin <= 510) {
            // <= 8:30 AM
            hourEntry.onTimeIn++;
          } else {
            hourEntry.lateIn++;
          }
        } else if (e.kind === "check_out") {
          if (currentMin >= 1000 && currentMin <= 1200) {
            // 4:40 PM - 8:00 PM
            hourEntry.validOut++;
          } else {
            hourEntry.earlyOut++;
          }
        }
      }
    });

    // Return only active business hours for cleaner view (06:00 to 21:00) or full 24h
    return hours.filter((h) => h.hourNum >= 5 && h.hourNum <= 21);
  }, [events]);

  // 2. Process Multi-Day Trend Data
  const trendData = React.useMemo(() => {
    const dayMap = new Map<string, { date: string; onTime: number; late: number; total: number }>();

    // Seed last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      dayMap.set(key, { date: key, onTime: 0, late: 0, total: 0 });
    }

    events.forEach((e) => {
      if (e.kind === "check_in") {
        const d = new Date(e.occurred_at);
        const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const entry = dayMap.get(key) || { date: key, onTime: 0, late: 0, total: 0 };
        const min = d.getHours() * 60 + d.getMinutes();

        if (min <= 510) {
          entry.onTime++;
        } else {
          entry.late++;
        }
        entry.total++;
        dayMap.set(key, entry);
      }
    });

    return Array.from(dayMap.values());
  }, [events]);

  // 3. Status Breakdown for Donut Chart
  const statusPieData = React.useMemo(() => {
    let onTimeCount = 0;
    let lateCount = 0;
    let validOutCount = 0;
    let earlyOutCount = 0;

    const checkedInEmployees = new Set<string>();

    events.forEach((e) => {
      const d = new Date(e.occurred_at);
      const min = d.getHours() * 60 + d.getMinutes();

      if (e.kind === "check_in") {
        checkedInEmployees.add(e.employee_id);
        if (min <= 510) onTimeCount++;
        else lateCount++;
      } else if (e.kind === "check_out") {
        if (min >= 1000 && min <= 1200) validOutCount++;
        else earlyOutCount++;
      }
    });

    const absentCount = Math.max(0, activeEmployeesCount - checkedInEmployees.size);

    return [
      { name: "On Time Arrival", value: onTimeCount, color: "#10b981" },
      { name: "Late Arrival", value: lateCount, color: "#f59e0b" },
      { name: "Absent", value: absentCount, color: "#94a3b8" },
      { name: "Validated Clock-Out", value: validOutCount, color: "#6366f1" },
      { name: "Early Clock-Out", value: earlyOutCount, color: "#f43f5e" },
    ].filter((item) => item.value > 0);
  }, [events, activeEmployeesCount]);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Chart View Toggle Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 font-display">
              Workforce Flow & Punctuality Analytics
            </h3>
            <span className="text-xs text-slate-500 block mt-0.5">
              Automated 8:30 AM cutoff & 4:40 PM departure window telemetry
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs overflow-x-auto no-scrollbar w-full sm:w-auto">
          <button
            onClick={() => setChartView("flow")}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 shrink-0 flex-1 sm:flex-none cursor-pointer ${
              chartView === "flow"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Clock className="h-3.5 w-3.5 text-indigo-600" />
            <span>Hourly Flow</span>
          </button>
          <button
            onClick={() => setChartView("trend")}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 shrink-0 flex-1 sm:flex-none cursor-pointer ${
              chartView === "trend"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            <span>7-Day Trend</span>
          </button>
          <button
            onClick={() => setChartView("department")}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 shrink-0 flex-1 sm:flex-none cursor-pointer ${
              chartView === "department"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <PieIcon className="h-3.5 w-3.5 text-amber-600" />
            <span>Status Breakdown</span>
          </button>
        </div>
      </div>

      {/* Main Animated Chart Panel */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Panel className="lg:col-span-2 bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
          {chartView === "flow" && (
            <div>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 font-display">
                    Hourly Arrival & Departure Velocity
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Distribution of employee check-ins across shift windows
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span className="text-slate-600 font-medium">On Time (&lt;8:30)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    <span className="text-slate-600 font-medium">Late (&gt;8:30)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                    <span className="text-slate-600 font-medium">Clock Out</span>
                  </div>
                </div>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="rounded-xl border border-slate-200 bg-slate-900/95 px-3 py-2 text-xs text-white shadow-xl backdrop-blur-md">
                            <span className="font-bold block text-slate-300">{label} Window</span>
                            <div className="mt-1 space-y-1">
                              <span className="block text-emerald-400 font-medium">
                                On Time Arrivals: {payload[0]?.value ?? 0}
                              </span>
                              <span className="block text-amber-400 font-medium">
                                Late Arrivals: {payload[1]?.value ?? 0}
                              </span>
                              <span className="block text-indigo-300 font-medium">
                                Valid Departures: {payload[2]?.value ?? 0}
                              </span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="onTimeIn"
                      name="On Time"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                      animationDuration={800}
                    />
                    <Bar
                      dataKey="lateIn"
                      name="Late"
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                      animationDuration={800}
                    />
                    <Bar
                      dataKey="validOut"
                      name="Valid Departures"
                      fill="#6366f1"
                      radius={[4, 4, 0, 0]}
                      animationDuration={800}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {chartView === "trend" && (
            <div>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 font-display">
                    7-Day Punctuality & Attendance Trend
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Comparison of on-time versus late arrivals over the current cycle
                  </p>
                </div>
                <Badge tone="success" size="sm">
                  ROLLING 7 DAYS
                </Badge>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="onTimeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="lateGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="rounded-xl border border-slate-200 bg-slate-900/95 px-3 py-2 text-xs text-white shadow-xl backdrop-blur-md">
                            <span className="font-bold block text-slate-300">{label}</span>
                            <div className="mt-1 space-y-1">
                              <span className="block text-emerald-400 font-medium">
                                On Time: {payload[0]?.value ?? 0}
                              </span>
                              <span className="block text-amber-400 font-medium">
                                Late: {payload[1]?.value ?? 0}
                              </span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="onTime"
                      name="On Time"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#onTimeGrad)"
                      animationDuration={1000}
                    />
                    <Area
                      type="monotone"
                      dataKey="late"
                      name="Late"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#lateGrad)"
                      animationDuration={1000}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {chartView === "department" && (
            <div>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 font-display">
                    Automated Status Classification Breakdown
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Proportion of On-Time, Late, Absent, and Validated Clock-outs
                  </p>
                </div>
              </div>

              <div className="h-72 w-full flex items-center justify-center">
                {statusPieData.length === 0 ? (
                  <div className="text-center text-xs text-slate-400">
                    No status events logged yet for today.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={4}
                        dataKey="value"
                        animationDuration={900}
                      >
                        {statusPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length || !payload[0]) return null;
                          const color = (data.payload as { color?: string })?.color || "#6366f1";
                          return (
                            <div className="rounded-xl border border-slate-200 bg-slate-900/95 px-3 py-2 text-xs text-white shadow-xl backdrop-blur-md">
                              <span className="font-bold block" style={{ color }}>
                                {data.name}
                              </span>
                              <span className="text-slate-200 mt-0.5 block font-mono">
                                Count: {data.value} employees
                              </span>
                            </div>
                          );
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        iconType="circle"
                        formatter={(value) => (
                          <span className="text-xs text-slate-700 font-medium">{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}
        </Panel>

        {/* Right 1 Col: Quick Automated Metrics & Rules Summary */}
        <Panel className="bg-slate-50/70 border border-slate-200 shadow-sm rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900 font-display flex items-center gap-2">
              <Sun className="h-4 w-4 text-amber-500" />
              Automated Shift Thresholds
            </h4>
            <span className="text-xs text-slate-500">
              Enterprise rule engine configured for active organization
            </span>

            <div className="mt-4 space-y-3">
              <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                  <span>Morning Window</span>
                  <Badge tone="success" size="sm">
                    ON TIME
                  </Badge>
                </div>
                <span className="text-[11px] text-slate-500 block">
                  00:00 AM – 8:30 AM · Full shift compliance
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-amber-800">
                  <span>Late Arrival</span>
                  <Badge tone="warning" size="sm">
                    LATE PENALTY
                  </Badge>
                </div>
                <span className="text-[11px] text-slate-500 block">
                  8:31 AM onwards · Auto-flagged with lateness minutes
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-indigo-800">
                  <span>Evening Departure</span>
                  <Badge tone="primary" size="sm">
                    VALIDATED
                  </Badge>
                </div>
                <span className="text-[11px] text-slate-500 block">
                  4:40 PM – 8:00 PM · Authorized unrestricted clock-out
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-rose-800">
                  <span>Night Lockdown</span>
                  <Badge tone="danger" size="sm">
                    RESTRICTED
                  </Badge>
                </div>
                <span className="text-[11px] text-slate-500 block">
                  8:00 PM – 12:00 AM · Scanner lock prevents erratic logs
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
            <span>Real-Time Engine</span>
            <span className="font-mono text-[11px] font-bold text-indigo-600">Active</span>
          </div>
        </Panel>
      </div>
    </div>
  );
}
