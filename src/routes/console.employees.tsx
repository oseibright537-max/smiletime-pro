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
import { useOrganization } from "@/hooks/useOrganization";
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
  const { currentOrgId } = useOrganization();
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
    queryKey: ["departments", currentOrgId],
    queryFn: async () => {
      let q = supabase.from("departments").select("*").order("name");
      if (currentOrgId) {
        q = q.or(`organization_id.eq.${currentOrgId},organization_id.is.null`);
      }
      return (await q).data ?? [];
    },
  });

  const employees = useQuery({
    queryKey: ["employees", currentOrgId],
    queryFn: async () => {
      let empQ = supabase
        .from("employees")
        .select("id,employee_code,full_name,email,job_title,status,department_id,departments(name)")
        .order("created_at", { ascending: false });
      if (currentOrgId) {
        empQ = empQ.or(`organization_id.eq.${currentOrgId},organization_id.is.null`);
      }

      let faceQ = supabase.from("face_embeddings").select("employee_id");
      if (currentOrgId) {
        faceQ = faceQ.or(`organization_id.eq.${currentOrgId},organization_id.is.null`);
      }

      const [{ data: rows }, { data: templates }] = await Promise.all([empQ, faceQ]);
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
        organization_id: currentOrgId || null,
        employee_code: parsed.employee_code,
        full_name: parsed.full_name,
        email: parsed.email || null,
        job_title: parsed.job_title || null,
        department_id: parsed.department_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Employee created successfully");
      setForm({ employee_code: "", full_name: "", email: "", job_title: "", department_id: "" });
      setIsAdding(false);
      qc.invalidateQueries({ queryKey: ["employees", currentOrgId] });
    },
    onError: (e) =>
      toast.error(e instanceof z.ZodError ? e.issues[0]!.message : (e as Error).message),
  });

  const addDepartment = useMutation({
    mutationFn: async () => {
      const name = newDept.trim();
      if (name.length < 2) throw new Error("Department name must be at least 2 characters");
      const { error } = await supabase.from("departments").insert({
        organization_id: currentOrgId || null,
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
      toast.success("Face templates reset. Employee must re-enrol.");
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteEmployee = useMutation({
    mutationFn: async (employeeId: string) => {
      const { error } = await supabase.from("employees").delete().eq("id", employeeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Employee permanently deleted");
      setEmployeeToDelete(null);
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      qc.invalidateQueries({ queryKey: ["report_employees"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const filteredEmployees = (employees.data ?? []).filter((e) => {
    const matchesSearch =
      e.full_name.toLowerCase().includes(search.toLowerCase()) ||
      e.employee_code.toLowerCase().includes(search.toLowerCase()) ||
      (e.job_title ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesDept = deptFilter === "all" || e.department_id === deptFilter;
    return matchesSearch && matchesDept;
  });

  const exportDirectoryCsv = () => {
    const list = employees.data ?? [];
    if (list.length === 0) return;
    const headers = [
      "Employee Code",
      "Full Name",
      "Email",
      "Job Title",
      "Department",
      "Status",
      "Enrolled Templates",
    ];
    const rows = list.map((e) => {
      const dept = (e.departments as { name: string } | null)?.name ?? "Unassigned";
      return [
        e.employee_code,
        e.full_name,
        e.email ?? "",
        e.job_title ?? "",
        dept,
        e.status.toUpperCase(),
        e.templates,
      ];
    });

    const csvContent = generateCsvString(headers, rows);
    downloadCsvBlob(
      `facetime_workforce_directory_${new Date().toISOString().slice(0, 10)}.csv`,
      csvContent,
    );
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-display">
              Workforce Directory
            </h1>
            <Badge tone="primary" size="sm">
              {employees.data?.length ?? 0} TOTAL
            </Badge>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Register employees, upload master HR rosters, or enrol facial profiles for instant
            attendance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={exportDirectoryCsv}
            disabled={(employees.data?.length ?? 0) === 0}
            icon={<Download className="h-4 w-4 text-indigo-600" />}
            className="flex-1 sm:flex-none justify-center"
          >
            Export Directory CSV
          </Button>
          {isStaff && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsBulkModalOpen(true)}
                icon={<FileSpreadsheet className="h-4 w-4 text-indigo-600" />}
                className="flex-1 sm:flex-none justify-center"
              >
                Bulk Ingest Roster
              </Button>
              <Button
                size="sm"
                onClick={() => setIsAdding(!isAdding)}
                icon={<UserPlus className="h-4 w-4" />}
                className="w-full sm:w-auto justify-center"
              >
                {isAdding ? "Close Form" : "New Employee"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Bulk Roster Ingestion Modal */}
      <BulkEnrollmentModal isOpen={isBulkModalOpen} onClose={() => setIsBulkModalOpen(false)} />

      {/* Add Employee Form Drawer */}
      {isStaff && isAdding && (
        <div className="grid gap-6 lg:grid-cols-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <Panel className="lg:col-span-2 bg-white border border-indigo-200 shadow-sm rounded-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h2 className="text-base font-bold text-slate-900 font-display flex items-center gap-2">
                <UserPlus className="h-4.5 w-4.5 text-indigo-600" />
                Register New Employee
              </h2>
              <span className="text-xs text-slate-500">Creates directory record</span>
            </div>

            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                addEmployee.mutate();
              }}
            >
              <Field label="Employee Code" hint="Unique ID badge">
                <Input
                  value={form.employee_code}
                  onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
                  placeholder="EMP-0142"
                  required
                />
              </Field>
              <Field label="Full Name">
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Elena Rostova"
                  required
                />
              </Field>
              <Field label="Work Email">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="elena@company.com"
                />
              </Field>
              <Field label="Job Title">
                <Input
                  value={form.job_title}
                  onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                  placeholder="Systems Engineer"
                />
              </Field>
              <Field label="Department">
                <Select
                  value={form.department_id}
                  onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {(departments.data ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="flex items-end">
                <Button type="submit" loading={addEmployee.isPending} className="w-full">
                  Create Employee Record
                </Button>
              </div>
            </form>
          </Panel>

          {/* Department Management Panel */}
          <Panel className="bg-white border border-slate-200 shadow-sm rounded-2xl">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200 mb-4">
              <Building2 className="h-4.5 w-4.5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900 font-display">Departments</h2>
            </div>
            <div className="flex gap-2">
              <Input
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                placeholder="e.g. Engineering"
                className="text-xs"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => addDepartment.mutate()}
                loading={addDepartment.isPending}
              >
                Add
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
              {(departments.data ?? []).map((d) => (
                <span
                  key={d.id}
                  className="inline-flex items-center rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs text-slate-700 font-medium"
                >
                  {d.name}
                </span>
              ))}
              {departments.data?.length === 0 && (
                <span className="text-xs text-slate-400">No departments registered yet.</span>
              )}
            </div>
          </Panel>
        </div>
      )}

      {/* Directory Table Panel */}
      <Panel className="p-0 overflow-hidden border border-slate-200 bg-white rounded-2xl shadow-sm">
        {/* Table Header & Search Filter */}
        <div className="border-b border-slate-200 px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight font-display">
              Employee Directory
            </h2>
            <span className="text-xs text-slate-500 block mt-0.5">
              Face templates are irreversible mathematical vectors stored in PostgreSQL.
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search by name, code, role..."
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
              {(departments.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table Content */}
        {employees.isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
            <div className="h-4 w-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
            Loading employee directory...
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 border border-slate-200 text-slate-500 mb-3">
              <Users className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">No employees found</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              Add your first employee to start biometric face enrollment.
            </p>
            {isStaff && (
              <div className="mt-5">
                <Button
                  size="sm"
                  onClick={() => setIsAdding(true)}
                  icon={<UserPlus className="h-3.5 w-3.5" />}
                >
                  Add Employee
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm min-w-[700px]">
              <thead className="border-b border-slate-200 bg-slate-100/70 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-600 font-display">
                <tr>
                  <th className="px-4 sm:px-6 py-3">Code</th>
                  <th className="px-4 sm:px-6 py-3">Employee</th>
                  <th className="px-4 sm:px-6 py-3">Department</th>
                  <th className="px-4 sm:px-6 py-3">Status</th>
                  <th className="px-4 sm:px-6 py-3">Biometric Profile</th>
                  <th className="px-4 sm:px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((e) => {
                  const hasTemplates = e.templates > 0;

                  return (
                    <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-indigo-700 font-bold">
                        {e.employee_code}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={e.full_name} size="sm" />
                          <div>
                            <span className="font-semibold text-slate-900 block text-sm">
                              {e.full_name}
                            </span>
                            <span className="text-xs text-slate-500">
                              {e.job_title || "No title set"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">
                        {(e.departments as { name: string } | null)?.name ?? (
                          <span className="text-slate-400">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge tone={e.status === "active" ? "success" : "warning"} size="sm">
                          {e.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        {hasTemplates ? (
                          <Badge tone="success" pulse size="sm">
                            ENROLLED ({e.templates} TEMPLATES)
                          </Badge>
                        ) : (
                          <Badge tone="warning" size="sm">
                            AWAITING ENROLLMENT
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link to="/console/enroll/$employeeId" params={{ employeeId: e.id }}>
                            <Button
                              size="xs"
                              variant={hasTemplates ? "outline" : "primary"}
                              icon={<ScanFace className="h-3 w-3" />}
                            >
                              {hasTemplates ? "Re-Enrol" : "Enrol Face"}
                            </Button>
                          </Link>

                          {isStaff && (
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => {
                                setEmployeeToDelete({
                                  id: e.id,
                                  full_name: e.full_name,
                                  employee_code: e.employee_code,
                                  job_title: e.job_title,
                                  department_name: (e.departments as { name: string } | null)?.name,
                                  templatesCount: e.templates,
                                });
                              }}
                              title="Delete employee profile"
                              className="text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
          if (employeeToDelete?.id) {
            deleteEmployee.mutate(employeeToDelete.id);
          }
        }}
        loading={deleteEmployee.isPending}
        employee={employeeToDelete}
      />

      {/* Bulk Roster Ingestion Modal */}
      <BulkEnrollmentModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        organizationId={currentOrgId || undefined}
      />
    </div>
  );
}
