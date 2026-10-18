import {database} from './content';
import {eventSeeds} from './event-seeds';
import {upcomingEvents,localDay,type Opportunity} from './event-types';
export {type Opportunity} from './event-types';
const text=(v:unknown,min:number,max:number):v is string=>typeof v==='string'&&v.trim().length>=min&&v.length<=max&&!/[<>\u0000-\u0008]/.test(v);
const date=(s:unknown):s is string=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
export function safeEventUrl(s:unknown):s is string{try{if(typeof s!=='string'||s.length>1200)return false;const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname)&&!u.hostname.endsWith('.local');}catch{return false;}}
export function validEvent(v:unknown):v is Opportunity{
 if(!v||typeof v!=='object')return false;const e=v as Opportunity;
 if(typeof e.timezone!=='string'||!e.timezone)return false;
 try{new Intl.DateTimeFormat('en',{timeZone:e.timezone});}catch{return false;}
 return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(e.slug)&&e.slug.length<=100&&text(e.title,8,180)&&text(e.organizer,2,140)&&text(e.summary,50,650)&&text(e.location,3,220)&&text(e.audience,10,500)&&text(e.time_note,5,250)&&text(e.price_note,5,300)&&text(e.deadline_note,5,300)&&date(e.start_date)&&date(e.end_date)&&e.end_date>=e.start_date&&(!e.deadline_date||date(e.deadline_date))&&(!e.highlight_date||date(e.highlight_date))&&typeof e.student_friendly==='boolean'&&['Conference','Summit','Meetup','Workshop','Awards'].includes(e.kind)&&['Toronto/GTA','Canada','Worldwide'].includes(e.region)&&['In person','Online','Hybrid'].includes(e.format)&&['Free','Paid','Not confirmed'].includes(e.price_kind)&&['AI','Tech','Markets'].includes(e.topic)&&['Registration open','Approval required','Check organizer','Sold out','Cancelled'].includes(e.status)&&safeEventUrl(e.official_url)&&safeEventUrl(e.registration_url)&&typeof e.checked_at==='string'&&!Number.isNaN(Date.parse(e.checked_at));
}
export async function allEvents():Promise<Opportunity[]>{
 const rows=(await database().prepare('SELECT content FROM event_listings LIMIT 500').all<{content:string}>()).results;
 const merged=new Map(eventSeeds.map(e=>[e.slug,e]));
 for(const row of rows){try{const e=JSON.parse(row.content);if(validEvent(e))merged.set(e.slug,e);}catch{}}
 return [...merged.values()];
}
export async function publicEvents(){return upcomingEvents(await allEvents());}
export async function publishEvent(value:unknown){
 const now=new Date(),e={...(value&&typeof value==='object'?value:{}),checked_at:now.toISOString()};
 if(!validEvent(e))return {published:false,error:'Supply a complete, plain-text event with valid dates, timezone, organizer evidence and HTTPS official/registration links.'};
 if(e.highlight_date&&e.highlight_date!==localDay(now))return {published:false,error:'A newsletter highlight must be for today in Toronto, or blank. Use only for meaningful new opportunities or approaching deadlines.'};
 if(e.status!=='Cancelled'&&(e.end_date<localDay(now,e.timezone)||Date.parse(e.start_date)>now.getTime()+550*86400000))return {published:false,error:'Use upcoming events within 18 months; mark cancelled listings explicitly.'};
 // Do not silently create another listing for the same organizer URL and date.
 const existing=await allEvents();if(existing.some(x=>x.slug!==e.slug&&x.official_url===e.official_url&&x.start_date===e.start_date))return {published:false,error:'Update the existing event slug rather than duplicate it.'};
 await database().prepare('INSERT INTO event_listings (slug,content,updated_at) VALUES (?,?,?) ON CONFLICT(slug) DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at').bind(e.slug,JSON.stringify(e),e.checked_at).run();
 return {published:true,event:e};
}
