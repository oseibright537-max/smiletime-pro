import React from "react";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  subtitle?: string;
  className?: string;
}

export function Logo({
  size = "md",
  showText = true,
  subtitle = "Attendance System",
  className = "",
}: LogoProps) {
  const iconSizes = {
    sm: "h-8 w-8",
    md: "h-9 w-9",
    lg: "h-11 w-11",
    xl: "h-14 w-14",
  };

  const titleSizes = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
    xl: "text-3xl",
  };

  const subSizes = {
    sm: "text-[9px]",
    md: "text-[10px]",
    lg: "text-xs",
    xl: "text-sm",
  };

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {/* Custom Vector Icon Emblem */}
      <div
        className={`relative ${iconSizes[size]} shrink-0 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-700 shadow-md flex items-center justify-center text-white border border-indigo-400/30 overflow-hidden`}
      >
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:6px_6px]" />

        {/* Custom SVG Face + Clock Biometric Vector */}
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-[68%] w-[68%] relative z-10"
        >
          {/* Biometric Scan Corner Brackets */}
          <path
            d="M6 10V7C6 5.89543 6.89543 5 8 5H11"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M21 5H24C25.1046 5 26 5.89543 26 7V10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M6 22V25C6 26.1046 6.89543 27 8 27H11"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M21 27H24C25.1046 27 26 26.1046 26 25V22"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Smiling Face Outline */}
          <circle cx="16" cy="13.5" r="3.5" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M10.5 22.5C11.5 19.5 13.5 18 16 18C18.5 18 20.5 19.5 21.5 22.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          {/* Time Clock Minute Tick */}
          <circle cx="23" cy="9" r="1.5" fill="#34D399" />
        </svg>

        {/* Live Active Pulse Dot */}
        <span className="absolute top-1 right-1 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
        </span>
      </div>

      {/* Brand Typography */}
      {showText && (
        <div className="flex flex-col text-left">
          <span
            className={`font-display font-extrabold tracking-tight text-slate-900 leading-tight ${titleSizes[size]}`}
          >
            Face<span className="text-indigo-600">Time</span>
          </span>
          <span
            className={`font-mono font-semibold uppercase tracking-widest text-slate-500 block ${subSizes[size]}`}
          >
            {subtitle}
          </span>
        </div>
      )}
    </div>
  );
}
