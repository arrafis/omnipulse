import {database} from './content';
import {baseLessons} from './learning-base';
import {editionDay} from './edition-clock';
import {learningCategories,learningLevels,type Lesson,type Reference} from './learning-types';
export const researchHosts=['developers.google.com','ai.google.dev','research.google','arxiv.org','nist.gov','genai.owasp.org','owasp.org','developer.mozilla.org','w3.org','ietf.org','rfc-editor.org','postgresql.org','sre.google','docs.aws.amazon.com','learn.microsoft.com','openai.com','sec.gov','investor.gov','bankofcanada.ca','canada.ca','bankofcanadamuseum.ca','pages.stern.nyu.edu','people.stern.nyu.edu','optionseducation.org','bis.org','imf.org','worldbank.org','federalreserve.gov'];
export function approvedReference(value:unknown):value is Reference {
 if(!value||typeof value!=='object')return false;const r=value as Reference;
 if(typeof r.label!=='string'||r.label.length<3||r.label.length>140||typeof r.url!=='string'||r.url.length>1500)return false;
 try{const url=new URL(r.url);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&researchHosts.some(host=>url.hostname===host||url.hostname.endsWith('.'+host));}catch{return false;}
}
const text=(v:unknown,min:number,max:number)=>typeof v==='string'&&v.trim().length>=min&&v.length<=max&&!/[<>]/.test(v);
export function validateLesson(value:unknown):value is Lesson {
 if(!value||typeof value!=='object')return false;const l=value as Lesson;
 return typeof l.slug==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(l.slug)&&l.slug.length<=90&&text(l.title,8,130)&&learningCategories.includes(l.category)&&learningLevels.includes(l.level)&&
 text(l.definition,35,600)&&text(l.explanation,180,4500)&&text(l.example,60,1600)&&text(l.pitfall,35,900)&&text(l.question,15,500)&&text(l.answer,20,1200)&&text(l.reason,40,800)&&
 Array.isArray(l.prerequisites)&&l.prerequisites.length<=5&&l.prerequisites.every(x=>typeof x==='string'&&/^[a-z0-9-]+$/.test(x))&&Array.isArray(l.sources)&&l.sources.length>=2&&l.sources.length<=5&&l.sources.every(approvedReference)&&new Set(l.sources.map(x=>x.url)).size===l.sources.length;
}
export async function allLessons():Promise<Lesson[]> {
 const rows=(await database().prepare('SELECT content,created_at FROM learning_topics ORDER BY created_at DESC LIMIT 500').all<{content:string;created_at:string}>()).results;
 const dynamic=rows.flatMap(row=>{try{const lesson=JSON.parse(row.content);return validateLesson(lesson)?[{...lesson,added:row.created_at}]:[];}catch{return [];}});
 return [...baseLessons,...dynamic];
}
const concept=(title:string)=>title.toLowerCase().replace(/[^a-z0-9]/g,'');
export async function publishLesson(input:unknown){
 if(!validateLesson(input))return {published:false,error:'Provide a complete plain-text lesson with two distinct primary references, a novelty reason, example and self-check.'};
 const existing=await allLessons();
 if(existing.some(l=>l.slug===input.slug||concept(l.title)===concept(input.title)))return {published:false,error:'This topic already exists. Do not republish it under a new name.'};
 if(input.prerequisites.some(slug=>!existing.some(l=>l.slug===slug)))return {published:false,error:'A prerequisite does not exist.'};
 const lesson:Lesson={slug:input.slug,title:input.title,category:input.category,level:input.level,definition:input.definition,explanation:input.explanation,example:input.example,pitfall:input.pitfall,question:input.question,answer:input.answer,prerequisites:input.prerequisites,sources:input.sources,reason:input.reason};
 const now=new Date().toISOString();
 const result=await database().prepare('INSERT OR IGNORE INTO learning_topics (slug,concept_key,title,category,level,content,added_date,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(lesson.slug,concept(lesson.title),lesson.title,lesson.category,lesson.level,JSON.stringify(lesson),editionDay(new Date()),now).run();
 return {published:Boolean(result.meta.changes),url:'/learn/'+lesson.slug,...(!result.meta.changes?{error:'A topic or today’s addition already exists. At most one new lesson is published per Toronto date.'}:{})};
}
