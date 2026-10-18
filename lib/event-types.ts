export type Opportunity={
 slug:string;title:string;organizer:string;kind:'Conference'|'Summit'|'Meetup'|'Workshop'|'Awards';
 start_date:string;end_date:string;timezone:string;time_note:string;location:string;region:'Toronto/GTA'|'Canada'|'Worldwide';
 format:'In person'|'Online'|'Hybrid';price_kind:'Free'|'Paid'|'Not confirmed';price_note:string;
 audience:string;student_friendly:boolean;summary:string;status:'Registration open'|'Approval required'|'Check organizer'|'Sold out'|'Cancelled';
 official_url:string;registration_url:string;deadline_date:string;deadline_note:string;checked_at:string;
 highlight_date:string;topic:'AI'|'Tech'|'Markets';
};
export function localDay(now:Date,timezone='America/Toronto'){return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function upcomingEvents(items:Opportunity[],now=new Date()):Opportunity[]{return items.filter(e=>e.status!=='Cancelled'&&e.end_date>=localDay(now,e.timezone)&&Date.parse(e.checked_at)>=now.getTime()-30*86400000).sort((a,b)=>a.start_date.localeCompare(b.start_date)||a.title.localeCompare(b.title));}
export function eventMatches(e:Opportunity,region:string,kind:string,cost:string,students:boolean,q:string){
 const locationMatches=region==='All'||(region==='Online'?(e.format==='Online'||e.format==='Hybrid'):region==='Canada'?(e.region==='Canada'||e.region==='Toronto/GTA'):e.region===region);
 return locationMatches&&(kind==='All'||e.kind===kind)&&(cost==='All'||e.price_kind===cost)&&(!students||e.student_friendly)&&(!q||(e.title+' '+e.organizer+' '+e.summary+' '+e.location).toLowerCase().includes(q.toLowerCase()));
}
export function eventHighlight(items:Opportunity[],topics?:string[],now=new Date()):Opportunity|undefined{return upcomingEvents(items,now).find(e=>e.highlight_date===localDay(now)&&e.checked_at.slice(0,10)>=new Date(now.getTime()-3*86400000).toISOString().slice(0,10)&&!['Sold out','Cancelled'].includes(e.status)&&(!topics||topics.includes(e.topic)));}
export function prettyDate(value:string){return new Date(value+'T12:00:00Z').toLocaleDateString('en-CA',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'});}
