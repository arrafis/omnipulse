import { database, type Category } from "./content";

import { parseFeed, type Feed } from "./rss";
export const feeds: Feed[] = [
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
  const db=database(), now=new Date().toISOString();
  await db.prepare("INSERT OR IGNORE INTO feed_sync (id,next_at) VALUES (1,'1970-01-01T00:00:00.000Z')").run();
  const claimed=await db.prepare("UPDATE feed_sync SET checked_at=?,next_at=? WHERE id=1 AND next_at<=?")
   .bind(now,new Date(Date.now()+15*60000).toISOString(),now).run();
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
   .bind(results.some(r=>r.status==="fulfilled")?1:0,now,errors.length?errors.join("; "):null,new Date(Date.now()+(errors.length===feeds.length?5:15)*60000).toISOString()).run();
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
   ) WHERE category_rank<=24 ORDER BY published_at DESC LIMIT 72`).bind(...params).all<FeedItem>()).results;
  const status=(await db.prepare("SELECT checked_at,success_at,error FROM feed_sync WHERE id=1").first<FeedStatus>())||{checked_at:null,success_at:null,error:null};
  return {items,status};
}
