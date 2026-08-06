import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ScanFace } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button, Field, Input, Panel } from "@/components/ui/primitives";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Sentra Attendance Console" },
      { name: "description", content: "Sign in to the Sentra facial recognition attendance console." },
      { property: "og:title", content: "Sign in — Sentra Attendance Console" },
      { property: "og:description", content: "Access the Sentra attendance console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({ next: typeof s['next'] === "string" ? s['next'] : undefined }),
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
        toast.success("Account created. Check your email to confirm, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: target });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="hero-surface flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-2">
          <div className="accent-surface flex h-9 w-9 items-center justify-center rounded-lg">
            <ScanFace className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-semibold">Sentra</span>
        </div>
        <Panel>
          <h1 className="text-xl font-semibold">
            {mode === "signin" ? "Sign in to the console" : "Create your workspace account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The first account created becomes the workspace administrator.
          </p>
          <form className="mt-6 space-y-4" onSubmit={submit}>
            {mode === "signup" && (
              <Field label="Full name">
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={100} />
              </Field>
            )}
            <Field label="Work email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </Field>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <button
            className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "No account yet? Create one" : "Already have an account? Sign in"}
          </button>
        </Panel>
      </div>
    </main>
  );
}
