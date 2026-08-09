import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ScanFace,
  ShieldCheck,
  Lock,
  Mail,
  KeyRound,
  CheckCircle2,
  Eye,
  EyeOff,
  ArrowLeft,
  User,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button, Field, Input, Panel } from "@/components/ui/primitives";
import { Logo } from "@/components/ui/logo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Authentication — FaceTime Attendance" },
      {
        name: "description",
        content: "Sign in, register, or recover your password for FaceTime Attendance.",
      },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s["next"] === "string" ? s["next"] : undefined,
  }),
  component: AuthPage,
});

type AuthMode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const { next } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const target = next && next.startsWith("/") ? next : "/console";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: target });
    });
  }, [navigate, target]);

  // Handle Form Submit
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        setResetSent(true);
        toast.success("Password reset email sent! Check your inbox.");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: { full_name: fullName.trim() },
          },
        });
        if (error) throw error;

        if (data?.session) {
          toast.success("Account created successfully! Welcome to FaceTime Attendance.");
          navigate({ to: target });
        } else if (data?.user && data.user.identities && data.user.identities.length === 0) {
          toast.error("This email is already registered. Please sign in or use forgot password.");
          setMode("signin");
        } else {
          toast.success("Registration received! Please check your email to activate your account.");
          setMode("signin");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          if (error.message.toLowerCase().includes("email not confirmed")) {
            throw new Error("Your email address is not confirmed yet. Please check your email inbox for the activation link.");
          }
          if (error.message.toLowerCase().includes("invalid login credentials")) {
            throw new Error("Incorrect email or password. Please re-check your credentials or click 'Forgot password?'.");
          }
          throw error;
        }

        if (data.session) {
          toast.success("Welcome back to FaceTime Attendance");
          navigate({ to: target });
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="hero-surface min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2 flex flex-col items-center">
          <Link to="/" className="inline-flex items-center gap-3 group">
            <Logo size="lg" subtitle="Biometric Portal" />
          </Link>
        </div>

        {/* Auth White Card */}
        <Panel className="p-8 bg-white border border-slate-200 shadow-lg rounded-2xl">
          {/* Mode Switcher Tabs (Only for signin / signup) */}
          {mode !== "forgot" && (
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200 mb-6">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={`rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer ${
                  mode === "signin"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer ${
                  mode === "signup"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Register
              </button>
            </div>
          )}

          {/* Heading */}
          <div className="space-y-1 mb-6">
            <h1 className="text-xl font-bold text-slate-900 font-display">
              {mode === "signin"
                ? "Sign in to workspace"
                : mode === "signup"
                  ? "Create administrator account"
                  : "Reset your password"}
            </h1>
            <p className="text-xs text-slate-500">
              {mode === "signin"
                ? "Enter your credentials to access staff records and terminal telemetry."
                : mode === "signup"
                  ? "Register an account to manage workforce biometric templates."
                  : "Enter your work email address to receive password recovery instructions."}
            </p>
          </div>

          {/* Forgot Password Success State */}
          {mode === "forgot" && resetSent ? (
            <div className="space-y-6 text-center py-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="h-14 w-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Check Your Email</h3>
                <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
                  We have sent password reset instructions to{" "}
                  <span className="font-semibold text-slate-900">{email}</span>. Please check your
                  inbox.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setResetSent(false);
                  setMode("signin");
                }}
                icon={<ArrowLeft className="h-4 w-4" />}
              >
                Back to Sign In
              </Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={submit}>
              {mode === "signup" && (
                <Field label="Full Name">
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

              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 font-display">
                      Password
                    </span>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => {
                          setResetSent(false);
                          setMode("forgot");
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-medium hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      minLength={6}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              <Button type="submit" size="lg" className="w-full mt-3" loading={busy}>
                {mode === "signin"
                  ? "Sign In to Console"
                  : mode === "signup"
                    ? "Create Account"
                    : "Send Reset Link"}
              </Button>

              {mode === "forgot" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => setMode("signin")}
                  icon={<ArrowLeft className="h-4 w-4" />}
                >
                  Back to Sign In
                </Button>
              )}
            </form>
          )}

          {/* Footer security badge */}
          <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
              <ShieldCheck className="h-4 w-4" />
              Secure 256-bit SSL Session
            </span>
            <Link to="/" className="text-indigo-600 hover:underline font-medium">
              Home
            </Link>
          </div>
        </Panel>
      </div>
    </main>
  );
}
