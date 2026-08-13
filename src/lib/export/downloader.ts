import { toast } from "sonner";

/**
 * Downloads a CSV or text string as a safe Blob file across Desktop, Tablet, and Mobile browsers.
 * Incorporates:
 * 1. UTF-8 Byte Order Mark (BOM: \uFEFF) so Microsoft Excel on iOS/Android/Windows properly reads characters.
 * 2. Proper MIME type (text/csv;charset=utf-8;).
 * 3. Temporary Object URL creation and automatic clean-up.
 * 4. Fallback handling for sandboxed mobile WebViews / Safari download restrictions.
 */
export function downloadCsvBlob(filename: string, csvContent: string): { success: boolean; fallbackUrl?: string } {
  try {
    // 1. Add UTF-8 BOM (\uFEFF) for Excel compatibility
    const bom = "\uFEFF";
    const blob = new Blob([bom + csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    // 2. Modern download approach using Blob & ObjectURL
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    link.setAttribute("target", "_blank");
    link.style.display = "none";
    document.body.appendChild(link);

    // 3. Programmatic trigger
    link.click();

    // 4. Clean up after a short delay so mobile engines have time to initiate the stream
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 3000);

    toast.success(`Export ready: ${filename}`, {
      description: "Downloaded successfully to your device.",
    });

    return { success: true, fallbackUrl: url };
  } catch (error) {
    console.error("Blob download failed, attempting mobile clipboard fallback:", error);

    // Fallback: Copy to clipboard if mobile browser blocks Blob download
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(csvContent);
        toast.info("Download blocked by browser — Copied to Clipboard!", {
          description: "You can paste the CSV data directly into your spreadsheet app.",
        });
      }
    } catch {
      toast.error("Download failed. Please check browser file permissions.");
    }

    return { success: false };
  }
}

/**
 * Converts tabular data array to RFC 4180-compliant CSV string
 */
export function generateCsvString(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const escapeCell = (val: string | number | boolean | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    // Escape quotes by doubling them
    return `"${str.replace(/"/g, '""')}"`;
  };

  const headerLine = headers.map(escapeCell).join(",");
  const dataLines = rows.map((row) => row.map(escapeCell).join(","));

  return [headerLine, ...dataLines].join("\r\n");
}

export interface MonthlyEmployeeSummary {
  employeeCode: string;
  fullName: string;
  department: string;
  jobTitle: string;
  daysPresent: number;
  onTimeDays: number;
  lateDays: number;
  totalLateMinutes: number;
  validatedDepartures: number;
  earlyDepartures: number;
  totalWorkHours: number;
  punctualityScore: number; // 0 - 100%
  status: string;
}

/**
 * Generates and downloads the comprehensive Monthly HR Payroll & Performance Export
 */
export function exportMonthlyPayrollSummary(
  monthLabel: string,
  summaryData: MonthlyEmployeeSummary[],
  totalWorkingDaysInMonth: number = 22,
): void {
  const headers = [
    "Employee Code",
    "Full Name",
    "Department",
    "Job Title",
    "Status",
    "Scheduled Days",
    "Days Present",
    "Attendance Rate (%)",
    "On Time Days",
    "Late Days",
    "Total Lateness (Mins)",
    "Validated Departures (4:40PM-8PM)",
    "Early Departures (<4:40PM)",
    "Est. Logged Hours",
    "Punctuality Rating (%)",
    "HR Compliance Tier",
  ];

  const rows = summaryData.map((emp) => {
    const attendanceRate =
      totalWorkingDaysInMonth > 0
        ? Math.min(100, Math.round((emp.daysPresent / totalWorkingDaysInMonth) * 100))
        : 0;

    let complianceTier = "Tier 1 — Excellent";
    if (emp.punctualityScore < 70 || attendanceRate < 75) {
      complianceTier = "Tier 3 — Requires Review";
    } else if (emp.punctualityScore < 85 || attendanceRate < 90) {
      complianceTier = "Tier 2 — Good";
    }

    return [
      emp.employeeCode,
      emp.fullName,
      emp.department || "Unassigned",
      emp.jobTitle || "Staff",
      emp.status.toUpperCase(),
      totalWorkingDaysInMonth,
      emp.daysPresent,
      `${attendanceRate}%`,
      emp.onTimeDays,
      emp.lateDays,
      emp.totalLateMinutes,
      emp.validatedDepartures,
      emp.earlyDepartures,
      emp.totalWorkHours.toFixed(1),
      `${emp.punctualityScore}%`,
      complianceTier,
    ];
  });

  const sanitizedMonth = monthLabel.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `HR_Monthly_Attendance_Payroll_${sanitizedMonth}_${new Date().toISOString().slice(0, 10)}.csv`;
  const csvContent = generateCsvString(headers, rows);

  downloadCsvBlob(filename, csvContent);
}
