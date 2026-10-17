const zone = 'America/Toronto';
export function editionDay(date:Date):string {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const part = (name:string) => parts.find(p=>p.type===name)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function hour(date:Date):number {
  return Number(new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'numeric',hourCycle:'h23'}).format(date));
}
// Hour stepping preserves the 08:00 Toronto boundary across DST changes.
export function refreshWindow(now:Date):{start:string;next:string}|null {
  if(hour(now)<8)return null;
  const start=new Date(now);
  start.setUTCMinutes(0,0,0);
  while(hour(start)>8)start.setUTCHours(start.getUTCHours()-1);
  const next=new Date(start.getTime()+20*3600000);
  for(let i=0;i<10;i++){
    if(editionDay(next)!==editionDay(start)&&hour(next)===8)return {start:start.toISOString(),next:next.toISOString()};
    next.setUTCHours(next.getUTCHours()+1);
  }
  throw new Error('Could not determine the next morning edition');
}
