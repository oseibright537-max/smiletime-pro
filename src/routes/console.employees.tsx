import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ScanFace,
  Trash2,
  UserPlus,
  Users,
  Building2,
  Search,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronRight,
  Shield,
  Layers,
  Download,
  FileSpreadsheet,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge, Button, Field, Input, Panel, Select } from "@/components/ui/primitives";
import { BulkEnrollmentModal } from "@/components/employees/BulkEnrollmentModal";
import { DeleteEmployeeModal } from "@/components/employees/DeleteEmployeeModal";
import { downloadCsvBlob, generateCsvString } from "@/lib/export/downloader";

export const Route = createFileRoute("/console/employees")({
  head: () => ({
    meta: [
      { title: "Employee Directory & Enrollment — FaceTime Attendance" },
      {
        name: "description",
        content:
          "Manage employee profiles, biometric enrollment vectors, and department hierarchy.",
      },
    ],
  }),
  component: Employees,
});

const employeeSchema = z.object({
  employee_code: z.string().trim().min(1, "Employee code is required").max(32),
  full_name: z.string().trim().min(2, "Name is too short").max(120),
  email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
  job_title: z.string().trim().max(120).optional().or(z.literal("")),
  department_id: z.string().uuid().optional().or(z.literal("")),
});

function Employees() {
  const { isStaff } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    employee_code: "",
    full_name: "",
    email: "",
    job_title: "",
    department_id: "",
  });
  const [newDept, setNewDept] = useState("");
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [isAdding, setIsAdding] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<{
    id: string;
    full_name: string;
    employee_code: string;
    job_title?: string | null;
    department_name?: string | null;
    templatesCount?: number;
  } | null>(null);

  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const [{ data: rows, error: empErr }, { data: templates, error: faceErr }] =
        await Promise.all([
          supabase
            .from("employees")
            .select(
              "id,employee_code,full_name,email,job_title,status,department_id,departments(name)",
            )
            .order("created_at", { ascending: false }),
          supabase.from("face_embeddings").select("employee_id"),
        ]);

      if (empErr) throw empErr;
      if (faceErr) throw faceErr;

      const counts = new Map<string, number>();
      (templates ?? []).forEach((t) =>
        counts.set(t.employee_id, (counts.get(t.employee_id) ?? 0) + 1),
      );
      return (rows ?? []).map((r) => ({ ...r, templates: counts.get(r.id) ?? 0 }));
    },
  });

  const addEmployee = useMutation({
    mutationFn: async () => {
      const parsed = employeeSchema.parse(form);
      const { error } = await supabase.from("employees").insert({
        employee_code: parsed.employee_code,
        full_name: parsed.full_name,
        email: parsed.email || null,
        job_title: parsed.job_title || null,
        department_id: parsed.department_id || null,
        status: "active",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Employee created successfully");
      setForm({ employee_code: "", full_name: "", email: "", job_title: "", department_id: "" });
      setIsAdding(false);
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (e) =>
      toast.error(e instanceof z.ZodError ? e.issues[0]!.message : (e as Error).message),
  });

  const addDepartment = useMutation({
    mutationFn: async () => {
      const name = newDept.trim();
      if (name.length < 2) throw new Error("Department name must be at least 2 characters");
      const { error } = await supabase.from("departments").insert({
        name,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewDept("");
      toast.success("Department registered");
      qc.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const resetFace = useMutation({
    mutationFn: async (employeeId: string) => {
      const { error } = await supabase
        .from("face_embeddings")
        .delete()
        .eq("employee_id", employeeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Biometric template reset");
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteEmployee = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Employee deleted permanently");
      setEmployeeToDelete(null);
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const filtered = (employees.data ?? []).filter((e) => {
    const matchesSearch =
      e.full_name.toLowerCase().includes(search.toLowerCase()) ||
      e.employee_code.toLowerCase().includes(search.toLowerCase()) ||
      (e.job_title ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesDept = deptFilter === "all" || e.department_id === deptFilter;
    return matchesSearch && matchesDept;
  });

  const exportRosterCsv = () => {
    if (!employees.data || employees.data.length === 0) return;
    const headers = [
      "Employee Code",
      "Full Name",
      "Email Address",
      "Job Title",
      "Department",
      "Biometric Templates Enrolled",
      "Status",
    ];

    const rows = (employees.data ?? []).map((e) => [
      e.employee_code,
      e.full_name,
      e.email ?? "—",
      e.job_title ?? "—",
      (e.departments as { name: string } | null)?.name ?? "General",
      e.templates,
      e.status,
    ]);

    const csvContent = generateCsvString(headers, rows);
    downloadCsvBlob(`workforce_roster_${new Date().toISOString().slice(0, 10)}.csv`, csvContent);
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-display">
              Workforce Directory
            </h1>
            <Badge tone="primary" size="md">
              {employees.data?.length ?? 0} ACTIVE PROFILES
            </Badge>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Manage employee identities, biometric enrollment suites, and team departments.
          </p>
        </div>

        {isStaff && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={exportRosterCsv}
              disabled={!employees.data || employees.data.length === 0}
              icon={<Download className="h-4 w-4 text-slate-400" />}
              className="flex-1 sm:flex-none justify-center bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-200"
            >
              Export Roster
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBulkModalOpen(true)}
              icon={<UploadCloud className="h-4 w-4 text-indigo-400" />}
              className="flex-1 sm:flex-none justify-center bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/30 text-indigo-300 font-bold"
            >
              Bulk Import CSV
            </Button>

            <Button
              size="sm"
              onClick={() => setIsAdding(!isAdding)}
              icon={<UserPlus className="h-4 w-4" />}
              className="w-full sm:w-auto justify-center shadow-lg shadow-indigo-600/30 font-bold"
            >
              {isAdding ? "Cancel Registration" : "Add Employee"}
            </Button>
          </div>
        )}
      </div>

      {/* Add Employee Form Drawer */}
      {isAdding && isStaff && (
        <Panel className="border border-indigo-500/30 bg-slate-900/90 shadow-2xl rounded-3xl p-6 sm:p-8 space-y-6 animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">
                Register New Employee
              </h2>
              <p className="text-xs text-slate-400">
                Create the employee record first, then proceed to the Biometric Enrollment Studio.
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              addEmployee.mutate();
            }}
            className="space-y-4"
          >
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Employee Code / ID (Unique)">
                <Input
                  required
                  placeholder="e.g. EMP-0142"
                  value={form.employee_code}
                  onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
                />
              </Field>

              <Field label="Full Name">
                <Input
                  required
                  placeholder="e.g. Marcus Vance"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </Field>

              <Field label="Email Address (Optional)">
                <Input
                  type="email"
                  placeholder="marcus@company.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>

              <Field label="Job Title / Role">
                <Input
                  placeholder="e.g. Senior Software Engineer"
                  value={form.job_title}
                  onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                />
              </Field>

              <Field label="Department">
                <Select
                  value={form.department_id}
                  onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                >
                  <option value="" className="bg-slate-900 text-slate-300">No Department Assigned</option>
                  {(departments.data ?? []).map((d) => (
                    <option key={d.id} value={d.id} className="bg-slate-900 text-slate-100">
                      {d.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                loading={addEmployee.isPending}
                icon={<CheckCircle2 className="h-4 w-4" />}
                className="shadow-lg shadow-indigo-600/30"
              >
                Save & Proceed to Biometrics
              </Button>
            </div>
          </form>
        </Panel>
      )}

      {/* Search & Department Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search by name, ID code, or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 text-xs sm:text-sm bg-slate-900/80 border-slate-800 text-slate-200"
          />
        </div>

        {/* Department filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setDeptFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              deptFilter === "all"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            All Teams ({employees.data?.length ?? 0})
          </button>
          {(departments.data ?? []).map((d) => {
            const count = (employees.data ?? []).filter((e) => e.department_id === d.id).length;
            return (
              <button
                key={d.id}
                onClick={() => setDeptFilter(d.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  deptFilter === d.id
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800"
                }`}
              >
                <span>{d.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    deptFilter === d.id ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Directory Table */}
      <Panel className="p-0 overflow-hidden border border-slate-800/90 bg-slate-900/70 backdrop-blur-xl rounded-3xl shadow-2xl">
        {employees.isLoading ? (
          <div className="p-12 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
            <div className="h-4 w-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            Loading employee directory...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/80 border border-slate-700/60 text-slate-400 mb-3">
              <Users className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className="text-base font-semibold text-white">No employees found</h3>
            <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
              {search || deptFilter !== "all"
                ? "No employee records match your active search filter."
                : "Get started by adding your first employee to enable biometric facial clock-ins."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm min-w-[720px]">
              <thead className="border-b border-slate-800 bg-slate-950/80 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 font-display">
                <tr>
                  <th className="px-6 py-3.5">Employee</th>
                  <th className="px-6 py-3.5">Employee ID</th>
                  <th className="px-6 py-3.5">Department</th>
                  <th className="px-6 py-3.5">Biometric Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((e) => {
                  const deptName = (e.departments as { name: string } | null)?.name ?? "General";
                  const isEnrolled = e.templates > 0;

                  return (
                    <tr key={e.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-600 text-white font-bold flex items-center justify-center shadow-md shadow-indigo-500/20 text-xs">
                            {e.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-white block text-sm">
                              {e.full_name}
                            </span>
                            <span className="text-xs text-slate-400">
                              {e.job_title || "Staff Member"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs font-bold text-indigo-400">
                        {e.employee_code}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800/80 text-slate-300 border border-slate-700/60">
                          {deptName}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {isEnrolled ? (
                          <Badge tone="success" pulse size="sm">
                            {e.templates} ENROLLED {e.templates === 1 ? "VECTOR" : "VECTORS"}
                          </Badge>
                        ) : (
                          <Badge tone="warning" size="sm">
                            AWAITING ENROLLMENT
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link to="/console/enroll/$employeeId" params={{ employeeId: e.id }}>
                            <Button
                              size="xs"
                              variant={isEnrolled ? "outline" : "primary"}
                              icon={<ScanFace className="h-3.5 w-3.5" />}
                              className="text-xs"
                            >
                              {isEnrolled ? "Update Face" : "Enrol Face"}
                            </Button>
                          </Link>

                          {isStaff && (
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() =>
                                setEmployeeToDelete({
                                  id: e.id,
                                  full_name: e.full_name,
                                  employee_code: e.employee_code,
                                  job_title: e.job_title,
                                  department_name: deptName,
                                  templatesCount: e.templates,
                                })
                              }
                              icon={<Trash2 className="h-3.5 w-3.5 text-rose-400" />}
                              className="hover:bg-rose-500/10 text-rose-400 cursor-pointer"
                            >
                              <span className="sr-only">Delete</span>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Delete Employee Confirmation Modal */}
      <DeleteEmployeeModal
        isOpen={Boolean(employeeToDelete)}
        onClose={() => setEmployeeToDelete(null)}
        onConfirm={() => {
          if (employeeToDelete) {
            deleteEmployee.mutate(employeeToDelete.id);
          }
        }}
        loading={deleteEmployee.isPending}
        employee={employeeToDelete}
      />

      {/* Bulk Roster CSV Ingestion Modal */}
      <BulkEnrollmentModal isOpen={isBulkModalOpen} onClose={() => setIsBulkModalOpen(false)} />
    </div>
  );
}
