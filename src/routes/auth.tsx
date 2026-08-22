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
      { title: "Authentication — SmileTime Pro" },
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
          navigate({ to: target });
        } else {
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
          throw new Error(
            "Invalid or expired verification code. Please check your email or request a new code.",
          );
        }

        if (data?.session) {
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
    <main className="min-h-screen bg-[#FAFAFB] flex items-center justify-center px-4 py-12 relative overflow-hidden font-sans">
      {/* Soft Ambient Halo */}
      <div className="bst-halo ln-halo--hero" />

      <div className="relative w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2 flex flex-col items-center">
          <Link to="/" className="inline-flex items-center gap-3 group">
            <Logo size="lg" subtitle="Portal" />
          </Link>
          <p className="text-xs text-[#5C5A66] max-w-sm">
            AI-powered enterprise facial recognition workforce intelligence & attendance system.
          </p>
        </div>

        {/* Card Form */}
        <Panel className="bg-white border border-[#ECEBF0] shadow-[0_6px_24px_rgba(27,26,32,0.05)] rounded-[28px] p-6 sm:p-8">
          {/* Mode Switcher Tabs */}
          {mode !== "forgot" && mode !== "verify" && (
            <div className="flex rounded-full bg-[#F3F2F6] p-1 mb-6 border border-[#ECEBF0]">
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setFormError(null);
                }}
                className={`flex-1 rounded-full py-2 text-xs font-semibold transition-all cursor-pointer ${
                  mode === "signin"
                    ? "bg-white text-[#1B1A20] shadow-xs"
                    : "text-[#5C5A66] hover:text-[#1B1A20]"
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
                className={`flex-1 rounded-full py-2 text-xs font-semibold transition-all cursor-pointer ${
                  mode === "signup"
                    ? "bg-white text-[#1B1A20] shadow-xs"
                    : "text-[#5C5A66] hover:text-[#1B1A20]"
                }`}
              >
                Register Company
              </button>
            </div>
          )}

          {/* Heading */}
          <div className="space-y-1 mb-6">
            <h1 className="text-xl font-bold text-[#1B1A20] tracking-[-0.02em]">
              {mode === "signin"
                ? "Sign in to company workspace"
                : mode === "signup"
                  ? "Register new company account"
                  : mode === "verify"
                    ? "Confirm your email code"
                    : "Reset your password"}
            </h1>
            <p className="text-xs text-[#5C5A66] leading-relaxed">
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
              <div className="h-14 w-14 rounded-full bg-[#EEF7F1] border border-[#B8E5C8] text-[#2F9E63] flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#1B1A20]">Check Your Email</h3>
                <p className="text-xs text-[#5C5A66] max-w-xs mx-auto leading-relaxed">
                  We have sent password reset instructions to{" "}
                  <span className="font-semibold text-[#1B1A20]">{email}</span>. Please check your
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
                  className="rounded-2xl border border-[#F5B8C4] bg-[#FDF1F3] px-3.5 py-2.5 text-xs font-semibold text-[#D64545]"
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
                      className="text-center tracking-widest font-mono text-lg font-bold rounded-full"
                      required
                      autoFocus
                    />
                  </Field>

                  <div className="flex items-center justify-between text-xs text-[#5C5A66] pt-1">
                    <span>Didn't receive the code?</span>
                    <button
                      type="button"
                      onClick={() => void handleResendOtp()}
                      disabled={resending}
                      className="font-semibold text-[#1B1A20] hover:underline cursor-pointer inline-flex items-center gap-1"
                    >
                      <RefreshCw className={`h-3 w-3 ${resending ? "animate-spin" : ""}`} />
                      Resend Code
                    </button>
                  </div>

                  <span className="bst-btn-wrap w-full">
                    <span className="bst-btn-halo" />
                    <Button
                      type="submit"
                      loading={busy}
                      size="lg"
                      className="w-full bst-btn bst-btn--lg"
                    >
                      Confirm & Enter Workspace
                    </Button>
                  </span>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signin");
                        setFormError(null);
                      }}
                      className="text-xs text-[#5C5A66] hover:text-[#1B1A20] cursor-pointer"
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
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      autoComplete="username email"
                    />
                  </Field>

                  {mode !== "forgot" && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#9B99A6]">
                          Password
                        </span>
                        {mode === "signin" && (
                          <button
                            type="button"
                            onClick={() => {
                              setResetSent(false);
                              setMode("forgot");
                            }}
                            className="text-xs text-[#5C5A66] hover:text-[#1B1A20] font-medium hover:underline cursor-pointer"
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
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          autoComplete={mode === "signin" ? "current-password" : "new-password"}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9B99A6] hover:text-[#1B1A20] cursor-pointer p-1"
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

                  <span className="bst-btn-wrap w-full mt-2">
                    <span className="bst-btn-halo" />
                    <Button
                      type="submit"
                      loading={busy}
                      size="lg"
                      className="w-full bst-btn bst-btn--lg"
                    >
                      {mode === "signin"
                        ? "Sign in to workspace"
                        : mode === "signup"
                          ? "Register Company Workspace"
                          : "Send Password Reset Link"}
                    </Button>
                  </span>

                  {mode === "forgot" && (
                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setMode("signin");
                          setFormError(null);
                        }}
                        className="text-xs text-[#5C5A66] hover:text-[#1B1A20] cursor-pointer"
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
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5C5A66] hover:text-[#1B1A20] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
