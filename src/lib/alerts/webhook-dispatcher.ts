export interface AlertWebhookConfig {
  enabled: boolean;
  webhookUrl: string;
  channelType: "slack" | "teams" | "discord" | "custom";
  alertOnLateArrival: boolean;
  alertOnUnrecognized: boolean;
  alertOnOvertime: boolean;
  alertOnEarlyDeparture: boolean;
  lateThresholdMins: number;
}

const WEBHOOK_STORAGE_KEY = "facetime_manager_alert_webhook_config_v1";

export const DEFAULT_WEBHOOK_CONFIG: AlertWebhookConfig = {
  enabled: false,
  webhookUrl: "",
  channelType: "slack",
  alertOnLateArrival: true,
  alertOnUnrecognized: true,
  alertOnOvertime: true,
  alertOnEarlyDeparture: false,
  lateThresholdMins: 15,
};

export function getWebhookConfig(): AlertWebhookConfig {
  try {
    const raw = localStorage.getItem(WEBHOOK_STORAGE_KEY);
    return raw ? { ...DEFAULT_WEBHOOK_CONFIG, ...JSON.parse(raw) } : DEFAULT_WEBHOOK_CONFIG;
  } catch {
    return DEFAULT_WEBHOOK_CONFIG;
  }
}

export function saveWebhookConfig(config: AlertWebhookConfig): void {
  try {
    localStorage.setItem(WEBHOOK_STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.error("Failed to save webhook config:", err);
  }
}

export interface AttendanceAlertPayload {
  type: "late_arrival" | "unrecognized_scan" | "overtime_warning" | "early_departure" | "test";
  employeeName?: string;
  employeeCode?: string;
  department?: string;
  timeStr: string;
  details: string;
  severity: "info" | "warning" | "critical";
}

export async function dispatchManagerAlert(
  payload: AttendanceAlertPayload,
): Promise<{ success: boolean; message: string }> {
  const config = getWebhookConfig();

  if (!config.enabled && payload.type !== "test") {
    return { success: false, message: "Webhooks are disabled in settings." };
  }

  const url = config.webhookUrl.trim();
  if (!url) {
    return { success: false, message: "No webhook URL configured." };
  }

  // Filter based on trigger preferences
  if (payload.type === "late_arrival" && !config.alertOnLateArrival) {
    return { success: false, message: "Late arrival alerts are muted." };
  }
  if (payload.type === "unrecognized_scan" && !config.alertOnUnrecognized) {
    return { success: false, message: "Unrecognized scan alerts are muted." };
  }
  if (payload.type === "overtime_warning" && !config.alertOnOvertime) {
    return { success: false, message: "Overtime alerts are muted." };
  }
  if (payload.type === "early_departure" && !config.alertOnEarlyDeparture) {
    return { success: false, message: "Early departure alerts are muted." };
  }

  const severityTag =
    payload.severity === "critical"
      ? "[CRITICAL]"
      : payload.severity === "warning"
        ? "[WARNING]"
        : "[INFO]";

  let bodyData: unknown = {};

  if (config.channelType === "slack") {
    bodyData = {
      text: `${severityTag} *[FaceTime Biometric Alert]* ${payload.details}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `FaceTime Attendance Alert: ${payload.type.replace("_", " ").toUpperCase()}`,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Employee:*\n${payload.employeeName || "Unrecognized Person"} ${payload.employeeCode ? `(${payload.employeeCode})` : ""}`,
            },
            {
              type: "mrkdwn",
              text: `*Timestamp:*\n${payload.timeStr}`,
            },
            {
              type: "mrkdwn",
              text: `*Department:*\n${payload.department || "General"}`,
            },
            {
              type: "mrkdwn",
              text: `*Severity:*\n${payload.severity.toUpperCase()}`,
            },
          ],
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `*Details:* ${payload.details} · _FaceTime Biometric Terminal Engine_`,
            },
          ],
        },
      ],
    };
  } else if (config.channelType === "discord") {
    bodyData = {
      content: `${severityTag} **FaceTime Biometric Alert**: ${payload.details}`,
      embeds: [
        {
          title: `Attendance Event: ${payload.type.replace("_", " ").toUpperCase()}`,
          color:
            payload.severity === "critical"
              ? 15158332
              : payload.severity === "warning"
                ? 16753920
                : 3447003,
          fields: [
            { name: "Employee", value: payload.employeeName || "Unknown", inline: true },
            { name: "Time", value: payload.timeStr, inline: true },
            { name: "Details", value: payload.details, inline: false },
          ],
          footer: { text: "FaceTime Biometric Terminal" },
        },
      ],
    };
  } else {
    // Custom / Teams generic JSON
    bodyData = {
      title: `FaceTime Attendance Alert: ${payload.type}`,
      employee_name: payload.employeeName,
      employee_code: payload.employeeCode,
      time: payload.timeStr,
      details: payload.details,
      severity: payload.severity,
      terminal: "FaceTime Biometric Terminal",
    };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyData),
      mode: "no-cors", // Allows browser to hit external webhooks (Slack/Discord) without CORS failure
    });

    return { success: true, message: "Alert dispatched successfully." };
  } catch (err) {
    console.warn("Failed to dispatch alert webhook:", err);
    return { success: false, message: (err as Error).message };
  }
}
