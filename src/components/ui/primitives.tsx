import React, { type ReactNode } from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "emerald";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const base =
    "relative inline-flex items-center justify-center font-medium transition-all duration-200 cursor-pointer select-none " +
    "disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]";

  const variants = {
    primary:
      "bg-gradient-to-r from-sky-400 to-cyan-300 text-slate-950 font-semibold shadow-lg shadow-sky-500/20 hover:shadow-sky-500/30 hover:brightness-105 border border-sky-300/30",
    secondary:
      "bg-secondary/80 hover:bg-secondary text-foreground border border-white/10 hover:border-white/20 shadow-sm",
    outline:
      "border border-white/12 bg-surface/50 text-foreground hover:bg-surface-hover hover:border-sky-400/40 hover:text-white backdrop-blur-md shadow-sm",
    ghost: "text-muted-foreground hover:text-foreground hover:bg-white/5",
    danger:
      "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md shadow-destructive/20 border border-destructive/30",
    emerald:
      "bg-gradient-to-r from-emerald-400 to-teal-300 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:brightness-105 border border-emerald-300/30",
  } as const;

  const sizes = {
    xs: "h-7 px-2.5 text-xs rounded-md gap-1.5",
    sm: "h-8.5 px-3.5 text-xs rounded-lg gap-1.5 font-medium",
    md: "h-10 px-4.5 text-sm rounded-xl gap-2",
    lg: "h-12 px-6 text-base rounded-xl gap-2.5 font-semibold",
    xl: "h-14 px-8 text-lg rounded-2xl gap-3 font-semibold",
  } as const;

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function Input({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-10.5 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all duration-200 hover:border-white/20 focus:border-sky-400 focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-sky-400/20 disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

export function Select({
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative w-full">
      <select
        className={`h-10.5 w-full appearance-none rounded-xl border border-white/10 bg-slate-950/60 px-3.5 pr-8 text-sm text-foreground transition-all duration-200 hover:border-white/20 focus:border-sky-400 focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-sky-400/20 disabled:opacity-50 ${className}`}
        {...props}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
        ▼
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  error,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  error?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-display">
          {label}
        </span>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-xs text-destructive font-medium">{error}</p>}
    </label>
  );
}

export function Panel({
  children,
  className = "",
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div className={`${interactive ? "panel-interactive" : "panel"} p-6 ${className}`}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "muted",
  pulse = false,
  size = "md",
}: {
  children: ReactNode;
  tone?: "muted" | "success" | "warning" | "primary" | "danger" | "neutral";
  pulse?: boolean;
  size?: "sm" | "md";
}) {
  const tones = {
    muted: "bg-slate-800/70 text-slate-300 border-slate-700/60",
    neutral: "bg-white/5 text-slate-300 border-white/10",
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
    warning: "bg-amber-500/10 text-amber-300 border-amber-500/25",
    primary: "bg-sky-500/10 text-sky-400 border-sky-500/25",
    danger: "bg-rose-500/10 text-rose-400 border-rose-500/25",
  } as const;

  const dotTones = {
    muted: "bg-slate-400",
    neutral: "bg-slate-400",
    success: "bg-emerald-400",
    warning: "bg-amber-400",
    primary: "bg-sky-400",
    danger: "bg-rose-400",
  } as const;

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[11px] gap-1.5",
    md: "px-2.5 py-1 text-xs gap-1.5",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium border backdrop-blur-sm ${tones[tone]} ${sizeStyles[size]}`}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping-slow ${dotTones[tone]}`}
          />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${dotTones[tone]}`} />
        </span>
      )}
      {children}
    </span>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials =
    name
      .split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "EP";

  const sizeClasses = {
    sm: "h-7 w-7 text-xs",
    md: "h-9 w-9 text-sm",
    lg: "h-11 w-11 text-base",
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border border-white/15 flex items-center justify-center font-display font-semibold text-sky-300 shadow-inner`}
    >
      {initials}
    </div>
  );
}
