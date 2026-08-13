import React, { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  X,
  Layers,
  Users,
  Building2,
  Download,
  Check,
  RefreshCw,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { Button, Badge, Input, Panel, Select } from "@/components/ui/primitives";
import {
  parseRosterFile,
  autoDetectColumnMapping,
  reconcileRosterWithDatabase,
  executeBulkRosterIngestion,
  type ColumnMapping,
  type IngestionPreview,
  type ConflictResolutionStrategy,
  type IngestionResult,
} from "@/lib/ingestion/bulk-enrollment";
import { downloadCsvBlob } from "@/lib/export/downloader";

interface BulkEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type WizardStep = "upload" | "mapping" | "preview" | "result";

export function BulkEnrollmentModal({ isOpen, onClose }: BulkEnrollmentModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<WizardStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    employee_code: "",
    full_name: "",
    email: "",
    department_name: "",
    job_title: "",
  });
  const [strategy, setStrategy] = useState<ConflictResolutionStrategy>("merge_update");
  const [preview, setPreview] = useState<IngestionPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [ingestResult, setIngestResult] = useState<IngestionResult | null>(null);
  const [filterTab, setFilterTab] = useState<"all" | "new" | "update" | "invalid">("all");
  const [previewSearch, setPreviewSearch] = useState("");

  if (!isOpen) return null;

  const resetAll = () => {
    setStep("upload");
    setFile(null);
    setRawHeaders([]);
    setRawRows([]);
    setPreview(null);
    setIngestResult(null);
    setLoading(false);
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  // Download Sample Master Roster Template
  const handleDownloadTemplate = () => {
    const sampleCsv =
      "Employee ID,Full Name,Department,Work Email,Phone Contacts / Job Title\n" +
      "EMP-1001,Alexander Wright,Engineering,alex.wright@company.com,Lead Architect\n" +
      "EMP-1002,Sophia Martinez,Product,sophia.m@company.com,Senior Product Manager\n" +
      "EMP-1003,David Chen,Operations,david.chen@company.com,Operations Director\n" +
      "EMP-1004,Amara Okafor,Human Resources,amara.o@company.com,HR Specialist\n" +
      "EMP-1005,Lucas Silva,Sales & Growth,lucas.s@company.com,Account Executive";

    downloadCsvBlob("Master_Workforce_Roster_Template.csv", sampleCsv);
  };

  // File Drop & Select Handler
  const handleFileProcess = async (selectedFile: File) => {
    setLoading(true);
    setFile(selectedFile);
    try {
      const { headers, rows } = await parseRosterFile(selectedFile);
      if (rows.length === 0) {
        toast.error("The selected file contains no data rows.");
        setLoading(false);
        return;
      }

      setRawHeaders(headers);
      setRawRows(rows);

      const detected = autoDetectColumnMapping(headers);
      setColumnMapping(detected);

      // Auto-reconcile
      const previewData = await reconcileRosterWithDatabase(rows, detected);
      setPreview(previewData);
      setStep("mapping");
    } catch (err) {
      toast.error(`Failed to parse spreadsheet: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      void handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  // Update Mapping & Re-reconcile
  const handleRecomputePreview = async () => {
    if (!rawRows.length) return;
    setLoading(true);
    try {
      const previewData = await reconcileRosterWithDatabase(rawRows, columnMapping);
      setPreview(previewData);
      setStep("preview");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Execute Ingestion
  const handleExecuteIngestion = async () => {
    if (!preview || !preview.rows.length) return;
    setLoading(true);
    try {
      const res = await executeBulkRosterIngestion(preview.rows, strategy);
      setIngestResult(res);
      setStep("result");

      // Invalidate queries so dashboard and directory update in real-time
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });

      if (res.success) {
        toast.success(`Bulk Enrollment Complete! ${res.totalProcessed} records processed.`);
      } else {
        toast.warning("Ingestion completed with some warnings.");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Filter preview rows
  const filteredPreviewRows = (preview?.rows ?? []).filter((r) => {
    if (filterTab !== "all" && r.conflictStatus !== filterTab) return false;
    if (!previewSearch) return true;
    const q = previewSearch.toLowerCase();
    return (
      r.full_name.toLowerCase().includes(q) ||
      r.employee_code.toLowerCase().includes(q) ||
      (r.department_name ?? "").toLowerCase().includes(q) ||
      (r.email ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-display">
                Bulk Workforce Ingestion & Enrollment
              </h2>
              <p className="text-xs text-slate-500">
                Automated HR master roster import with duplicate & conflict reconciliation
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stepper Bar */}
        <div className="px-6 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                step === "upload" ? "bg-indigo-600 text-white" : "bg-emerald-600 text-white"
              }`}
            >
              1
            </span>
            <span className={step === "upload" ? "font-bold text-indigo-700" : "text-slate-600"}>
              Upload Roster
            </span>
          </div>
          <ArrowRight className="h-3 w-3 text-slate-400" />
          <div className="flex items-center gap-2">
            <span
              className={`h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                step === "mapping"
                  ? "bg-indigo-600 text-white"
                  : step === "preview" || step === "result"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-300 text-slate-700"
              }`}
            >
              2
            </span>
            <span className={step === "mapping" ? "font-bold text-indigo-700" : "text-slate-600"}>
              Map & Conflicts
            </span>
          </div>
          <ArrowRight className="h-3 w-3 text-slate-400" />
          <div className="flex items-center gap-2">
            <span
              className={`h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                step === "preview"
                  ? "bg-indigo-600 text-white"
                  : step === "result"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-300 text-slate-700"
              }`}
            >
              3
            </span>
            <span className={step === "preview" ? "font-bold text-indigo-700" : "text-slate-600"}>
              Validation & Diff
            </span>
          </div>
          <ArrowRight className="h-3 w-3 text-slate-400" />
          <div className="flex items-center gap-2">
            <span
              className={`h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                step === "result" ? "bg-indigo-600 text-white" : "bg-slate-300 text-slate-700"
              }`}
            >
              4
            </span>
            <span className={step === "result" ? "font-bold text-indigo-700" : "text-slate-600"}>
              Complete
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STEP 1: Upload Roster */}
          {step === "upload" && (
            <div className="space-y-6">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-indigo-50/30 hover:bg-indigo-50/60 rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.tsv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      void handleFileProcess(e.target.files[0]);
                    }
                  }}
                />
                <div className="mx-auto h-16 w-16 rounded-2xl bg-indigo-100/80 group-hover:bg-indigo-200/80 text-indigo-600 flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
                  <UploadCloud className="h-8 w-8" />
                </div>
                <h3 className="text-base font-bold text-slate-900 font-display">
                  Click or drag HR Master Spreadsheet here
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto">
                  Supports <strong className="text-slate-700">.CSV</strong>,{" "}
                  <strong className="text-slate-700">.XLSX</strong>, and{" "}
                  <strong className="text-slate-700">.XLS</strong> files. Automatically parses
                  Employee IDs, Names, Departments, Emails, and Job Titles.
                </p>
                <div className="mt-5 inline-flex items-center gap-2 bg-white border border-indigo-200 rounded-xl px-4 py-2 text-xs font-semibold text-indigo-700 shadow-xs">
                  <FileSpreadsheet className="h-4 w-4" /> Select Master Spreadsheet File
                </div>
              </div>

              {/* Template Download Box */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Info className="h-5 w-5 text-indigo-600 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Need standard HR spreadsheet format?
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Download our pre-formatted master template with sample employee codes and
                      departments.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  icon={<Download className="h-3.5 w-3.5 text-indigo-600" />}
                >
                  Download Template CSV
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: Field Mapping & Conflict Strategy */}
          {step === "mapping" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-display">
                    Spreadsheet Loaded: {file?.name}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Found {rawRows.length} rows and {rawHeaders.length} columns. Confirm column
                    mappings below.
                  </p>
                </div>
                <Badge tone="primary" size="sm">
                  {rawRows.length} RECORDS
                </Badge>
              </div>

              {/* Column Mapping Grid */}
              <div className="grid sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Employee ID / Code <span className="text-rose-500">*</span>
                  </label>
                  <Select
                    value={columnMapping.employee_code}
                    onChange={(e) =>
                      setColumnMapping({ ...columnMapping, employee_code: e.target.value })
                    }
                  >
                    <option value="">-- Select Column --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <Select
                    value={columnMapping.full_name}
                    onChange={(e) =>
                      setColumnMapping({ ...columnMapping, full_name: e.target.value })
                    }
                  >
                    <option value="">-- Select Column --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Department / Team
                  </label>
                  <Select
                    value={columnMapping.department_name}
                    onChange={(e) =>
                      setColumnMapping({ ...columnMapping, department_name: e.target.value })
                    }
                  >
                    <option value="">-- Unassigned / None --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Work Email</label>
                  <Select
                    value={columnMapping.email}
                    onChange={(e) =>
                      setColumnMapping({ ...columnMapping, email: e.target.value })
                    }
                  >
                    <option value="">-- None --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Job Title / Phone Contacts
                  </label>
                  <Select
                    value={columnMapping.job_title}
                    onChange={(e) =>
                      setColumnMapping({ ...columnMapping, job_title: e.target.value })
                    }
                  >
                    <option value="">-- None --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Conflict Handling Strategy Selector */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 font-display">
                  Duplicate & Conflict Policy:
                </h4>
                <div className="grid sm:grid-cols-3 gap-3">
                  <label
                    onClick={() => setStrategy("merge_update")}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      strategy === "merge_update"
                        ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/20"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">Merge & Update</span>
                      <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                        Recommended
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Updates employee details if revised roster uploaded later without erasing face
                      templates.
                    </p>
                  </label>

                  <label
                    onClick={() => setStrategy("skip_existing")}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      strategy === "skip_existing"
                        ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/20"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-xs font-bold text-slate-900">Skip Existing</span>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Only add brand new employees; leave existing database records untouched.
                    </p>
                  </label>

                  <label
                    onClick={() => setStrategy("overwrite")}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      strategy === "overwrite"
                        ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/20"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-xs font-bold text-slate-900">Full Overwrite</span>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Replace all matching profiles with newly supplied master spreadsheet records.
                    </p>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Validation & Live Reconciliation Diff */}
          {step === "preview" && preview && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Summary Metric Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-semibold block uppercase">
                    Total Ingest Rows
                  </span>
                  <span className="text-2xl font-bold text-slate-900 font-display">
                    {preview.totalRows}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[11px] text-emerald-700 font-semibold block uppercase">
                    Brand New
                  </span>
                  <span className="text-2xl font-bold text-emerald-700 font-display">
                    {preview.newCount}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200">
                  <span className="text-[11px] text-indigo-700 font-semibold block uppercase">
                    Records to Merge
                  </span>
                  <span className="text-2xl font-bold text-indigo-700 font-display">
                    {preview.updateCount}
                  </span>
                </div>
                <div
                  className={`p-3.5 rounded-2xl border ${
                    preview.errorCount > 0
                      ? "bg-rose-50 border-rose-200 text-rose-700"
                      : "bg-slate-50 border-slate-200 text-slate-500"
                  }`}
                >
                  <span className="text-[11px] font-semibold block uppercase">Invalid Rows</span>
                  <span className="text-2xl font-bold font-display">{preview.errorCount}</span>
                </div>
              </div>

              {/* Department Auto-Provisioning Notice */}
              {preview.distinctDepartments.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-indigo-600 shrink-0" />
                    <span>
                      Detected{" "}
                      <strong>{preview.distinctDepartments.length} unique departments</strong> in
                      roster (missing ones will be automatically created in database).
                    </span>
                  </div>
                </div>
              )}

              {/* Filter Tabs & Search */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                  <button
                    onClick={() => setFilterTab("all")}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                      filterTab === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                    }`}
                  >
                    All ({preview.totalRows})
                  </button>
                  <button
                    onClick={() => setFilterTab("new")}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                      filterTab === "new" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600"
                    }`}
                  >
                    New ({preview.newCount})
                  </button>
                  <button
                    onClick={() => setFilterTab("update")}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                      filterTab === "update" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600"
                    }`}
                  >
                    Updates ({preview.updateCount})
                  </button>
                  {preview.errorCount > 0 && (
                    <button
                      onClick={() => setFilterTab("invalid")}
                      className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                        filterTab === "invalid" ? "bg-white text-rose-700 shadow-xs" : "text-slate-600"
                      }`}
                    >
                      Errors ({preview.errorCount})
                    </button>
                  )}
                </div>

                <Input
                  placeholder="Search preview rows..."
                  value={previewSearch}
                  onChange={(e) => setPreviewSearch(e.target.value)}
                  className="max-w-xs h-8 text-xs"
                />
              </div>

              {/* Diff Data Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 font-semibold text-slate-700 font-display">
                    <tr>
                      <th className="px-4 py-2.5">Row</th>
                      <th className="px-4 py-2.5">Code</th>
                      <th className="px-4 py-2.5">Full Name</th>
                      <th className="px-4 py-2.5">Department</th>
                      <th className="px-4 py-2.5">Email</th>
                      <th className="px-4 py-2.5">Status / Diff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPreviewRows.map((r) => (
                      <tr
                        key={r.rowIndex}
                        className={
                          r.conflictStatus === "invalid"
                            ? "bg-rose-50/60"
                            : r.conflictStatus === "update"
                              ? "bg-indigo-50/30"
                              : "hover:bg-slate-50"
                        }
                      >
                        <td className="px-4 py-2 text-slate-400 font-mono">#{r.rowIndex}</td>
                        <td className="px-4 py-2 font-mono font-bold text-indigo-700">
                          {r.employee_code || "—"}
                        </td>
                        <td className="px-4 py-2 font-semibold text-slate-900">{r.full_name}</td>
                        <td className="px-4 py-2 text-slate-600">
                          {r.department_name || "Unassigned"}
                        </td>
                        <td className="px-4 py-2 text-slate-500">{r.email || "—"}</td>
                        <td className="px-4 py-2">
                          {r.conflictStatus === "new" ? (
                            <Badge tone="success" size="sm">
                              NEW INSERT
                            </Badge>
                          ) : r.conflictStatus === "update" ? (
                            <div className="flex flex-col gap-0.5">
                              <Badge tone="primary" size="sm">
                                UPDATE MERGE
                              </Badge>
                              {r.diffs && r.diffs.length > 0 && (
                                <span className="text-[10px] text-indigo-600">
                                  {r.diffs.map((d) => `${d.field}: ${d.oldVal}→${d.newVal}`).join(", ")}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-rose-700 font-semibold">
                              {r.validationErrors.join("; ")}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 4: Success & Audit Result */}
          {step === "result" && ingestResult && (
            <div className="py-8 text-center space-y-5 animate-in zoom-in-95 duration-200">
              <div className="mx-auto h-16 w-16 rounded-3xl bg-emerald-50 border-2 border-emerald-300 text-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900 font-display">
                  Bulk Workforce Ingestion Complete!
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Master spreadsheet ingested. Employee directory records have been pre-populated into
                  PostgreSQL database.
                </p>
              </div>

              {/* Stats Box */}
              <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <span className="text-xs text-emerald-800 font-bold block">
                    {ingestResult.insertedCount}
                  </span>
                  <span className="text-[10px] text-emerald-600 uppercase font-semibold">
                    New Added
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200">
                  <span className="text-xs text-indigo-800 font-bold block">
                    {ingestResult.updatedCount}
                  </span>
                  <span className="text-[10px] text-indigo-600 uppercase font-semibold">
                    Updated
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-xs text-slate-800 font-bold block">
                    {ingestResult.createdDepartmentsCount}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">
                    Depts Created
                  </span>
                </div>
              </div>

              {ingestResult.errors.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 max-w-md mx-auto text-left">
                  <p className="font-bold">Warnings during processing:</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px]">
                    {ingestResult.errors.map((e, idx) => (
                      <li key={idx}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          {step === "upload" && (
            <Button variant="ghost" size="sm" onClick={handleClose}>
              Cancel
            </Button>
          )}

          {step === "mapping" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep("upload")}
                icon={<ArrowLeft className="h-3.5 w-3.5" />}
              >
                Back to Upload
              </Button>
              <Button
                size="sm"
                onClick={handleRecomputePreview}
                disabled={!columnMapping.employee_code || !columnMapping.full_name}
                loading={loading}
                icon={<ArrowRight className="h-3.5 w-3.5" />}
              >
                Review & Reconcile
              </Button>
            </>
          )}

          {step === "preview" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep("mapping")}
                icon={<ArrowLeft className="h-3.5 w-3.5" />}
              >
                Back to Mapping
              </Button>
              <Button
                size="sm"
                onClick={handleExecuteIngestion}
                loading={loading}
                icon={<Check className="h-3.5 w-3.5" />}
              >
                Commit Ingestion ({preview?.validCount ?? 0} Profiles)
              </Button>
            </>
          )}

          {step === "result" && (
            <div className="w-full flex justify-end">
              <Button size="sm" onClick={handleClose}>
                Done & View Directory
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
