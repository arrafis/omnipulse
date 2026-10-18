import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
async function load(path, stubs) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require: name => name in stubs ? stubs[name] : require(name), Response, Date, URL, console });
  return exports;
}
const briefingHelpers=await load("../lib/briefing.ts",{});
const readingHelpers=await load("../lib/reading-list.ts",{});
const learningTypes=await load('../lib/learning-types.ts',{});
const briefingComponent=await load("../app/briefing-experience.tsx",{"@/lib/briefing":briefingHelpers,"@/lib/reading-list":readingHelpers,"@/lib/learning-types":learningTypes});
const desk = await load("../app/news-desk.tsx", {
  "./briefing-experience": {default: () => React.createElement("section", null, "Your briefing")},
  "./subscribe": {default: () => React.createElement("div", null, "Email setup")},
  "@/lib/edition-clock": {editionDay:date=>date.toISOString().slice(0,10)},
  "@/lib/reading-list": {READING_LIST_KEY: "test", readReadingList: () => []},
});
const live = [{id:1,url:"https://example.com/ai",title:"AI example",summary:"A publisher summary that has enough detail for further reading.",category:"AI",source:"Example",published_at:new Date().toISOString(),fetched_at:new Date().toISOString()},
  {id:2,url:"https://example.com/tech",title:"Tech example",summary:"Another summary of a useful technology story with source details.",category:"Tech",source:"Example",published_at:new Date().toISOString(),fetched_at:new Date().toISOString()}];
function render(initialCategory, initialQuery = "") {
  return renderToStaticMarkup(React.createElement(desk.default, {live,feedStatus:{checked_at:null,success_at:null,error:null},newsletterEnabled:false,initialCategory,initialQuery}));
}
const ai = render("AI");
const medicalHtml=renderToStaticMarkup(React.createElement(desk.default,{live:[...live,{...live[0],id:3,url:'https://example.com/medical',title:'Medical example',category:'Medical'}],feedStatus:{checked_at:null,success_at:null,error:null},newsletterEnabled:false,initialCategory:'Medical',initialQuery:''}));
assert.ok(medicalHtml.includes('Medical example'));assert.ok(!medicalHtml.includes('AI example'));assert.ok(medicalHtml.includes('not diagnosis or treatment advice'));
assert.ok(ai.includes("AI example")); assert.ok(!ai.includes("Tech example"));
assert.ok(ai.includes('aria-label="Save story: AI example"')); assert.ok(ai.includes("AWAITING EDITION"));
assert.ok(!render("All", "doesnotexist").includes("AI example"));
assert.ok(render("Saved").includes("Your reading list is empty"));
assert.ok(!render("Saved").includes("The deeper read"));
assert.ok(render("invalid").includes("Today’s edition"));
console.log("PASS rendered categories, search, saved empty state and accessible save controls");

const briefingHtml=renderToStaticMarkup(React.createElement(briefingComponent.default,{items:live}));
assert.ok(briefingHtml.includes("Your briefing"));assert.ok(briefingHtml.includes("Since your last visit"));assert.ok(briefingHtml.includes("From the publisher"));assert.ok(briefingHtml.includes("Mark edition read"));assert.ok(briefingHtml.includes("Report an issue"));assert.ok(briefingHtml.includes("not story-specific analysis"));
console.log("PASS essential briefing rendering, source transparency and reading controls");
const expansion=await load('../lib/learning-expansion.ts',{});
const guides=await load('../lib/learning-guides.ts',{});
const courses=await load('../lib/course-lessons.ts',{});
const baseLessons=(await load('../lib/learning-base.ts',{'./learning-expansion':expansion,'./learning-guides':guides,'./course-lessons':courses})).baseLessons;
const catalog=await load('../app/learn/learning-catalog.tsx',{'@/lib/learning-types':learningTypes});
const catalogHtml=renderToStaticMarkup(React.createElement(catalog.default,{lessons:baseLessons}));
for(const level of ['Beginner','Intermediate','Advanced'])assert.ok(catalogHtml.includes(level));
assert.equal((catalogHtml.match(/class="lesson-card"/g)||[]).length,baseLessons.length);
assert.ok(catalogHtml.includes('/learn/transformer-attention'));assert.ok(catalogHtml.includes('Find a concept'));
console.log('PASS learning catalog renders all paths, depth levels, lesson routes and search controls');
const lessonPage=await load('../app/learn/[slug]/page.tsx',{
 'next/navigation':{notFound:()=>{throw new Error('Not found');}},
 '@/lib/learning':{allLessons:async()=>baseLessons},
 '@/lib/learning-base':{baseLessons},
 '@/lib/learning-types':learningTypes,
 '../lesson-progress':{default:()=>null}
});
for(const lesson of baseLessons){
 const html=renderToStaticMarkup(await lessonPage.default({params:Promise.resolve({slug:lesson.slug})}));
 for(const id of ['key-terms','explanation','worked-example','practice','references'])assert.ok(html.includes('id="'+id+'"'),lesson.slug+': missing '+id);
 assert.equal((html.match(/<details>/g)||[]).length,2,lesson.slug+': two practice answers');
 assert.ok(html.includes(lesson.guide.terms[0][0]));
}
console.log('PASS all lesson pages render teaching sections, glossary and both practice answers');
const coverage=await load('../lib/course-coverage.ts',{});
const paths=await load('../app/learn/study-paths/page.tsx',{'@/lib/learning-base':{baseLessons},'@/lib/course-coverage':coverage});
const pathsHtml=renderToStaticMarkup(React.createElement(paths.default));
for(const code of ['710','711','712','713','714','715'])assert.ok(pathsHtml.includes('MMGMT '+code));
assert.ok(pathsHtml.includes('/learn/optimization-chance-recourse'));assert.ok(pathsHtml.includes('not an official McMaster course'));

let refreshes = 0, sandboxCalls = 0;
const mcp = await load("../app/mcp/route.ts", {
  '@/lib/learning':{allLessons:async()=>[],publishLesson:async()=>({published:true}),researchHosts:[]},
  '@/lib/story-context':{storyContexts:async()=>[],publishStoryContext:async()=>({published:true})},
  '@/lib/briefing':briefingHelpers,
  "next/server": {NextResponse:{json:(body,options) => new Response(JSON.stringify(body), {status:options?.status||200,headers:{"Content-Type":"application/json"}})}},
  "@/lib/editor-auth": {identity:req => req.headers.has("oai-authenticated-user-id") ? {email:req.headers.get("oai-authenticated-user-email")} : null, isOriginalOwner: async email => email === "owner@example.test"},
  "@/lib/live-news": {refreshFeedsIfDue:async()=>{refreshes++;},liveNews:async()=>({items:live,status:{checked_at:"checked",success_at:"success",error:null}})},
  "@/lib/billing": {prepareSandboxCheckout:async()=>{sandboxCalls++;return {mode:"test",real_charges:false,checkout_url:"https://checkout.stripe.com/test"};}},
  "@/lib/newsletter": {newsletterConfigured:()=>false,deliverDigest:()=>{throw new Error("Must not send during setup");}},
});
function request(method, headers = {}, params = {}) {
  return new Request("https://example.com/mcp", {method:"POST",headers:{"Content-Type":"application/json",...headers},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})});
}
assert.deepEqual((await (await mcp.POST(request("server/discover"))).json()).result.supportedVersions,["2026-07-28"]);
assert.equal((await (await mcp.POST(request("tools/list"))).json()).result.tools.length,6);
const params={name:"refresh_omnipulse_news"};
assert.equal((await mcp.POST(request("tools/call",{},params))).status,401);
assert.equal((await mcp.POST(request("tools/call",{"oai-authenticated-user-id":"wrong","oai-authenticated-user-email":"reader@example.test"},params))).status,403);
assert.equal(refreshes,0);
for(const name of ['list_omnipulse_learning_topics','publish_omnipulse_learning_topic','publish_omnipulse_story_context']){
 assert.equal((await mcp.POST(request('tools/call',{}, {name}))).status,401);
 assert.equal((await mcp.POST(request('tools/call',{'oai-authenticated-user-id':'wrong','oai-authenticated-user-email':'reader@example.test'}, {name}))).status,403);
}
const owner={"oai-authenticated-user-id":"owner","oai-authenticated-user-email":"owner@example.test"};
assert.equal((await (await mcp.POST(request("tools/call",owner,params))).json()).result.structuredContent.recent_stories,2);
assert.equal(refreshes,1);
assert.equal((await mcp.POST(request("tools/call",owner,{name:"deliver_omnipulse_morning_digest"}))).status,503);
console.log("PASS MCP discovery, tool discovery, authorization and disabled delivery");
console.log("Interface checks passed (server rendering and stubbed services; not browser or provider integration tests).");

const testParams={name:"prepare_omnipulse_test_checkout"};
assert.equal((await mcp.POST(request("tools/call",{},testParams))).status,401);
assert.equal((await mcp.POST(request("tools/call",{"oai-authenticated-user-id":"wrong","oai-authenticated-user-email":"reader@example.test"},testParams))).status,403);
assert.equal(sandboxCalls,0);
assert.equal((await (await mcp.POST(request("tools/call",owner,testParams))).json()).result.structuredContent.real_charges,false);
assert.equal(sandboxCalls,1);
console.log("PASS sandbox checkout tool requires the original owner");
const serviceEnv={STRIPE_TEST_CHECKOUT_TOKEN:'test-only-'.repeat(8)};
let serviceCalls=0;
let serviceMode=true;
const testCheckout=await load('../app/api/premium/test-checkout/route.ts',{
 'cloudflare:workers':{env:serviceEnv},
 'next/server':{NextResponse:{json:(body,options)=>new Response(JSON.stringify(body),{status:options?.status||200})}},
 '@/lib/billing':{billingTestMode:()=>serviceMode,prepareSandboxCheckout:async()=>{serviceCalls++;return {mode:'test',real_charges:false};}},
});
const serviceRequest=token=>new Request('https://example.test/api/premium/test-checkout',{method:'POST',headers:token?{authorization:`Bearer ${token}`}:{}});
assert.equal((await testCheckout.POST(serviceRequest())).status,403);
assert.equal((await testCheckout.POST(serviceRequest('wrong'))).status,403);
assert.equal(serviceCalls,0);
assert.equal((await testCheckout.POST(serviceRequest(serviceEnv.STRIPE_TEST_CHECKOUT_TOKEN))).status,200);
serviceMode=false;
assert.equal((await testCheckout.POST(serviceRequest(serviceEnv.STRIPE_TEST_CHECKOUT_TOKEN))).status,403);
assert.equal(serviceCalls,1);
console.log('PASS sandbox service endpoint rejects anonymous requests and live mode');
