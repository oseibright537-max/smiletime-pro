import React, { type ReactNode } from "react";
import { Loader2, ChevronDown, type LucideIcon } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "emerald" | "glow";
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
    "disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 active:scale-[0.98]";

  const variants = {
    primary:
      "bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 border border-indigo-500/50",
    secondary:
      "bg-slate-800/80 hover:bg-slate-700/80 text-slate-100 border border-slate-700/80 shadow-md backdrop-blur-md",
    outline:
      "border border-slate-700 bg-slate-900/60 hover:bg-slate-800/80 text-slate-200 hover:text-white shadow-sm backdrop-blur-md",
    ghost: "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60",
    danger:
      "bg-rose-600/90 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/25 border border-rose-500/50",
    emerald:
      "bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-600/25 border border-emerald-500/50",
    glow: "bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-white font-bold shadow-lg shadow-indigo-500/30 border border-white/20",
  } as const;

  const sizes = {
    xs: "h-7 px-2.5 text-xs rounded-lg gap-1.5",
    sm: "h-8.5 px-3.5 text-xs rounded-xl gap-1.5 font-medium",
    md: "h-10 px-4.5 text-sm rounded-xl gap-2",
    lg: "h-12 px-6 text-base rounded-2xl gap-2.5 font-semibold",
    xl: "h-14 px-8 text-lg rounded-2xl gap-3 font-semibold",
  } as const;

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : icon}
      {children}
    </button>
  );
}

export function Input({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-10.5 w-full rounded-xl border border-slate-700/80 bg-slate-900/70 backdrop-blur-md px-3.5 text-sm text-slate-100 placeholder:text-slate-500 transition-all duration-200 hover:border-slate-600 focus:border-indigo-500 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 disabled:opacity-40 ${className}`}
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
        className={`h-10.5 w-full appearance-none rounded-xl border border-slate-700/80 bg-slate-900/70 backdrop-blur-md px-3.5 pr-8 text-sm text-slate-100 transition-all duration-200 hover:border-slate-600 focus:border-indigo-500 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 disabled:opacity-40 ${className}`}
        {...props}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
        <ChevronDown className="h-4 w-4" />
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
        {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
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

export function BentoCard({
  children,
  className = "",
  glow = "indigo",
}: {
  children: ReactNode;
  className?: string;
  glow?: "indigo" | "cyan" | "emerald" | "rose" | "none";
}) {
  const glowStyles = {
    indigo: "hover:shadow-indigo-500/20 hover:border-indigo-500/40",
    cyan: "hover:shadow-cyan-500/20 hover:border-cyan-500/40",
    emerald: "hover:shadow-emerald-500/20 hover:border-emerald-500/40",
    rose: "hover:shadow-rose-500/20 hover:border-rose-500/40",
    none: "",
  };

  return (
    <div className={`bento-card p-6 ${glowStyles[glow]} ${className}`}>
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
  tone?: "muted" | "success" | "warning" | "primary" | "danger" | "neutral" | "accent";
  pulse?: boolean;
  size?: "sm" | "md";
}) {
  const tones = {
    muted: "bg-slate-800/80 text-slate-300 border-slate-700/60",
    neutral: "bg-slate-800/80 text-slate-300 border-slate-700/60",
    success: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    primary: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    accent: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    danger: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  } as const;

  const dotTones = {
    muted: "bg-slate-400",
    neutral: "bg-slate-400",
    success: "bg-emerald-400",
    warning: "bg-amber-400",
    primary: "bg-indigo-400",
    accent: "bg-cyan-400",
    danger: "bg-rose-400",
  } as const;

  const sizeStyles = {
    sm: "px-2.5 py-0.5 text-[11px] gap-1.5",
    md: "px-3 py-1 text-xs gap-1.5",
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

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
  trend,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: "primary" | "success" | "warning" | "danger" | "neutral" | "accent";
  trend?: string;
}) {
  const toneMap = {
    primary: {
      border: "border-indigo-500/20 hover:border-indigo-500/40",
      iconBg: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400",
      glow: "hover:shadow-[0_8px_30px_rgba(99,102,241,0.15)]",
    },
    success: {
      border: "border-emerald-500/20 hover:border-emerald-500/40",
      iconBg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
      glow: "hover:shadow-[0_8px_30px_rgba(16,185,129,0.15)]",
    },
    accent: {
      border: "border-cyan-500/20 hover:border-cyan-500/40",
      iconBg: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
      glow: "hover:shadow-[0_8px_30px_rgba(6,182,212,0.15)]",
    },
    warning: {
      border: "border-amber-500/20 hover:border-amber-500/40",
      iconBg: "bg-amber-500/10 border-amber-500/20 text-amber-400",
      glow: "hover:shadow-[0_8px_30px_rgba(245,158,11,0.15)]",
    },
    danger: {
      border: "border-rose-500/20 hover:border-rose-500/40",
      iconBg: "bg-rose-500/10 border-rose-500/20 text-rose-400",
      glow: "hover:shadow-[0_8px_30px_rgba(244,63,94,0.15)]",
    },
    neutral: {
      border: "border-slate-800 hover:border-slate-700",
      iconBg: "bg-slate-800/80 border-slate-700 text-slate-400",
      glow: "hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)]",
    },
  };

  const current = toneMap[tone];

  return (
    <div
      className={`rounded-2xl bg-slate-900/70 border ${current.border} p-5 backdrop-blur-xl transition-all duration-300 ${current.glow} flex flex-col justify-between`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-display truncate">
          {label}
        </span>
        <div
          className={`h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 ${current.iconBg}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-mono">
            {value}
          </span>
          {trend && (
            <span className="text-xs font-semibold text-emerald-400 font-mono">
              {trend}
            </span>
          )}
        </div>
        {hint && <p className="mt-1 text-xs text-slate-500 truncate">{hint}</p>}
      </div>
    </div>
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
      className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-indigo-500 to-cyan-600 border border-white/20 flex items-center justify-center font-display font-bold text-white shadow-md shadow-indigo-500/20 shrink-0`}
    >
      {initials}
    </div>
  );
}
