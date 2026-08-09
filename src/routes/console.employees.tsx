import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ScanFace,
  Trash2,
  UserPlus,
  Building2,
  Search,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronRight,
  Shield,
  Layers,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge, Button, Field, Input, Panel, Select, Avatar } from "@/components/ui/primitives";

export const Route = createFileRoute("/console/employees")({ component: Employees });

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

  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: async () => (await supabase.from("departments").select("*").order("name")).data ?? [],
  });

  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const [{ data: rows }, { data: templates }] = await Promise.all([
        supabase
          .from("employees")
          .select(
            "id,employee_code,full_name,email,job_title,status,department_id,departments(name)",
          )
          .order("created_at", { ascending: false }),
        supabase.from("face_embeddings").select("employee_id"),
      ]);
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
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Employee created successfully");
      setForm({ employee_code: "", full_name: "", email: "", job_title: "", department_id: "" });
      setIsAdding(false);
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e) =>
      toast.error(e instanceof z.ZodError ? e.issues[0]!.message : (e as Error).message),
  });

  const addDepartment = useMutation({
    mutationFn: async () => {
      const name = newDept.trim();
      if (name.length < 2) throw new Error("Department name must be at least 2 characters");
      const { error } = await supabase.from("departments").insert({ name });
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

  const filteredEmployees = (employees.data ?? []).filter((e) => {
    const matchesSearch =
      e.full_name.toLowerCase().includes(search.toLowerCase()) ||
      e.employee_code.toLowerCase().includes(search.toLowerCase()) ||
      (e.job_title ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesDept = deptFilter === "all" || e.department_id === deptFilter;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-2 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-white font-display">
              Workforce Directory
            </h1>
            <Badge tone="primary" size="sm">
              {employees.data?.length ?? 0} TOTAL
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-400 font-light">
            Enrol employee faces from 5 angles to build irreversible math vectors for attendance
            kiosks.
          </p>
        </div>

        {isStaff && (
          <Button
            size="sm"
            onClick={() => setIsAdding(!isAdding)}
            icon={<UserPlus className="h-4 w-4" />}
          >
            {isAdding ? "Close Form" : "New Employee"}
          </Button>
        )}
      </div>

      {/* Add Employee Form Drawer (Collapsible) */}
      {isStaff && isAdding && (
        <div className="grid gap-6 lg:grid-cols-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <Panel className="lg:col-span-2 border-sky-500/30">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h2 className="text-base font-bold text-white font-display flex items-center gap-2">
                <UserPlus className="h-4.5 w-4.5 text-sky-400" />
                Register New Employee
              </h2>
              <span className="text-xs text-muted-foreground">Creates directory record</span>
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
                  placeholder="Lead Systems Engineer"
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
          <Panel>
            <div className="flex items-center gap-2 pb-3 border-b border-white/10 mb-4">
              <Building2 className="h-4.5 w-4.5 text-sky-400" />
              <h2 className="text-base font-bold text-white font-display">Departments</h2>
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
                  className="inline-flex items-center rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-xs text-slate-300"
                >
                  {d.name}
                </span>
              ))}
              {departments.data?.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  No departments registered yet.
                </span>
              )}
            </div>
          </Panel>
        </div>
      )}

      {/* Directory Table Panel */}
      <Panel className="p-0 overflow-hidden border border-white/10">
        {/* Table Header & Search Filter */}
        <div className="border-b border-white/10 px-6 py-5 flex flex-wrap items-center justify-between gap-4 bg-slate-900/50">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight font-display">
              Employee Directory
            </h2>
            <span className="text-xs text-muted-foreground">
              Face templates are irreversible 128-D math vectors stored on PostgreSQL pgvector.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by name, code, role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="h-9 rounded-xl border border-white/10 bg-slate-950 px-3 text-xs text-foreground focus:border-sky-400 focus:outline-none"
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
          <div className="px-6 py-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <div className="h-4 w-4 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
            Loading employee directory...
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-muted-foreground mb-3">
              <Users className="h-6 w-6 text-sky-400" />
            </div>
            <h3 className="text-base font-semibold text-white">No employees found</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
              Add your first employee to begin the 5-angle biometric face enrolment process.
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
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-slate-950/60 text-xs font-semibold uppercase tracking-wider text-muted-foreground font-display">
                <tr>
                  <th className="px-6 py-3.5">Code</th>
                  <th className="px-6 py-3.5">Employee</th>
                  <th className="px-6 py-3.5">Department</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Biometric Templates</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredEmployees.map((e) => {
                  const hasTemplates = e.templates > 0;

                  return (
                    <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-sky-300 font-semibold">
                        {e.employee_code}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={e.full_name} size="sm" />
                          <div>
                            <span className="font-semibold text-white block text-sm">
                              {e.full_name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {e.job_title || "No title set"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-300">
                        {(e.departments as { name: string } | null)?.name ?? (
                          <span className="text-muted-foreground/60">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge tone={e.status === "active" ? "success" : "warning"} size="sm">
                          {e.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        {hasTemplates ? (
                          <div className="flex items-center gap-2">
                            <Badge tone="success" pulse size="sm">
                              {e.templates} ANGLES ENROLLED
                            </Badge>
                          </div>
                        ) : (
                          <Badge tone="warning" size="sm">
                            AWAITING ENROLMENT
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link to="/console/enroll/$employeeId" params={{ employeeId: e.id }}>
                            <Button
                              size="xs"
                              variant={hasTemplates ? "outline" : "primary"}
                              icon={<ScanFace className="h-3 w-3" />}
                            >
                              {hasTemplates ? "Re-Enrol" : "Enrol Face"}
                            </Button>
                          </Link>

                          {isStaff && hasTemplates && (
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`Clear face templates for ${e.full_name}?`)) {
                                  resetFace.mutate(e.id);
                                }
                              }}
                              title="Reset face templates"
                              className="text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                            >
                              <Trash2 className="h-3 w-3" />
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
    </div>
  );
}
