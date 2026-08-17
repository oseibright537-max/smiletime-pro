import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  LogOut,
  ScanFace,
  Users,
  Zap,
  Settings,
  Menu,
  X,
  Shield,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { Badge, Button } from "@/components/ui/primitives";
import { Logo } from "@/components/ui/logo";
import { Building, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/console")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Console — FaceTime Attendance" },
      {
        name: "description",
        content:
          "Manage employees, face enrolment, and attendance activity in FaceTime Attendance.",
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
  const { currentOrg, organizations, switchOrganization } = useOrganization();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-400 gap-3">
        <div className="h-5 w-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        <span className="font-mono text-xs uppercase tracking-widest text-indigo-400 font-semibold">
          Authenticating session…
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200 flex flex-col font-sans">
      {/* Top Glass Navigation Header */}
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-xl border-b border-white/10 shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3">
          {/* Left: Brand Logo & Organization Pill */}
          <div className="flex items-center gap-3 sm:gap-4 lg:gap-6">
            <Link to="/" className="group flex items-center">
              <Logo size="sm" subtitle="Enterprise Hub" />
            </Link>

            {/* Active Company Badge / Switcher */}
            {currentOrg && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-200 text-xs font-semibold shadow-inner">
                <Building className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                {organizations.length > 1 ? (
                  <select
                    value={currentOrg.id}
                    onChange={(e) => switchOrganization(e.target.value)}
                    className="bg-transparent font-bold text-slate-200 text-xs focus:outline-none cursor-pointer pr-1"
                  >
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id} className="bg-slate-900 text-white">
                        {org.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="max-w-[120px] sm:max-w-[160px] truncate font-bold text-slate-200">
                    {currentOrg.name}
                  </span>
                )}
              </div>
            )}

            {/* Desktop Navigation Tabs (Hidden on Mobile/Tablet < md) */}
            <nav className="hidden md:flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800/80">
              {nav.map((item) => {
                const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                      active
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                    }`}
                  >
                    <item.icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: Actions & Mobile Hamburger */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Terminal status */}
            <div className="hidden sm:block">
              <Badge tone="success" pulse size="sm">
                ENGINE ONLINE
              </Badge>
            </div>

            {/* Primary role badge */}
            {roles.slice(0, 1).map((r) => (
              <Badge key={r} tone="primary" size="sm" className="hidden xs:inline-flex">
                {r.toUpperCase()}
              </Badge>
            ))}

            {/* Kiosk Mode Launcher */}
            <Link to="/kiosk" className="hidden sm:inline-flex">
              <Button
                size="sm"
                variant="outline"
                icon={<Zap className="h-3.5 w-3.5 text-indigo-400" />}
                className="border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-200 font-semibold"
              >
                Kiosk
              </Button>
            </Link>

            {/* Sign Out Button (Desktop) */}
            <button
              onClick={() => signOut()}
              title="Sign out of workspace"
              className="hidden sm:inline-flex items-center justify-center h-8.5 w-8.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>

            {/* Mobile Hamburger Toggle Button (< md) */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex items-center justify-center h-9 w-9 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors cursor-pointer"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu (< md) */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800 bg-slate-950 px-4 pt-3 pb-5 space-y-3 animate-in slide-in-from-top-2 duration-200 shadow-2xl">
            {/* Status Pill */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-400">System Status:</span>
                <Badge tone="success" pulse size="sm">
                  ENGINE ONLINE
                </Badge>
              </div>
              <div className="flex gap-1">
                {roles.map((r) => (
                  <Badge key={r} tone="primary" size="sm">
                    {r.toUpperCase()}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Navigation Links */}
            <div className="space-y-1">
              {nav.map((item) => {
                const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 w-full rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all ${
                      active
                        ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                        : "text-slate-300 hover:bg-slate-900"
                    }`}
                  >
                    <item.icon
                      className={`h-4 w-4 ${active ? "text-indigo-400" : "text-slate-500"}`}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Mobile Actions Grid */}
            <div className="pt-2 grid grid-cols-2 gap-2">
              <Link to="/kiosk" className="w-full" onClick={() => setMobileMenuOpen(false)}>
                <Button
                  size="sm"
                  className="w-full justify-center"
                  icon={<Zap className="h-4 w-4" />}
                >
                  Launch Kiosk
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => signOut()}
                className="w-full justify-center text-rose-400 hover:bg-rose-500/10 border-rose-500/30"
                icon={<LogOut className="h-4 w-4" />}
              >
                Sign Out
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Main Workspace View */}
      <main className="flex-1 mx-auto max-w-7xl w-full px-3 sm:px-6 py-5 sm:py-8 pb-20 md:pb-8">
        <Outlet />
      </main>

      {/* Console Workspace Footer */}
      <footer className="hidden md:block border-t border-slate-800/80 bg-slate-950/60 backdrop-blur-md py-4 px-6 mt-auto">
        <div className="mx-auto max-w-7xl flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-400">FaceTime Attendance</span>
            <span>·</span>
            <span>Zero-Photo Retention (RAM Vectors Only)</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Engine Online
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/kiosk" className="text-indigo-400 hover:text-indigo-300 font-semibold">
              Launch Kiosk Terminal →
            </Link>
            <span>© {new Date().getFullYear()} Enterprise Suite</span>
          </div>
        </div>
      </footer>

      {/* Mobile Sticky Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-slate-950/90 backdrop-blur-xl border-t border-slate-800 shadow-2xl px-2 py-1.5 flex items-center justify-around">
        {nav.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl text-[10px] font-semibold transition-all ${
                active ? "text-indigo-400 font-bold" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <item.icon
                className={`h-4 w-4 mb-0.5 ${active ? "text-indigo-400" : "text-slate-500"}`}
              />
              <span className="truncate max-w-[75px]">{item.label.split(" ")[0]}</span>
            </Link>
          );
        })}

        <Link
          to="/kiosk"
          className="flex flex-col items-center justify-center py-1 px-3 rounded-xl text-[10px] font-semibold text-indigo-400 hover:text-indigo-300"
        >
          <div className="h-4 w-4 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mb-0.5">
            <Zap className="h-3 w-3 text-indigo-400" />
          </div>
          <span>Kiosk</span>
        </Link>
      </div>
    </div>
  );
}
