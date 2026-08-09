import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { LayoutDashboard, LogOut, ScanFace, Users, Zap, Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Badge, Button } from "@/components/ui/primitives";
import { Logo } from "@/components/ui/logo";

export const Route = createFileRoute("/console")({
  head: () => ({
    meta: [
      { title: "Console — FaceTime Attendance" },
      {
        name: "description",
        content: "Manage employees, face enrolment, and attendance activity in FaceTime Attendance.",
      },
    ],
  }),
  component: ConsoleLayout,
});

const nav = [
  { to: "/console", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/console/employees", label: "Employees & Enrollment", icon: Users, exact: false },
  { to: "/console/settings", label: "Settings", icon: Settings, exact: true },
];

function ConsoleLayout() {
  const { user, loading, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) {
      navigate({
        to: "/auth",
        search: { next: pathname.startsWith("/console") ? pathname : "/console" },
      });
    }
  }, [loading, user, navigate, pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500 gap-3">
        <div className="h-5 w-5 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
        <span className="font-mono text-xs uppercase tracking-widest text-indigo-600 font-semibold">
          Authenticating session…
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-500/20 selection:text-indigo-900">
      {/* Top Glass Navigation */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-3">
          {/* Logo & Workspace brand */}
          <div className="flex items-center gap-6">
            <Link to="/" className="group">
              <Logo size="sm" subtitle="Enterprise Hub" />
            </Link>

            {/* Navigation Tabs */}
            <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              {nav.map((item) => {
                const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                      active
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                    }`}
                  >
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-3">
            {/* Live Terminal status */}
            <Badge tone="success" pulse size="sm">
              ENGINE ONLINE
            </Badge>

            {/* Roles */}
            {roles.map((r) => (
              <Badge key={r} tone="primary" size="sm">
                {r.toUpperCase()}
              </Badge>
            ))}

            {/* Kiosk Mode Launcher */}
            <Link to="/kiosk">
              <Button
                size="sm"
                variant="outline"
                icon={<Zap className="h-3.5 w-3.5 text-indigo-600" />}
              >
                Launch Kiosk
              </Button>
            </Link>

            {/* Sign Out */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => signOut()}
              title="Sign out of workspace"
              className="text-slate-500 hover:text-rose-600"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Workspace View */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
