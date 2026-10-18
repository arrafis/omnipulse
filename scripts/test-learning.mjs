import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const sql=new DatabaseSync(':memory:');
for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())sql.exec(readFileSync(`drizzle/${name}`,'utf8'));
const stmt=(query,values=[])=>({bind:(...args)=>stmt(query,args),run:async()=>({meta:{changes:Number(sql.prepare(query).run(...values).changes)}}),first:async()=>sql.prepare(query).get(...values)||null,all:async()=>({results:sql.prepare(query).all(...values)})});
const db={prepare:stmt};const cache=new Map();
function load(name){if(cache.has(name))return cache.get(name);const exports={};cache.set(name,exports);const source=ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(source,{exports,require:name=>name==='./content'?{database:()=>db}:load(name.replace('./','')),Date,Intl,URL,console});return exports;}
const learning=load('learning'),base=load('learning-base').baseLessons,contexts=load('story-context');
assert.equal(base.length,101);assert.equal(new Set(base.map(l=>l.slug)).size,base.length);
for(const category of ['AI','Technology','Finance'])for(const level of ['Beginner','Intermediate','Advanced'])assert.ok(base.filter(l=>l.category===category&&l.level===level).length>=8);
for(const l of base){assert.ok(l.sources.every(learning.approvedReference));assert.ok(l.prerequisites.every(p=>base.some(x=>x.slug===p)));}
const coverage=load('course-coverage').courseCoverage;assert.equal(coverage.length,6);for(const course of coverage){assert.ok(course.topics.length>=10);for(const topic of course.topics)for(const slug of topic.slugs)assert.ok(base.some(l=>l.slug===slug),course.code+': missing '+slug);}
const visited=new Set(),visiting=new Set();
function walk(slug){assert.ok(!visiting.has(slug),'Prerequisite cycle at '+slug);if(visited.has(slug))return;visiting.add(slug);for(const p of base.find(l=>l.slug===slug).prerequisites)walk(p);visiting.delete(slug);visited.add(slug);}
for(const l of base){walk(l.slug);assert.ok(l.definition.length>=35&&l.explanation.length>=180&&l.example.length>=60&&l.question.length>=15&&l.answer.length>=20,'Incomplete lesson: '+l.slug);}
const candidate={...base[0],slug:'a-new-concept',title:'A researched new learning concept',explanation:[base[0].explanation,base[0].guide.why,...base[0].guide.terms.map(t=>t.join(': ')),...base[0].guide.steps.map(s=>s.join(': '))].join('\n\n'),example:[base[0].example,...base[0].guide.walkthrough].join('\n\n'),reason:'This concept fills a specific gap with a distinct learning objective and two primary references.',sources:[...base[0].sources,{label:'NIST AI framework',url:'https://www.nist.gov/itl/ai-risk-management-framework'}]};
assert.equal((await learning.publishLesson({...candidate,explanation:base[0].explanation,example:base[0].example})).published,false,'Short summaries must not pass the new publishing quality gate');
const guideKeys=Object.keys(load('learning-guides').lessonGuides);
for(const lesson of load('course-lessons').courseLessons)assert.ok(load('learning-types').lessonText(lesson).trim().split(/\s+/).length>=400,'Course lesson must teach in depth: '+lesson.slug);
assert.equal(guideKeys.length+load('course-lessons').courseLessons.length,base.length);
for(const lesson of base){const guide=lesson.guide;assert.ok(guide,'Missing teaching guide: '+lesson.slug);assert.ok(guide.terms.length>=2&&guide.steps.length>=2&&guide.walkthrough.length>=3);assert.ok(guide.practice.question!==lesson.question);assert.ok(guide.practice.answer.length>=80);}
assert.equal(learning.validateLesson({...candidate,sources:[{label:'Fake source',url:'javascript:alert(1)'}]}),false);
assert.equal(learning.validateLesson({...candidate,sources:[{label:'Fake source',url:'https://nist.gov.evil.test/a'},candidate.sources[0]]}),false);
assert.equal(learning.validateLesson({...candidate,explanation:'<script>alert(1)</script>'}),false);
assert.equal((await learning.publishLesson({...candidate,prerequisites:['does-not-exist']})).published,false);
assert.equal((await learning.publishLesson(candidate)).published,true);
assert.equal((await learning.allLessons()).length,base.length+1);
assert.equal((await learning.publishLesson(candidate)).published,false);
assert.equal((await learning.publishLesson({...candidate,slug:'another-concept',title:'Another distinct topic'})).published,false,'Only one addition per Toronto date');
const now=new Date().toISOString(),item={url:'https://openai.com/index/test-story',title:'A model announcement',summary:'A publisher summary',category:'AI',source:'OpenAI News',published_at:now,fetched_at:now,id:1};
sql.prepare('INSERT INTO feed_items (url,title,summary,category,source,published_at,fetched_at) VALUES (?,?,?,?,?,?,?)').run(item.url,item.title,item.summary,item.category,item.source,now,now);
const note={url:item.url,why:'This report describes a specific deployment pattern; its claims remain those of the publisher and require independent evaluation.',watch:'Watch for published evaluations and operational evidence.',sources:[{label:'Original source',url:item.url}]};
assert.equal((await contexts.publishStoryContext({...note,sources:[null]})).published,false);
assert.equal((await contexts.publishStoryContext({...note,url:'https://openai.com/missing'})).published,false);
assert.equal((await contexts.publishStoryContext({...note,sources:[{label:'Unsafe',url:'http://127.0.0.1'}]})).published,false);
assert.equal((await contexts.publishStoryContext(note)).published,true);
assert.equal((await contexts.storyContexts([item])).length,1);
assert.equal((await contexts.storyContexts([{...item,summary:'Publisher corrected the text'}])).length,0,'Changed source text invalidates older context');
const template=load('digest-template').renderDigest({stories:[item],contexts:[{...note,updated_at:now}],title:'Morning <test>',siteUrl:'https://example.test',preferences:'https://example.test/preferences',leave:'https://example.test/unsubscribe',address:'Test address',contact:'contact@example.test',focus:false});
assert.ok(template.html.includes('Why it matters'));assert.ok(template.html.includes('<title>Morning &lt;test&gt;</title>'));assert.equal((template.html.match(/<h1\b/g)||[]).length,1);assert.ok(template.plain.includes('Why it matters:'));
sql.close();console.log('PASS learning coverage, prerequisites, source validation, persistence, duplicate/day limits, context invalidation and accessible digest rendering.');
