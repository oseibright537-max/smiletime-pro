import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { LayoutDashboard, LogOut, ScanFace, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Badge, Button } from "@/components/ui/primitives";

export const Route = createFileRoute("/console")({
  head: () => ({
    meta: [
      { title: "Console — Sentra Attendance" },
      { name: "description", content: "Manage employees, face enrolment, and attendance activity in Sentra." },
      { property: "og:title", content: "Console — Sentra Attendance" },
      { property: "og:description", content: "Manage employees, enrolment, and attendance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConsoleLayout,
});

const nav = [
  { to: "/console", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/console/employees", label: "Employees", icon: Users, exact: false },
];

function ConsoleLayout() {
  const { user, loading, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth", search: { next: pathname.startsWith("/console") ? pathname : "/console" } });
    }
  }, [loading, user, navigate, pathname]);


  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading console…
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface/60 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-6 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="accent-surface flex h-8 w-8 items-center justify-center rounded-lg">
              <ScanFace className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
            <span className="font-display font-semibold">Sentra</span>
          </Link>
          <nav className="flex items-center gap-1">
            {nav.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {roles.map((r) => (
              <Badge key={r} tone="primary">
                {r}
              </Badge>
            ))}
            <Link to="/kiosk">
              <Button size="sm">Kiosk mode</Button>
            </Link>
            <Button size="sm" variant="ghost" onClick={() => signOut()}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
