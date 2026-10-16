import Link from "next/link";
import {notFound} from "next/navigation";
import {getPublished,safeUrl} from "@/lib/content";
export const dynamic="force-dynamic";
export default async function Story({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;if(!/^[a-z0-9-]{1,90}$/.test(slug))notFound();
 const article=await getPublished(slug);if(!article)notFound();
 const source=safeUrl(article.source_url);
 return <><div className="edition-bar"><Link href="/">OMNIPULSE</Link><span>{article.category.toUpperCase()} DESK</span></div><main className="article-wrap"><Link href="/" className="back-link">← Front page</Link><span className="kicker">{article.category} · Explainer</span><h1>{article.title}</h1><p className="standfirst">{article.summary}</p><p className="byline">OmniPulse desk · Published {new Date(article.published_at||article.created_at).toLocaleDateString("en-CA",{year:"numeric",month:"long",day:"numeric"})}</p><div className="article-body">{article.body.split(/\n\n+/).map((p,i)=><p key={i}>{p}</p>)}</div><div className="source-box"><strong>Primary source</strong>{source?<a href={source} target="_blank" rel="noopener noreferrer">{article.source_name} ↗</a>:<span>Source unavailable</span>}<p>The linked source supports the factual context. The explanation is OmniPulse writing.</p></div><Link href="/" className="back-link">← More stories</Link></main><footer className="site-footer"><span>© {new Date().getUTCFullYear()} OMNIPULSE</span><Link href="/privacy">Privacy</Link></footer></>;
}
