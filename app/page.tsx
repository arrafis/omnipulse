import Link from "next/link";
import { liveNews, refreshFeedsIfDue, type FeedItem, type FeedStatus } from "@/lib/live-news";
import NewsDesk from "./news-desk";
import { newsletterConfigured } from "@/lib/newsletter";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ category?: string; q?: string }> }) {
  const params = await searchParams;
  let live: FeedItem[] = [];
  let feedStatus: FeedStatus = { checked_at: null, success_at: null, error: null };
  try {
    await refreshFeedsIfDue();
    const result = await liveNews();
    live = result.items;
    feedStatus = result.status;
  } catch {
    feedStatus.error = "Live feeds temporarily unavailable";
  }

  return <>
    <div className="edition-bar"><span><span className="edition-dot" />THE DIGITAL EDITION</span><span>AI · TECHNOLOGY · MARKETS</span></div>
    <header className="masthead"><Link href="/" className="wordmark" aria-label="OmniPulse home">OMNIPULSE<span className="wordmark-dot">.</span></Link><p>Signals worth your attention.</p></header>
    <NewsDesk live={live} feedStatus={feedStatus} newsletterEnabled={newsletterConfigured()}
      initialCategory={params.category} initialQuery={typeof params.q === "string" ? params.q.slice(0, 100) : ""} />
    <footer className="site-footer"><span>© {new Date().getUTCFullYear()} OMNIPULSE</span><span>Independent reading, direct sources.</span><Link href="/about">About & sources</Link><Link href="/privacy">Privacy</Link></footer>
  </>;
}
