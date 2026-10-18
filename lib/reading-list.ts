import type { FeedItem } from "./live-news";

export const READING_LIST_KEY = "omnipulse-reading-list-v1";
export type SavedStory = Pick<FeedItem, "url" | "title" | "category" | "source" | "published_at" | "summary">;
export function readReadingList(raw: string | null): SavedStory[] {
  try {
    const input: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(input)) return [];
    const seen = new Set<string>();
    return input.filter((item): item is SavedStory => {
      if (!item || typeof item !== "object") return false;
      const s = item as Record<string, unknown>;
      if (!["url", "title", "source", "published_at", "summary"].every(key => typeof s[key] === "string") || !["AI", "Tech", "Markets", "Medical"].includes(s.category as string)) return false;
      try { if (new URL(s.url as string).protocol !== "https:") return false; } catch { return false; }
      if (seen.has(s.url as string) || Number.isNaN(Date.parse(s.published_at as string))) return false;
      seen.add(s.url as string);
      return (s.title as string).length <= 240 && (s.summary as string).length <= 1000;
    }).slice(0, 100);
  } catch { return []; }
}
