import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ScanFace, ArrowRight, ShieldCheck, Lock, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button, Field, Input, Panel, Badge } from "@/components/ui/primitives";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In — Sentra Attendance Console" },
      {
        name: "description",
        content: "Sign in to the Sentra facial recognition attendance console.",
      },
      { property: "og:title", content: "Sign In — Sentra Attendance Console" },
      { property: "og:description", content: "Access the Sentra attendance console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s["next"] === "string" ? s["next"] : undefined,
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  const target = next && next.startsWith("/") ? next : "/console";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: target });
    });
  }, [navigate, target]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Account created successfully. You can now sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back to Sentra");
        navigate({ to: target });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="hero-surface flex min-h-screen items-center justify-center px-4 py-12 selection:bg-sky-500/30 selection:text-sky-200">
      {/* Ambient background glow accents */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-sky-500/10 rounded-full blur-[130px]" />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-3 group">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-500 shadow-lg shadow-sky-500/25 group-hover:scale-105 transition-transform">
              <ScanFace className="h-6 w-6 text-slate-950" />
            </div>
            <span className="font-display text-2xl font-extrabold tracking-tight text-white">
              Sentra
            </span>
          </Link>
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
            Biometric Access & Attendance
          </p>
        </div>

        {/* Auth Glass Card */}
        <Panel className="p-8 border border-white/12 shadow-2xl backdrop-blur-2xl">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-950 p-1 border border-white/10 mb-6">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`rounded-lg py-2 text-xs font-semibold transition-all ${
                mode === "signin"
                  ? "bg-sky-400 text-slate-950 shadow-md shadow-sky-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded-lg py-2 text-xs font-semibold transition-all ${
                mode === "signup"
                  ? "bg-sky-400 text-slate-950 shadow-md shadow-sky-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Create Account
            </button>
          </div>

          <div className="space-y-1 mb-6">
            <h1 className="text-xl font-bold text-white font-display">
              {mode === "signin"
                ? "Sign in to workspace console"
                : "Register organization administrator"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {mode === "signin"
                ? "Enter your credentials to access staff records and terminal telemetry."
                : "The first registered user is granted full administrator privileges."}
            </p>
          </div>

          <form className="space-y-4" onSubmit={submit}>
            {mode === "signup" && (
              <Field label="Administrator Full Name">
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Elena Rostova"
                  required
                  maxLength={100}
                />
              </Field>
            )}

            <Field label="Work Email Address">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                maxLength={255}
              />
            </Field>

            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                minLength={8}
              />
            </Field>

            <Button type="submit" size="lg" className="w-full mt-2" loading={busy}>
              {mode === "signin" ? "Sign In to Console" : "Create Workspace Account"}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              Encrypted Session
            </span>
            <Link to="/" className="text-sky-400 hover:underline">
              Back to Home
            </Link>
          </div>
        </Panel>
      </div>
    </main>
  );
}
