import { liveNews, refreshFeedsIfDue, type FeedItem, type FeedStatus } from "@/lib/live-news";
import {publicEvents} from "@/lib/events";
import {eventSeeds} from "@/lib/event-seeds";
import {upcomingEvents} from "@/lib/event-types";
import NewsDesk from "./news-desk";
import { newsletterConfigured } from "@/lib/newsletter";
import {storyContexts,type StoryContext} from '@/lib/story-context';

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ category?: string; q?: string }> }) {
  const params = await searchParams;
  let live: FeedItem[] = [];
  let contexts:StoryContext[]=[];
  let feedStatus: FeedStatus = { checked_at: null, success_at: null, error: null };
  try {
    await refreshFeedsIfDue();
    const result = await liveNews();
    live = result.items;
    feedStatus = result.status;
    contexts=await storyContexts(live);
  } catch {
    feedStatus.error = "Live feeds temporarily unavailable";
  }

  let events=upcomingEvents(eventSeeds);try{events=await publicEvents();}catch{}
  return <>
    <div className="edition-bar"><span><span className="edition-dot" />THE DIGITAL EDITION</span><span>AI · TECHNOLOGY · MARKETS · MEDICAL</span></div>
    <header className="masthead"><a href="/" className="wordmark" aria-label="OmniPulse home">OMNIPULSE<span className="wordmark-dot">.</span></a><p>Signals worth your attention.</p></header>
    <NewsDesk events={events} live={live} contexts={contexts} feedStatus={feedStatus} newsletterEnabled={newsletterConfigured()}
      initialCategory={params.category} initialQuery={typeof params.q === "string" ? params.q.slice(0, 100) : ""} />
    <footer className="site-footer"><span>© {new Date().getUTCFullYear()} OMNIPULSE</span><span>Independent reading, direct sources.</span><a href="/about">About & sources</a><a href="/privacy">Privacy</a><a href="/terms">Terms & content rights</a></footer>
  </>;
}
