import React, { type ReactNode } from "react";
import { Loader2, ChevronDown } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "quiet" | "danger" | "emerald";
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
    "relative inline-flex items-center justify-center font-semibold transition-all duration-200 cursor-pointer select-none rounded-full " +
    "disabled:opacity-45 disabled:pointer-events-none disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.97]";

  const variants = {
    primary:
      "bg-[#1B1A20] text-white hover:bg-[#2B2934] border border-[#1B1A20] hover:shadow-[0_0_20px_rgba(199,184,245,0.45)] focus-visible:ring-[#1B1A20]",
    secondary:
      "bg-[#F3F2F6] hover:bg-[#EFEDF4] text-[#1B1A20] border border-[#ECEBF0] hover:border-[#9B99A6] focus-visible:ring-[#1B1A20]",
    outline:
      "border border-[#ECEBF0] bg-white text-[#1B1A20] hover:bg-[#F3F2F6] hover:border-[#9B99A6] shadow-xs focus-visible:ring-[#1B1A20]",
    ghost:
      "bg-transparent text-[#5C5A66] hover:text-[#1B1A20] hover:bg-[#F3F2F6] border border-transparent focus-visible:ring-[#1B1A20]",
    quiet:
      "bg-transparent text-[#5C5A66] hover:text-[#1B1A20] border-0 focus-visible:ring-[#1B1A20]",
    danger:
      "bg-[#D64545] text-white hover:bg-[#B83838] border border-[#D64545] shadow-xs focus-visible:ring-[#D64545]",
    emerald:
      "bg-[#2F9E63] hover:bg-[#268553] text-white font-semibold shadow-xs border border-[#2F9E63] focus-visible:ring-[#2F9E63]",
  } as const;

  const sizes = {
    xs: "h-7 px-3 text-xs gap-1.5",
    sm: "h-8.5 px-4 text-xs gap-1.5 font-semibold",
    md: "h-10 px-5 text-sm gap-2",
    lg: "h-12 px-7 text-base gap-2.5 font-semibold",
    xl: "h-14 px-8 text-lg gap-3 font-semibold",
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
      className={`h-11 w-full rounded-2xl border border-[#ECEBF0] bg-white px-4 text-sm text-[#1B1A20] placeholder:text-[#9B99A6] transition-all duration-200 hover:border-[#9B99A6] focus:border-[#1B1A20] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B1A20]/10 disabled:opacity-45 ${className}`}
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
        className={`h-11 w-full appearance-none rounded-2xl border border-[#ECEBF0] bg-white px-4 pr-9 text-sm text-[#1B1A20] transition-all duration-200 hover:border-[#9B99A6] focus:border-[#1B1A20] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B1A20]/10 disabled:opacity-45 ${className}`}
        {...props}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9B99A6]">
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
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#9B99A6]">
          {label}
        </span>
        {hint && <span className="text-[11px] text-[#9B99A6]">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-xs text-[#D64545] font-medium mt-1">{error}</p>}
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
    <div
      className={`bg-white border border-[#ECEBF0] rounded-[24px] shadow-[0_2px_10px_rgba(27,26,32,0.04)] p-6 transition-all duration-200 ${
        interactive
          ? "hover:border-[#9B99A6] hover:shadow-[0_6px_24px_rgba(27,26,32,0.06)] hover:-translate-y-0.5 cursor-pointer"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "muted",
  pulse = false,
  size = "md",
  className = "",
}: {
  children: ReactNode;
  tone?:
    "muted" | "success" | "warning" | "primary" | "danger" | "neutral" | "lilac" | "rose" | "sage";
  pulse?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const tones = {
    muted: "bg-[#F3F2F6] text-[#5C5A66] border-[#ECEBF0]",
    neutral: "bg-[#F3F2F6] text-[#5C5A66] border-[#ECEBF0]",
    success: "bg-[#EEF7F1] text-[#2F9E63] border-[#B8E5C8]",
    warning: "bg-[#FDF6E2] text-[#B45309] border-[#FDE68A]",
    primary: "bg-[#F3EFFC] text-[#7C5ED6] border-[#C7B8F5]",
    danger: "bg-[#FDF1F3] text-[#D64545] border-[#F5B8C4]",
    lilac: "bg-[#F3EFFC] text-[#7C5ED6] border-[#C7B8F5]",
    rose: "bg-[#FDF1F3] text-[#D65E7C] border-[#F5B8C4]",
    sage: "bg-[#EEF7F1] text-[#2F9E63] border-[#B8E5C8]",
  } as const;

  const dotTones = {
    muted: "bg-[#9B99A6]",
    neutral: "bg-[#9B99A6]",
    success: "bg-[#2F9E63]",
    warning: "bg-[#F59E0B]",
    primary: "bg-[#7C5ED6]",
    danger: "bg-[#D64545]",
    lilac: "bg-[#7C5ED6]",
    rose: "bg-[#D65E7C]",
    sage: "bg-[#2F9E63]",
  } as const;

  const sizeStyles = {
    sm: "px-2.5 py-0.5 text-[10.5px] tracking-wide gap-1.5",
    md: "px-3 py-1 text-xs gap-1.5",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold border ${tones[tone]} ${sizeStyles[size]} ${className}`}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${dotTones[tone]}`}
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
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-[#EFEDF4] border border-[#ECEBF0] text-[#1B1A20] flex items-center justify-center font-semibold shadow-xs flex-shrink-0`}
    >
      {initials}
    </div>
  );
}
