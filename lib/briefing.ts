import type { FeedItem } from './live-news';
export type StoryGroup = { lead:FeedItem; sources:FeedItem[] };
const stop=new Set('the a an of to in on for and with is it at as by from how why what new this that are has'.split(' '));
function words(title:string){return new Set(title.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>2&&!stop.has(w)));}
// Conservative title matching: related topics alone must not imply the same event.
export function groupStories(items:FeedItem[]):StoryGroup[]{
 const groups:StoryGroup[]=[];
 for(const item of [...items].sort((a,b)=>b.published_at.localeCompare(a.published_at))){
  const a=words(item.title);
  const match=groups.find(group=>{
   if(group.sources.some(s=>s.url===item.url))return true;
   if(Math.abs(Date.parse(group.lead.published_at)-Date.parse(item.published_at))>48*3600000)return false;
   if(item.title.toLowerCase().trim()===group.lead.title.toLowerCase().trim())return true;
   const b=words(group.lead.title),same=[...a].filter(w=>b.has(w)).length;
   return same>=5&&same/Math.max(a.size,b.size)>=.78;
  });
  if(match){if(!match.sources.some(s=>s.url===item.url))match.sources.push(item);}else groups.push({lead:item,sources:[item]});
 }
 return groups;
}
export function dailyBrief(items:FeedItem[],limit=5):StoryGroup[]{
 const topical=items.filter(item=>item.category!=='Tech'||/\b(ai|tech|technology|technologies|software|hardware|chip|computer|cloud|data|security|cyber|privacy|internet|robot|model|phone|spacex|starlink|satellite|wireless|mobile|apple|google|microsoft|nvidia|meta|openai|semiconductor|api|browser|battery|electric|startup|quantum)\b/i.test(item.title));
 const groups=groupStories(topical),picks:StoryGroup[]=[];
 for(const category of ['AI','Tech','Markets','Medical']){const item=groups.find(g=>g.lead.category===category);if(item&&picks.length<limit)picks.push(item);}
 for(const group of groups){if(picks.length>=limit)break;if(!picks.includes(group)&&!picks.some(p=>p.lead.source===group.lead.source&&picks.filter(x=>x.lead.source===group.lead.source).length>=2))picks.push(group);}
 for(const group of groups){if(picks.length>=limit)break;if(!picks.includes(group))picks.push(group);}
 return picks.sort((a,b)=>b.lead.published_at.localeCompare(a.lead.published_at));
}
export function sourceType(source:string){if(['NIH Research Matters','MIT News AI'].some(name=>source===name||source.startsWith(name+' · ')))return 'Research institution summary';if(source.startsWith('Nature Medicine'))return 'Journal feed · article type varies';return ['FTC','UK DSIT','OpenAI News','Google DeepMind','Hugging Face','Microsoft Blog','Federal Reserve','SEC','Bank of Canada','WHO'].some(name=>source===name||source.startsWith(name+' · '))?'Primary announcement':'Publisher reporting';}
export function fingerprint(item:FeedItem){return item.title+'|'+item.summary;}
export const contextGuides={
 Medical:{title:'A finding is not yet a treatment',body:'Identify whether a report concerns cells, animals, observational human data or a controlled trial. Check absolute effects, limitations and whether the result has been replicated. A journal feed includes different article types, and a headline does not establish approval or clinical benefit.',watch:'Study design, participants, harms, absolute effect sizes, corrections and independent confirmation. Discuss personal decisions with a qualified clinician.',url:'https://www.nih.gov/health-information/nih-clinical-research-trials-you',source:'NIH clinical research guidance'},
 AI:{title:'How to read an AI announcement',body:'A model announcement is a claim from its maker. Look for a published evaluation, the testing conditions and evidence from independent use before comparing capabilities.',watch:'Independent evaluations, access restrictions and pricing changes.',url:'https://www.nist.gov/itl/ai-risk-management-framework',source:'NIST AI Risk Management Framework'},
 Tech:{title:'From launch to real-world impact',body:'A product launch establishes what a company says it offers. Availability, compatibility and independent testing determine how useful it is for you.',watch:'General availability, compatibility requirements and independent testing.',url:'https://www.ftc.gov/business-guidance/advertising-marketing',source:'FTC advertising guidance'},
 Markets:{title:'Why rates travel beyond the headlines',body:'Monetary policy affects financial conditions, including the cost of borrowing. The impact varies across households, companies and investments.',watch:'The next policy decision, official economic releases and changes to guidance.',url:'https://www.federalreserve.gov/monetarypolicy.htm',source:'Federal Reserve monetary policy'}
};
