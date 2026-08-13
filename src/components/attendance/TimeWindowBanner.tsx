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

export function TimeWindowBanner({ compact = false, showRulesGuide = true }: TimeWindowBannerProps) {
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
        return <Sun className="h-4 w-4 text-emerald-600 animate-pulse" />;
      case "late_arrival":
      case "work_hours_clockout_restricted":
        return <Clock className="h-4 w-4 text-amber-600" />;
      case "evening_clock_out":
        return <Sunset className="h-4 w-4 text-indigo-600" />;
      case "night_lockdown":
        return <Moon className="h-4 w-4 text-rose-600" />;
      default:
        return <Clock className="h-4 w-4 text-slate-600" />;
    }
  };

  const getBgStyle = () => {
    switch (windowInfo.category) {
      case "morning_on_time":
        return "bg-emerald-50/80 border-emerald-200 text-emerald-950";
      case "late_arrival":
      case "work_hours_clockout_restricted":
        return "bg-amber-50/80 border-amber-200 text-amber-950";
      case "evening_clock_out":
        return "bg-indigo-50/80 border-indigo-200 text-indigo-950";
      case "night_lockdown":
        return "bg-rose-50/80 border-rose-200 text-rose-950";
      default:
        return "bg-slate-50 border-slate-200 text-slate-900";
    }
  };

  if (compact) {
    return (
      <div
        className={`inline-flex flex-wrap items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold backdrop-blur-sm shadow-xs ${getBgStyle()}`}
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
    <Panel className={`p-4 sm:p-5 rounded-2xl border transition-all duration-300 ${getBgStyle()}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-2xl bg-white shadow-xs border border-inherit flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
            {getWindowIcon()}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold font-display tracking-tight break-words">
                {windowInfo.title}
              </h3>
              <Badge tone={windowInfo.badgeTone} pulse size="sm">
                ACTIVE
              </Badge>
            </div>
            <p className="text-xs opacity-90 mt-0.5 leading-relaxed">{windowInfo.description}</p>
          </div>
        </div>

        {/* Right Info & Toggle */}
        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-inherit/30">
          <div className="text-left sm:text-right">
            <span className="text-[10px] uppercase font-bold opacity-75 block font-display">
              Next Shift Threshold
            </span>
            <span className="text-xs font-mono font-bold">
              {windowInfo.minutesUntilNextWindow}m → {windowInfo.nextWindowName}
            </span>
          </div>

          {showRulesGuide && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="px-2.5 py-1.5 rounded-xl bg-white/70 hover:bg-white border border-inherit text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer shrink-0 shadow-xs"
            >
              <span>{showDetails ? "Hide Rules" : "Shift Rules"}</span>
              {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Expandable Shift Rules Policy Breakdown */}
      {showDetails && (
        <div className="mt-4 pt-4 border-t border-inherit/40 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 text-xs animate-in fade-in duration-200">
          <div className="p-3 rounded-xl bg-white/80 border border-inherit/60 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-emerald-800">
              <Sun className="h-3.5 w-3.5 text-emerald-600" />
              <span>00:00 – 8:30 AM</span>
            </div>
            <span className="text-[11px] text-slate-600 block">
              Morning arrival window. Clock-ins are categorized as <strong>On Time</strong>.
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white/80 border border-inherit/60 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-800">
              <Clock className="h-3.5 w-3.5 text-amber-600" />
              <span>8:31 AM – 4:40 PM</span>
            </div>
            <span className="text-[11px] text-slate-600 block">
              Late arrival period. Flagged as <strong>Late</strong> (+Xm). Clock-outs restricted.
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white/80 border border-inherit/60 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-indigo-800">
              <Sunset className="h-3.5 w-3.5 text-indigo-600" />
              <span>4:40 PM – 8:00 PM</span>
            </div>
            <span className="text-[11px] text-slate-600 block">
              Evening clock-out window. Departure categorized as <strong>Validated Departure</strong>.
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white/80 border border-inherit/60 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-rose-800">
              <Moon className="h-3.5 w-3.5 text-rose-600" />
              <span>8:01 PM – 11:59 PM</span>
            </div>
            <span className="text-[11px] text-slate-600 block">
              Night lockdown period. Attendance scanner locked to prevent erratic time logs.
            </span>
          </div>
        </div>
      )}
    </Panel>
  );
}
