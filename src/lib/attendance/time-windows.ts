export type AttendanceKind = "check_in" | "check_out" | "break_start" | "break_end";
export type AttendanceStatus = "on_time" | "late" | "early_leave" | "normal";

export interface TimeWindowConfig {
  morningStartMinutes: number; // 00:00 -> 0
  onTimeCutoffMinutes: number; // 08:30 -> 8 * 60 + 30 = 510
  eveningStartMinutes: number; // 16:40 (4:40 PM) -> 16 * 60 + 40 = 1000
  eveningEndMinutes: number; // 20:00 (8:00 PM) -> 20 * 60 = 1200
}

export const DEFAULT_TIME_WINDOWS: TimeWindowConfig = {
  morningStartMinutes: 0, // 00:00 AM
  onTimeCutoffMinutes: 510, // 08:30 AM
  eveningStartMinutes: 1000, // 04:40 PM (16:40)
  eveningEndMinutes: 1200, // 08:00 PM (20:00)
};

export type WindowCategory =
  | "morning_on_time"
  | "late_arrival"
  | "work_hours_clockout_restricted"
  | "evening_clock_out"
  | "night_lockdown";

export interface TimeWindowStatus {
  currentMinutes: number;
  timeString: string;
  category: WindowCategory;
  title: string;
  description: string;
  isClockInAllowed: boolean;
  isClockOutAllowed: boolean;
  isNightLockdown: boolean;
  isWorkHoursRestricted: boolean;
  clockInStatus: AttendanceStatus;
  clockOutStatus: AttendanceStatus;
  badgeTone: "success" | "warning" | "danger" | "primary" | "neutral";
  latenessMinutes: number;
  minutesUntilNextWindow: number;
  nextWindowName: string;
}

/**
 * Calculates current time-window status and rules based on daily thresholds
 */
export function evaluateTimeWindow(
  date: Date = new Date(),
  config: TimeWindowConfig = DEFAULT_TIME_WINDOWS,
): TimeWindowStatus {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const currentMinutes = hours * 60 + minutes;

  const timeString = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Morning Window: 00:00 - 08:30
  if (
    currentMinutes >= config.morningStartMinutes &&
    currentMinutes <= config.onTimeCutoffMinutes
  ) {
    const minutesToLate = config.onTimeCutoffMinutes - currentMinutes;
    return {
      currentMinutes,
      timeString,
      category: "morning_on_time",
      title: "Morning Clock-In Window (On Time)",
      description: "Clock-ins during this period are recorded as On Time (00:00 AM – 8:30 AM).",
      isClockInAllowed: true,
      isClockOutAllowed: false,
      isNightLockdown: false,
      isWorkHoursRestricted: false,
      clockInStatus: "on_time",
      clockOutStatus: "early_leave",
      badgeTone: "success",
      latenessMinutes: 0,
      minutesUntilNextWindow: minutesToLate,
      nextWindowName: "Late Window (8:31 AM)",
    };
  }

  // Work Hours & Late Arrival Window: 08:31 - 16:39
  if (currentMinutes > config.onTimeCutoffMinutes && currentMinutes < config.eveningStartMinutes) {
    const lateMinutes = currentMinutes - config.onTimeCutoffMinutes;
    const minutesToEvening = config.eveningStartMinutes - currentMinutes;
    return {
      currentMinutes,
      timeString,
      category: "late_arrival",
      title: "Late Arrival / Active Work Window",
      description: `Clock-ins are flagged as Late (+${lateMinutes}m). Clock-outs are locked until 4:40 PM.`,
      isClockInAllowed: true,
      isClockOutAllowed: false, // Locked / restricted during core working hours
      isNightLockdown: false,
      isWorkHoursRestricted: true,
      clockInStatus: "late",
      clockOutStatus: "early_leave",
      badgeTone: "warning",
      latenessMinutes: lateMinutes,
      minutesUntilNextWindow: minutesToEvening,
      nextWindowName: "Evening Clock-Out Window (4:40 PM)",
    };
  }

  // Evening Clock-Out Window: 16:40 - 20:00 (4:40 PM – 8:00 PM)
  if (currentMinutes >= config.eveningStartMinutes && currentMinutes <= config.eveningEndMinutes) {
    const minutesToLockdown = config.eveningEndMinutes - currentMinutes;
    return {
      currentMinutes,
      timeString,
      category: "evening_clock_out",
      title: "Evening Clock-Out Window",
      description: "Authorized clock-out period (4:40 PM – 8:00 PM). Normal validated departure.",
      isClockInAllowed: true,
      isClockOutAllowed: true,
      isNightLockdown: false,
      isWorkHoursRestricted: false,
      clockInStatus: "late",
      clockOutStatus: "normal",
      badgeTone: "primary",
      latenessMinutes: currentMinutes - config.onTimeCutoffMinutes,
      minutesUntilNextWindow: minutesToLockdown,
      nextWindowName: "Night Lockdown (8:00 PM)",
    };
  }

  // Night Lockdown: 20:01 - 23:59:59 (after 8:00 PM)
  const minutesToMidnight = 1440 - currentMinutes;
  return {
    currentMinutes,
    timeString,
    category: "night_lockdown",
    title: "Closed / Night Lockdown",
    description: "Terminal clock actions disabled after 8:00 PM to prevent erratic time logs.",
    isClockInAllowed: false,
    isClockOutAllowed: false,
    isNightLockdown: true,
    isWorkHoursRestricted: false,
    clockInStatus: "late",
    clockOutStatus: "normal",
    badgeTone: "danger",
    latenessMinutes: currentMinutes - config.onTimeCutoffMinutes,
    minutesUntilNextWindow: minutesToMidnight,
    nextWindowName: "Morning Window (12:00 AM)",
  };
}

/**
 * Validates whether an attendance action (check_in or check_out) can proceed
 * and computes its official classification status according to enterprise rules.
 */
export function checkAttendanceRules(
  kind: AttendanceKind,
  date: Date = new Date(),
  overrideAdmin = false,
): {
  allowed: boolean;
  status: AttendanceStatus;
  statusLabel: string;
  isLate: boolean;
  lateMinutes: number;
  reason?: string;
} {
  const windowInfo = evaluateTimeWindow(date);

  // 1. Night Lockdown check
  if (windowInfo.isNightLockdown && !overrideAdmin) {
    return {
      allowed: false,
      status: "normal",
      statusLabel: "Night Lockdown",
      isLate: false,
      lateMinutes: 0,
      reason: "System is in Night Lockdown (8:00 PM – 12:00 AM). Clock actions are disabled.",
    };
  }

  // 2. Check-In Evaluation
  if (kind === "check_in") {
    if (windowInfo.category === "morning_on_time") {
      return {
        allowed: true,
        status: "on_time",
        statusLabel: "On Time",
        isLate: false,
        lateMinutes: 0,
      };
    } else {
      return {
        allowed: true,
        status: "late",
        statusLabel: `Late (+${windowInfo.latenessMinutes}m)`,
        isLate: true,
        lateMinutes: windowInfo.latenessMinutes,
      };
    }
  }

  // 3. Check-Out Evaluation
  if (kind === "check_out") {
    // Evening Window (4:40 PM - 8:00 PM) -> Allowed Normal Departure
    if (windowInfo.category === "evening_clock_out") {
      return {
        allowed: true,
        status: "normal",
        statusLabel: "Validated Departure",
        isLate: false,
        lateMinutes: 0,
      };
    }

    // Work Hours (Between 8:31 AM and 4:40 PM) -> Restricted / Early Departure
    if (windowInfo.isWorkHoursRestricted) {
      if (overrideAdmin) {
        return {
          allowed: true,
          status: "early_leave",
          statusLabel: "Early Departure (Admin Approved)",
          isLate: false,
          lateMinutes: 0,
          reason: "Approved early departure prior to standard 4:40 PM window.",
        };
      }
      return {
        allowed: false,
        status: "early_leave",
        statusLabel: "Early Departure Locked",
        isLate: false,
        lateMinutes: 0,
        reason:
          "Clock-outs are locked during working hours until 4:40 PM. Please obtain admin authorization for early departures.",
      };
    }

    // Morning check-out attempt
    if (windowInfo.category === "morning_on_time" && !overrideAdmin) {
      return {
        allowed: false,
        status: "early_leave",
        statusLabel: "Early Departure Locked",
        isLate: false,
        lateMinutes: 0,
        reason: "Check-outs open at 4:40 PM. Cannot clock out during morning arrival window.",
      };
    }
  }

  // Break events
  return {
    allowed: true,
    status: "normal",
    statusLabel: "Normal",
    isLate: false,
    lateMinutes: 0,
  };
}

/**
 * Format minutes into readable time (e.g. 510 -> "8:30 AM")
 */
export function formatMinutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = m < 10 ? `0${m}` : m;
  return `${displayH}:${displayM} ${ampm}`;
}
