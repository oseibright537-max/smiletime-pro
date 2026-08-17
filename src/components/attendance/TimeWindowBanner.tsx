import React, { useState, useEffect } from "react";
import {
  Clock,
  Sun,
  Sunset,
  Moon,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Badge, Panel } from "@/components/ui/primitives";
import {
  evaluateTimeWindow,
  type TimeWindowStatus,
  formatMinutesToTime,
} from "@/lib/attendance/time-windows";

interface TimeWindowBannerProps {
  compact?: boolean;
  showRulesGuide?: boolean;
}

export function TimeWindowBanner({
  compact = false,
  showRulesGuide = true,
}: TimeWindowBannerProps) {
  const [windowInfo, setWindowInfo] = useState<TimeWindowStatus>(() => evaluateTimeWindow());
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const update = () => {
      setWindowInfo(evaluateTimeWindow());
    };
    update();
    const interval = setInterval(update, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const getWindowIcon = () => {
    switch (windowInfo.category) {
      case "morning_on_time":
        return <Sun className="h-4 w-4 text-emerald-400 animate-pulse" />;
      case "late_arrival":
      case "work_hours_clockout_restricted":
        return <Clock className="h-4 w-4 text-amber-400" />;
      case "evening_clock_out":
        return <Sunset className="h-4 w-4 text-indigo-400" />;
      case "night_lockdown":
        return <Moon className="h-4 w-4 text-rose-400" />;
      default:
        return <Clock className="h-4 w-4 text-slate-400" />;
    }
  };

  const getBgStyle = () => {
    switch (windowInfo.category) {
      case "morning_on_time":
        return "bg-emerald-950/40 border-emerald-500/30 text-emerald-100 shadow-lg shadow-emerald-950/50";
      case "late_arrival":
      case "work_hours_clockout_restricted":
        return "bg-amber-950/40 border-amber-500/30 text-amber-100 shadow-lg shadow-amber-950/50";
      case "evening_clock_out":
        return "bg-indigo-950/40 border-indigo-500/30 text-indigo-100 shadow-lg shadow-indigo-950/50";
      case "night_lockdown":
        return "bg-rose-950/40 border-rose-500/30 text-rose-100 shadow-lg shadow-rose-950/50";
      default:
        return "bg-slate-900/60 border-slate-800 text-slate-100";
    }
  };

  if (compact) {
    return (
      <div
        className={`inline-flex flex-wrap items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold backdrop-blur-md shadow-xs ${getBgStyle()}`}
      >
        <div className="flex items-center gap-1.5">
          {getWindowIcon()}
          <span>{windowInfo.title}</span>
        </div>
        <span className="text-[10px] opacity-75 font-mono">
          ({windowInfo.minutesUntilNextWindow}m until {windowInfo.nextWindowName})
        </span>
      </div>
    );
  }

  return (
    <Panel className={`p-4 sm:p-5 rounded-2xl border backdrop-blur-xl transition-all duration-300 ${getBgStyle()}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-2xl bg-slate-900/80 shadow-md border border-inherit flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
            {getWindowIcon()}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold font-display tracking-tight text-white break-words">
                {windowInfo.title}
              </h3>
              <Badge tone={windowInfo.badgeTone} pulse size="sm">
                ACTIVE
              </Badge>
            </div>
            <p className="text-xs opacity-80 mt-0.5 leading-relaxed">{windowInfo.description}</p>
          </div>
        </div>

        {/* Right Info & Toggle */}
        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-inherit/30">
          <div className="text-left sm:text-right">
            <span className="text-[10px] uppercase font-bold opacity-75 block font-display">
              Next Shift Threshold
            </span>
            <span className="text-xs font-mono font-bold text-white">
              {windowInfo.minutesUntilNextWindow}m → {windowInfo.nextWindowName}
            </span>
          </div>

          {showRulesGuide && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-inherit text-xs font-semibold text-slate-200 transition-colors flex items-center gap-1 cursor-pointer shrink-0 shadow-xs"
            >
              <span>{showDetails ? "Hide Rules" : "Shift Rules"}</span>
              {showDetails ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Expandable Shift Rules Policy Breakdown */}
      {showDetails && (
        <div className="mt-4 pt-4 border-t border-inherit/40 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 text-xs animate-in fade-in duration-200">
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-emerald-400">
              <Sun className="h-3.5 w-3.5 text-emerald-400" />
              <span>00:00 – 8:30 AM</span>
            </div>
            <span className="text-[11px] text-slate-400 block">
              Morning arrival window. Clock-ins are categorized as <strong className="text-emerald-300">On Time</strong>.
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-400">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              <span>8:31 AM – 4:40 PM</span>
            </div>
            <span className="text-[11px] text-slate-400 block">
              Late arrival period. Flagged as <strong className="text-amber-300">Late</strong> (+Xm). Clock-outs restricted.
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-indigo-400">
              <Sunset className="h-3.5 w-3.5 text-indigo-400" />
              <span>4:40 PM – 8:00 PM</span>
            </div>
            <span className="text-[11px] text-slate-400 block">
              Evening clock-out window. Departure categorized as{" "}
              <strong className="text-indigo-300">Validated Departure</strong>.
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-rose-400">
              <Moon className="h-3.5 w-3.5 text-rose-400" />
              <span>8:01 PM – 11:59 PM</span>
            </div>
            <span className="text-[11px] text-slate-400 block">
              Night lockdown period. Attendance scanner locked to prevent erratic time logs.
            </span>
          </div>
        </div>
      )}
    </Panel>
  );
}
