import { env } from "cloudflare:workers";

export type Category = "AI" | "Tech" | "Markets";
export type Article = {
 id:number; slug:string; title:string; summary:string; body:string; category:Category;
 source_url:string; source_name:string; status:"draft"|"published";
 created_at:string; updated_at:string; published_at:string|null;
};
export const categories: Category[] = ["AI","Tech","Markets"];

export function database() {
 if (!env.DB) throw new Error("Newsroom storage is unavailable");
 return env.DB;
}

export async function listPublished(category?: Category, search?: string): Promise<Article[]> {
 const db=database();
 if (search) {
  const q=`%${search.replace(/[\\%_]/g,"")}%`;
  return (await db.prepare("SELECT * FROM articles WHERE status='published' AND (title LIKE ? OR summary LIKE ?) ORDER BY published_at DESC LIMIT 60").bind(q,q).all<Article>()).results;
 }
 if(category) return (await db.prepare("SELECT * FROM articles WHERE status='published' AND category=? ORDER BY published_at DESC LIMIT 60").bind(category).all<Article>()).results;
 return (await db.prepare("SELECT * FROM articles WHERE status='published' ORDER BY published_at DESC LIMIT 60").all<Article>()).results;
}
export async function getPublished(slug:string): Promise<Article|null> {
 return (await database().prepare("SELECT * FROM articles WHERE slug=? AND status='published'").bind(slug).first<Article>())??null;
}
export async function editorFor(userId:string):Promise<boolean> {
 const owner=await database().prepare("SELECT user_id FROM editors WHERE id=1").first<{user_id:string}>();
 return owner?.user_id===userId;
}
export function safeUrl(raw:string):string | null {
 try {const url=new URL(raw);return url.protocol==='https:'?url.href:null;}catch{return null;}
}
export function slugify(title:string) {
 return title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g,"").trim().replace(/\s+/g,"-").slice(0,80);
}
