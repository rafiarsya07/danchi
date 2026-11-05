import type { CuteIconName } from "@/components/cute-icon";

export const LEARN_KINDS: Record<string, { label: string; emoji: string; tab: string; icon: CuteIconName }> = {
  goal: { label: "Goal", emoji: "🎯", tab: "learn" , icon: "target" },
  course: { label: "Online course", emoji: "💻", tab: "learn" , icon: "laptop" },
  book: { label: "Book", emoji: "📖", tab: "learn" , icon: "book" },
  article: { label: "Article", emoji: "📰", tab: "learn" , icon: "notes" },
  video: { label: "Video / tutorial", emoji: "🎬", tab: "learn" , icon: "video" },
  skill: { label: "Skill", emoji: "🛠️", tab: "skills" , icon: "star" },
  certificate: { label: "Certificate", emoji: "🏅", tab: "certs" , icon: "scroll" },
  resource: { label: "Resource / link", emoji: "🔗", tab: "links" , icon: "link" },
};
export const LEARN_STATUS: Record<string, { label: string; cls: string }> = {
  want: { label: "Want to", cls: "bg-white" },
  doing: { label: "Doing", cls: "bg-sun" },
  done: { label: "Done", cls: "bg-mint" },
};
