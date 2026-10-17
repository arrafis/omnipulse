import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import ts from "typescript";

// Exercise real SQL and route logic. All email requests are captured locally.
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const sql = new DatabaseSync(":memory:");
for (const name of readdirSync(path.join(root,"drizzle")).filter(n => n.endsWith(".sql")).sort()) sql.exec(readFileSync(path.join(root,"drizzle",name),"utf8"));
function statement(query, values = []) {
  return {
    bind: (...args) => statement(query,args),
    run: async () => ({meta:{changes:Number(sql.prepare(query).run(...values).changes)}}),
    first: async () => sql.prepare(query).get(...values) || null,
    all: async () => ({results:sql.prepare(query).all(...values)}),
  };
}
const db = {prepare:statement,batch:async statements => {sql.exec("BEGIN");try {const rows=[];for(const s of statements)rows.push(await s.run());sql.exec("COMMIT");return rows;}catch(e){sql.exec("ROLLBACK");throw e;}}};
const env = {DB:db,NEWSLETTER_ENABLED:"true",RESEND_API_KEY:"test-only",NEWSLETTER_SIGNING_KEY:"x".repeat(64),NEWSLETTER_JOB_TOKEN:"y".repeat(64),NEWSLETTER_FROM_EMAIL:"Test <daily@example.test>",NEWSLETTER_CONTACT_EMAIL:"contact@example.test",NEWSLETTER_POSTAL_ADDRESS:"Test mailing address",NEWSLETTER_SITE_URL:"https://example.test"};
const mail=[];
const modules=new Map();
function load(filename) {
  if(modules.has(filename))return modules.get(filename).exports;
  const module={exports:{}};modules.set(filename,module);
  const source=readFileSync(filename,"utf8");
  const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
  const customRequire=name=>{
    if(name==="cloudflare:workers")return {env};
    if(name==="next/server")return {NextResponse:{json:(body,options)=>new Response(JSON.stringify(body),{status:options?.status||200,headers:{"Content-Type":"application/json"}})}};
    if(name.endsWith("live-news"))return {refreshFeedsIfDue:async()=>{}};
    if(name.startsWith("@/")||name.startsWith("."))return load(path.resolve(name.startsWith("@/")?root:path.dirname(filename),name.startsWith("@/")?name.slice(2):name)+".ts");
    return require(name);
  };
  vm.runInNewContext(outputText,{module,exports:module.exports,require:customRequire,Response,Request,AbortSignal,URL,URLSearchParams,TextEncoder,Uint8Array,crypto:webcrypto,console,setTimeout:fn=>{fn();return 0;},fetch:async(url,options)=>{assert.equal(url,"https://api.resend.com/emails");mail.push(JSON.parse(options.body));return new Response(JSON.stringify({id:`test-${mail.length}`}));}},{filename});
  return module.exports;
}
const newsletter=load(path.join(root,"lib/newsletter.ts"));
const signup=load(path.join(root,"app/api/subscribers/route.ts"));
const confirm=load(path.join(root,"app/api/newsletter/confirm/route.ts"));
const leave=load(path.join(root,"app/api/newsletter/unsubscribe/route.ts"));
const request=(route,body,origin="https://example.test")=>new Request(`https://example.test${route}`,{method:"POST",headers:{"Content-Type":"application/json",origin},body:JSON.stringify(body)});
const payload={email:"reader@example.test",consent:true};
assert.equal((await signup.POST(request("/api/subscribers",payload,"https://evil.test"))).status,403);
assert.equal((await signup.POST(request("/api/subscribers",{...payload,consent:false}))).status,400);
assert.equal(mail.length,0);
assert.equal((await signup.POST(request("/api/subscribers",payload))).status,202);
assert.equal(mail.length,1);
assert.equal(mail[0].reply_to,env.NEWSLETTER_CONTACT_EMAIL);
assert.ok(mail[0].text.includes(env.NEWSLETTER_POSTAL_ADDRESS));
assert.equal(sql.prepare("SELECT confirmed_at FROM subscribers").get().confirmed_at,null);
await signup.POST(request("/api/subscribers",payload));assert.equal(mail.length,1,"Repeated signup must not resend within one hour");
let result=await newsletter.deliverDigest();assert.equal(result.sent,0,"Unconfirmed readers must not receive digests");
const token=new URL(mail[0].text.match(/https:\/\/example\.test\/newsletter\/confirm\?token=\S+/)[0]).searchParams.get("token");
assert.equal((await confirm.POST(request("/api/newsletter/confirm",{token}))).status,200);
assert.equal((await confirm.POST(request("/api/newsletter/confirm",{token}))).status,410,"Confirmation links are single use");
sql.prepare("UPDATE subscribers SET delivery_hour=0").run(); // Make delivery eligible independent of the test runner clock.
const date=new Date().toISOString();
sql.prepare("INSERT INTO feed_items (url,title,summary,category,source,published_at,fetched_at) VALUES (?,?,?,?,?,?,?)").run("https://publisher.example.test/story","Source headline","A publisher excerpt","AI","Publisher",date,date);
sql.prepare("UPDATE subscribers SET delivery_hour=24").run();
result=await newsletter.deliverDigest();assert.equal(result.sent,0,"Later delivery preferences must not send early");
sql.prepare("UPDATE subscribers SET delivery_hour=0").run();
result=await newsletter.deliverDigest();assert.equal(result.sent,1);assert.equal(mail.length,2);
assert.equal(mail[1].reply_to,env.NEWSLETTER_CONTACT_EMAIL);
assert.ok(mail[1].html.includes('The 30-second edition'));assert.ok(mail[1].html.includes('One useful explanation'));assert.ok(mail[1].html.includes('role="presentation"'));
const preferenceRoute=load(path.join(root,"app/api/preferences/route.ts"));
const preferenceToken=await newsletter.preferencesToken(1,"reader@example.test");
assert.equal((await preferenceRoute.POST(request("/api/preferences",{token:preferenceToken,categories:["Tech"],deliveryHour:13}))).status,400);
assert.equal((await preferenceRoute.POST(request("/api/preferences",{token:"invalid",categories:["Tech"],deliveryHour:10}))).status,403);
assert.equal((await preferenceRoute.POST(request("/api/preferences",{token:preferenceToken,categories:["Tech"],deliveryHour:10}))).status,200);
assert.equal(sql.prepare("SELECT delivery_hour FROM subscribers WHERE id=1").get().delivery_hour,10);
sql.prepare("UPDATE subscribers SET delivery_hour=0").run();
assert.ok(mail[1].text.includes("https://publisher.example.test/story"));
assert.equal(mail[1].headers["List-Unsubscribe-Post"],"List-Unsubscribe=One-Click");
assert.equal(sql.prepare("SELECT status FROM newsletter_deliveries").get().status,"sent");
result=await newsletter.deliverDigest();assert.equal(result.sent,0);assert.equal(mail.length,2,"Same-day retry must not duplicate delivery");
const unsubscribe=new URL(mail[1].text.match(/Unsubscribe: (\S+)/)[1]).searchParams.get("token");
assert.equal((await leave.POST(request("/api/newsletter/unsubscribe",{token:unsubscribe}))).status,200);
assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM subscribers").get().n,0);
assert.equal((await leave.POST(request("/api/newsletter/unsubscribe",{token:unsubscribe}))).status,200,"Unsubscribe retry should succeed");
env.NEWSLETTER_ENABLED="false";assert.equal((await signup.POST(request("/api/subscribers",payload))).status,503);
sql.close();
console.log("PASS newsletter SQL flow: consent, origin, confirmation throttle, single-use confirmation, confirmed-only delivery, reply-to, daily deduplication and unsubscribe");
console.log("Email requests were mocked; no real messages were sent by these tests.");
