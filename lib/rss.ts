import type { Category } from "./content";
export type Feed = { name: string; category: Category; url: string; host: string };
// Medical and Markets keep their specialist desks; AI technology has its own desk.
export function storyCategory(category:Category,title:string,summary:string,url=''):Category {
 if(category!=='Tech')return category;
 const text=title+' '+summary;
 return /\b(ai|artificial intelligence|machine learning|deep learning|neural networks?|generative|chatbots?|chatgpt|openai|anthropic|claude|deepmind|gemini|copilot|llms?|large language models?|language models?|diffusion models?)\b/i.test(text)||/\/(?:ai|artificial-intelligence|machine-learning)\//i.test(url)?'AI':'Tech';
}
function decodeCodePoint(raw:string):string {
 const hex=raw[0].toLowerCase()==="x";
 const code=parseInt(hex?raw.slice(1):raw,hex?16:10);
 return code>0&&code<=0x10ffff&&!(code>=0xd800&&code<=0xdfff)?String.fromCodePoint(code):"�";
}
function field(xml:string,tag:string):string {
  const match=xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,"i"));
  return match?.[1]?.replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/,"$1").trim()||"";
}
function clean(value:string):string {
  return value.replace(/<[^>]*>/g,"").replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n:string)=>decodeCodePoint(n))
   .replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&quot;/gi,'"').replace(/&apos;|&#39;/gi,"'")
   .replace(/&(nbsp|hellip|lsquo|rsquo|ldquo|rdquo|mdash|ndash);/gi,(_,name:string)=>({nbsp:" ",hellip:"…",lsquo:"‘",rsquo:"’",ldquo:"“",rdquo:"”",mdash:"—",ndash:"–"})[name.toLowerCase() as "nbsp"|"hellip"|"lsquo"|"rsquo"|"ldquo"|"rdquo"|"mdash"|"ndash"])
   .replace(/\s+/g," ").trim();
}
export function parseFeed(xml:string,feed:Feed,now:string) {
  const blocks=xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi)||xml.match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi)||[];
  return blocks.slice(0,20).flatMap(item=>{
    const title=clean(field(item,"title")).slice(0,240);
    const fullSummary=clean(field(item,"description")||field(item,"summary")).replace(/<[^>]*>/g,"");
    const summary=fullSummary.length>240?fullSummary.slice(0,237).replace(/\s+\S*$/,"").trimEnd()+"…":fullSummary;
    const links=item.match(/<link\s[^>]*>/gi)||[];
    const atomLink=links.find(link=>!link.match(/\brel=["']([^"']+)["']/i)||/\brel=["']alternate["']/i.test(link))?.match(/\bhref=["']([^"']+)["']/i)?.[1]||"";
    const rawUrl=clean(field(item,"link")||atomLink);
    const date=new Date(clean(field(item,"pubDate")||field(item,"dc:date")||field(item,"published")||field(item,"updated")));
    let url:URL;
    try {url=new URL(rawUrl);}catch{return [];}
    if(url.protocol!=="https:"||!(url.hostname===feed.host||url.hostname.endsWith(`.${feed.host}`))||!title||Number.isNaN(date.getTime())||date.getTime()>new Date(now).getTime()+3600000||date.getTime()<new Date(now).getTime()-30*86400000)return [];
    url.hash="";
    const author=clean(field(item,"dc:creator")||field(item,"author")).slice(0,120);
    const category=storyCategory(feed.category,title,fullSummary,url.href);
    // Shared sections use one publisher identity for deduplication and outage filtering.
    const publisher=feed.name;
    return [{url:url.href,title,summary,category,source:publisher+(author?' · '+author:''),published_at:date.toISOString(),fetched_at:now}];
  });
}

