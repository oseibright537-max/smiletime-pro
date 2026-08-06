import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ScanFace, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge, Button, Field, Input, Panel, Select } from "@/components/ui/primitives";

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
  const [form, setForm] = useState({ employee_code: "", full_name: "", email: "", job_title: "", department_id: "" });
  const [newDept, setNewDept] = useState("");

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
          .select("id,employee_code,full_name,email,job_title,status,department_id,departments(name)")
          .order("created_at", { ascending: false }),
        supabase.from("face_embeddings").select("employee_id"),
      ]);
      const counts = new Map<string, number>();
      (templates ?? []).forEach((t) => counts.set(t.employee_id, (counts.get(t.employee_id) ?? 0) + 1));
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
      toast.success("Employee added");
      setForm({ employee_code: "", full_name: "", email: "", job_title: "", department_id: "" });
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e) => toast.error(e instanceof z.ZodError ? e.issues[0]!.message : (e as Error).message),
  });

  const addDepartment = useMutation({
    mutationFn: async () => {
      const name = newDept.trim();
      if (name.length < 2) throw new Error("Department name is too short");
      const { error } = await supabase.from("departments").insert({ name });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewDept("");
      toast.success("Department created");
      qc.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const resetFace = useMutation({
    mutationFn: async (employeeId: string) => {
      const { error } = await supabase.from("face_embeddings").delete().eq("employee_id", employeeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Face templates cleared");
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Employees</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add people, then enrol their face from five angles so the kiosk can recognise them.
        </p>
      </div>

      {isStaff && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel className="lg:col-span-2">
            <h2 className="font-semibold">New employee</h2>
            <form
              className="mt-4 grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                addEmployee.mutate();
              }}
            >
              <Field label="Employee code">
                <Input
                  value={form.employee_code}
                  onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
                  placeholder="EMP-0142"
                  required
                />
              </Field>
              <Field label="Full name">
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  required
                />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field label="Job title">
                <Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
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
                <Button type="submit" disabled={addEmployee.isPending} className="w-full">
                  {addEmployee.isPending ? "Saving…" : "Add employee"}
                </Button>
              </div>
            </form>
          </Panel>

          <Panel>
            <h2 className="font-semibold">Departments</h2>
            <div className="mt-4 flex gap-2">
              <Input value={newDept} onChange={(e) => setNewDept(e.target.value)} placeholder="Engineering" />
              <Button variant="outline" onClick={() => addDepartment.mutate()} disabled={addDepartment.isPending}>
                Add
              </Button>
            </div>
            <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
              {(departments.data ?? []).map((d) => (
                <li key={d.id}>· {d.name}</li>
              ))}
              {departments.data?.length === 0 && <li>No departments yet.</li>}
            </ul>
          </Panel>
        </div>
      )}

      <Panel className="p-0">
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-semibold">Directory</h2>
        </div>
        {employees.isLoading ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">Loading…</p>
        ) : employees.data?.length === 0 ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">No employees yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">Code</th>
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Department</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Face</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {(employees.data ?? []).map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{e.employee_code}</td>
                    <td className="px-6 py-3">
                      <div>{e.full_name}</div>
                      <div className="text-xs text-muted-foreground">{e.job_title ?? "—"}</div>
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">
                      {(e.departments as { name: string } | null)?.name ?? "—"}
                    </td>
                    <td className="px-6 py-3">
                      <Badge tone={e.status === "active" ? "success" : "warning"}>{e.status}</Badge>
                    </td>
                    <td className="px-6 py-3">
                      {e.templates > 0 ? (
                        <Badge tone="primary">{e.templates} templates</Badge>
                      ) : (
                        <Badge tone="muted">not enrolled</Badge>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex justify-end gap-2">
                        <Link to="/console/enroll/$employeeId" params={{ employeeId: e.id }}>
                          <Button size="sm" variant="outline">
                            <ScanFace className="h-4 w-4" /> Enrol
                          </Button>
                        </Link>
                        {isStaff && e.templates > 0 && (
                          <Button size="sm" variant="ghost" onClick={() => resetFace.mutate(e.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
