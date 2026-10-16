"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Category } from "@/lib/content";
import type { FeedItem, FeedStatus } from "@/lib/live-news";
import Subscribe from "./subscribe";
import { READING_LIST_KEY, readReadingList, type SavedStory } from "@/lib/reading-list";

type Section = Category | "All" | "Saved";
const categories: Category[] = ["AI", "Tech", "Markets"];
const isCategory = (value: string | null | undefined): value is Category => categories.includes(value as Category);
const date = (value: string) => new Date(value).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
const excerpt = (item: FeedItem) => item.summary.replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();

function furtherReading(items: FeedItem[], section: Section): FeedItem[] {
  const useful = items.filter(item => excerpt(item).length >= 45 && excerpt(item).toLowerCase() !== item.title.toLowerCase());
  const topIds = new Set(items.slice(0, 12).map(item => item.id));
  const beyondHeadlines = useful.filter(item => !topIds.has(item.id));
  if (section !== "All") return (beyondHeadlines.length >= 3 ? beyondHeadlines : useful).slice(0, 3);
  return categories.flatMap(category => beyondHeadlines.find(item => item.category === category) ?? useful.find(item => item.category === category) ?? []).sort((a, b) => b.published_at.localeCompare(a.published_at));
}

export default function NewsDesk({ live, feedStatus, newsletterEnabled, initialCategory, initialQuery }: {
  live: FeedItem[]; feedStatus: FeedStatus;
  newsletterEnabled:boolean; initialCategory?: string; initialQuery: string;
}) {
  const [section, setSection] = useState<Section>(initialCategory === "Saved" ? "Saved" : isCategory(initialCategory) ? initialCategory : "All");
  const [query, setQuery] = useState(initialQuery);
  const [searchOpen, setSearchOpen] = useState(Boolean(initialQuery));
  const [visibleCount, setVisibleCount] = useState(12);
  const [saved, setSaved] = useState<SavedStory[]>([]);
  const [saveMessage, setSaveMessage] = useState("");
  useEffect(() => {
    function load() { try { setSaved(readReadingList(localStorage.getItem(READING_LIST_KEY))); } catch { setSaveMessage("Your browser has disabled storage. Saving stories is unavailable."); } }
    load();
    const onStorage = (event: StorageEvent) => { if (event.key === READING_LIST_KEY) load(); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  function toggleSaved(item: FeedItem) {
    const exists = saved.some(story => story.url === item.url);
    if (!exists && saved.length >= 100) { setSaveMessage("Your reading list is full. Remove a story before saving another."); return; }
    const next = exists ? saved.filter(story => story.url !== item.url) : [{url:item.url,title:item.title,summary:item.summary,source:item.source,category:item.category,published_at:item.published_at}, ...saved];
    try { localStorage.setItem(READING_LIST_KEY, JSON.stringify(next)); setSaved(next); setSaveMessage(exists ? "Story removed from your reading list." : "Story saved on this device."); }
    catch { setSaveMessage("Could not save this story. Check your browser storage settings."); }
  }

  useEffect(() => {
    function syncFromUrl() {
      const params = new URLSearchParams(window.location.search);
      setSection(params.get("category") === "Saved" ? "Saved" : isCategory(params.get("category")) ? params.get("category") as Category : "All");
      setQuery(params.get("q")?.slice(0, 100) ?? "");
      setSearchOpen(Boolean(params.get("q")));
      setVisibleCount(12);
    }
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  function updateUrl(next: Section, text: string, push = false) {
    const url = new URL(window.location.href);
    if (next === "All") url.searchParams.delete("category"); else url.searchParams.set("category", next);
    if (text.trim()) url.searchParams.set("q", text.trim()); else url.searchParams.delete("q");
    window.history[push ? "pushState" : "replaceState"]({}, "", url.pathname + url.search);
  }
  function select(next: Section) {
    if (next === section) return;
    setSection(next);
    setVisibleCount(12);
    updateUrl(next, query, true);
  }
  function search(event: FormEvent<HTMLFormElement>) { event.preventDefault(); updateUrl(section, query); }
  function changeQuery(value: string) { setQuery(value); setVisibleCount(12); updateUrl(section, value); }

  const term = query.trim().toLocaleLowerCase();
  const visibleNews = useMemo(() => {
    const items: FeedItem[] = section === "Saved" ? saved.map((item, index) => ({...item, id:-index-1, fetched_at:item.published_at})) : live;
    return items.filter(item => (section === "All" || section === "Saved" || item.category === section) && (!term || (item.title + " " + item.summary).toLocaleLowerCase().includes(term)));
  }, [live, saved, section, term]);
  const [lead, ...rest] = useMemo(() => furtherReading(visibleNews, section), [visibleNews, section]);
  const heading = term ? "Search results for “" + query.trim() + "”" : section === "All" ? "The front page" : section === "Saved" ? "Your reading list" : section + " desk";

  const fresh = Boolean(feedStatus.success_at && Date.now() - Date.parse(feedStatus.success_at) < 30 * 60 * 1000);
  return <>
    <div className="nav-shell"><nav className="main-nav" aria-label="Sections">{(["All", ...categories, "Saved"] as Section[]).map(item =>
      <button type="button" key={item} onClick={() => select(item)} className={section === item ? "selected" : ""} aria-pressed={section === item}>
        {item === "All" ? "Front page" : item === "Saved" ? "Saved" : item}<span className="nav-count">{item === "Saved" ? saved.length : item === "All" ? live.length : live.filter(news => news.category === item).length}</span>
      </button>)}</nav><button type="button" className="search-toggle" aria-label={searchOpen ? "Close search" : "Open search"} aria-expanded={searchOpen} onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) changeQuery(""); }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg><span>Search</span></button></div>
    <main className="site-wrap" id="main-content">
      <p className="save-feedback" role="status" aria-live="polite">{saveMessage}</p>
      {searchOpen && <form className="search-panel" onSubmit={search} role="search"><label htmlFor="site-search">Search the edition</label><input id="site-search" name="q" autoFocus value={query} maxLength={100} onChange={event => changeQuery(event.target.value)} placeholder="Try AI, chips, interest rates…" /><button type="submit">Search ↗</button></form>}
      <div className="edition-heading"><div><span className="overline">TODAY&apos;S EDITION <span className="overline-rule" /></span><h1>{heading}</h1></div><div className="edition-meta"><span className={"live-pill" + (!fresh || feedStatus.error ? " feed-warning" : "")}><span />{!fresh ? "AWAITING UPDATE" : feedStatus.error ? "PARTIAL UPDATE" : "FEEDS UPDATED"}</span><span>{new Date().toLocaleDateString("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" })} · UTC</span></div></div>

      <section className="live-section" aria-labelledby="latest-heading" key={section}><div className="live-heading"><div><span className="section-index">01 / THE WIRE</span><h2 id="latest-heading">{section === "Saved" ? "Saved stories" : "Latest updates"}<span className="heading-period">.</span></h2></div><span className="feed-status">{feedStatus.success_at ? "Feeds checked " + new Date(feedStatus.success_at).toLocaleString("en-US", { timeZone: "UTC", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " UTC" : "Awaiting first feed update"}{feedStatus.error ? " · Some sources unavailable" : ""}</span></div>
        <p className="feed-note">{section === "Saved" ? "Saved on this browser only. Your reading list stays here when you return; clearing browser storage removes it." : <>Direct from publisher feeds. Open a headline for the full report, or save it for later. Updates are checked on visits, at most every 15 minutes. <a href="/about">Our sources ↗</a></>}</p>
        {visibleNews.length ? <><div className="live-grid">{visibleNews.slice(0, visibleCount).map((item, index) => <article key={item.url} className={"live-card " + (index === 0 ? "live-card-featured" : "")}><a className="headline-link" href={item.url} target="_blank" rel="noopener noreferrer"><span className="card-topline"><span className="source-badge">{item.category}</span><span className="source-name">{item.source}</span></span><h3>{item.title}</h3><span className="card-source"><time dateTime={item.published_at}>{date(item.published_at)}</time><span>Read original ↗</span></span></a><button type="button" className="save-story" aria-pressed={saved.some(story => story.url === item.url)} aria-label={(saved.some(story => story.url === item.url) ? "Remove saved story: " : "Save story: ") + item.title} onClick={() => toggleSaved(item)}>{saved.some(story => story.url === item.url) ? "✓ Saved" : "+ Save"}</button></article>)}</div>{visibleNews.length > visibleCount && <button type="button" className="show-more" onClick={() => setVisibleCount(count => count + 12)}>Show more headlines <span>{visibleCount} of {visibleNews.length}</span><span aria-hidden="true">↓</span></button>}</> : <div className="feed-empty"><span className="empty-symbol">◌</span><p>{term ? "No matching headlines. Try a broader search." : section === "Saved" ? "Your reading list is empty. Save a headline from the front page to find it here." : feedStatus.error ? "This feed is temporarily unavailable. Check back shortly." : "No recent headlines in this section yet."}</p></div>}
      </section>

      {section !== "Saved" && <section className="explainers-section" aria-labelledby="explainers-heading"><div className="live-heading"><div><span className="section-index">02 / FURTHER READING</span><h2 id="explainers-heading">The deeper read<span className="heading-period">.</span></h2></div><span className="feed-status">Recent publisher summaries · Read the original reports</span></div>
        {lead ? <><a href={lead.url} target="_blank" rel="noopener noreferrer" className="lead-story"><div className="lead-content"><span className="kicker">{lead.category} / FEATURED READ</span><h3>{lead.title}</h3><p>{excerpt(lead)}</p><span className="lead-bottom"><span>{lead.source.toUpperCase()} · {date(lead.published_at)}</span><span className="read-more">Read original ↗</span></span></div><div className="lead-art" aria-hidden="true"><div className="pulse-ring ring-one"/><div className="pulse-ring ring-two"/><div className="pulse-ring ring-three"/><span>{lead.category}</span><div className="art-rule"/></div></a>{rest.length > 0 && <div className="story-grid">{rest.map(item => <article key={item.url} className="story-card"><a href={item.url} target="_blank" rel="noopener noreferrer" className="headline-link"><span className="kicker">{item.category} / FROM THE SOURCE</span><h3>{item.title}</h3><p>{excerpt(item)}</p><span className="card-source">{item.source} · {date(item.published_at)}<span>Read original ↗</span></span></a><button type="button" className="save-story" aria-pressed={saved.some(story => story.url === item.url)} aria-label={(saved.some(story => story.url === item.url) ? "Remove saved story: " : "Save story: ") + item.title} onClick={() => toggleSaved(item)}>{saved.some(story => story.url === item.url) ? "✓ Saved" : "+ Save"}</button></article>)}</div>}</> : <div className="feed-empty"><p>No source summaries are available in this view yet. The headlines above link directly to the publishers.</p></div>}
      </section>}
      <section className="newsletter-section" id="newsletter" aria-labelledby="newsletter-heading"><div className="newsletter-intro"><span className="section-index">03 / YOUR MORNING EDITION</span><h2 id="newsletter-heading">A clearer start to your day<span className="heading-period">.</span></h2><p>A concise digest of AI, technology and markets, with brief source excerpts and links to read the original reporting. Planned for mornings in Eastern Time.</p></div><div className="newsletter-plans"><div className="newsletter-free"><span className="plan-tag">THE DAILY EMAIL</span><h3>Free edition</h3><p>Key headlines and further reading, delivered to your inbox.</p><Subscribe enabled={newsletterEnabled}/></div><div className="newsletter-premium"><span className="plan-tag">COMING AFTER EMAIL LAUNCH</span><h3>OmniPulse Focus<span className="heading-period">.</span></h3><p>Choose AI, technology or markets for a morning edition built around the topics you follow.</p><strong className="premium-price">$7 CAD <span>/ month</span></strong><span className="premium-note">No payment is taken while this edition is in setup. Join the free list and mark your interest when email opens.</span></div></div></section>
      <div className="bottom-note"><span className="edition-dot" /> The signal, with the source. <span>Published headlines belong to their original publishers.</span></div>
    </main>
  </>;
}
