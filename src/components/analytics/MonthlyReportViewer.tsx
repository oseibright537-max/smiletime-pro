import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  Calendar,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
  TrendingUp,
  Award,
  Copy,
  Layers,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge, Button, Input, Panel, Select, Avatar } from "@/components/ui/primitives";
import {
  exportMonthlyPayrollSummary,
  type MonthlyEmployeeSummary,
  downloadCsvBlob,
  generateCsvString,
} from "@/lib/export/downloader";

interface MonthlyReportViewerProps {
  onClose?: () => void;
}

export function MonthlyReportViewer({ onClose }: MonthlyReportViewerProps) {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth()); // 0-indexed
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [workingDays, setWorkingDays] = useState(22);

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const monthLabel = `${months[selectedMonth]} ${selectedYear}`;

  // Fetch all employees and departments
  const employeesQuery = useQuery({
    queryKey: ["report_employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id,employee_code,full_name,email,job_title,status,department_id,departments(name)")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch attendance events for the selected month
  const attendanceQuery = useQuery({
    queryKey: ["report_attendance", selectedYear, selectedMonth],
    queryFn: async () => {
      const startOfMonth = new Date(selectedYear, selectedMonth, 1, 0, 0, 0);
      const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

      const { data, error } = await supabase
        .from("attendance_events")
        .select("id,employee_id,kind,occurred_at,status,confidence")
        .gte("occurred_at", startOfMonth.toISOString())
        .lte("occurred_at", endOfMonth.toISOString())
        .order("occurred_at", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });

  const departmentsQuery = useQuery({
    queryKey: ["departments"],
    queryFn: async () => (await supabase.from("departments").select("*").order("name")).data ?? [],
  });

  // Aggregate monthly performance per employee
  const reportData = useMemo<MonthlyEmployeeSummary[]>(() => {
    const employees = employeesQuery.data ?? [];
    const events = attendanceQuery.data ?? [];

    const empEventMap = new Map<string, typeof events>();
    events.forEach((ev) => {
      const list = empEventMap.get(ev.employee_id) || [];
      list.push(ev);
      empEventMap.set(ev.employee_id, list);
    });

    return employees.map((emp) => {
      const empEvents = empEventMap.get(emp.id) || [];
      const dept = (emp.departments as { name: string } | null)?.name ?? "Unassigned";

      type EventItem = (typeof events)[number];
      const dailyMap = new Map<string, { checkIn?: EventItem; checkOut?: EventItem }>();
      empEvents.forEach((ev) => {
        const dayKey = new Date(ev.occurred_at).toISOString().slice(0, 10);
        const dayEntry = dailyMap.get(dayKey) || {};
        if (ev.kind === "check_in" && !dayEntry.checkIn) {
          dayEntry.checkIn = ev;
        } else if (ev.kind === "check_out" && !dayEntry.checkOut) {
          dayEntry.checkOut = ev;
        }
        dailyMap.set(dayKey, dayEntry);
      });

      let onTimeDays = 0;
      let lateDays = 0;
      let totalLateMinutes = 0;
      let validatedDepartures = 0;
      let earlyDepartures = 0;
      let totalWorkHours = 0;

      dailyMap.forEach(({ checkIn, checkOut }) => {
        if (checkIn) {
          const d = new Date(checkIn.occurred_at);
          const min = d.getHours() * 60 + d.getMinutes();
          // Cutoff: 8:30 AM = 510 minutes
          if (min <= 510) {
            onTimeDays++;
          } else {
            lateDays++;
            totalLateMinutes += min - 510;
          }
        }

        if (checkOut) {
          const d = new Date(checkOut.occurred_at);
          const min = d.getHours() * 60 + d.getMinutes();
          // Validated window: 16:40 (1000m) to 20:00 (1200m)
          if (min >= 1000 && min <= 1200) {
            validatedDepartures++;
          } else if (min < 1000) {
            earlyDepartures++;
          }
        }

        if (checkIn && checkOut) {
          const diffMs =
            new Date(checkOut.occurred_at).getTime() - new Date(checkIn.occurred_at).getTime();
          const hours = Math.max(0, diffMs / (1000 * 60 * 60));
          totalWorkHours += hours;
        } else if (checkIn) {
          // Standard 8 hours estimate
          totalWorkHours += 8;
        }
      });

      const daysPresent = dailyMap.size;
      const punctualityScore = daysPresent > 0 ? Math.round((onTimeDays / daysPresent) * 100) : 100;

      return {
        employeeCode: emp.employee_code,
        fullName: emp.full_name,
        department: dept,
        jobTitle: emp.job_title || "Staff",
        daysPresent,
        onTimeDays,
        lateDays,
        totalLateMinutes,
        validatedDepartures,
        earlyDepartures,
        totalWorkHours,
        punctualityScore,
        status: emp.status,
      };
    });
  }, [employeesQuery.data, attendanceQuery.data]);

  // Filter report
  const filteredReport = useMemo(() => {
    return reportData.filter((r) => {
      const matchesSearch =
        r.fullName.toLowerCase().includes(search.toLowerCase()) ||
        r.employeeCode.toLowerCase().includes(search.toLowerCase()) ||
        r.department.toLowerCase().includes(search.toLowerCase());

      const matchesDept = deptFilter === "all" || r.department === deptFilter;

      let matchesTier = true;
      if (tierFilter === "tier1") matchesTier = r.punctualityScore >= 90;
      else if (tierFilter === "tier2")
        matchesTier = r.punctualityScore >= 75 && r.punctualityScore < 90;
      else if (tierFilter === "tier3") matchesTier = r.punctualityScore < 75;

      return matchesSearch && matchesDept && matchesTier;
    });
  }, [reportData, search, deptFilter, tierFilter]);

  // Key KPI summary metrics
  const avgPunctuality = useMemo(() => {
    if (!reportData.length) return 0;
    const total = reportData.reduce((acc, r) => acc + r.punctualityScore, 0);
    return Math.round(total / reportData.length);
  }, [reportData]);

  const totalLateMins = useMemo(() => {
    return reportData.reduce((acc, r) => acc + r.totalLateMinutes, 0);
  }, [reportData]);

  const handleExportCsv = () => {
    if (!reportData.length) {
      toast.error("No employee attendance data available for export.");
      return;
    }
    exportMonthlyPayrollSummary(monthLabel, reportData, workingDays);
  };

  const handleExportLateInfractionsCsv = () => {
    const lateStaff = reportData.filter((e) => e.lateDays > 0);
    if (!lateStaff.length) {
      toast.info("No late infractions recorded for " + monthLabel + ". Perfect punctuality!");
      return;
    }

    const headers = [
      "Employee Code",
      "Full Name",
      "Department",
      "Job Title",
      "Days Present",
      "Late Days Count",
      "Late Frequency (% of Days)",
      "Total Lateness (Minutes)",
      "Avg Lateness Per Infraction (Minutes)",
      "Punctuality Rating (%)",
      "HR Disciplinary Tier",
    ];

    const rows = lateStaff.map((e) => {
      const lateFreq = e.daysPresent > 0 ? Math.round((e.lateDays / e.daysPresent) * 100) : 0;
      const avgMins = e.lateDays > 0 ? Math.round(e.totalLateMinutes / e.lateDays) : 0;
      const tier =
        e.lateDays >= 5 || e.punctualityScore < 70
          ? "Tier 3 — Escalation Required"
          : e.lateDays >= 2
            ? "Tier 2 — Warning Advisory"
            : "Tier 1 — Isolated Incident";

      return [
        e.employeeCode,
        e.fullName,
        e.department,
        e.jobTitle,
        e.daysPresent,
        e.lateDays,
        `${lateFreq}%`,
        e.totalLateMinutes,
        `${avgMins} mins`,
        `${e.punctualityScore}%`,
        tier,
      ];
    });

    const csvContent = generateCsvString(headers, rows);
    downloadCsvBlob(
      `smiletime_monthly_late_infractions_${monthLabel.replace(/\s+/g, "_")}.csv`,
      csvContent,
    );
  };

  const handleCopyCsvClipboard = () => {
    const headers = [
      "Employee Code",
      "Full Name",
      "Department",
      "Job Title",
      "Status",
      "Days Present",
      "On Time Days",
      "Late Days",
      "Total Lateness (Mins)",
      "Validated Departures",
      "Early Departures",
      "Punctuality Rating (%)",
    ];
    const rows = reportData.map((e) => [
      e.employeeCode,
      e.fullName,
      e.department,
      e.jobTitle,
      e.status,
      e.daysPresent,
      e.onTimeDays,
      e.lateDays,
      e.totalLateMinutes,
      e.validatedDepartures,
      e.earlyDepartures,
      `${e.punctualityScore}%`,
    ]);
    const csvContent = generateCsvString(headers, rows);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(csvContent);
      toast.success("Monthly CSV data copied to clipboard!");
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Top Header Card */}
      <Panel className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 sm:pb-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
              <FileSpreadsheet className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-2xl font-bold text-slate-900 font-display">
                  Monthly HR & Payroll Intelligence
                </h2>
                <Badge tone="primary" size="sm">
                  {monthLabel.toUpperCase()}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Automated monthly shift summaries, punctuality compliance, and payroll export tool
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyCsvClipboard}
              icon={<Copy className="h-3.5 w-3.5 text-slate-600" />}
              title="Copy RFC-4180 CSV table to device clipboard"
              className="flex-1 sm:flex-none justify-center"
            >
              Copy CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportLateInfractionsCsv}
              disabled={reportData.filter((e) => e.lateDays > 0).length === 0}
              icon={<Clock className="h-4 w-4 text-amber-600" />}
              className="flex-1 sm:flex-none justify-center text-amber-900 bg-amber-50/60 border-amber-300 hover:bg-amber-100/60"
              title="Download formatted spreadsheet of all late employees"
            >
              Late Infractions CSV
            </Button>
            <Button
              size="sm"
              onClick={handleExportCsv}
              disabled={reportData.length === 0}
              icon={<Download className="h-4 w-4" />}
              className="flex-1 sm:flex-none justify-center"
            >
              Download Payroll CSV
            </Button>
          </div>
        </div>

        {/* Month Selector & Controls Grid */}
        <div className="mt-4 sm:mt-5 grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <div>
            <label className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase block mb-1 font-display">
              Reporting Month
            </label>
            <Select
              value={selectedMonth.toString()}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="text-xs h-9 w-full"
            >
              {months.map((m, idx) => (
                <option key={m} value={idx}>
                  {m}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase block mb-1 font-display">
              Reporting Year
            </label>
            <Select
              value={selectedYear.toString()}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="text-xs h-9 w-full"
            >
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </Select>
          </div>

          <div>
            <label className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase block mb-1 font-display">
              Scheduled Shift Days
            </label>
            <Input
              type="number"
              min="1"
              max="31"
              value={workingDays}
              onChange={(e) => setWorkingDays(parseInt(e.target.value) || 22)}
              className="text-xs h-9 w-full"
            />
          </div>

          <div>
            <label className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase block mb-1 font-display">
              Compliance Tier
            </label>
            <Select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="text-xs h-9 w-full"
            >
              <option value="all">All Tiers</option>
              <option value="tier1">Tier 1 (&gt;= 90% Punctual)</option>
              <option value="tier2">Tier 2 (75% – 89%)</option>
              <option value="tier3">Tier 3 (&lt; 75% Review)</option>
            </Select>
          </div>
        </div>
      </Panel>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase text-slate-500 font-display block truncate">
            Workforce Monitored
          </span>
          <span className="text-xl sm:text-2xl font-bold text-slate-900 font-display mt-1 block">
            {reportData.length}
          </span>
          <span className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 block truncate">
            Active enrolled roster
          </span>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 shadow-xs">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase text-emerald-800 font-display block truncate">
            Avg. Punctuality
          </span>
          <span className="text-xl sm:text-2xl font-bold text-emerald-700 font-display mt-1 block">
            {avgPunctuality}%
          </span>
          <span className="text-[10px] sm:text-[11px] text-emerald-700/80 mt-0.5 block truncate">
            Arrivals &lt; 8:30 AM
          </span>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/80 border border-amber-200 shadow-xs">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase text-amber-800 font-display block truncate">
            Cumulative Lateness
          </span>
          <span className="text-xl sm:text-2xl font-bold text-amber-800 font-display mt-1 block">
            {totalLateMins}m
          </span>
          <span className="text-[10px] sm:text-[11px] text-amber-700/80 mt-0.5 block truncate">
            Entire organization
          </span>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200 shadow-xs">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase text-indigo-800 font-display block truncate">
            Validated Clock-Outs
          </span>
          <span className="text-xl sm:text-2xl font-bold text-indigo-700 font-display mt-1 block">
            {reportData.reduce((a, b) => a + b.validatedDepartures, 0)}
          </span>
          <span className="text-[10px] sm:text-[11px] text-indigo-700/80 mt-0.5 block truncate">
            4:40 PM – 8:00 PM exits
          </span>
        </div>
      </div>

      {/* In-App Tablet/Mobile Viewer Panel */}
      <Panel className="p-0 overflow-hidden border border-slate-200 bg-white rounded-2xl shadow-sm">
        {/* Table Search and Filters */}
        <div className="border-b border-slate-200 px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 font-display">
              In-App Monthly Attendance Data Viewer
            </h3>
            <span className="text-xs text-slate-500 block mt-0.5">
              Tablet-optimized interactive data grid. No external spreadsheet app required.
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search staff, code, dept..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs w-full"
              />
            </div>

            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-800 focus:border-indigo-600 focus:outline-none cursor-pointer shrink-0"
            >
              <option value="all">All Departments</option>
              {(departmentsQuery.data ?? []).map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content View */}
        {employeesQuery.isLoading || attendanceQuery.isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
            <div className="h-4 w-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
            Computing monthly attendance matrix...
          </div>
        ) : filteredReport.length === 0 ? (
          <div className="px-6 py-16 text-center text-xs text-slate-500">
            No employee records match the current filters for {monthLabel}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-100/70 font-semibold uppercase tracking-wider text-slate-600 font-display">
                <tr>
                  <th className="px-6 py-3.5">Employee</th>
                  <th className="px-6 py-3.5">Department</th>
                  <th className="px-6 py-3.5 text-center">Days Present</th>
                  <th className="px-6 py-3.5 text-center">On Time (&lt;8:30)</th>
                  <th className="px-6 py-3.5 text-center">Late (&gt;8:30)</th>
                  <th className="px-6 py-3.5 text-center">Late (Mins)</th>
                  <th className="px-6 py-3.5 text-center">Valid Departures</th>
                  <th className="px-6 py-3.5 text-center">Punctuality Score</th>
                  <th className="px-6 py-3.5 text-right">Compliance Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReport.map((r) => {
                  const attendancePct =
                    workingDays > 0
                      ? Math.min(100, Math.round((r.daysPresent / workingDays) * 100))
                      : 0;

                  return (
                    <tr key={r.employeeCode} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={r.fullName} size="sm" />
                          <div>
                            <span className="font-semibold text-slate-900 block text-xs">
                              {r.fullName}
                            </span>
                            <span className="font-mono text-[10px] text-indigo-700 font-bold">
                              {r.employeeCode}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-slate-600 font-medium">{r.department}</td>
                      <td className="px-6 py-3.5 text-center">
                        <span className="font-bold text-slate-900">
                          {r.daysPresent} / {workingDays}
                        </span>
                        <span className="text-[10px] text-slate-400 block">({attendancePct}%)</span>
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                          {r.onTimeDays} d
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        {r.lateDays > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                            {r.lateDays} d
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">0</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-center font-mono">
                        {r.totalLateMinutes > 0 ? (
                          <span className="text-amber-700 font-bold">+{r.totalLateMinutes}m</span>
                        ) : (
                          <span className="text-slate-400">0m</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                          {r.validatedDepartures} / {r.daysPresent}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-12 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                r.punctualityScore >= 90
                                  ? "bg-emerald-500"
                                  : r.punctualityScore >= 75
                                    ? "bg-amber-500"
                                    : "bg-rose-500"
                              }`}
                              style={{ width: `${r.punctualityScore}%` }}
                            />
                          </div>
                          <span className="font-bold text-slate-900">{r.punctualityScore}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        {r.punctualityScore >= 90 ? (
                          <Badge tone="success" size="sm">
                            TIER 1 (EXCELLENT)
                          </Badge>
                        ) : r.punctualityScore >= 75 ? (
                          <Badge tone="warning" size="sm">
                            TIER 2 (GOOD)
                          </Badge>
                        ) : (
                          <Badge tone="danger" size="sm">
                            TIER 3 (REVIEW)
                          </Badge>
                        )}
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
