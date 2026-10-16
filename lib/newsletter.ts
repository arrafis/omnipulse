import { env } from "cloudflare:workers";
import { database } from "./content";
import { refreshFeedsIfDue, type FeedItem } from "./live-news";

type Config = { apiKey:string; from:string; siteUrl:string; contact:string; address:string };
const setting=(key:string)=>String((env as unknown as Record<string,unknown>)[key]||"").trim();
export function newsletterConfigured():boolean {
 if(setting("NEWSLETTER_ENABLED")!=="true")return false;
 if(!["RESEND_API_KEY","NEWSLETTER_FROM_EMAIL","NEWSLETTER_CONTACT_EMAIL","NEWSLETTER_POSTAL_ADDRESS"].every(setting))return false;
 if(setting("NEWSLETTER_SIGNING_KEY").length<32||setting("NEWSLETTER_JOB_TOKEN").length<32)return false;
 if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(setting("NEWSLETTER_CONTACT_EMAIL")))return false;
 if(!/^(?:[^<>]+ <[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>|[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)$/.test(setting("NEWSLETTER_FROM_EMAIL")))return false;
 try{
  const url=new URL(setting("NEWSLETTER_SITE_URL"));
  return url.protocol==="https:"&&url.origin===setting("NEWSLETTER_SITE_URL");
 }catch{return false;}
}
function config():Config {
 if(!newsletterConfigured())throw new Error("Newsletter delivery is not configured");
 return {apiKey:setting("RESEND_API_KEY"),from:setting("NEWSLETTER_FROM_EMAIL"),siteUrl:setting("NEWSLETTER_SITE_URL"),contact:setting("NEWSLETTER_CONTACT_EMAIL"),address:setting("NEWSLETTER_POSTAL_ADDRESS")};
}
export function authorizedJob(value:string|null):boolean {const expected=setting("NEWSLETTER_JOB_TOKEN");return !!expected&&value===`Bearer ${expected}`;}
export const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]||char);
export async function sha256(value:string):Promise<string>{const bytes=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");}
export function freshToken(){return crypto.randomUUID()+crypto.randomUUID();}

async function sendEmail(to:string,subject:string,html:string,plain:string,unique:string,unsubscribe?:string){
 const c=config();
 const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":`Bearer ${c.apiKey}`,"Content-Type":"application/json","Idempotency-Key":unique},body:JSON.stringify({from:c.from,reply_to:c.contact,to:[to],subject,html,text:plain,headers:unsubscribe?{"List-Unsubscribe":`<${unsubscribe}>, <mailto:${c.contact}?subject=unsubscribe>`,"List-Unsubscribe-Post":"List-Unsubscribe=One-Click"}:undefined}),signal:AbortSignal.timeout(8000)});
 const result=await response.json().catch(()=>({})) as {id?:string;message?:string};
 if(!response.ok||!result.id)throw new Error(`Email provider rejected request (${response.status})`);
 return result.id;
}

export async function sendConfirmation(email:string,token:string,unique:string){
 const c=config(), url=`${c.siteUrl}/newsletter/confirm?token=${encodeURIComponent(token)}`;
 const html=`<div style="font:16px/1.6 Arial,sans-serif;color:#17212d;max-width:600px"><h1 style="font:700 38px Georgia,serif">Confirm your OmniPulse email</h1><p>You requested the daily news digest. Confirm that this address belongs to you to receive it.</p><p><a href="${escapeHtml(url)}" style="display:inline-block;background:#17212d;color:white;padding:12px 20px;text-decoration:none">Confirm subscription</a></p><p>This link expires in 48 hours. If you did not request this, ignore this email.</p><hr><small>OmniPulse · ${escapeHtml(c.address)} · Contact: ${escapeHtml(c.contact)}</small></div>`;
 return sendEmail(email,"Confirm your OmniPulse subscription",html,`Confirm your subscription: ${url}\n\nIf you did not request this, ignore this email.\n\nOmniPulse · ${c.address} · ${c.contact}`,unique);
}

async function sign(value:string):Promise<string>{
 const signingKey=setting("NEWSLETTER_SIGNING_KEY");if(!signingKey)throw new Error("Unsubscribe verification is unavailable");
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(signingKey),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const bytes=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value)));
 return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
}
async function signature(id:number,email:string):Promise<string>{return sign(`${id}:${email}`);}
export async function unsubscribeToken(id:number,email:string){return `${id}.${await signature(id,email)}`;}
export async function preferencesToken(id:number,email:string){
 const expires=Math.floor(Date.now()/1000)+30*86400;
 return `${id}.${expires}.${await sign(`preferences:${id}:${email}:${expires}`)}`;
}
export type PreferenceSubscriber={id:number;email:string;plan:string;preferred_categories:string;stripe_customer_id:string|null};
export async function preferencesSubscriber(token:string):Promise<PreferenceSubscriber|null>{
 const match=/^(\d{1,12})\.(\d{10})\.([0-9a-f]{64})$/.exec(token);
 if(!match||Number(match[2])<Math.floor(Date.now()/1000))return null;
 const id=Number(match[1]),row=await database().prepare("SELECT id,email,plan,preferred_categories,stripe_customer_id FROM subscribers WHERE id=? AND confirmed_at IS NOT NULL").bind(id).first<PreferenceSubscriber>();
 if(!row)return null;
 const expected=await sign(`preferences:${id}:${row.email}:${match[2]}`);
 return expected===match[3]?row:null;
}
export async function unsubscribeByToken(token:string):Promise<boolean>{
 const match=/^(\d{1,12})\.([0-9a-f]{64})$/.exec(token);if(!match)return false;
 const id=Number(match[1]),db=database();
 const row=await db.prepare("SELECT email FROM subscribers WHERE id=?").bind(id).first<{email:string}>();if(!row)return true;
 const expected=await signature(id,row.email);if(expected!==match[2])return false;
 await db.batch([db.prepare("DELETE FROM newsletter_deliveries WHERE subscriber_id=?").bind(id),db.prepare("DELETE FROM subscribers WHERE id=?").bind(id)]);return true;
}

function pickStories(items:FeedItem[],plan="free",preferred="AI,Tech,Markets"):FeedItem[]{
 const picks:FeedItem[]=[];
 const chosen=["AI","Tech","Markets"].filter(category=>preferred.split(",").includes(category));
 const categories=plan==="premium"&&chosen.length?chosen:["AI","Tech","Markets"];
 if(plan==="premium"){
  for(let rank=0;rank<6&&picks.length<6;rank++)for(const category of categories){
   const item=items.filter(story=>story.category===category)[rank];if(item&&picks.length<6)picks.push(item);
  }
 }else for(const category of categories){picks.push(...items.filter(item=>item.category===category).slice(0,2));}
 return picks.sort((a,b)=>b.published_at.localeCompare(a.published_at)).slice(0,6);
}
type Recipient={id:number;email:string;plan:string;preferred_categories:string};
export async function deliverDigest(){
 const c=config(), db=database();
 await refreshFeedsIfDue();
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const value=(type:string)=>parts.find(part=>part.type===type)?.value||"";
 const today=`${value("year")}-${value("month")}-${value("day")}`;
 const items=(await db.prepare("SELECT * FROM (SELECT *,ROW_NUMBER() OVER(PARTITION BY category ORDER BY published_at DESC) AS category_rank FROM feed_items WHERE published_at>=?) WHERE category_rank<=30 ORDER BY published_at DESC").bind(new Date(Date.now()-7*86400000).toISOString()).all<FeedItem>()).results;
 if(!items.length)return {date:today,sent:0,failed:0,remaining:false,reason:"No recent headlines"};
 const retryAfter=new Date(Date.now()-60*60000).toISOString(),staleAfter=new Date(Date.now()-20*60000).toISOString();
 const candidates=(await db.prepare("SELECT s.id,s.email,s.plan,s.preferred_categories FROM subscribers s LEFT JOIN newsletter_deliveries d ON d.subscriber_id=s.id AND d.delivery_date=? WHERE s.confirmed_at IS NOT NULL AND s.plan IN ('free','premium') AND (d.id IS NULL OR (d.status='failed' AND d.attempted_at<?) OR (d.status='sending' AND d.attempted_at<?)) ORDER BY s.id LIMIT 26")
  .bind(today,retryAfter,staleAfter).all<Recipient>()).results;
 let sent=0,failed=0;
 for(const subscriber of candidates.slice(0,25)){
  const stories=pickStories(items,subscriber.plan,subscriber.preferred_categories);
  if(!stories.length){
   await db.prepare("INSERT OR IGNORE INTO newsletter_deliveries (subscriber_id,delivery_date,status,attempted_at) VALUES (?,?,'skipped',?)").bind(subscriber.id,today,new Date().toISOString()).run();
   continue;
  }
  const now=new Date().toISOString();
  await db.prepare("INSERT OR IGNORE INTO newsletter_deliveries (subscriber_id,delivery_date,status,attempted_at) VALUES (?,?,'pending',?)").bind(subscriber.id,today,now).run();
  const claim=await db.prepare("UPDATE newsletter_deliveries SET status='sending',attempted_at=? WHERE subscriber_id=? AND delivery_date=? AND (status='pending' OR (status='failed' AND attempted_at<?) OR (status='sending' AND attempted_at<?))").bind(now,subscriber.id,today,retryAfter,staleAfter).run();
  if(!claim.meta.changes)continue;
  const token=await unsubscribeToken(subscriber.id,subscriber.email);
  const leave=`${c.siteUrl}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
  const oneClick=`${c.siteUrl}/api/newsletter/one-click?token=${encodeURIComponent(token)}`;
  const preferences=`${c.siteUrl}/preferences?token=${encodeURIComponent(await preferencesToken(subscriber.id,subscriber.email))}`;
  const title=`OmniPulse ${subscriber.plan==="premium"?"Focus":"Daily"} · ${new Date().toLocaleDateString("en-US",{timeZone:"America/Toronto",month:"long",day:"numeric"})}`;
  const rows=stories.map(item=>`<tr><td style="padding:18px 0;border-bottom:1px solid #e4e1d8"><small style="color:#ba4b30">${escapeHtml(item.category.toUpperCase())} · ${escapeHtml(item.source)} · ${escapeHtml(item.published_at.slice(0,10))}</small><h2 style="font:700 22px Georgia,serif;margin:7px 0"><a style="color:#17212d" href="${escapeHtml(item.url)}">${escapeHtml(item.title)}</a></h2>${item.summary?`<p style="margin:0;color:#5c6465">${escapeHtml(item.summary)}${item.summary.length>=240?"…":""}</p>`:""}</td></tr>`).join("");
  const html=`<div style="font:16px/1.6 Arial,sans-serif;color:#17212d;max-width:650px;margin:auto"><p style="color:#ba4b30;font-weight:bold;letter-spacing:.12em">${subscriber.plan==="premium"?"YOUR TOPIC EDITION":"THE MORNING EDITION"}</p><h1 style="font:700 46px Georgia,serif;margin:0">OMNIPULSE.</h1><p>${stories.length} source-linked reads ${subscriber.plan==="premium"?`in ${escapeHtml(subscriber.preferred_categories.replaceAll(",",", "))}`:"across AI, technology and markets"}. Excerpts come from publisher feeds.</p><table style="border-collapse:collapse;width:100%">${rows}</table><p><a href="${c.siteUrl}">Explore the full edition</a> · <a href="${escapeHtml(preferences)}">Manage topics</a></p><hr><small>OmniPulse · ${escapeHtml(c.address)} · Contact: ${escapeHtml(c.contact)}<br><a href="${escapeHtml(leave)}">Unsubscribe</a></small></div>`;
  const plain=`${title}\n\n`+stories.map(item=>`${item.category} · ${item.source} · ${item.published_at.slice(0,10)}\n${item.title}\n${item.summary}\n${item.url}`).join("\n\n")+`\n\nExplore: ${c.siteUrl}\nManage topics: ${preferences}\nUnsubscribe: ${leave}\nOmniPulse · ${c.address} · ${c.contact}`;
  try {
   const id=await sendEmail(subscriber.email,title,html,plain,`omnipulse-${today}-${subscriber.id}`,oneClick);
   await db.prepare("UPDATE newsletter_deliveries SET status='sent',sent_at=?,provider_id=? WHERE subscriber_id=? AND delivery_date=?").bind(new Date().toISOString(),id,subscriber.id,today).run();sent++;
  } catch(error){
   console.error("Newsletter delivery failed",subscriber.id,error);
   await db.prepare("UPDATE newsletter_deliveries SET status='failed' WHERE subscriber_id=? AND delivery_date=?").bind(subscriber.id,today).run();failed++;
  }
  await new Promise(resolve=>setTimeout(resolve,550));
 }
 return {date:today,sent,failed,remaining:candidates.length>25};
}
