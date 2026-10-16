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
const desk = await load("../app/news-desk.tsx", {
  "./subscribe": {default: () => React.createElement("div", null, "Email setup")},
  "@/lib/reading-list": {READING_LIST_KEY: "test", readReadingList: () => []},
});
const live = [{id:1,url:"https://example.com/ai",title:"AI example",summary:"A publisher summary that has enough detail for further reading.",category:"AI",source:"Example",published_at:new Date().toISOString(),fetched_at:new Date().toISOString()},
  {id:2,url:"https://example.com/tech",title:"Tech example",summary:"Another summary of a useful technology story with source details.",category:"Tech",source:"Example",published_at:new Date().toISOString(),fetched_at:new Date().toISOString()}];
function render(initialCategory, initialQuery = "") {
  return renderToStaticMarkup(React.createElement(desk.default, {live,feedStatus:{checked_at:null,success_at:null,error:null},newsletterEnabled:false,initialCategory,initialQuery}));
}
const ai = render("AI");
assert.ok(ai.includes("AI example")); assert.ok(!ai.includes("Tech example"));
assert.ok(ai.includes('aria-label="Save story: AI example"')); assert.ok(ai.includes("AWAITING UPDATE"));
assert.ok(!render("All", "doesnotexist").includes("AI example"));
assert.ok(render("Saved").includes("Your reading list is empty"));
assert.ok(!render("Saved").includes("The deeper read"));
assert.ok(render("invalid").includes("The front page"));
console.log("PASS rendered categories, search, saved empty state and accessible save controls");

let refreshes = 0;
const mcp = await load("../app/mcp/route.ts", {
  "next/server": {NextResponse:{json:(body,options) => new Response(JSON.stringify(body), {status:options?.status||200,headers:{"Content-Type":"application/json"}})}},
  "@/lib/editor-auth": {identity:req => req.headers.has("oai-authenticated-user-id") ? {email:req.headers.get("oai-authenticated-user-email")} : null, isOriginalOwner: async email => email === "owner@example.test"},
  "@/lib/live-news": {refreshFeedsIfDue:async()=>{refreshes++;},liveNews:async()=>({items:live,status:{checked_at:"checked",success_at:"success",error:null}})},
  "@/lib/newsletter": {newsletterConfigured:()=>false,deliverDigest:()=>{throw new Error("Must not send during setup");}},
});
function request(method, headers = {}, params = {}) {
  return new Request("https://example.com/mcp", {method:"POST",headers:{"Content-Type":"application/json",...headers},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})});
}
assert.deepEqual((await (await mcp.POST(request("server/discover"))).json()).result.supportedVersions,["2026-07-28"]);
assert.equal((await (await mcp.POST(request("tools/list"))).json()).result.tools.length,2);
const params={name:"refresh_omnipulse_news"};
assert.equal((await mcp.POST(request("tools/call",{},params))).status,401);
assert.equal((await mcp.POST(request("tools/call",{"oai-authenticated-user-id":"wrong","oai-authenticated-user-email":"reader@example.test"},params))).status,403);
assert.equal(refreshes,0);
const owner={"oai-authenticated-user-id":"owner","oai-authenticated-user-email":"owner@example.test"};
assert.equal((await (await mcp.POST(request("tools/call",owner,params))).json()).result.structuredContent.recent_stories,2);
assert.equal(refreshes,1);
assert.equal((await mcp.POST(request("tools/call",owner,{name:"deliver_omnipulse_morning_digest"}))).status,503);
console.log("PASS MCP discovery, tool discovery, authorization and disabled delivery");
console.log("Interface checks passed (server rendering and stubbed services; not browser or provider integration tests).");
