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
  subtitle = "Biometric Intelligence",
  className = "",
}: LogoProps) {
  const iconSizes = {
    sm: "h-8 w-8",
    md: "h-9 w-9",
    lg: "h-11 w-11",
    xl: "h-14 w-14",
  };

  const titleSizes = {
    sm: "text-[16px]",
    md: "text-[18px]",
    lg: "text-[22px]",
    xl: "text-[28px]",
  };

  const subSizes = {
    sm: "text-[9.5px]",
    md: "text-[10.5px]",
    lg: "text-[11.5px]",
    xl: "text-[13px]",
  };

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Emblem in Hairline Ring */}
      <div
        className={`relative ${iconSizes[size]} shrink-0 rounded-full bg-[#EFEDF4] border border-[#ECEBF0] flex items-center justify-center text-[#1B1A20] overflow-hidden`}
      >
        {/* Soft Triad Background Glow */}
        <div className="absolute inset-0 bg-gradient-to-tr from-[#C7B8F5]/30 via-[#F5B8C4]/25 to-[#B8E5C8]/30 opacity-75" />

        {/* Biometric Scan Emblem */}
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-[62%] w-[62%] relative z-10 text-[#1B1A20]"
        >
          <path
            d="M7 11V8C7 6.89543 7.89543 6 9 6H12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M20 6H23C24.1046 6 25 6.89543 25 8V11"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M7 21V24C7 25.1046 7.89543 26 9 26H12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M20 26H23C24.1046 26 25 25.1046 25 24V21"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="16" cy="13.5" r="3.2" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M11 22C12 19.5 13.8 18 16 18C18.2 18 20 19.5 21 22"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>

        {/* Live Active Pulse Dot */}
        <span className="absolute top-1 right-1 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2F9E63] opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2F9E63]" />
        </span>
      </div>

      {/* Brand Wordmark Gradient Typography */}
      {showText && (
        <div className="flex flex-col text-left leading-none">
          <span className={`font-semibold tracking-[-0.025em] bst-wordmark ${titleSizes[size]}`}>
            SmileTime
          </span>
          {subtitle && (
            <span
              className={`font-medium tracking-[0.06em] uppercase text-[#9B99A6] block mt-0.5 ${subSizes[size]}`}
            >
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
