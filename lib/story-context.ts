import {database} from './content';
import {fingerprint} from './briefing';
import {approvedReference} from './learning';
import type {Reference} from './learning-types';
import type {FeedItem} from './live-news';
export type StoryContext={url:string;fingerprint:string;why:string;watch:string;sources:Reference[];updated_at:string};
export async function storyContexts(items:FeedItem[]):Promise<StoryContext[]>{
 if(!items.length)return [];
 const rows=(await database().prepare('SELECT * FROM story_contexts WHERE updated_at>=? LIMIT 200').bind(new Date(Date.now()-7*86400000).toISOString()).all<Omit<StoryContext,'sources'>&{sources:string}>()).results;
 return rows.flatMap(row=>{const item=items.find(i=>i.url===row.url);if(!item||fingerprint(item)!==row.fingerprint)return [];try{const sources=JSON.parse(row.sources);return Array.isArray(sources)?[{...row,sources}]:[];}catch{return [];}});
}
export async function publishStoryContext(value:unknown){
 if(!value||typeof value!=='object')return {published:false,error:'Invalid context'};
 const v=value as {url:string;why:string;watch:string;sources:Reference[]};
 if(typeof v.url!=='string'||typeof v.why!=='string'||v.why.length<60||v.why.length>900||typeof v.watch!=='string'||v.watch.length<30||v.watch.length>600||/[<>]/.test(v.why+v.watch)||!Array.isArray(v.sources)||v.sources.length<1||v.sources.length>4)return {published:false,error:'Supply a specific, bounded explanation, watch item and source links.'};
 const item=await database().prepare('SELECT * FROM feed_items WHERE url=? AND published_at>=?').bind(v.url,new Date(Date.now()-7*86400000).toISOString()).first<FeedItem>();
 if(!item)return {published:false,error:'The story is not in the recent approved feeds.'};
 if(!v.sources.every(s=>s&&typeof s==='object'&&(s.url===item.url&&typeof s.label==='string'&&s.label.length>=3&&s.label.length<=140||approvedReference(s))))return {published:false,error:'References must be the original report or approved primary sources.'};
 const now=new Date().toISOString();
 await database().prepare('INSERT INTO story_contexts (url,fingerprint,why,watch,sources,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(url) DO UPDATE SET fingerprint=excluded.fingerprint,why=excluded.why,watch=excluded.watch,sources=excluded.sources,updated_at=excluded.updated_at').bind(item.url,fingerprint(item),v.why,v.watch,JSON.stringify(v.sources),now).run();
 return {published:true,url:item.url,updated_at:now};
}
