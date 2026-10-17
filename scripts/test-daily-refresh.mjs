import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const sql=new DatabaseSync(':memory:');
for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())sql.exec(readFileSync(`drizzle/${name}`,'utf8'));
const statement=(query,values=[])=>({bind:(...args)=>statement(query,args),run:async()=>({meta:{changes:Number(sql.prepare(query).run(...values).changes)}}),first:async()=>sql.prepare(query).get(...values)||null,all:async()=>({results:sql.prepare(query).all(...values)})});
const db={prepare:statement,batch:async statements=>Promise.all(statements.map(s=>s.run()))};
let instant='2026-10-18T11:59:59Z',calls=0,fail=false;
class Clock extends Date {constructor(value){super(value===undefined?instant:value);}static now(){return Date.parse(instant);}}
const modules=new Map();
function load(name){
 if(modules.has(name))return modules.get(name);
 const exports={};modules.set(name,exports);
 const source=ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports,require:name=>name==='./content'?{database:()=>db}:load(name.replace('./','')),Date:Clock,Intl,URL,AbortSignal,console:{error:()=>{}},fetch:async url=>{
  calls++;if(fail)return new Response('',{status:503});
  const feed=modules.get('live-news').feeds.find(f=>f.url===url);
  return new Response(`<item><title>Source announcement</title><link>https://${feed.host}/${encodeURIComponent(feed.name)}</link><pubDate>${instant}</pubDate><description>A source excerpt.</description></item>`);
 }});
 return exports;
}
const live=load('live-news'),clock=load('edition-clock');
await live.refreshFeedsIfDue();assert.equal(calls,0,'No refresh before 8 AM Toronto');
instant='2026-10-18T12:00:00Z';
await Promise.all([live.refreshFeedsIfDue(),live.refreshFeedsIfDue()]);
assert.equal(calls,live.feeds.length,'Concurrent morning requests share one claim');
instant='2026-10-19T03:59:00Z';await live.refreshFeedsIfDue();assert.equal(calls,live.feeds.length,'No second refresh late in the Toronto day');
instant='2026-10-19T11:59:00Z';await live.refreshFeedsIfDue();assert.equal(calls,live.feeds.length,'No pre-morning refresh after midnight');
instant='2026-10-19T12:00:00Z';await live.refreshFeedsIfDue();assert.equal(calls,2*live.feeds.length,'Next morning starts a new edition');
fail=true;instant='2026-10-20T12:00:00Z';await live.refreshFeedsIfDue();assert.equal(calls,3*live.feeds.length);
instant='2026-10-20T18:00:00Z';await live.refreshFeedsIfDue();assert.equal(calls,3*live.feeds.length,'Failed sources also wait until the next morning');
assert.ok(sql.prepare('SELECT error FROM feed_sync').get().error);
assert.equal(clock.refreshWindow(new Date('2026-10-31T12:00:00Z')).next,'2026-11-01T13:00:00.000Z','Fall DST keeps 8 AM local');
assert.equal(clock.refreshWindow(new Date('2027-03-13T13:00:00Z')).next,'2027-03-14T12:00:00.000Z','Spring DST keeps 8 AM local');
sql.close();
console.log('PASS once-daily refresh: Toronto boundary, concurrent requests, failed sources and both DST transitions. Publisher fetches were mocked.');
