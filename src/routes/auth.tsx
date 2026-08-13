import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  ArrowLeft,
  KeyRound,
  Mail,
  User,
  Building,
  Sparkles,
  Key,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button, Field, Input, Panel } from "@/components/ui/primitives";
import { Logo } from "@/components/ui/logo";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Authentication — FaceTime Attendance" },
      {
        name: "description",
        content: "Sign in, register company, or confirm email verification code.",
      },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s["next"] === "string" ? s["next"] : undefined,
  }),
  component: AuthPage,
});

type AuthMode = "signin" | "signup" | "verify" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const { next } = useSearch({ from: "/auth" });
  const { user } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const target = next && next.startsWith("/") ? next : "/console";

  useEffect(() => {
    if (user) {
      navigate({ to: target });
    }
  }, [user, navigate, target]);

  // Resend verification code
  const handleResendOtp = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: cleanEmail,
      });
      if (error) throw error;
      toast.info("A new verification code has been sent to your email.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setResending(false);
    }
  };

  // Handle Form Submit
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);

    const cleanEmail = email.trim().toLowerCase();

    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        setResetSent(true);
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: {
              full_name: fullName.trim() || cleanEmail,
              company_name: companyName.trim() || `${fullName.trim() || cleanEmail}'s Company`,
            },
          },
        });
        if (error) throw error;

        // If email already exists in Supabase
        if (data?.user && data.user.identities && data.user.identities.length === 0) {
          setFormError("This email is already registered. Please sign in.");
          setMode("signin");
        } else if (data?.session) {
          // Direct login without email confirmation requirement - NO popup message
          navigate({ to: target });
        } else {
          // Confirmation code required -> switch to verify mode
          setMode("verify");
        }
      } else if (mode === "verify") {
        // 6-digit confirmation code verification
        const token = otpCode.trim();
        let { data, error } = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token,
          type: "signup",
        });

        // Fallback to type: email or recovery if signup type errors
        if (error) {
          const secondAttempt = await supabase.auth.verifyOtp({
            email: cleanEmail,
            token,
            type: "email",
          });
          if (!secondAttempt.error) {
            data = secondAttempt.data;
            error = null;
          }
        }

        if (error) {
          throw new Error("Invalid or expired verification code. Please check your email or request a new code.");
        }

        if (data?.session) {
          // Verified & Logged in - redirect directly with NO message
          navigate({ to: target });
        } else {
          setMode("signin");
        }
      } else {
        // Sign In
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes("email not confirmed")) {
            setMode("verify");
            throw new Error(
              "Your email is not confirmed yet. Enter the 6-digit code sent to your inbox below.",
            );
          }
          if (msg.includes("invalid login credentials")) {
            throw new Error(
              "Incorrect email or password. If you forgot your password, click 'Forgot password?'.",
            );
          }
          throw error;
        }

        if (data.session) {
          // Direct redirect with NO congratulatory/signed in popup message
          navigate({ to: target });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication error occurred";
      setFormError(message);
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
          <p className="text-xs text-slate-500 max-w-sm">
            AI-powered enterprise facial recognition workforce intelligence & attendance system.
          </p>
        </div>

        {/* Card Form */}
        <Panel className="bg-white border border-slate-200 shadow-xl rounded-2xl p-6 sm:p-8">
          {/* Mode Switcher Tabs */}
          {mode !== "forgot" && mode !== "verify" && (
            <div className="flex rounded-xl bg-slate-100 p-1 mb-6 border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setFormError(null);
                }}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer ${
                  mode === "signin"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setFormError(null);
                }}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer ${
                  mode === "signup"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Register Company
              </button>
            </div>
          )}

          {/* Heading */}
          <div className="space-y-1 mb-6">
            <h1 className="text-xl font-bold text-slate-900 font-display">
              {mode === "signin"
                ? "Sign in to company workspace"
                : mode === "signup"
                  ? "Register new company account"
                  : mode === "verify"
                    ? "Confirm your email code"
                    : "Reset your password"}
            </h1>
            <p className="text-xs text-slate-500">
              {mode === "signin"
                ? "Enter your work credentials to access staff records and terminal telemetry."
                : mode === "signup"
                  ? "Create an isolated company account with automated roster and kiosk management."
                  : mode === "verify"
                    ? `Enter the 6-digit confirmation code sent to ${email}.`
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
              {formError && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700"
                >
                  {formError}
                </div>
              )}

              {/* Mode: Verify 6-digit Code */}
              {mode === "verify" && (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-150">
                  <Field label="6-Digit Verification Code">
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={8}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="123456"
                      className="text-center tracking-widest font-mono text-lg font-bold"
                      required
                      autoFocus
                    />
                  </Field>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <span>Didn't receive the code?</span>
                    <button
                      type="button"
                      onClick={() => void handleResendOtp()}
                      disabled={resending}
                      className="font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer inline-flex items-center gap-1"
                    >
                      <RefreshCw className={`h-3 w-3 ${resending ? "animate-spin" : ""}`} />
                      Resend Code
                    </button>
                  </div>

                  <Button type="submit" loading={busy} size="lg" className="w-full">
                    Confirm & Enter Workspace
                  </Button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signin");
                        setFormError(null);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                    >
                      ← Back to Sign In
                    </button>
                  </div>
                </div>
              )}

              {/* Mode: Sign Up Fields */}
              {mode === "signup" && (
                <>
                  <Field label="Full Name">
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Elena Rostova"
                      required
                      maxLength={100}
                    />
                  </Field>

                  <Field label="Company / Organization Name">
                    <Input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Acme Corporation Ltd"
                      required
                      maxLength={100}
                    />
                  </Field>
                </>
              )}

              {/* Email and Password Fields for SignIn / SignUp / Forgot */}
              {mode !== "verify" && (
                <>
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
                          placeholder="••••••••"
                          required
                          minLength={6}
                          maxLength={72}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <Button type="submit" loading={busy} size="lg" className="w-full mt-2">
                    {mode === "signin"
                      ? "Sign in to workspace"
                      : mode === "signup"
                        ? "Register Company Workspace"
                        : "Send Password Reset Link"}
                  </Button>

                  {mode === "forgot" && (
                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setMode("signin");
                          setFormError(null);
                        }}
                        className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                      >
                        ← Back to Sign In
                      </button>
                    </div>
                  )}
                </>
              )}
            </form>
          )}
        </Panel>

        {/* Back link */}
        <div className="text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
