export interface OrganizationBranding {
  companyName: string;
  customLogoUrl: string;
  kioskWelcomeTitle: string;
  kioskAnnouncement: string;
  kioskAnnouncementEnabled: boolean;
  accentColor: "indigo" | "blue" | "emerald" | "violet" | "amber" | "rose" | "slate";
  showCelebrationMilestones: boolean;
}

const BRANDING_STORAGE_KEY = "facetime_company_branding_v1";

export const DEFAULT_BRANDING: OrganizationBranding = {
  companyName: "FaceTime Technologies",
  customLogoUrl: "",
  kioskWelcomeTitle: "Welcome to Workplace Biometric Station",
  kioskAnnouncement:
    "🎉 Reminder: Quarterly All-Hands Meeting today at 3:00 PM in Main Auditorium.",
  kioskAnnouncementEnabled: true,
  accentColor: "indigo",
  showCelebrationMilestones: true,
};

export function getBranding(): OrganizationBranding {
  try {
    const raw = localStorage.getItem(BRANDING_STORAGE_KEY);
    return raw ? { ...DEFAULT_BRANDING, ...JSON.parse(raw) } : DEFAULT_BRANDING;
  } catch {
    return DEFAULT_BRANDING;
  }
}

export function saveBranding(branding: OrganizationBranding): void {
  try {
    localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(branding));
  } catch (err) {
    console.error("Failed to save branding preferences:", err);
  }
}

export const ACCENT_THEMES = {
  indigo: {
    primary: "#4338ca",
    glow: "rgba(67, 56, 202, 0.35)",
    label: "Royal Indigo",
  },
  blue: {
    primary: "#2563eb",
    glow: "rgba(37, 99, 235, 0.35)",
    label: "Sapphire Blue",
  },
  emerald: {
    primary: "#059669",
    glow: "rgba(5, 150, 105, 0.35)",
    label: "Cyber Emerald",
  },
  violet: {
    primary: "#7c3aed",
    glow: "rgba(124, 58, 237, 0.35)",
    label: "Deep Violet",
  },
  amber: {
    primary: "#d97706",
    glow: "rgba(217, 119, 6, 0.35)",
    label: "Warm Amber",
  },
  rose: {
    primary: "#e11d48",
    glow: "rgba(225, 29, 72, 0.35)",
    label: "Ruby Crimson",
  },
  slate: {
    primary: "#0f172a",
    glow: "rgba(15, 23, 42, 0.35)",
    label: "Obsidian Slate",
  },
} as const;
