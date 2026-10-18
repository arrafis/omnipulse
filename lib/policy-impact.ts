import type {FeedItem} from './live-news';
import type {StoryGroup} from './briefing';

// A discovery lens, not a legal-status classifier. Source documents establish status.
export function isPolicyImpact(item:Pick<FeedItem,'title'|'summary'|'category'>):boolean {
 if(item.category==='Medical')return false;
 const text=item.title+' '+item.summary;
 const technology=/\b(ai|artificial intelligence|algorithm\w*|digital|tech\w*|cyber\w*|data|privacy|semiconductor\w*|chips?|social media|online|internet|robot\w*)\b/i.test(text);
 const impact=/\b(regulat\w*|legislat\w*|govern\w*|laws?|legal|oversight|enforc\w*|ban\w*|copyright|antitrust|competition|safety|age verification|age restriction\w*|workers?|workforce|jobs?|employment|education|schools?|productivity|inequality|access|infrastructure|investment|trade|export\w*|econom\w*|rights|bias|accountability)\b/i.test(text);
 return technology&&impact;
}

// One slot when relevant coverage exists. Topic preferences are applied by the caller.
export function policyDigest(items:FeedItem[],brief:(items:FeedItem[],limit:number)=>StoryGroup[]):FeedItem[]{
 const policy=items.find(isPolicyImpact);
 if(!policy)return brief(items,5).map(g=>g.lead);
 return [...brief(items.filter(i=>!isPolicyImpact(i)),4).map(g=>g.lead),policy]
  .sort((a,b)=>b.published_at.localeCompare(a.published_at));
}
