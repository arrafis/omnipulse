import Link from 'next/link';
import {allLessons} from '@/lib/learning';
import {baseLessons} from '@/lib/learning-base';
import LearningCatalog from './learning-catalog';
export const dynamic='force-dynamic';
export const metadata={title:'Learn | AI, Technology & Finance'};
export default async function Learn(){
 let lessons=baseLessons,available=true;
 try{lessons=await allLessons();}catch{available=false;}
 return <><div className="edition-bar"><Link href="/">OMNIPULSE</Link><span>THE LEARNING LIBRARY</span></div><main className="learn-wrap" id="main-content"><nav className="learn-nav"><Link href="/">← Today’s edition</Link><Link href="/about">Sources & approach</Link></nav><header className="learn-hero"><span className="kicker">CURIOSITY, WITH A CLEAR PATH</span><h1>Understand a little.<br/><em>Then go deeper.</em></h1><p>AI, technology and finance, from first definitions to advanced ideas. Start where you are. Every lesson includes an example, a self-check and references.</p><span className="learn-meta">{lessons.length} lessons · 3 learning paths · Free to explore</span></header>{!available&&<p role="status" className="preferences-message">The foundation library is available. Recent additions are temporarily unavailable.</p>}<LearningCatalog lessons={lessons}/><aside className="learn-policy"><h2>A library that grows thoughtfully.</h2><p>During the morning review, we look for useful concepts missing from the library. A new lesson needs a distinct learning objective and primary references. Some days there is nothing to add. Lessons use AI-assisted writing; source links let you check the ideas and explore the full material.</p><p>Finance lessons explain concepts and illustrative calculations. They do not recommend investments or account for your individual circumstances. Progress is stored on this browser.</p></aside></main></>;
}
