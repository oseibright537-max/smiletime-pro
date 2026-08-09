import React, { type ReactNode } from "react";
import { Loader2, ChevronDown } from "lucide-react";

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
      "bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm hover:shadow border border-indigo-600",
    secondary:
      "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 shadow-sm",
    outline:
      "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm",
    ghost: "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
    danger:
      "bg-rose-600 text-white hover:bg-rose-700 shadow-sm border border-rose-600",
    emerald:
      "bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm hover:shadow border border-emerald-600",
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
      className={`h-10.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 hover:border-slate-400 focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20 disabled:opacity-50 ${className}`}
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
        className={`h-10.5 w-full appearance-none rounded-xl border border-slate-300 bg-white px-3.5 pr-8 text-sm text-slate-900 transition-all duration-200 hover:border-slate-400 focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20 disabled:opacity-50 ${className}`}
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
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 font-display">
          {label}
        </span>
        {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
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
    muted: "bg-slate-100 text-slate-700 border-slate-200",
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
    primary: "bg-indigo-50 text-indigo-700 border-indigo-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
  } as const;

  const dotTones = {
    muted: "bg-slate-400",
    neutral: "bg-slate-400",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    primary: "bg-indigo-500",
    danger: "bg-rose-500",
  } as const;

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[11px] gap-1.5",
    md: "px-2.5 py-1 text-xs gap-1.5",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium border ${tones[tone]} ${sizeStyles[size]}`}
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
      className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 border border-indigo-200 flex items-center justify-center font-display font-semibold text-white shadow-sm`}
    >
      {initials}
    </div>
  );
}
