import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, ScanFace, UserPlus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge, Button, Panel } from "@/components/ui/primitives";

export const Route = createFileRoute("/console/")({ component: Overview });

function useOverview() {
  return useQuery({
    queryKey: ["overview"],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const [employees, embeddings, events] = await Promise.all([
        supabase.from("employees").select("id,status"),
        supabase.from("face_embeddings").select("employee_id"),
        supabase
          .from("attendance_events")
          .select("id,employee_id,kind,occurred_at,confidence,liveness_score,employees(full_name)")
          .gte("occurred_at", startOfDay.toISOString())
          .order("occurred_at", { ascending: false })
          .limit(25),
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
  });
}

function Stat({ label, value, hint, icon: Icon }: { label: string; value: string | number; hint: string; icon: typeof Users }) {
  return (
    <Panel>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-3xl font-semibold">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
        <Icon className="h-5 w-5 text-primary" />
      </div>
    </Panel>
  );
}

function Overview() {
  const { data, isLoading } = useOverview();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Today at a glance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live recognition activity across every enrolled employee.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/console/employees">
            <Button variant="outline">
              <UserPlus className="h-4 w-4" /> Add employee
            </Button>
          </Link>
          <Link to="/kiosk">
            <Button>
              <ScanFace className="h-4 w-4" /> Open kiosk
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Present today" value={isLoading ? "—" : data!.present} hint="Unique check-ins" icon={CheckCircle2} />
        <Stat label="Active employees" value={isLoading ? "—" : data!.active} hint="Eligible for attendance" icon={Users} />
        <Stat label="Face enrolled" value={isLoading ? "—" : data!.enrolled} hint="Have face templates" icon={ScanFace} />
        <Stat
          label="Awaiting enrolment"
          value={isLoading ? "—" : Math.max(0, data!.active - data!.enrolled)}
          hint="Cannot check in yet"
          icon={Clock}
        />
      </div>

      <Panel className="p-0">
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-semibold">Recognition log — today</h2>
        </div>
        {isLoading ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">Loading events…</p>
        ) : data!.events.length === 0 ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">
            No attendance recorded yet today. Open kiosk mode to start capturing.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-medium">Employee</th>
                <th className="px-6 py-3 font-medium">Event</th>
                <th className="px-6 py-3 font-medium">Time</th>
                <th className="px-6 py-3 font-medium">Match</th>
                <th className="px-6 py-3 font-medium">Liveness</th>
              </tr>
            </thead>
            <tbody>
              {data!.events.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-6 py-3">
                    {(e.employees as { full_name: string } | null)?.full_name ?? "Unknown"}
                  </td>
                  <td className="px-6 py-3">
                    <Badge tone={e.kind === "check_in" ? "success" : e.kind === "check_out" ? "primary" : "muted"}>
                      {e.kind.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">
                    {new Date(e.occurred_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">
                    {e.confidence != null ? `${Math.round(e.confidence * 100)}%` : "—"}
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">
                    {e.liveness_score != null ? `${Math.round(e.liveness_score * 100)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
