import { database, type Category } from "./content";

import { parseFeed, type Feed } from "./rss";
import { refreshWindow } from "./edition-clock";
import {medicalLaunchItems} from './medical-launch';
export const feeds: Feed[] = [
  {name:"BBC News Health",category:"Medical",url:"https://feeds.bbci.co.uk/news/health/rss.xml",host:"bbc.co.uk"},
  {name:"NIH Research Matters",category:"Medical",url:"https://www.nih.gov/nih-research-matters/feed.xml",host:"nih.gov"},
  {name:"Nature Medicine",category:"Medical",url:"https://www.nature.com/nm.rss",host:"nature.com"},
  {name:"BBC News Technology",category:"Tech",url:"https://feeds.bbci.co.uk/news/technology/rss.xml",host:"bbc.co.uk"},
  {name:"BBC News Business",category:"Markets",url:"https://feeds.bbci.co.uk/news/business/rss.xml",host:"bbc.co.uk"},
  {name:"Rest of World",category:"Tech",url:"https://restofworld.org/feed/",host:"restofworld.org"},
  {name:"OpenAI News",category:"AI",url:"https://openai.com/news/rss.xml",host:"openai.com"},
  {name:"Microsoft Blog",category:"Tech",url:"https://blogs.microsoft.com/feed/",host:"blogs.microsoft.com"},
  {name:"The Verge",category:"Tech",url:"https://www.theverge.com/rss/index.xml",host:"theverge.com"},
  {name:"TechCrunch",category:"Tech",url:"https://techcrunch.com/feed/",host:"techcrunch.com"},
  {name:"Federal Reserve",category:"Markets",url:"https://www.federalreserve.gov/feeds/press_all.xml",host:"federalreserve.gov"},
  {name:"SEC",category:"Markets",url:"https://www.sec.gov/news/pressreleases.rss",host:"sec.gov"},
];
export type FeedItem = {id:number;url:string;title:string;summary:string;category:Category;source:string;published_at:string;fetched_at:string};
export type FeedStatus = {checked_at:string|null;success_at:string|null;error:string|null};


export async function refreshFeedsIfDue():Promise<void> {
  const current=new Date(), window=refreshWindow(current);
  if(!window)return;
  const db=database(), now=current.toISOString();
  await db.prepare("INSERT OR IGNORE INTO feed_sync (id,next_at) VALUES (1,'1970-01-01T00:00:00.000Z')").run();
  const claimed=await db.prepare("UPDATE feed_sync SET checked_at=?,next_at=? WHERE id=1 AND (checked_at IS NULL OR checked_at<?)")
   .bind(now,window.next,window.start).run();
  if(!claimed.meta.changes)return;
  const results=await Promise.allSettled(feeds.map(async feed=>{
    const response=await fetch(feed.url,{headers:{"User-Agent":"OmniPulse/1.0 (RSS reader)","Accept":"application/rss+xml, application/xml, text/xml"},signal:AbortSignal.timeout(6500)});
    if(!response.ok)throw new Error(`${feed.name}: HTTP ${response.status}`);
    const xml=(await response.text()).slice(0,1024*1024);
    const items=parseFeed(xml,feed,now);
    if(!items.length)throw new Error(`${feed.name}: no recent feed items`);
    await db.batch(items.map(item=>db.prepare("INSERT INTO feed_items (url,title,summary,category,source,published_at,fetched_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(url) DO UPDATE SET summary=excluded.summary,title=excluded.title,fetched_at=excluded.fetched_at")
     .bind(item.url,item.title,item.summary,item.category,item.source,item.published_at,item.fetched_at)));
    return items.length;
  }));
  const errors=results.flatMap((result,index)=>result.status==="rejected"?[`${feeds[index].name} unavailable`]:[]);
  results.forEach((result,index)=>{if(result.status==="rejected")console.error("RSS refresh failed",feeds[index].name,result.reason);});
  await db.prepare("UPDATE feed_sync SET success_at=CASE WHEN ? THEN ? ELSE success_at END,error=?,next_at=? WHERE id=1")
   .bind(results.some(r=>r.status==="fulfilled")?1:0,now,errors.length?errors.join("; "):null,window.next).run();
  await db.prepare("DELETE FROM feed_items WHERE published_at < ?").bind(new Date(Date.now()-30*86400000).toISOString()).run();
}

export async function liveNews(category?:Category,search?:string):Promise<{items:FeedItem[];status:FeedStatus}> {
  const db=database();
  const where=["published_at >= ?"], params:unknown[]=[new Date(Date.now()-7*86400000).toISOString()];
  if(category){where.push("category = ?");params.push(category);}
  if(search){where.push("title LIKE ?");params.push(`%${search.replace(/[\\%_]/g,"")}%`);}
  const items=(await db.prepare(`SELECT id,url,title,summary,category,source,published_at,fetched_at FROM (
    SELECT *,ROW_NUMBER() OVER (PARTITION BY category ORDER BY published_at DESC) AS category_rank
    FROM feed_items WHERE ${where.join(" AND ")}
   ) WHERE category_rank<=24 ORDER BY published_at DESC LIMIT 96`).bind(...params).all<FeedItem>()).results;
  const status=(await db.prepare("SELECT checked_at,success_at,error FROM feed_sync WHERE id=1").first<FeedStatus>())||{checked_at:null,success_at:null,error:null};
  // A dated launch edition keeps the new desk useful before its first morning sync.
  // It expires with the normal seven-day window and is superseded by stored Medical items.
  const launch=items.some(i=>i.category==='Medical')||category&&category!=='Medical'?[]:medicalLaunchItems.filter(i=>Date.parse(i.published_at)>=Date.now()-7*86400000&&(!search||i.title.toLowerCase().includes(search.toLowerCase())));
  return {items:[...items,...launch].sort((a,b)=>b.published_at.localeCompare(a.published_at)),status};
}
