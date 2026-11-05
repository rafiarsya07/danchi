import type { CuteIconName } from "@/components/cute-icon";

export const DOC_CATEGORIES: Record<string, { label: string; emoji: string; icon: CuteIconName }> = {
  passport: { label: "Passport", emoji: "🛂", icon: "passport" },
  id: { label: "IC / ID card", emoji: "🪪", icon: "idcard" },
  visa: { label: "Visa / permit", emoji: "📄", icon: "scroll" },
  student: { label: "Student card", emoji: "🎓", icon: "idcard" },
  license: { label: "Driving licence", emoji: "🚗", icon: "ride" },
  insurance: { label: "Insurance", emoji: "🛡️", icon: "shield" },
  health: { label: "Health", emoji: "💊", icon: "pill" },
  certificate: { label: "Certificate", emoji: "📜", icon: "scroll" },
  other: { label: "Other", emoji: "🗂️", icon: "papers" },
};

export const APP_CATEGORIES: Record<string, { label: string; emoji: string; icon: CuteIconName }> = {
  scholarship: { label: "Scholarship", emoji: "🎓", icon: "learn" },
  internship: { label: "Internship", emoji: "💼", icon: "briefcase" },
  job: { label: "Job", emoji: "👩‍💻", icon: "laptop" },
  program: { label: "Program / exchange", emoji: "✈️", icon: "plane" },
  competition: { label: "Competition", emoji: "🏆", icon: "trophy" },
  other: { label: "Other", emoji: "✍️", icon: "pencil" },
};

export const APP_STATUSES = [
  { key: "idea", label: "Idea", emoji: "💭", cls: "bg-white" },
  { key: "preparing", label: "Preparing", emoji: "✍️", cls: "bg-sun-soft" },
  { key: "submitted", label: "Submitted", emoji: "📮", cls: "bg-sky" },
  { key: "interview", label: "Interview", emoji: "🗣️", cls: "bg-lilac" },
  { key: "offer", label: "Offer!", emoji: "🎉", cls: "bg-mint" },
  { key: "rejected", label: "Not this time", emoji: "🌧️", cls: "bg-pink-soft" },
] as const;

export const FILE_REF_TYPES = ["paper", "note", "course", "project", "item", "learning"] as const;
export type FileRefType = (typeof FILE_REF_TYPES)[number];
