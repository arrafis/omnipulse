import Link from "next/link";
import type { Metadata } from "next";
import { feeds } from "@/lib/live-news";
import { newsletterConfigured } from "@/lib/newsletter";
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "About & sources" };
export default function About() {
  const emailEnabled = newsletterConfigured();
  return <><div className="edition-bar"><Link href="/">OMNIPULSE</Link><span>ABOUT & SOURCES</span></div>
    <main className="article-wrap" id="main-content"><Link href="/" className="back-link">← Front page</Link>
      <span className="kicker">THE SIGNAL, WITH THE SOURCE</span><h1>A calmer way to keep up.</h1>
      <p className="standfirst">One reading desk for AI, technology and markets. Every headline leads back to the original publisher.</p>
      <div className="article-body"><h2>How the edition works</h2><p>OmniPulse collects headlines and brief excerpts from public publisher feeds. We link to the full report instead of republishing it. “The deeper read” highlights available feed summaries; these are publisher excerpts, not independently written reporting or AI-generated analysis.</p>
        <p>The front page shows up to 24 stories per section from the last seven days, ordered by publication time. Feeds are checked on visits, at most every 15 minutes. An open tab refreshes every 15 minutes and when you return to it. This is a periodically updated reading desk, rather than a real-time news terminal.</p>
        <p>A source can be temporarily unavailable or stop offering a feed. The latest successful refresh time appears above the headlines. Partial updates are labeled, and previously fetched stories may remain visible during an outage.</p>
        <h2>Our sources</h2><p>Company blogs and regulatory releases are primary announcements. The Verge and TechCrunch provide publisher reporting. Including a source does not imply a partnership or endorsement.</p>
      </div><div className="source-directory">{feeds.map(feed => <a key={feed.name} href={feed.url} target="_blank" rel="noopener noreferrer"><span className="source-badge">{feed.category}</span><strong>{feed.name}</strong><span>Publisher feed ↗</span></a>)}</div>
      <div className="article-body"><h2>Read on your terms</h2><p>Filter by topic, search the current edition, and save up to 100 stories on this browser. No account is needed to read or save. Saved stories do not sync between devices.</p><h2>The morning edition</h2><p>{emailEnabled ? "The free daily digest is open for subscriptions, with delivery scheduled for 8:13 AM Eastern Time. Confirm your email address to join; every digest includes an unsubscribe link. The paid Focus edition is still in setup and no payment is accepted yet." : "Daily email and the paid Focus edition are in setup. We will accept subscriptions only when email delivery is ready, and payments only when the paid edition can be delivered."}</p><h2>Built by Sifath Ar-Rafi</h2><p>OmniPulse is an independent product project exploring a reliable, source-linked news experience. It is an aggregator, not an investment advisory service. Read the original reporting and verify information before acting on it.</p></div>
      <Link href="/privacy" className="back-link">Privacy details ↗</Link>
    </main></>;
}
