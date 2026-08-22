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
  Building,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { Badge, Button } from "@/components/ui/primitives";
import { Logo } from "@/components/ui/logo";

export const Route = createFileRoute("/console")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Console — SmileTime Pro" },
      {
        name: "description",
        content: "Manage employees, face enrolment, and attendance activity in SmileTime Pro.",
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
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFB] text-sm text-[#5C5A66] gap-3">
        <div className="h-5 w-5 rounded-full border-2 border-[#1B1A20] border-t-transparent animate-spin" />
        <span className="font-mono text-xs uppercase tracking-widest text-[#1B1A20] font-semibold">
          Authenticating session…
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFB] text-[#1B1A20] selection:bg-[#C7B8F5]/30 selection:text-[#1B1A20] flex flex-col font-sans">
      {/* Top Glass Navigation Header */}
      <header className="sticky top-0 z-40 bg-[#FAFAFB]/85 backdrop-blur-md border-b border-[#ECEBF0]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3">
          {/* Left: Brand Logo & Organization Pill */}
          <div className="flex items-center gap-3 sm:gap-5 lg:gap-6">
            <Link to="/" className="group flex items-center">
              <Logo size="sm" subtitle="Workspace" />
            </Link>

            {/* Active Company Badge / Switcher */}
            {currentOrg && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-[#ECEBF0] rounded-full text-[#1B1A20] text-xs font-semibold shadow-2xs">
                <Building className="h-3.5 w-3.5 text-[#5C5A66] shrink-0" />
                {organizations.length > 1 ? (
                  <select
                    value={currentOrg.id}
                    onChange={(e) => switchOrganization(e.target.value)}
                    className="bg-transparent font-semibold text-[#1B1A20] text-xs focus:outline-none cursor-pointer pr-1"
                  >
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="max-w-[120px] sm:max-w-[160px] truncate font-semibold text-[#1B1A20]">
                    {currentOrg.name}
                  </span>
                )}
              </div>
            )}

            {/* Desktop Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1 bg-[#F3F2F6] p-1 rounded-full border border-[#ECEBF0]">
              {nav.map((item) => {
                const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200 ${
                      active
                        ? "bg-white text-[#1B1A20] shadow-xs"
                        : "text-[#5C5A66] hover:text-[#1B1A20]"
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
                ONLINE
              </Badge>
            </div>

            {/* Primary role badge */}
            {roles.slice(0, 1).map((r) => (
              <Badge key={r} tone="muted" size="sm" className="hidden xs:inline-flex">
                {r.toUpperCase()}
              </Badge>
            ))}

            {/* Kiosk Mode Launcher */}
            <Link to="/kiosk" className="hidden sm:inline-flex">
              <span className="bst-btn-wrap">
                <span className="bst-btn-halo" />
                <Button
                  size="sm"
                  className="bst-btn bst-btn--sm"
                  icon={<Zap className="h-3.5 w-3.5 text-[#C7B8F5]" />}
                >
                  Kiosk
                </Button>
              </span>
            </Link>

            {/* Sign Out Button (Desktop) */}
            <button
              onClick={() => signOut()}
              title="Sign out of workspace"
              className="hidden sm:inline-flex items-center justify-center h-8.5 w-8.5 rounded-full text-[#5C5A66] hover:text-[#D64545] hover:bg-[#FDF1F3] border border-[#ECEBF0] transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>

            {/* Mobile Hamburger Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex items-center justify-center h-9 w-9 rounded-full bg-white hover:bg-[#F3F2F6] border border-[#ECEBF0] text-[#1B1A20] transition-colors"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#ECEBF0] bg-white px-4 pt-3 pb-5 space-y-3 animate-in slide-in-from-top-2 duration-200 shadow-lg">
            <div className="flex items-center justify-between pb-2 border-b border-[#ECEBF0] text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#1B1A20]">System Status:</span>
                <Badge tone="success" pulse size="sm">
                  ENGINE ONLINE
                </Badge>
              </div>
              <div className="flex gap-1">
                {roles.map((r) => (
                  <Badge key={r} tone="muted" size="sm">
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
                    className={`flex items-center gap-3 w-full rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all ${
                      active ? "bg-[#1B1A20] text-white" : "text-[#5C5A66] hover:bg-[#F3F2F6]"
                    }`}
                  >
                    <item.icon className={`h-4 w-4 ${active ? "text-white" : "text-[#9B99A6]"}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Mobile Actions */}
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
                className="w-full justify-center text-[#D64545] hover:bg-[#FDF1F3] border-[#F5B8C4]"
                icon={<LogOut className="h-4 w-4" />}
              >
                Sign Out
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Main Workspace View */}
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 py-6 pb-20 md:pb-8">
        <Outlet />
      </main>

      {/* Console Workspace Footer */}
      <footer className="hidden md:block border-t border-[#ECEBF0] bg-white py-4 px-6 mt-auto">
        <div className="mx-auto max-w-7xl flex items-center justify-between text-xs text-[#5C5A66]">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-[#1B1A20]">SmileTime Pro</span>
            <span>·</span>
            <span>Zero-Photo Retention (RAM Vectors Only)</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1 text-[#2F9E63] font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2F9E63]" />
              Engine Online
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/kiosk" className="text-[#1B1A20] font-semibold hover:underline">
              Launch Kiosk Terminal →
            </Link>
            <span>© {new Date().getFullYear()} SmileTime</span>
          </div>
        </div>
      </footer>

      {/* Mobile Sticky Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#ECEBF0] shadow-lg px-2 py-2 flex items-center justify-around">
        {nav.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl text-[10.5px] font-semibold transition-all ${
                active ? "text-[#1B1A20] font-bold" : "text-[#9B99A6] hover:text-[#1B1A20]"
              }`}
            >
              <item.icon
                className={`h-4 w-4 mb-0.5 ${active ? "text-[#1B1A20]" : "text-[#9B99A6]"}`}
              />
              <span className="truncate max-w-[75px]">{item.label.split(" ")[0]}</span>
            </Link>
          );
        })}

        <Link
          to="/kiosk"
          className="flex flex-col items-center justify-center py-1 px-3 rounded-2xl text-[10.5px] font-semibold text-[#1B1A20]"
        >
          <div className="h-4 w-4 rounded-full bg-[#F3EFFC] border border-[#C7B8F5] flex items-center justify-center mb-0.5">
            <Zap className="h-3 w-3 text-[#7C5ED6]" />
          </div>
          <span>Kiosk</span>
        </Link>
      </div>
    </div>
  );
}
