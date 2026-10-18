import {notFound} from 'next/navigation';
import {allLessons} from '@/lib/learning';
import {baseLessons} from '@/lib/learning-base';
import {readingMinutes,lessonText} from '@/lib/learning-types';
import LessonProgress from '../lesson-progress';
export const dynamic='force-dynamic';
const paragraphs=(text:string)=>text.split(/\n\s*\n/).filter(Boolean).map((p,i)=><p key={i}>{p}</p>);
export default async function LessonPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;let lessons=baseLessons;
 try{lessons=await allLessons();}catch{}
 const lesson=lessons.find(l=>l.slug===slug);if(!lesson)notFound();
 const guide=lesson.guide;
 const next=lessons.find(l=>l.prerequisites.includes(slug))||lessons.find(l=>l.category===lesson.category&&l.slug!==slug&&!lesson.prerequisites.includes(l.slug));
 return <><div className="edition-bar"><a href="/">OMNIPULSE</a><span>LEARN / {lesson.category.toUpperCase()}</span></div>
 <main className="article-wrap lesson-page" id="main-content"><a href="/learn" className="back-link">← Learning library</a><span className="kicker">{lesson.category} / {lesson.level}</span>
 <h1>{lesson.title}</h1><p className="standfirst">{lesson.definition}</p>
 <p className="byline">About {readingMinutes(lessonText(lesson))} min to read · Take extra time for practice · AI-assisted learning notes · {lesson.added?'Added '+new Date(lesson.added).toLocaleDateString('en-CA',{timeZone:'America/Toronto'}):'Expanded October 17, 2026'}</p>
 {guide&&<aside className="lesson-goal"><span className="kicker">WHAT YOU WILL LEARN</span><p>{guide.why}</p><span>Read → follow the example → try it yourself</span></aside>}
 {lesson.prerequisites.length>0&&<aside className="lesson-prerequisites"><strong>Helpful first</strong>{lesson.prerequisites.map(p=><a href={'/learn/'+p} key={p}>{lessons.find(l=>l.slug===p)?.title||p} ↗</a>)}</aside>}
 <nav className="lesson-contents" aria-label="In this lesson">{guide&&<a href="#key-terms">Key terms</a>}<a href="#explanation">Explanation</a><a href="#worked-example">Worked example</a><a href="#practice">Practice</a><a href="#references">References</a></nav>
 <div className="article-body">
 {guide&&<section id="key-terms" className="lesson-terms"><h2>First, the key terms.</h2><dl>{guide.terms.map(([term,meaning])=><div key={term}><dt>{term}</dt><dd>{meaning}</dd></div>)}</dl></section>}
 <section id="explanation"><h2>The idea, explained</h2>{paragraphs(lesson.explanation)}
 {guide&&<div className="lesson-steps">{guide.steps.map(([title,body],i)=><section key={title}><span className="kicker">STEP {i+1}</span><h3>{title}</h3>{paragraphs(body)}</section>)}</div>}</section>
 <section id="worked-example" className="lesson-example"><h2>Follow a worked example.</h2>{paragraphs(lesson.example)}
 {guide&&<><h3>Walk it through, one step at a time</h3><ol>{guide.walkthrough.map(step=><li key={step}>{step}</li>)}</ol></>}</section>
 <section><h2>Where people get stuck</h2>{paragraphs(lesson.pitfall)}</section>
 <section id="practice" className="lesson-check"><h2>Now try it yourself.</h2><p className="learn-meta">Pause before opening each answer. Explain your reasoning in your own words.</p>
 <h3>1. Check the core idea</h3><p>{lesson.question}</p><details><summary>Reveal the answer & reasoning</summary>{paragraphs(lesson.answer)}</details>
 {guide&&<><h3>2. Apply what you learned</h3><p>{guide.practice.question}</p><details><summary>Reveal the answer & reasoning</summary>{paragraphs(guide.practice.answer)}</details></>}</section>
 {guide&&<aside className="lesson-recap"><h2>Before you move on</h2><p>Can you explain this without looking?</p><p>{guide.why}</p><p>If not, revisit the walkthrough or open a “Helpful first” lesson. You do not need to memorize the wording.</p></aside>}
 {lesson.reason&&<><h2>Why this was added</h2><p>{lesson.reason}</p></>}</div>
 <section id="references" className="source-box"><strong>References & further study</strong>{lesson.sources.map(s=><a href={s.url} key={s.url} target="_blank" rel="noopener noreferrer">{s.label} ↗</a>)}<p>Original explanatory notes and hypothetical examples. Calculations simplify real-world details to teach the concept. References support further study. {lesson.category==='Finance'?'Educational material, not personalized financial advice.':''}</p></section>
 <LessonProgress slug={lesson.slug}/>{next&&<a className="lesson-next" href={'/learn/'+next.slug}><span>KEEP EXPLORING</span><strong>{next.title} →</strong></a>}
 <a className="report-link" href={'mailto:sifatharrafi@gmail.com?subject='+encodeURIComponent('Learning correction: '+lesson.title)}>Something still unclear? Tell us what needs a better explanation</a></main></>;
}
