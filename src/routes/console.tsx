import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { LayoutDashboard, LogOut, ScanFace, Users, Zap, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Badge, Button } from "@/components/ui/primitives";

export const Route = createFileRoute("/console")({
  head: () => ({
    meta: [
      { title: "Console — Sentra Attendance" },
      {
        name: "description",
        content: "Manage employees, face enrolment, and attendance activity in Sentra.",
      },
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
  { to: "/console/employees", label: "Employees & Enrolment", icon: Users, exact: false },
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
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-muted-foreground gap-3">
        <div className="h-5 w-5 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
        <span className="font-mono text-xs uppercase tracking-widest text-sky-400">
          Authenticating session…
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-foreground selection:bg-sky-500/30 selection:text-sky-200">
      {/* Top Glass Navigation */}
      <header className="sticky top-0 z-40 glass-bar border-b border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-3.5">
          {/* Logo & Workspace brand */}
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
                <ScanFace className="h-4.5 w-4.5 text-slate-950" />
              </div>
              <div>
                <span className="font-display font-bold text-white text-base tracking-tight block">
                  Sentra
                </span>
                <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider block">
                  Enterprise Hub
                </span>
              </div>
            </Link>

            {/* Navigation Tabs */}
            <nav className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-white/10 backdrop-blur-md">
              {nav.map((item) => {
                const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                      active
                        ? "bg-sky-400 text-slate-950 shadow-md shadow-sky-500/20"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
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
                icon={<Zap className="h-3.5 w-3.5 text-sky-400" />}
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
              className="text-muted-foreground hover:text-rose-400"
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
